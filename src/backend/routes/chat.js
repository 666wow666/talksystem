/**
 * 聊天API路由模块
 * 处理前端发起的AI对话请求，分发到不同的工作流进行处理
 */

const express = require('express');
const { glmService } = require('../services/glmService');

const router = express.Router();

/**
 * POST /chat/:workflowNum
 * 根据工作流编号调用相应的AI处理逻辑
 * @param {number} req.params.workflowNum - 工作流编号，1或2
 * @param {Object} req.body - 请求体，包含message和basicInfo字段
 * @returns {Object} - JSON响应，包含AI生成的内容
 */
router.post('/:workflowNum', async (req, res) => {
  try {
    const workflowNum = parseInt(req.params.workflowNum);
    const { message, basicInfo } = req.body;

    if (!message) {
      return res.status(400).json({ error: "缺少 message 字段" });
    }

    if (![1, 2].includes(workflowNum)) {
      return res.status(400).json({ error: "不支持的工作流编号" });
    }

    console.log(`[工作流${workflowNum}] 收到请求`);

    let result;
    if (workflowNum === 1) {
      result = await glmService.workflow1(message);
    } else {
      result = await glmService.workflow2(message, basicInfo);
    }

    res.json({ content: result });

  } catch (error) {
    console.error(`[工作流${req.params.workflowNum}] 错误:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /chat
 * 默认工作流接口，调用工作流1（智能追问生成）
 * @param {Object} req.body - 请求体，包含message字段
 * @returns {Object} - JSON响应，包含AI生成的内容
 */
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "缺少 message 字段" });
    }

    console.log(`[工作流1] 收到请求`);
    const result = await glmService.workflow1(message);

    res.json({ content: result });

  } catch (error) {
    console.error("[工作流1] 错误:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
