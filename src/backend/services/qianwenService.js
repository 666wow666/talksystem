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

    // 禁用思考过程以加快响应速度
    const enableThinking = false;

    console.log('[千问] 请求详情:');
    console.log('[千问]   模型:', model);
    console.log('[千问]   Temperature:', temperature);
    console.log('[千问]   EnableThinking:', enableThinking);
    console.log('[千问]   Messages数量:', messages.length);
    
    // 打印 system prompt 长度
    if (messages[0] && messages[0].role === 'system') {
      console.log('[千问]   SystemPrompt长度:', messages[0].content.length);
    }
    
    // 打印 user prompt 长度
    const userMsg = messages.find(m => m.role === 'user');
    if (userMsg) {
      console.log('[千问]   UserPrompt长度:', userMsg.content.length);
      console.log('[千问]   UserPrompt预览:', userMsg.content.substring(0, 100) + '...');
    }

    const requestBody = {
      model: model,
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: 8192,
      stream: false,
      enable_thinking: enableThinking
    };
    
    console.log('[千问] 开始发送请求到 API...');
    const startTime = Date.now();
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseTime = Date.now() - startTime;
    console.log('[千问] API响应时间:', responseTime + 'ms');
    console.log('[千问] API响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[千问] API错误:', response.status, errorText);
      throw new Error(`千问 API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[千问] 响应数据keys:', Object.keys(data));

    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    let content = data.choices?.[0]?.message?.content || '';
    console.log('[千问] 返回内容长度:', content.length);

    // 如果有思考过程，提取最终回复（去掉思考部分）
    if (data.choices?.[0]?.message?.reasoning_content) {
      const reasoningContent = data.choices[0].message.reasoning_content;
      console.log('[千问] 思考过程长度:', reasoningContent.length);
      console.log('[千问] 思考过程 (已忽略):', reasoningContent.substring(0, 200) + '...');
    }

    return content;
  }
}

const qianwenService = new QianwenService();

module.exports = { QianwenService, qianwenService };