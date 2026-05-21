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
    this.workflow1Model = null;
    this.workflow2Model = null;
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

      // 选择工作流1的模型
      const question1 = `  请选择工作流1（推荐问题）模型 [1-${this.configuredModels.length}] (默认: ${defaultModelName}): `;
      
      rl.question(question1, (answer1) => {
        let selectedIndex1 = defaultIndex >= 0 ? defaultIndex : 0;
        if (answer1.trim() !== '') {
          const num = parseInt(answer1.trim());
          if (!isNaN(num) && num >= 1 && num <= this.configuredModels.length) {
            selectedIndex1 = num - 1;
          }
        }
        const selected1 = this.configuredModels[selectedIndex1];
        this.workflow1Model = selected1.id;
        console.log(`  ✓ 工作流1已选择: ${selected1.name}`);
        console.log('');

        // 选择工作流2的模型
        const question2 = `  请选择工作流2（笔录生成）模型 [1-${this.configuredModels.length}] (默认: ${defaultModelName}): `;
        
        rl.question(question2, (answer2) => {
          rl.close();
          
          let selectedIndex2 = defaultIndex >= 0 ? defaultIndex : 0;
          if (answer2.trim() !== '') {
            const num = parseInt(answer2.trim());
            if (!isNaN(num) && num >= 1 && num <= this.configuredModels.length) {
              selectedIndex2 = num - 1;
            }
          }
          
          const selected2 = this.configuredModels[selectedIndex2];
          this.workflow2Model = selected2.id;
          
          console.log('');
          console.log(`  ✓ 工作流1: ${selected1.name}`);
          console.log(`  ✓ 工作流2: ${selected2.name}`);
          console.log('');
          
          resolve({ workflow1: selected1.id, workflow2: selected2.id });
        });
      });
    });
  }

  getModelForWorkflow(workflowNum) {
    if (workflowNum === 1) {
      if (this.workflow1Model) {
        return this.workflow1Model;
      }
      return config.workflow1Model || config.defaultModel || 'glm';
    } else if (workflowNum === 2) {
      if (this.workflow2Model) {
        return this.workflow2Model;
      }
      return config.workflow2Model || config.defaultModel || 'glm';
    }
    return config.defaultModel || 'glm';
  }

  getCurrentModel() {
    return this.getModelForWorkflow(1);
  }
}

const modelSelector = new ModelSelector();

module.exports = { ModelSelector, modelSelector };