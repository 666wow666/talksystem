const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class DoubaoService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.doubao.baseURL || 'https://ark.cn-beijing.volces.com/api/v3';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.doubao.apiKey;
    }
    return this.apiKey;
  }

  getModel() {
    if (!this.model) {
      this.model = config.doubao.model || 'doubao-pro-32k';
    }
    return this.model;
  }

  getModelName() {
    return 'doubao';
  }

  async executeRequest(messages, temperature) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      throw new Error('DOUBAO_API_KEY 未配置，请检查 .env 文件');
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
      throw new Error(`豆包 API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.choices?.[0]?.message?.content || '';
  }
}

const doubaoService = new DoubaoService();

module.exports = { DoubaoService, doubaoService };