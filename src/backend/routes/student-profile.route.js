/**
 * 学生画像路由
 *
 * POST /api/student-profile/generate/:studentId - 触发生成画像
 * GET /api/student-profile/:studentId - 获取画像
 */

const express = require('express');
const { StudentProfileService } = require('../services/student-profile.service');

const router = express.Router();
const profileService = new StudentProfileService();

/**
 * POST /api/student-profile/generate/:studentId
 * 触发生成学生画像
 */
router.post('/generate/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    console.log(`\n========== [学生画像] 生成请求 ==========`);
    console.log(`学生ID: ${studentId}`);
    console.log(`请求时间: ${new Date().toLocaleString()}`);

    const profile = await profileService.generateProfile(studentId);

    console.log(`========== [学生画像] 生成完成 ==========\n`);

    res.json({
      success: true,
      profile: profile
    });
  } catch (error) {
    console.error(`[学生画像] 生成失败:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/student-profile/:studentId
 * 获取学生画像
 */
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const profile = await profileService.getProfile(studentId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: '画像不存在'
      });
    }

    res.json({
      success: true,
      profile: profile
    });
  } catch (error) {
    console.error(`[学生画像] 获取失败:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
