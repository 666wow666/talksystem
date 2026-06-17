/**
 * 画像生成 Agent
 * 根据分数和证据生成学生画像
 */
const { AIServiceFactory } = require('../services/aiServiceFactory');
const { getProfilePrompt } = require('../prompts/profile.prompt');

class ProfileAgent {
  /**
   * 生成画像
   * @param {object} student - 学生信息
   * @param {object} dimensionScores - 五维分数
   * @param {Array} itemScores - 各项评分
   * @param {Array} evidenceItems - 证据列表
   * @returns {object} 画像结果
   */
  async generate(student, dimensionScores, itemScores, evidenceItems) {
    const aiService = AIServiceFactory.getService();

    // 构建维度分数文本
    let dimensionText = '';
    for (const [key, data] of Object.entries(dimensionScores)) {
      dimensionText += `${data.name}：${data.score}分（${data.total}/${data.maxTotal}）\n`;
    }

    // 构建证据文本
    let evidenceText = '';
    for (const ev of evidenceItems) {
      evidenceText += `【${ev.evidence_key}】${ev.dimension_name} - ${ev.evidence_summary}\n`;
      evidenceText += `原文："${ev.quote}"\n\n`;
    }

    // 构建评分文本
    let scoreText = '';
    for (const score of itemScores) {
      scoreText += `${score.dimension_name}-${score.item_name}：${score.score}分\n`;
      scoreText += `理由：${score.score_reason}\n\n`;
    }

    const input = `学生信息：
姓名：${student.name || '未知'}
学号：${student.studentId || '未知'}

五维分数：
${dimensionText}

各项评分：
${scoreText}

证据列表：
${evidenceText || '（无证据）'}

请根据以上信息生成学生画像。`;

    const prompt = getProfilePrompt();

    const result = await aiService.executeRequest([
      { role: 'system', content: prompt },
      { role: 'user', content: input }
    ], 0.5, 2);

    // 解析 JSON 结果
    const parsed = this.parseJsonResult(result);
    return parsed || {
      profile_summary: '画像生成失败',
      dimension_comments: [],
      risk_flags: [],
      follow_up_suggestions: []
    };
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

module.exports = { ProfileAgent };
