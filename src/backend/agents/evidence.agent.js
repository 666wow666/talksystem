/**
 * 证据抽取 Agent
 * 从谈话记录中抽取证据
 */
const { AIServiceFactory } = require('../services/aiServiceFactory');
const { getEvidencePrompt } = require('../prompts/evidence.prompt');

class EvidenceAgent {
  /**
   * 抽取证据
   * @param {object} student - 学生信息
   * @param {Array} conversations - 谈话记录列表
   * @returns {object} { evidence_items: [] }
   */
  async extract(student, conversations) {
    const aiService = AIServiceFactory.getService();

    // 构建输入
    let conversationText = '';
    for (const conv of conversations) {
      conversationText += `【谈话ID】${conv.id || 'unknown'}\n`;
      conversationText += `【日期】${conv.date || 'unknown'}\n`;
      conversationText += `【内容】\n${conv.content || conv.transcript || ''}\n\n`;
    }

    const input = `学生信息：
姓名：${student.name || '未知'}
学号：${student.studentId || '未知'}

谈话记录：
${conversationText}`;

    const prompt = getEvidencePrompt();

    const result = await aiService.executeRequest([
      { role: 'system', content: prompt },
      { role: 'user', content: input }
    ], 0.3, 2);

    // 解析 JSON 结果
    const parsed = this.parseJsonResult(result);
    return parsed || { evidence_items: [] };
  }

  /**
   * 解析 AI 返回的 JSON
   */
  parseJsonResult(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return null;
    }

    const text = rawText.trim();

    // 尝试代码块
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {}
    }

    // 尝试直接解析
    try {
      return JSON.parse(text);
    } catch (e) {}

    // 寻找 { ... } 区间
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (e) {}
    }

    return null;
  }
}

module.exports = { EvidenceAgent };
