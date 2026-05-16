/**
 * 健康检查路由模块
 * 提供服务状态查询接口，用于监控AI服务配置是否正确
 */

const express = require('express');
const { config } = require('../config');

const router = express.Router();

/**
 * GET /health
 * 检查服务运行状态和AI配置是否正确
 * @returns {Object} - 服务状态信息，包含认证方式和端点配置
 */
router.get('/', (req, res) => {
  const isValidKey = config.glm.apiKey && config.glm.apiKey.length > 0;
  
  if (isValidKey) {
    res.json({
      status: 'ok',
      provider: 'GLM',
      endpoint: config.glm.baseURL,
      model: config.glm.model,
      workflows: {
        1: config.glm.apiKey ? 'configured' : 'not configured',
        2: config.glm.apiKey ? 'configured' : 'not configured'
      }
    });
  } else {
    res.status(500).json({
      status: 'error',
      error: '智谱AI密钥未配置'
    });
  }
});

module.exports = router;
