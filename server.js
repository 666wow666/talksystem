/**
 * 后端Express服务器主文件
 * 初始化Express应用，配置中间件，注册路由，启动HTTP服务
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { config, printConfigValidation } = require('./src/backend/config');
const chatRouter = require('./src/backend/routes/chat');
const healthRouter = require('./src/backend/routes/health');

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

app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  const authPassword = process.env.AUTH_PASSWORD;

  if (password === authPassword) {
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

app.listen(port, () => {
  console.log(`\n🚀 服务器运行在 http://localhost:${port}`);
  console.log(`📡 API Endpoint: ${config.glm.baseURL}`);
  console.log(`🤖 AI模型: ${config.glm.model}`);
  printConfigValidation();
});
