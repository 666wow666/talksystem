/**
 * 智谱AI大语言模型服务模块
 * 负责与智谱GLM-4模型交互，实现审讯追问建议生成和笔录自动生成功能
 */

const { config } = require('../config');

/**
 * GLM服务类
 * 封装与智谱AI的通信逻辑，提供工作流1（追问生成）和工作流2（笔录生成）功能
 */
class GLMService {
  constructor() {
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4';
    this.workflow1Buffer = '';
    this.workflow1Resolvers = [];
    this.isProcessingWorkflow1 = false;
  }

  /**
   * 获取API密钥（延迟获取，确保环境变量已加载）
   */
  getApiKey() {
    if (!this.apiKey) {
      this.apiKey = config.glm.apiKey;
    }
    return this.apiKey;
  }

  /**
   * 获取当前使用的模型名称
   */
  getModel() {
    if (!this.model) {
      this.model = config.glm.model || 'glm-4.7-flash';
    }
    return this.model;
  }

  /**
   * 处理工作流1的缓冲区内容
   * 将累积的多条输入消息合并后统一发送给AI处理
   * 采用Promise队列机制确保并发请求按顺序处理
   */
  async processWorkflow1Buffer() {
    if (this.isProcessingWorkflow1 || this.workflow1Buffer.trim() === '') {
      return;
    }

    this.isProcessingWorkflow1 = true;
    const bufferedContent = this.workflow1Buffer;
    this.workflow1Buffer = '';

    try {
      const result = await this.executeRequest([
        { role: 'system', content: this.getWorkflow1Prompt() },
        { role: 'user', content: bufferedContent }
      ], 0.7);

      this.workflow1Resolvers.forEach(item => item.resolve(result));
    } catch (error) {
      this.workflow1Resolvers.forEach(item => item.reject(error));
    } finally {
      this.workflow1Resolvers = [];
      this.isProcessingWorkflow1 = false;

      if (this.workflow1Buffer.trim() !== '') {
        this.processWorkflow1Buffer();
      }
    }
  }

  /**
   * 工作流1：智能追问生成
   * 根据审讯内容生成推荐追问问题，帮助审讯人员获取关键信息
   * @param {string} message - 用户输入的审讯描述
   * @returns {Promise<string>} - 返回AI生成的追问建议JSON字符串
   */
  async workflow1(message) {
    this.workflow1Buffer = (this.workflow1Buffer ? this.workflow1Buffer + '\n' : '') + message;

    if (this.isProcessingWorkflow1) {
      return new Promise((resolve, reject) => {
        this.workflow1Resolvers.push({ resolve, reject });
      });
    }

    return new Promise((resolve, reject) => {
      this.workflow1Resolvers.push({ resolve, reject });
      this.processWorkflow1Buffer();
    });
  }

  /**
   * 工作流2：讯问笔录生成
   * 根据基本信息表和审讯录音内容生成规范的讯问笔录
   * @param {string} text - 审讯录音转录的文本内容
   * @param {Object} basicInfo - 被询问人的基本信息对象
   * @returns {Promise<string>} - 返回生成的笔录文本
   */
  async workflow2(text, basicInfo) {
    const prompt = this.buildWorkflow2Prompt(text, basicInfo);

    const result = await this.executeRequest([
      { role: 'system', content: this.getWorkflow2Prompt() },
      { role: 'user', content: prompt }
    ], 0.2);

    return result;
  }

  /**
   * 获取当前时间并格式化为中文日期时间格式
   * 用于讯问笔录的时间字段
   * @returns {string} - 格式化的日期时间字符串，如"2024年01月15日14时"
   */
  getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `${year}年${month}月${day}日${hour}时`;
  }

  /**
   * 获取工作流1的系统提示词
   * 定义AI作为专业审讯员的角色和输出格式要求
   * @returns {string} - 系统提示词内容
   */
  getWorkflow1Prompt() {
    return `你是一名专业的审讯员。请根据输入，站在询问人员的角度，生成推荐追问问题。

【输出格式】
严格按以下JSON格式输出，不要输出任何其他内容：
{"q1":"问题1内容","s1":分数1,"q2":"问题2内容","s2":分数2,"q3":"问题3内容","s3":分数3,"q4":"问题4内容","s4":分数4,"q5":"问题5内容","s5":分数5}

【规则】
1. 问题要具体、尖锐、可直接使用
2. 围绕模糊、矛盾、回避，信息缺失等地方提问
3. 每个问题必须对应一个分数（0-100的整数），分数越高表示越重要
4. 最多5个问题，不够5个时用空字符串""补齐
5. 不要输出markdown代码块，不要有多余解释`;
  }

  /**
   * 获取工作流2的系统提示词
   * 定义AI作为公安警务辅助人员的角色和笔录格式规范
   * @returns {string} - 系统提示词内容
   */
  getWorkflow2Prompt() {
    return `你是一名经验丰富的公安警务辅助人员。请根据提供的基本信息和录音内容，生成规范的讯问笔录。

【输出格式要求】
严格按照以下格式输出，不要添加任何额外内容：

讯问时间：${this.getCurrentTime()}
询问人：XXX
被讯问人基本情况：
姓名：XXX，身份证号：XXX，住址：XXX，职业：XXX，政治面貌：XXX，联系电话：XXX
答：XXX

【规则】
1. 使用"答："开头记录被讯问人的回答内容
2. 如果没有相关信息，使用"-"代替
3. 不要使用markdown格式，纯文本输出
4. 保持格式整洁，不要有多余空行`;
  }

  /**
   * 构建工作流2的提示词
   * 将基本信息表和录音内容整合成AI可处理的完整提示词
   * @param {string} text - 审讯录音转录文本
   * @param {Object} basicInfo - 被询问人基本信息
   * @returns {string} - 整合后的提示词
   */
  buildWorkflow2Prompt(text, basicInfo) {
    let prompt = '【基本信息】\n';
    prompt += '询问人：' + (basicInfo?.inquirerName || '-') + '\n';
    prompt += '被询问人姓名：' + (basicInfo?.respondentName || '-') + '\n';
    prompt += '身份证号：' + (basicInfo?.idCard || '-') + '\n';
    prompt += '住址：' + (basicInfo?.address || '-') + '\n';
    prompt += '联系方式：' + (basicInfo?.phone || '-') + '\n';
    prompt += '职业：' + (basicInfo?.occupation || '-') + '\n';
    prompt += '政治面貌：' + (basicInfo?.politicalStatus || '-') + '\n';
    prompt += '与案件关系：' + (basicInfo?.caseRelation || '-') + '\n\n';
    prompt += '【录音内容】\n' + text;
    return prompt;
  }

  /**
   * 执行与GLM API的HTTP请求
   * 使用fetch API发送POST请求到智谱AI接口
   * @param {Array} messages - 消息数组，包含system和user消息
   * @param {number} temperature - 温度参数，控制输出的随机性
   * @returns {Promise<string>} - 返回AI生成的文本内容
   * @throws {Error} - API请求失败时抛出错误
   */
  async executeRequest(messages, temperature) {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    
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
