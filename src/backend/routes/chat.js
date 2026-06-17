/**
 * 谈心谈话 AI 路由
 *
 * POST /chat/1：workflow1 — 实时访谈引导，返回 { content, tag, reason }
 *   Body: { message: string }
 *   Response: { success: true, content: string, tag: string, reason: string, model: string }
 *
 * POST /chat/2：workflow2 — 角色分离，返回带"老师：""学生："前缀的文本
 *   Body: { message: string, basicInfo?: object }
 *   Response: { success: true, content: string, model: string }
 *
 * POST /chat：默认走 workflow1
 *
 * GET /chat/models：返回可用模型列表
 */

const express = require('express');
const { AIServiceFactory } = require('../services/aiServiceFactory');
const { modelSelector } = require('../services/modelSelector');

const router = express.Router();

// POST /chat/:workflowNum — 统一入口
router.post('/:workflowNum', async (req, res) => {
    try {
        const workflowNum = parseInt(req.params.workflowNum);
        const { message, basicInfo } = req.body || {};

        console.log('\n========== [工作流' + workflowNum + '] 新请求 ==========');
        console.log('请求时间:', new Date().toLocaleString());
        console.log('消息长度:', message ? message.length : 'N/A');

        if (!message) {
            console.log('错误: 缺少 message 字段');
            return res.status(400).json({ success: false, error: '缺少 message 字段' });
        }

        if (workflowNum !== 1 && workflowNum !== 2) {
            console.log('错误: 不支持的工作流编号', workflowNum);
            return res.status(400).json({ success: false, error: '不支持的工作流编号' });
        }

        const currentModel = modelSelector.getModelForWorkflow(workflowNum);
        console.log('工作流' + workflowNum + '模型:', currentModel);

        const aiService = AIServiceFactory.getService(currentModel);

        let result;
        if (workflowNum === 1) {
            // workflow1：实时访谈引导，返回 { content, tag }
            result = await aiService.workflow1(message);
            console.log('AI 解析结果:', result);
            console.log('========== [工作流' + workflowNum + '] 请求完成 ==========\n');
            return res.json({
                success: true,
                content: result.content,
                tag: result.tag,
                reason: result.reason,
                model: currentModel
            });
        } else {
            // workflow2：角色分离，返回 string
            console.log('[工作流2] 开始调用 AI 服务...');
            console.log('[工作流2] basicInfo:', JSON.stringify(basicInfo));
            
            const startTime = Date.now();
            result = await aiService.workflow2(message, basicInfo);
            const duration = Date.now() - startTime;
            
            console.log('[工作流2] AI 调用完成，耗时:', duration + 'ms');
            console.log('[工作流2] 返回内容长度:', result ? result.length : 0);
            if (result && result.length < 500) {
                console.log('[工作流2] 返回内容预览:', result.substring(0, 200));
            }
            console.log('========== [工作流' + workflowNum + '] 请求完成 ==========\n');
            return res.json({
                success: true,
                content: result,
                model: currentModel
            });
        }
    } catch (error) {
        console.log('\n!!!!!!!!!! [工作流' + req.params.workflowNum + '] 错误 !!!!!!!!!!');
        console.error('错误时间:', new Date().toLocaleString());
        console.error('错误内容:', error.message);
        if (error.stack) console.error('堆栈:\n', error.stack);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
        return res.status(500).json({ success: false, error: error.message || '服务内部错误' });
    }
});

// POST /chat — 默认走 workflow1
router.post('/', async (req, res) => {
    try {
        const { message } = req.body || {};

        console.log('\n========== [工作流1 (默认路由)] 新请求 ==========');
        console.log('请求时间:', new Date().toLocaleString());
        console.log('消息长度:', message ? message.length : 'N/A');

        if (!message) {
            console.log('错误: 缺少 message 字段');
            return res.status(400).json({ success: false, error: '缺少 message 字段' });
        }

        const currentModel = modelSelector.getModelForWorkflow(1);
        console.log('工作流1模型:', currentModel);

        const aiService = AIServiceFactory.getService(currentModel);

        const result = await aiService.workflow1(message);

        console.log('AI 解析结果:', result);
        console.log('========== [工作流1 (默认路由)] 请求完成 ==========\n');

        return res.json({
            success: true,
            content: result.content,
            tag: result.tag,
            reason: result.reason,
            model: currentModel
        });
    } catch (error) {
        console.log('\n!!!!!!!!!! [工作流1 (默认路由)] 错误 !!!!!!!!!!');
        console.error('错误时间:', new Date().toLocaleString());
        console.error('错误内容:', error.message);
        if (error.stack) console.error('堆栈:\n', error.stack);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
        return res.status(500).json({ success: false, error: error.message || '服务内部错误' });
    }
});

// GET /chat/models — 可用模型列表
router.get('/models', (req, res) => {
    try {
        const availableModels = AIServiceFactory.getAvailableModels();
        const currentModel = modelSelector.getCurrentModel();

        console.log('\n========== [GET /chat/models] 请求 ==========');
        console.log('可用模型:', availableModels.join(', '));
        console.log('当前模型:', currentModel);
        console.log('========================================\n');

        res.json({
            success: true,
            availableModels: availableModels,
            currentModel: currentModel
        });
    } catch (error) {
        console.error('\n!!!!!!!!!! [GET /chat/models] 错误 !!!!!!!!!!');
        console.error(error);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
