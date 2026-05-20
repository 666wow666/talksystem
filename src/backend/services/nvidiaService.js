const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class NvidiaService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.nvidia.baseURL || 'https://integrate.api.nvidia.com/v1';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.nvidia.apiKey;
    }
    return this.apiKey;
  }

  getModel() {
    if (!this.model) {
      this.model = config.nvidia.model || 'deepseek-ai/deepseek-v4-flash';
    }
    return this.model;
  }

  getModelName() {
    return 'nvidia';
  }

  async executeRequest(messages, temperature) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY 未配置，请检查 .env 文件');
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
        temperature: temperature || 0.7,
        max_tokens: 16384,
        top_p: 0.95,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.choices?.[0]?.message?.content || '';
  }
}

const nvidiaService = new NvidiaService();

module.exports = { NvidiaService, nvidiaService };