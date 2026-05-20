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
  const currentModel = modelSelector.getCurrentModel();
  const models = [];
  
  if (config.glm.apiKey) models.push({ name: 'glm', displayName: '智谱GLM', configured: true, current: currentModel === 'glm' });
  else models.push({ name: 'glm', displayName: '智谱GLM', configured: false, current: false });
  
  if (config.deepseek.apiKey) models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: true, current: currentModel === 'deepseek' });
  else models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: false, current: false });
  
  if (config.doubao.apiKey) models.push({ name: 'doubao', displayName: '豆包', configured: true, current: currentModel === 'doubao' });
  else models.push({ name: 'doubao', displayName: '豆包', configured: false, current: false });
  
  if (config.kimi.apiKey) models.push({ name: 'kimi', displayName: 'Kimi', configured: true, current: currentModel === 'kimi' });
  else models.push({ name: 'kimi', displayName: 'Kimi', configured: false, current: false });
  
  if (config.qianwen.apiKey) models.push({ name: 'qianwen', displayName: '千问', configured: true, current: currentModel === 'qianwen' });
  else models.push({ name: 'qianwen', displayName: '千问', configured: false, current: false });
  
  if (config.ernie.apiKey && config.ernie.secretKey) models.push({ name: 'ernie', displayName: '文心一言', configured: true, current: currentModel === 'ernie' });
  else models.push({ name: 'ernie', displayName: '文心一言', configured: false, current: false });
  
  if (config.nvidia.apiKey) models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: true, current: currentModel === 'nvidia' });
  else models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: false, current: false });
  
  res.json({
    currentModel: currentModel,
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
    qianwen: '千问',
    ernie: '文心一言',
    nvidia: 'NVIDIA'
  };
  
  if (config.enableTerminalSelection) {
    console.log('📋 终端模型选择已启用\n');
    await modelSelector.promptForSelection();
  } else {
    console.log('📋 终端模型选择已禁用，直接使用默认模型\n');
  }
  
  const currentModel = modelSelector.getCurrentModel();
  
  console.log(`\n🚀 服务器运行在 http://localhost:${port}`);
  console.log(`🤖 当前AI模型: ${modelNames[currentModel] || currentModel}`);
  console.log('');
  
  app.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  CloudPolice 服务已启动');
    console.log('═══════════════════════════════════════════════════════════\n');
  });
}

startServer().catch(console.error);