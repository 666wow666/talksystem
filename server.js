require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { config, printConfigValidation } = require('./src/backend/config');
const chatRouter = require('./src/backend/routes/chat');
const healthRouter = require('./src/backend/routes/health');
const { modelSelector } = require('./src/backend/services/modelSelector');

const app = express();
const port = config.port;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.redirect('/auth.html');
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/chat') || 
      req.path.startsWith('/health') ||
      req.path.includes('.')) {
    return next();
  }

  const clientIP = req.headers['x-forwarded-for'] || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress || 
                  'unknown';
  const path = req.path.replace(/^\//, '') || 'main.html';

  const authed = req.query.authed === '1' || req.cookies?.authed === '1';
  const basicInfoFilled = req.query.filled === '1' || req.cookies?.basicInfoFilled === '1';

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (path === 'main.html' || path === '') {
    if (!authed || !basicInfoFilled) {
      console.log(`[页面访问] ${clientIP} 尝试直接访问首页，重定向到 auth.html`);
      return res.redirect('/auth.html');
    }
  }

  if (path === 'data-collect.html') {
    if (!authed) {
      console.log(`[页面访问] ${clientIP} 尝试直接访问信息采集页，重定向到 auth.html`);
      return res.redirect('/auth.html');
    }
  }

  next();
});

app.use('/chat', chatRouter);
app.use('/health', healthRouter);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  const storedHash = process.env.AUTH_PASSWORD_HASH;

  if (!storedHash) {
    return res.status(500).json({ success: false, error: '认证配置未设置' });
  }

  const inputHash = sha256(password);

  if (inputHash === storedHash) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: '密码错误' });
  }
});

app.get('/api/config', (req, res) => {
  console.log('[调试] XFYUN_APPID:', process.env.XFYUN_APPID);
  console.log('[调试] XFYUN_API_KEY:', process.env.XFYUN_API_KEY);
  console.log('[调试] 完整 process.env:', Object.keys(process.env).filter(k => k.includes('XF')));
  
  res.json({
    xfyunAppId: process.env.XFYUN_APPID || '',
    xfyunApiKey: process.env.XFYUN_API_KEY || ''
  });
});

app.get('/api/models', (req, res) => {
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  const models = [];
  
  if (config.glm.apiKey) models.push({ name: 'glm', displayName: '智谱GLM', configured: true, current: workflow1Model === 'glm' });
  else models.push({ name: 'glm', displayName: '智谱GLM', configured: false, current: false });
  
  if (config.deepseek.apiKey) models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: true, current: workflow1Model === 'deepseek' });
  else models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: false, current: false });
  
  if (config.doubao.apiKey) models.push({ name: 'doubao', displayName: '豆包', configured: true, current: workflow1Model === 'doubao' });
  else models.push({ name: 'doubao', displayName: '豆包', configured: false, current: false });
  
  if (config.kimi.apiKey) models.push({ name: 'kimi', displayName: 'Kimi', configured: true, current: workflow1Model === 'kimi' });
  else models.push({ name: 'kimi', displayName: 'Kimi', configured: false, current: false });
  
  if (config.qianwen.apiKey) models.push({ name: 'qianwen', displayName: '千问', configured: true, current: workflow1Model === 'qianwen' });
  else models.push({ name: 'qianwen', displayName: '千问', configured: false, current: false });
  
  if (config.ernie.apiKey && config.ernie.secretKey) models.push({ name: 'ernie', displayName: '文心一言', configured: true, current: workflow1Model === 'ernie' });
  else models.push({ name: 'ernie', displayName: '文心一言', configured: false, current: false });
  
  if (config.nvidia.apiKey) models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: true, current: workflow1Model === 'nvidia' });
  else models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: false, current: false });
  
  res.json({
    workflow1Model: workflow1Model,
    workflow2Model: workflow2Model,
    currentModel: workflow1Model,
    models: models
  });
});

async function startServer() {
  console.log('\n正在初始化 CloudPolice...\n');
  printConfigValidation();
  
  const modelNames = {
    glm: '智谱GLM',
    deepseek: 'DeepSeek',
    doubao: '豆包',
    kimi: 'Kimi',
    ernie: '文心一言',
    nvidia: 'NVIDIA',
    qianwen: '千问'
  };
  
  if (config.enableTerminalSelection) {
    console.log('📋 终端模型选择已启用\n');
    await modelSelector.promptForSelection();
  } else {
    console.log('📋 终端模型选择已禁用，直接使用默认模型\n');
  }
  
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  
  function getModelVersion(modelName, workflowNum) {
    const modelConfig = config[modelName];
    if (!modelConfig) return '';
    if (workflowNum === 1 && modelConfig.workflow1Model) {
      return ` (${modelConfig.workflow1Model})`;
    } else if (workflowNum === 2 && modelConfig.workflow2Model) {
      return ` (${modelConfig.workflow2Model})`;
    } else if (modelConfig.model) {
      return ` (${modelConfig.model})`;
    }
    return '';
  }
  
  console.log(`\n🚀 服务器运行在 http://localhost:${port}`);
  console.log(`🤖 工作流1（推荐问题）模型: ${modelNames[workflow1Model] || workflow1Model}${getModelVersion(workflow1Model, 1)}`);
  console.log(`🤖 工作流2（笔录生成）模型: ${modelNames[workflow2Model] || workflow2Model}${getModelVersion(workflow2Model, 2)}`);
  console.log('');
  
  app.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  CloudPolice 服务已启动');
    console.log('═══════════════════════════════════════════════════════════\n');
  });
}

startServer().catch(console.error);