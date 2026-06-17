/**
 * 谈心谈话 AI 服务基类
 *
 * 工作流设计：
 *   - workflow1：实时访谈引导智能体
 *     根据实时语音转写文本，判断谈话方向，输出老师下一句应该问的开放式问题
 *     返回：{ content: string, tag: '学业情况' | '人际关系' | '心理状态' | '生活状况' | '个人规划' }
 *
 *   - workflow2：角色分离智能体
 *     根据完整谈话内容，为每一段发言标注身份（老师/学生），
 *     在每条发言前添加 "老师：" 或 "学生：" 前缀
 *     返回：string（已添加身份标注的完整文本）
 *
 * 具体模型（GLM/DeepSeek/豆包 等）继承本类，
 * 实现 executeRequest() 调用对应平台的大模型 API。
 */

class BaseAIService {
    constructor() {
        // workflow1 请求合并：将短时间内的多条转写合并为一次 AI 调用
        this.workflow1Buffer = '';
        this.workflow1Resolvers = [];
        this.isProcessingWorkflow1 = false;
    }

    // ========== workflow1：实时访谈引导智能体 ==========

    /**
     * 入口方法：外部传入一段文本，返回 { content, tag }
     * 内部做请求合并，避免高频调用导致 AI 服务压力。
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

    async processWorkflow1Buffer() {
        if (this.isProcessingWorkflow1 || this.workflow1Buffer.trim() === '') {
            return;
        }

        this.isProcessingWorkflow1 = true;
        const bufferedContent = this.workflow1Buffer;
        this.workflow1Buffer = '';

        try {
            const rawResult = await this.executeRequest([
                { role: 'system', content: this.getWorkflow1Prompt() },
                {
                    role: 'user',
                    content: '以下是实时语音转写文本，请给出老师下一句提问：\n\n' + bufferedContent
                }
            ], 0.3, 1);

            const parsed = this.extractJsonFromResult(rawResult);
            const normalized = this.normalizeWorkflow1Result(parsed);

            this.workflow1Resolvers.forEach(item => item.resolve(normalized));
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
     * workflow1 的 System Prompt
     * 学校谈心谈话实时引导智能体
     */
    getWorkflow1Prompt() {
        return `你是"学校谈心谈话实时引导智能体"。

你的任务是：
根据未分角色、未断句的实时语音转写文本，帮助老师判断下一步应该问什么问题，并确定谈话方向。

【输入】
实时ASR文本流（可能不完整）

【输出 JSON（必须严格）】

{
  "content": "一句老师可以直接说的追问",
  "tag": "学业情况 | 人际关系 | 心理状态 | 生活状况 | 个人规划",
  "reason": "提出这个问题的原因，说明为什么要问这个问题"
}

【规则】

1. 只输出一个问题
2. 不做心理诊断
3. reason 要简洁说明提问原因，帮助老师理解为什么问这个问题
4. 必须自然像老师说话
5. 必须是开放式问题
6. 输入可能不完整，要自行理解语义
7. tag必须严格五选一
8. 如果不确定 → 选"心理状态"

【标签定义】

学业情况：学习、考试、成绩、升学
人际关系：同学、朋友、冲突
心理状态：情绪、压力、焦虑
生活状况：家庭、作息、健康
个人规划：未来目标、发展方向`;
    }

    /**
     * 从 AI 返回的原始文本中提取 JSON 对象
     * 兼容：代码块、带额外说明、嵌套引号等情况
     */
    extractJsonFromResult(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return null;
        }

        const text = rawText.trim();

