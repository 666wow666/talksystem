/**
 * 评分聚合服务
 * 纯 TypeScript 实现（这里是 JavaScript），不使用大模型
 * 负责汇总五维分数
 */
class ScoreAggregatorService {
  /**
   * 计算五维分数
   * @param {Array} itemScores - 各题目评分
   * @param {object} assessmentConfig - 评估配置
   * @returns {object} { dimension_scores: {}, radar_chart_data: [] }
   */
  aggregateScores(itemScores, assessmentConfig) {
    const dimensionScores = {};
    const radarChartData = [];

    // 固定顺序
    const dimensionOrder = [
      'academic_status',
      'interpersonal_relationship',
      'mental_state',
      'life_status',
      'career_planning'
    ];

    // 按维度分组计算
    const dimensionMap = {};
    for (const dim of assessmentConfig.dimensions) {
      dimensionMap[dim.key] = {
        name: dim.name,
        items: dim.items.map(i => i.key),
        score: 0,
        count: 0
      };
    }

    // 累加每个维度的分数
    for (const score of itemScores) {
      if (dimensionMap[score.dimension_key]) {
        dimensionMap[score.dimension_key].score += score.score;
        dimensionMap[score.dimension_key].count++;
      }
    }

    // 计算每个维度的平均分（转换为百分制，方便理解）
    for (const dimKey of dimensionOrder) {
      const dim = dimensionMap[dimKey];
      if (dim && dim.count > 0) {
        const avgScore = dim.score / dim.count;
        dimensionScores[dimKey] = {
          score: Math.round(avgScore * 10) / 10, // 保留1位小数
          name: dim.name,
          // 保留原始总分（5题满分100）
          total: dim.score,
          maxTotal: dim.count * 20
        };
        // 雷达图使用平均分（0-20转换为0-100）
        radarChartData.push(Math.round((avgScore / 20) * 100));
      } else {
        dimensionScores[dimKey] = {
          score: 50,
          name: dim?.name || dimKey,
          total: 0,
          maxTotal: 0
        };
        radarChartData.push(50);
      }
    }

    return {
      dimension_scores: dimensionScores,
      radar_chart_data: radarChartData
    };
  }

  /**
   * 计算风险等级
   * @param {Array} evidenceItems - 证据列表
   * @returns {Array} 风险标志列表
   */
  calculateRiskFlags(evidenceItems) {
    const riskFlags = [];

    // 按风险类型统计
    const riskCount = {};
    for (const evidence of evidenceItems) {
      if (evidence.risk_type && evidence.risk_type !== '') {
        if (!riskCount[evidence.risk_type]) {
          riskCount[evidence.risk_type] = { count: 0, polarities: [] };
        }
        riskCount[evidence.risk_type].count++;
        riskCount[evidence.risk_type].polarities.push(evidence.evidence_polarity);
      }
    }

    // 风险类型映射
    const riskTypeMap = {
      self_harm: { type: '自残行为', level: 'high' },
      suicide: { type: '自杀倾向', level: 'high' },
      dropout: { type: '辍学风险', level: 'medium' },
      gambling: { type: '赌博行为', level: 'medium' },
      loan: { type: '贷款问题', level: 'medium' },
      debt: { type: '债务问题', level: 'medium' },
      conflict: { type: '人际冲突', level: 'low' }
    };

    for (const [riskType, data] of Object.entries(riskCount)) {
      const mapping = riskTypeMap[riskType] || { type: riskType, level: 'low' };
      const hasNegative = data.polarities.includes('negative');

      riskFlags.push({
        type: mapping.type,
        risk_type: riskType,
        level: hasNegative ? mapping.level : 'low',
        count: data.count,
        description: `发现${data.count}条相关证据`
      });
    }

    return riskFlags;
  }
}

module.exports = { ScoreAggregatorService };
