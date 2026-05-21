const { BaseAIService } = require('./baseAIService');
const { config } = require('../config');

class QianwenService extends BaseAIService {
  constructor() {
    super();
    this.baseURL = config.qianwen.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.qianwen.apiKey;
    }
    return this.apiKey;
  }

  getModel(workflowNum = null) {
    if (workflowNum === 1) {
      return config.qianwen.workflow1Model || config.qianwen.model || 'qwen3.5-32b';
    } else if (workflowNum === 2) {
      return config.qianwen.workflow2Model || config.qianwen.model || 'qwen3.5-32b';
    }
    return config.qianwen.model || 'qwen3.5-32b';
  }

  getModelName() {
    return 'qianwen';
  }

  async executeRequest(messages, temperature, workflowNum = null) {
    const apiKey = this.getApiKey();
    const model = this.getModel(workflowNum);

    if (!apiKey) {
      throw new Error('QIANWEN_API_KEY 未配置，请检查 .env 文件');
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
        max_tokens: 8192,
        stream: false,
        thinking: {
          type: 'enabled',
          budget_tokens: 4000
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`千问 API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    let content = data.choices?.[0]?.message?.content || '';

    // 如果有思考过程，提取最终回复（去掉思考部分）
    if (data.choices?.[0]?.message?.reasoning_content) {
      const reasoningContent = data.choices[0].message.reasoning_content;
      console.log('[千问] 思考过程 (已忽略):', reasoningContent.substring(0, 200) + '...');
    }

    return content;
  }
}

const qianwenService = new QianwenService();

module.exports = { QianwenService, qianwenService };