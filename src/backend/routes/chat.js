const express = require('express');
const { AIServiceFactory } = require('../services/aiServiceFactory');
const { modelSelector } = require('../services/modelSelector');

const router = express.Router();

router.post('/:workflowNum', async (req, res) => {
  try {
    const workflowNum = parseInt(req.params.workflowNum);
    const { message, basicInfo } = req.body;

    console.log('\n========== [工作流' + workflowNum + '] 新请求 ==========');
    console.log('请求时间:', new Date().toLocaleString());
    console.log('消息长度:', message ? message.length : 'N/A');
    console.log('包含基本信息:', basicInfo ? '是' : '否');

    if (!message) {
      console.log('错误: 缺少 message 字段');
      return res.status(400).json({ error: "缺少 message 字段" });
    }

    if (![1, 2].includes(workflowNum)) {
      console.log('错误: 不支持的工作流编号', workflowNum);
      return res.status(400).json({ error: "不支持的工作流编号" });
    }

    const currentModel = modelSelector.getModelForWorkflow(workflowNum);
    console.log('工作流' + workflowNum + '模型:', currentModel);
    
    const aiService = AIServiceFactory.getService(currentModel);
    
    let result;
    if (workflowNum === 1) {
      console.log('调用工作流1: 生成推荐问题');
      result = await aiService.workflow1(message);
    } else {
      console.log('调用工作流2: 生成笔录');
      result = await aiService.workflow2(message, basicInfo);
    }

    console.log('AI 返回结果:');
    console.log('----------------------------------------');
    console.log(result ? result : '(空)');
    console.log('----------------------------------------');
    console.log('结果长度:', result ? result.length : 0);
    console.log('========== [工作流' + workflowNum + '] 请求完成 ==========\n');

    res.json({ content: result, model: currentModel });

  } catch (error) {
    console.log('\n!!!!!!!!!! [工作流' + req.params.workflowNum + '] 错误 !!!!!!!!!!');
    console.error('错误时间:', new Date().toLocaleString());
    console.error('错误内容:', error.message);
    if (error.stack) {
      console.error('堆栈:\n', error.stack);
    }
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    console.log('\n========== [工作流1 (默认路由)] 新请求 ==========');
    console.log('请求时间:', new Date().toLocaleString());
    console.log('消息长度:', message ? message.length : 'N/A');

    if (!message) {
      console.log('错误: 缺少 message 字段');
      return res.status(400).json({ error: "缺少 message 字段" });
    }

    const currentModel = modelSelector.getModelForWorkflow(1);
    console.log('工作流1模型:', currentModel);
    
    const aiService = AIServiceFactory.getService(currentModel);
    
    console.log('调用工作流1: 生成推荐问题');
    const result = await aiService.workflow1(message);

    console.log('AI 返回结果:');
    console.log('----------------------------------------');
    console.log(result ? result : '(空)');
    console.log('----------------------------------------');
    console.log('结果长度:', result ? result.length : 0);
    console.log('========== [工作流1 (默认路由)] 请求完成 ==========\n');

    res.json({ content: result, model: currentModel });

  } catch (error) {
    console.log('\n!!!!!!!!!! [工作流1 (默认路由)] 错误 !!!!!!!!!!');
    console.error('错误时间:', new Date().toLocaleString());
    console.error('错误内容:', error.message);
    if (error.stack) {
      console.error('堆栈:\n', error.stack);
    }
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    res.status(500).json({ error: error.message });
  }
});

router.get('/models', (req, res) => {
  try {
    const availableModels = AIServiceFactory.getAvailableModels();
    const currentModel = modelSelector.getCurrentModel();
    
    console.log('\n========== [GET /models] 请求 ==========');
    console.log('可用模型:', availableModels.join(', '));
    console.log('当前模型:', currentModel);
    console.log('========================================\n');
    
    res.json({
      availableModels: availableModels,
      currentModel: currentModel,
      models: availableModels.map(name => ({
        name: name,
        displayName: getModelDisplayName(name)
      }))
    });
  } catch (error) {
    console.error('\n!!!!!!!!!! [GET /models] 错误 !!!!!!!!!!');
    console.error(error);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    res.status(500).json({ error: error.message });
  }
});

function getModelDisplayName(name) {
  const displayNames = {
    glm: '智谱GLM',
    deepseek: 'DeepSeek',
    doubao: '豆包',
    kimi: 'Kimi',
    qianwen: '千问',
    ernie: '文心一言',
    nvidia: 'NVIDIA'
  };
  return displayNames[name] || name;
}

module.exports = router;