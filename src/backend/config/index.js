/**
 * 后端配置管理模块
 * 集中管理所有环境变量和配置项，提供配置校验功能
 */

/**
 * 应用配置对象
 * 包含服务端口和AI服务相关配置
 */
const config = {
  port: process.env.PORT || 5000,
  
  glm: {
    apiKey: process.env.GLM_API_KEY,
    baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-4-flash'
  },
  
  xfyun: {
    appId: process.env.XFYUN_APPID,
    apiKey: process.env.XFYUN_API_KEY
  },
  
  auth: {
    password: process.env.AUTH_PASSWORD
  }
};

/**
 * 校验配置项的有效性
 * 检查必需的配置项是否已正确设置
 * @returns {Object} - 返回错误列表和警告列表
 */
function validateConfig() {
  const errors = [];
  const warnings = [];
  
  if (!config.glm.apiKey) {
    errors.push('❌ 缺少 GLM_API_KEY 环境变量（智谱AI密钥）');
  }
  
  if (!config.xfyun.appId) {
    warnings.push('⚠️  缺少 XFYUN_APPID 环境变量（讯飞应用ID）');
  }
  
  if (!config.xfyun.apiKey) {
    warnings.push('⚠️  缺少 XFYUN_API_KEY 环境变量（讯飞API密钥）');
  }
  
  if (!config.auth.password) {
    warnings.push('⚠️  缺少 AUTH_PASSWORD 环境变量（认证密码）');
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ 所有配置项校验通过');
  }
  
  return { errors, warnings };
}

/**
 * 打印配置校验结果
 * 在控制台输出配置错误和警告信息
 */
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
