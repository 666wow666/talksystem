/**
 * 评分 Prompt
 */
function getScoringPrompt(assessmentConfig) {
  const dimensions = assessmentConfig.dimensions;

  let itemList = '';
  dimensions.forEach(dim => {
    dim.items.forEach(item => {
      itemList += `- ${item.key}: ${dim.name}-${item.name}\n`;
    });
  });

  return `你是学生画像评分智能体。

任务：根据证据对assessment_config中的所有问题评分。

评分规则：
20 = 明确正向（有明确证据支持正面表现）
15 = 偏正向（有证据支持正面表现，但不够明确）
10 = 无证据或中性（无相关证据，或证据不明确）
5 = 偏负向（有证据支持负面表现，但不够严重）
0 = 严重负向（有明确证据支持严重负面表现）

评分要求：
1. 所有题目必须评分（25道题）
2. 无证据统一10分
3. 必须说明评分理由（score_reason）
4. 每条评分必须关联证据（evidence_keys）
5. 优先采用最近日期的证据
6. 输出严格JSON，不允许输出解释文字

评估维度：
${itemList}

输出格式：
{
  "item_scores": [
    {
      "item_key": "题目key",
      "dimension_key": "维度key",
      "dimension_name": "维度名称",
      "item_name": "题目名称",
      "score": 分数,
      "score_reason": "评分理由",
      "evidence_keys": ["E001", "E002"]
    }
  ]
}`;
}

module.exports = { getScoringPrompt };
