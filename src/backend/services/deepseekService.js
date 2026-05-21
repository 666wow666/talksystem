const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class DeepSeekService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.deepseek.baseURL || 'https://api.deepseek.com/v1';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.deepseek.apiKey;
    }
    return this.apiKey;
  }

  getModel(workflowNum = null) {
    if (workflowNum === 1) {
      return config.deepseek.workflow1Model || config.deepseek.model || 'deepseek-chat';
    } else if (workflowNum === 2) {
      return config.deepseek.workflow2Model || config.deepseek.model || 'deepseek-chat';
    }
    return config.deepseek.model || 'deepseek-chat';
  }

  getModelName() {
    return 'deepseek';
  }

  async executeRequest(messages, temperature, workflowNum = null) {
    const apiKey = this.getApiKey();
    const model = this.getModel(workflowNum);

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置，请检查 .env 文件');
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
      throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.choices?.[0]?.message?.content || '';
  }
}

const deepseekService = new DeepSeekService();

module.exports = { DeepSeekService, deepseekService };