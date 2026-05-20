class BaseAIService {
  constructor() {
    this.workflow1Buffer = '';
    this.workflow1Resolvers = [];
    this.isProcessingWorkflow1 = false;
  }

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

  async workflow2(text, basicInfo) {
    const prompt = this.buildWorkflow2Prompt(text, basicInfo);

    const result = await this.executeRequest([
      { role: 'system', content: this.getWorkflow2Prompt() },
      { role: 'user', content: prompt }
    ], 0.5);

    return result;
  }

  getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `${year}年${month}月${day}日${hour}时`;
  }

  getWorkflow1Prompt() {
    return `你是一名专业的审讯员。请根据输入的对话片段，并联系之前的对话片段，站在询问人员的角度，生成推荐追问问题。
    区分面对的对象是证人还是嫌疑人，该信息在用户发送的"基本信息"下的与案件关系部分，针对不同的对象采取相对应的询问方法。

【输出格式】
严格按以下JSON格式输出，不要输出任何其他内容：
{"q1":"问题1内容","s1":分数1,"q2":"问题2内容","s2":分数2,"q3":"问题3内容","s3":分数3,"q4":"问题4内容","s4":分数4,"q5":"问题5内容","s5":分数5}

【规则】
1. 问题要具体、尖锐、简洁、可直接使用
2. 围绕模糊、矛盾、回避，信息缺失等地方提问
3. 每个问题必须对应一个分数（0-100的整数），该分数由分析案件经过后得出，分数越高表示越重要
4. 最多5个问题，不够5个时用空字符串""补齐`;
  }

  getWorkflow2Prompt() {
    return `你是一名专业的公安笔录记录员。请根据提供的基本信息和录音内容，生成规范的讯问笔录。
    【规则】
    1.不得扭曲、篡改、编造内容，若有无法理解的部分以【】标注该部分的头尾
    2.输出格式严格按照以下要求
    3.'_'符号部分不填写原样输出
    【输出格式要求】
严格按照以下格式输出，不要添加任何额外内容：

讯问时间：${this.getCurrentTime()}
时间____年___月___日___时___分至____年___月___日___时___分
地点
询问/讯问人（签名_______________工作单位
被询问/讯问人____________性别     年龄     出生日期
身份证件种类及号码                          □是□否人大代表
现住址                                    联系方式
户籍所在地
（口头传唤∕被扭送∕自动投案的被询问/讯问人____月___日___时__分到达，___ 月___日___时  分离开，本人签名___________）。
问：
答：`;
  }

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

  async executeRequest(messages, temperature) {
    throw new Error('executeRequest 方法必须在子类中实现');
  }

  getModelName() {
    throw new Error('getModelName 方法必须在子类中实现');
  }
}

module.exports = { BaseAIService };