        // 1. 尝试 ```json ... ``` 代码块
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch) {
            try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) {}
        }

        // 2. 尝试全文直接 JSON
        try { return JSON.parse(text); } catch (e) {}

        // 3. 寻找第一个 { 到最后一个 } 之间的内容
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            try { return JSON.parse(jsonStr); } catch (e) {}
        }

        // 4. 寻找 "content": "..." 等关键字段
        const contentMatch = text.match(/"content"\s*:\s*"([^"]*)"/);
        const tagMatch = text.match(/"tag"\s*:\s*"([^"]*)"/);
        const reasonMatch = text.match(/"reason"\s*:\s*"([^"]*)"/);
        if (contentMatch && tagMatch) {
            return {
                content: contentMatch[1],
                tag: tagMatch[1],
                reason: reasonMatch ? reasonMatch[1] : ''
            };
        }

        return null;
    }

    /**
     * 规范化 workflow1 返回结果
     * 确保 content、tag 和 reason 合法，有兜底策略
     */
    normalizeWorkflow1Result(obj) {
        const VALID_TAGS = ['学业情况', '人际关系', '心理状态', '生活状况', '个人规划'];
        const FALLBACK_QUESTION = '最近有没有什么事情让你感觉压力比较大？';
        const DEFAULT_TAG = '心理状态';
        const FALLBACK_REASON = '根据谈话内容，进一步了解学生情况';

        if (!obj || typeof obj !== 'object') {
            return { content: FALLBACK_QUESTION, tag: DEFAULT_TAG, reason: FALLBACK_REASON };
        }

        let content = obj.content;
        let tag = obj.tag;
        let reason = obj.reason;

        if (!content || typeof content !== 'string' || !content.trim()) {
            content = FALLBACK_QUESTION;
        } else {
            content = content.trim();
        }

        if (!tag || typeof tag !== 'string' || VALID_TAGS.indexOf(tag.trim()) === -1) {
            tag = DEFAULT_TAG;
        } else {
            tag = tag.trim();
        }

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            reason = FALLBACK_REASON;
        } else {
            reason = reason.trim();
        }

        return { content: content, tag: tag, reason: reason };
    }

    // ========== workflow2：角色分离智能体 ==========

    async workflow2(text, basicInfo) {
        console.log('[BaseAIService] workflow2 调用开始');
        console.log('[BaseAIService] 输入文本长度:', text ? text.length : 0);
        console.log('[BaseAIService] basicInfo:', JSON.stringify(basicInfo));
        
        const prompt = this.buildWorkflow2Prompt(text, basicInfo);
        console.log('[BaseAIService] 构建的prompt长度:', prompt.length);
        console.log('[BaseAIService] prompt预览:', prompt.substring(0, 200) + '...');

        const systemPrompt = this.getWorkflow2Prompt();
        console.log('[BaseAIService] SystemPrompt长度:', systemPrompt.length);

        console.log('[BaseAIService] 开始调用executeRequest...');
        const startTime = Date.now();
        
        const result = await this.executeRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], 0.5, 2);

        const duration = Date.now() - startTime;
        console.log('[BaseAIService] executeRequest完成，耗时:', duration + 'ms');
        console.log('[BaseAIService] 返回结果长度:', result ? result.length : 0);

        return result;
    }

    /**
     * workflow2 的 System Prompt
     * 教育场景对话分析助手（无警情、无刑侦术语）
     */
    getWorkflow2Prompt() {
        return `你是教育场景对话分析助手，请对下方师生谈话内容进行发言身份识别与拆分。

识别规则

    老师特征：主导对话、发起询问状况类提问、给出指导 / 评价 / 建议、引导表达、使用教育类话术。
    学生特征：回答问题、讲述个人情况、表达想法 / 感受、配合引导发言、发起征求建议类提问。
    严格依据上下文语义、对话逻辑、问答关系推断身份，原文无标注需自主判断。
    硬性要求：完整保留原文文字、不增删、不修改语义、不调整发言顺序、只做文字的梳理和添加发言人前缀。
    无法判定发言身份时，统一标记为【身份待确认】。

输出格式
老师：
学生：`;
    }

    /**
     * 构造 workflow2 的 user prompt
     * 注意：这里不再包含 "警情" 等刑侦术语，改为教育场景字段。
     */
    buildWorkflow2Prompt(text, basicInfo) {
        let prompt = '【基本信息】\n';
        const info = basicInfo || {};
        prompt += '谈话人：' + (info.interviewer || (info.inquirerName ? info.inquirerName : '-')) + '\n';
        prompt += '学生姓名：' + (info.studentName || (info.respondentName ? info.respondentName : '-')) + '\n';
        if (info.studentId) prompt += '学号：' + info.studentId + '\n';
        if (info.studentInfo) {
            const si = info.studentInfo;
            if (si.class) prompt += '班级：' + si.class + '\n';
            if (si.college) prompt += '学院：' + si.college + '\n';
            if (si.grade) prompt += '年级：' + si.grade + '\n';
        }
        if (info.conversationTypeLabel) {
            prompt += '谈话类型：' + info.conversationTypeLabel + '\n';
        }
        prompt += '\n【录音内容】\n' + (text || '');
        return prompt;
    }

    // ========== 需子类实现的方法 ==========

    /**
     * 调用具体平台的 AI API
     * messages: [{ role: 'system'|'user', content: string }, ...]
     * temperature: 0~1
     * workflowNum: 1 或 2（用于选择不同模型配置）
     * 返回：string（AI 返回的原始文本）
     */
    async executeRequest(messages, temperature, workflowNum) {
        throw new Error('executeRequest 方法必须在子类中实现');
    }

    getModelName() {
        throw new Error('getModelName 方法必须在子类中实现');
    }
}

module.exports = { BaseAIService };
