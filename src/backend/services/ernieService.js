const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class ErnieService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.ernie.baseURL || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.ernie.apiKey;
    }
    return this.apiKey;
  }

  getSecretKey() {
    if (!this.secretKey) {
      this.secretKey = config.ernie.secretKey;
    }
    return this.secretKey;
  }

  getModel(workflowNum = null) {
    if (workflowNum === 1) {
      return config.ernie.workflow1Model || config.ernie.model || 'ernie-4.0-turbo';
    } else if (workflowNum === 2) {
      return config.ernie.workflow2Model || config.ernie.model || 'ernie-4.0-turbo';
    }
    return config.ernie.model || 'ernie-4.0-turbo';
  }

  getModelName() {
    return 'ernie';
  }

  async getAccessToken() {
    if (this.accessToken && this.accessTokenExpireTime > Date.now()) {
      return this.accessToken;
    }

    const apiKey = this.getApiKey();
    const secretKey = this.getSecretKey();

    const response = await fetch('https://aip.baidubce.com/oauth/2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`文心一言 获取AccessToken错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.accessTokenExpireTime = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  async executeRequest(messages, temperature, workflowNum = null) {
    const apiKey = this.getApiKey();
    const secretKey = this.getSecretKey();

    if (!apiKey || !secretKey) {
      throw new Error('ERNIE_API_KEY 或 ERNIE_SECRET_KEY 未配置，请检查 .env 文件');
    }

    const accessToken = await this.getAccessToken();
    const model = this.getModel(workflowNum);

    const response = await fetch(`${this.baseURL}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`文心一言 API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(data.error_msg || `文心一言错误: ${data.error_code}`);
    }

    return data.result || '';
  }
}

const ernieService = new ErnieService();

module.exports = { ErnieService, ernieService };