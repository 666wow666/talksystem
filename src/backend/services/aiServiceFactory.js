const { glmService } = require('./glmService');
const { deepseekService } = require('./deepseekService');
const { doubaoService } = require('./doubaoService');
const { kimiService } = require('./kimiService');
const { qianwenService } = require('./qianwenService');
const { ernieService } = require('./ernieService');
const { nvidiaService } = require('./nvidiaService');
const { config } = require('../config');

const SERVICE_MAP = {
  glm: glmService,
  deepseek: deepseekService,
  doubao: doubaoService,
  kimi: kimiService,
  qianwen: qianwenService,
  ernie: ernieService,
  nvidia: nvidiaService
};

class AIServiceFactory {
  static getService(modelName = null) {
    const selectedModel = modelName || config.defaultModel || 'glm';
    
    const service = SERVICE_MAP[selectedModel.toLowerCase()];
    
    if (!service) {
      throw new Error(`不支持的AI模型: ${selectedModel}。支持的模型: ${Object.keys(SERVICE_MAP).join(', ')}`);
    }
    
    return service;
  }

  static getAvailableModels() {
    return Object.keys(SERVICE_MAP);
  }

  static getDefaultModel() {
    return config.defaultModel || 'glm';
  }
}

module.exports = { AIServiceFactory, SERVICE_MAP };