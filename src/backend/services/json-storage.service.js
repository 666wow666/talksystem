/**
 * JSON 存储服务
 * 管理学生信息、谈话记录、画像结果的读写
 * 
 * 数据来源：data/student-archives/{学生ID}/
 * - 学生信息：.info.json
 * - 谈话记录：*.analysis.json
 * - 画像输出：data/profiles/{学生ID}.json
 */
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const STUDENT_ARCHIVES_DIR = path.join(DATA_DIR, 'student-archives');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');

class JsonStorageService {
  /**
   * 确保目录存在
   */
  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }

  /**
   * 读取 JSON 文件
   */
  async readJson(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * 写入 JSON 文件
   */
  async writeJson(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取学生信息
   * 从 student-archives/{studentId}/.info.json 读取
   * @param {string} studentId - 学生ID（如 "陈_202524552"）
   */
  async getStudent(studentId) {
    const filePath = path.join(STUDENT_ARCHIVES_DIR, studentId, '.info.json');
    const info = await this.readJson(filePath);
    
    if (!info) {
      return null;
    }
    
    // 转换为画像服务期望的格式
    return {
      id: studentId,
      name: info.name || '',
      studentId: info.studentId || '',
      gender: info.gender || '',
      college: info.college || '',
      major: info.major || '',
      team: info.team || '',
      birthday: info.birthday || '',
      origin: info.origin || ''
    };
  }

  /**
   * 获取学生的所有谈话记录
   * 从 student-archives/{studentId}/ 下所有 .analysis.json 文件读取
   * @param {string} studentId - 学生ID（如 "陈_202524552"）
   */
  async getConversations(studentId) {
    const studentDir = path.join(STUDENT_ARCHIVES_DIR, studentId);
    
    let files;
    try {
      files = await fs.readdir(studentDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
    
    const conversations = [];
    
    // 遍历所有 .analysis.json 文件
    for (const file of files) {
      if (!file.endsWith('.analysis.json')) {
        continue;
      }
      
      const filePath = path.join(studentDir, file);
      const analysisData = await this.readJson(filePath);
      
      if (!analysisData) {
        continue;
      }
      
      // 从文件名解析日期（如 "06-14同学日常交流.analysis.json"）
      const dateMatch = file.match(/^(\d{2})-(\d{2})/);
      let dateStr = 'unknown';
      if (dateMatch) {
        const year = new Date().getFullYear();
        dateStr = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
      }
      
      // 提取对话内容（优先使用 analysis，其次 transcript）
      let content = '';
      if (analysisData.analysis && analysisData.analysis.trim()) {
        content = analysisData.analysis;
      } else if (analysisData.transcript && analysisData.transcript.trim()) {
        content = analysisData.transcript;
      }
      
      // 转换为画像服务期望的格式
      conversations.push({
        id: file.replace('.analysis.json', ''),
        date: dateStr,
        title: analysisData.conversationTypeLabel || file.replace('.analysis.json', ''),
        conversationType: analysisData.conversationType || '',
        interviewer: analysisData.interviewer || '',
        content: content,
        transcript: analysisData.transcript || '',
        analysis: analysisData.analysis || ''
      });
    }
    
    // 按日期排序（最新的在前）
    conversations.sort((a, b) => {
      if (a.date === 'unknown') return 1;
      if (b.date === 'unknown') return -1;
      return new Date(b.date) - new Date(a.date);
    });
    
    return conversations;
  }

  /**
   * 获取学生画像
   * @param {string} studentId
   */
  async getProfile(studentId) {
    const filePath = path.join(PROFILES_DIR, `${studentId}.json`);
    return await this.readJson(filePath);
  }

  /**
   * 保存学生画像
   * @param {string} studentId
   * @param {object} profile
   */
  async saveProfile(studentId, profile) {
    const filePath = path.join(PROFILES_DIR, `${studentId}.json`);
    await this.writeJson(filePath, profile);
  }

  /**
   * 获取评估配置
   */
  async getAssessmentConfig() {
    const filePath = path.join(__dirname, '..', 'schemas', 'assessment-config.json');
    return await this.readJson(filePath);
  }

  /**
   * 初始化目录结构
   */
  async initDirs() {
    await this.ensureDir(STUDENT_ARCHIVES_DIR);
    await this.ensureDir(PROFILES_DIR);
  }
}

module.exports = { JsonStorageService };