const config = {
  port: process.env.PORT || 5000,
  
  defaultModel: process.env.DEFAULT_MODEL || 'qianwen',

  // 是否启用终端模型选择
  // true: 启动时在终端选择模型
  // false: 直接使用默认模型
  enableTerminalSelection: process.env.ENABLE_TERMINAL_SELECTION === 'true',

  glm: {
    apiKey: process.env.GLM_API_KEY,
    baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-4-flash'
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },

  doubao: {
    apiKey: process.env.DOUBAO_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    model: process.env.DOUBAO_MODEL || 'doubao-pro-32k'
  },

  kimi: {
    apiKey: process.env.KIMI_API_KEY,
    baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.KIMI_MODEL || 'moonshot-v1-8k'
  },

  qianwen: {
    apiKey: process.env.QIANWEN_API_KEY,
    baseURL: process.env.QIANWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.QIANWEN_MODEL || 'qwen3.5-32b'
  },

  ernie: {
    apiKey: process.env.ERNIE_API_KEY,
    secretKey: process.env.ERNIE_SECRET_KEY,
    baseURL: process.env.ERNIE_BASE_URL || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    model: process.env.ERNIE_MODEL || 'ernie-4.0-turbo'
  },

  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-flash'
  },

  xfyun: {
    appId: process.env.XFYUN_APPID,
    apiKey: process.env.XFYUN_API_KEY
  },

  auth: {
    password: process.env.AUTH_PASSWORD
  }
};

function validateConfig() {
  const errors = [];
  const warnings = [];
  
  const configuredModels = [];
  if (config.glm.apiKey) configuredModels.push('GLM');
  if (config.deepseek.apiKey) configuredModels.push('DeepSeek');
  if (config.doubao.apiKey) configuredModels.push('豆包');
  if (config.kimi.apiKey) configuredModels.push('Kimi');
  if (config.qianwen.apiKey) configuredModels.push('千问');
  if (config.ernie.apiKey && config.ernie.secretKey) configuredModels.push('文心一言');
  if (config.nvidia.apiKey) configuredModels.push('NVIDIA');

  if (configuredModels.length === 0) {
    errors.push('❌ 未配置任何AI模型API密钥，请至少配置一个模型');
  } else {
    console.log(`✓ 已配置的AI模型: ${configuredModels.join(', ')}`);
  }

  if (!config.xfyun.appId) {
    warnings.push('⚠️  缺少 XFYUN_APPID 环境变量（讯飞应用ID）');
  }
  
  if (!config.xfyun.apiKey) {
    warnings.push('⚠️  缺少 XFYUN_API_KEY 环境变量（讯飞API密钥）');
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ 所有配置项校验通过');
  }
  
  return { errors, warnings };
}

function printConfigValidation() {
  const { errors, warnings } = validateConfig();
  
  if (errors.length > 0) {
    console.warn('\n=== 配置错误 ===');
    errors.forEach(e => console.warn(e));
    console.warn('================\n');
  }
  
  if (warnings.length > 0) {
    console.warn('\n=== 配置警告 ===');
    warnings.forEach(w => console.warn(w));
    console.warn('================\n');
  }
  
  if (errors.length === 0) {
    console.log('✓ 所有配置项校验通过');
  }
}

module.exports = {
  config,
  validateConfig,
  printConfigValidation
};