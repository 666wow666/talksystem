const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class GLMService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.glm.baseURL || 'https://open.bigmodel.cn/api/paas/v4';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.glm.apiKey;
    }
    return this.apiKey;
  }

  getModel(workflowNum = null) {
    if (workflowNum === 1) {
      return config.glm.workflow1Model || config.glm.model || 'glm-4-flash';
    } else if (workflowNum === 2) {
      return config.glm.workflow2Model || config.glm.model || 'glm-4-flash';
    }
    return config.glm.model || 'glm-4-flash';
  }

  getModelName() {
    return 'glm';
  }

  async executeRequest(messages, temperature, workflowNum = null) {
    const apiKey = this.getApiKey();
    const model = this.getModel(workflowNum);

    if (!apiKey) {
      throw new Error('GLM_API_KEY 未配置，请检查 .env 文件');
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.choices?.[0]?.message?.content || '';
  }
}

const glmService = new GLMService();

module.exports = { GLMService, glmService };