/**
 * 评分 Agent
 * 根据证据对25项问题评分
 */
const { AIServiceFactory } = require('../services/aiServiceFactory');
const { getScoringPrompt } = require('../prompts/scoring.prompt');

class ScoringAgent {
  /**
   * 评分
   * @param {object} assessmentConfig - 评估配置
   * @param {Array} evidenceItems - 证据列表
   * @returns {object} { item_scores: [] }
   */
  async score(assessmentConfig, evidenceItems) {
    const aiService = AIServiceFactory.getService();

    // 构建证据文本
    let evidenceText = '';
    for (const ev of evidenceItems) {
      evidenceText += `【${ev.evidence_key}】${ev.dimension_name} - ${ev.evidence_summary}\n`;
      evidenceText += `原文："${ev.quote}"\n`;
      evidenceText += `极性：${ev.evidence_polarity}\n\n`;
    }

    if (evidenceItems.length === 0) {
      evidenceText = '（无证据）';
    }

    const input = `证据列表：
${evidenceText}

请对以上证据进行评分。`;

    const prompt = getScoringPrompt(assessmentConfig);

    const result = await aiService.executeRequest([
      { role: 'system', content: prompt },
      { role: 'user', content: input }
    ], 0.3, 2);

    // 解析 JSON 结果
    const parsed = this.parseJsonResult(result);
    return parsed || { item_scores: [] };
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

module.exports = { ScoringAgent };
