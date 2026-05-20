const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class KimiService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.kimi.baseURL || 'https://api.moonshot.cn/v1';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.kimi.apiKey;
    }
    return this.apiKey;
  }

  getModel() {
    if (!this.model) {
      this.model = config.kimi.model || 'moonshot-v1-8k';
    }
    return this.model;
  }

  getModelName() {
    return 'kimi';
  }

  async executeRequest(messages, temperature) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      throw new Error('KIMI_API_KEY 未配置，请检查 .env 文件');
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
      throw new Error(`Kimi API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.choices?.[0]?.message?.content || '';
  }
}

const kimiService = new KimiService();

module.exports = { KimiService, kimiService };