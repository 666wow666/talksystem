const readline = require('readline');
const { config } = require('../config');

const MODEL_DISPLAY_NAMES = {
  glm: '智谱GLM',
  deepseek: 'DeepSeek',
  doubao: '豆包',
  kimi: 'Kimi',
  qianwen: '千问',
  ernie: '文心一言',
  nvidia: 'NVIDIA'
};

class ModelSelector {
  constructor() {
    this.currentModel = null;
    this.configuredModels = this.getConfiguredModels();
  }

  getConfiguredModels() {
    const models = [];
    
    if (config.glm.apiKey) {
      models.push({
        id: 'glm',
        name: MODEL_DISPLAY_NAMES.glm,
        configured: true
      });
    }
    
    if (config.deepseek.apiKey) {
      models.push({
        id: 'deepseek',
        name: MODEL_DISPLAY_NAMES.deepseek,
        configured: true
      });
    }
    
    if (config.doubao.apiKey) {
      models.push({
        id: 'doubao',
        name: MODEL_DISPLAY_NAMES.doubao,
        configured: true
      });
    }
    
    if (config.kimi.apiKey) {
      models.push({
        id: 'kimi',
        name: MODEL_DISPLAY_NAMES.kimi,
        configured: true
      });
    }
    
    if (config.qianwen.apiKey) {
      models.push({
        id: 'qianwen',
        name: MODEL_DISPLAY_NAMES.qianwen,
        configured: true
      });
    }
    
    if (config.ernie.apiKey && config.ernie.secretKey) {
      models.push({
        id: 'ernie',
        name: MODEL_DISPLAY_NAMES.ernie,
        configured: true
      });
    }
    
    if (config.nvidia.apiKey) {
      models.push({
        id: 'nvidia',
        name: MODEL_DISPLAY_NAMES.nvidia,
        configured: true
      });
    }
    
    return models;
  }

  async promptForSelection() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      if (this.configuredModels.length === 0) {
        console.log('\n  ❌ 未检测到任何已配置的AI模型！');
        console.log('  请在 .env 文件中配置至少一个模型的 API Key。\n');
        rl.close();
        resolve(null);
        return;
      }

      const defaultModel = config.defaultModel || 'glm';
      const defaultIndex = this.configuredModels.findIndex(m => m.id === defaultModel);
      const defaultNum = defaultIndex >= 0 ? defaultIndex + 1 : 1;
      const defaultModelName = this.configuredModels[defaultNum - 1]?.name || '未知';

      console.log('');
      console.log('  ┌─────────────────────────────────────────┐');
      console.log('  │          CloudPolice AI 服务            │');
      console.log('  ├─────────────────────────────────────────┤');
      
      this.configuredModels.forEach((model, index) => {
        const num = index + 1;
        const isDefault = num === defaultNum;
        const marker = isDefault ? '★' : ' ';
        console.log(`  │  ${num}. ${marker} ${model.name}`);
      });
      
      console.log('  └─────────────────────────────────────────┘');
      console.log('');

      const question = `  请选择模型 [1-${this.configuredModels.length}] (默认: ${defaultModelName}): `;
      
      rl.question(question, (answer) => {
        rl.close();
        
        const trimmed = answer.trim();
        
        let selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
        
        if (trimmed !== '') {
          const num = parseInt(trimmed);
          if (!isNaN(num) && num >= 1 && num <= this.configuredModels.length) {
            selectedIndex = num - 1;
          }
        }
        
        const selected = this.configuredModels[selectedIndex];
        this.currentModel = selected.id;
        
        console.log('');
        console.log(`  ✓ 已选择: ${selected.name}`);
        console.log('');
        
        resolve(selected.id);
      });
    });
  }

  getCurrentModel() {
    if (this.currentModel) {
      return this.currentModel;
    }
    return config.defaultModel || 'glm';
  }
}

const modelSelector = new ModelSelector();

module.exports = { ModelSelector, modelSelector };