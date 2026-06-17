/**
 * 学生画像服务
 * 工作流编排
 */
const { JsonStorageService } = require('./json-storage.service');
const { ScoreAggregatorService } = require('./score-aggregator.service');
const { EvidenceAgent } = require('../agents/evidence.agent');
const { ScoringAgent } = require('../agents/scoring.agent');
const { ProfileAgent } = require('../agents/profile.agent');

class StudentProfileService {
  constructor() {
    this.storage = new JsonStorageService();
    this.aggregator = new ScoreAggregatorService();
    this.evidenceAgent = new EvidenceAgent();
    this.scoringAgent = new ScoringAgent();
    this.profileAgent = new ProfileAgent();
  }

  /**
   * 生成学生画像
   * @param {string} studentId - 学生ID
   * @returns {object} 完整画像
   */
  async generateProfile(studentId) {
    console.log(`[画像] 开始为学生 ${studentId} 生成画像`);

    // 1. 读取学生信息
    const student = await this.storage.getStudent(studentId);
    if (!student) {
      throw new Error(`学生 ${studentId} 不存在`);
    }

    // 2. 读取谈话记录
    const conversations = await this.storage.getConversations(studentId);
    if (!conversations || conversations.length === 0) {
      throw new Error(`学生 ${studentId} 没有谈话记录`);
    }

    // 3. 读取评估配置
    const assessmentConfig = await this.storage.getAssessmentConfig();

    // 4. EvidenceAgent - 抽取证据
    console.log(`[画像] 步骤1/4 - 抽取证据`);
    const evidenceResult = await this.evidenceAgent.extract(student, conversations);
    const evidenceItems = evidenceResult.evidence_items || [];
    console.log(`[画像] 抽取到 ${evidenceItems.length} 条证据`);

    // 5. ScoringAgent - 评分
    console.log(`[画像] 步骤2/4 - 评分`);
    const scoringResult = await this.scoringAgent.score(assessmentConfig, evidenceItems);
    const itemScores = scoringResult.item_scores || [];
    console.log(`[画像] 评定了 ${itemScores.length} 项`);

    // 6. ScoreAggregator - 聚合分数
    console.log(`[画像] 步骤3/4 - 聚合分数`);
    const { dimension_scores, radar_chart_data } = this.aggregator.aggregateScores(itemScores, assessmentConfig);
    const riskFlags = this.aggregator.calculateRiskFlags(evidenceItems);
    console.log(`[画像] 五维分数计算完成`);

    // 7. ProfileAgent - 生成画像
    console.log(`[画像] 步骤4/4 - 生成画像`);
    const profileResult = await this.profileAgent.generate(
      student,
      dimension_scores,
      itemScores,
      evidenceItems
    );

    // 8. 组装最终结果
    const finalProfile = {
      student_id: studentId,
      student_name: student.name,
      generated_at: new Date().toISOString(),
      evidence_items: evidenceItems,
      item_scores: itemScores,
      dimension_scores: dimension_scores,
      radar_chart_data: radar_chart_data,
      profile_summary: profileResult.profile_summary || '',
      dimension_comments: profileResult.dimension_comments || [],
      risk_flags: riskFlags,
      follow_up_suggestions: profileResult.follow_up_suggestions || []
    };

    // 9. 保存画像
    await this.storage.saveProfile(studentId, finalProfile);
    console.log(`[画像] 学生 ${studentId} 画像已保存`);

    return finalProfile;
  }

  /**
   * 获取学生画像
   * @param {string} studentId
   */
  async getProfile(studentId) {
    return await this.storage.getProfile(studentId);
  }
}

module.exports = { StudentProfileService };
