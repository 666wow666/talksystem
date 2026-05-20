
/**
 * 工作流1模块：智能追问推荐
 * 根据审讯录音内容，自动生成推荐的追问问题，帮助审讯人员获取关键信息
 */
(function() {
    // 推荐问题缓冲区，用于存储和管理当前显示的推荐问题
    var recommendedBuffer = {
        questions: [null, null, null, null, null], // 5个推荐问题
        scores: [0, 0, 0, 0, 0], // 每个问题的匹配分数
        currentIndex: -1, // 当前高亮显示的问题索引
        currentCycleId: null, // 当前处理周期的唯一ID
        updateLocked: false // 是否锁定更新，防止频繁切换
    };
    var UPDATE_LOCK_TIME = 2000; // 更新锁定时间(毫秒)
    var isFirstRequest = true; // 是否为第一次请求（会附带基本信息）
    var isRequestPending = false; // 是否有请求正在处理中
    var messageBuffer = []; // 消息缓冲区，用于合并并发请求

    /**
     * 生成唯一的处理周期ID
     * @returns {string} - 包含时间戳和随机数的唯一ID
     */
    function generateCycleId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * HTML转义函数，防止XSS攻击
     * @param {string} text - 待转义的文本
     * @returns {string} - 转义后的安全文本
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 从localStorage获取基本信息
     * @returns {Object|null} - 基本信息对象或null
     */
    function getBasicInfo() {
        var basicInfoStr = localStorage.getItem('basicInfo');
        if (basicInfoStr) {
            try {
                return JSON.parse(basicInfoStr);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * 构建包含基本信息的完整消息
     * @param {string} text - 录音转写文本
     * @param {boolean} includeBasicInfo - 是否包含基本信息
     * @returns {string} - 整合后的完整消息
     */
    function buildMessageWithBasicInfo(text, includeBasicInfo) {
        if (!includeBasicInfo) {
            return text;
        }
        var basicInfo = getBasicInfo();
        if (!basicInfo) {
            return text;
        }
        return '【基本信息】\n' +
            '询问人：' + (basicInfo.inquirerName || '-') + '\n' +
            '被询问人姓名：' + (basicInfo.respondentName || '-') + '\n' +
            '身份证号：' + (basicInfo.idCard || '-') + '\n' +
            '住址：' + (basicInfo.address || '-') + '\n' +
            '联系方式：' + (basicInfo.phone || '-') + '\n' +
            '职业：' + (basicInfo.occupation || '-') + '\n' +
            '政治面貌：' + (basicInfo.politicalStatus || '-') + '\n' +
            '与案件关系：' + (basicInfo.caseRelation || '-') + '\n' +
            '警情：' + (basicInfo.caseInfo || '-') + '\n\n' +
            '【录音内容】\n' + text;
    }

    /**
     * 发送文本到工作流1进行处理
     * 如果当前有请求正在处理，则将新消息加入缓冲池
     * @param {string} text - 待处理的录音转写文本
     */
    function sendToWorkflow1(text) {
        if (isRequestPending) {
            messageBuffer.push(text);
            console.log('[工作流1] 请求中，新消息加入缓冲池，当前缓冲: ' + messageBuffer.length + ' 条');
            return;
        }
        processSend(text);
    }

    /**
     * 实际执行工作流1请求处理
     * 发送请求到后端API，并处理响应结果
     * @param {string} text - 待处理的文本内容
     */
    function processSend(text) {
        var timestamp = new Date().toLocaleTimeString();
        var cycleId = generateCycleId();
        recommendedBuffer.currentCycleId = cycleId;
        recommendedBuffer.updateLocked = false;

        var shouldIncludeBasicInfo = isFirstRequest;
        if (isFirstRequest) {
            isFirstRequest = false;
        }
        var finalMessage = buildMessageWithBasicInfo(text, shouldIncludeBasicInfo);

        isRequestPending = true;

        fetch('/chat/1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: finalMessage })
        })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var contentType = response.headers.get('content-type');
            var fullResult = '';
            if (contentType && contentType.includes('text/event-stream')) {
                var reader = response.body.getReader();
                var decoder = new TextDecoder();
                function readStream() {
                    reader.read().then(function(res) {
                        if (res.done) {
                            processWorkflowResult(fullResult, cycleId, timestamp);
                            return;
                        }
                        var chunk = decoder.decode(res.value);
                        var lines = chunk.split('\n');
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i];
                            if (!line.trim()) continue;
                            if (line.indexOf('data:') === 0) {
                                var dataStr = line.slice(5).trim();
                                if (dataStr === '[DONE]') continue;
                                try {
                                    var data = JSON.parse(dataStr);
                                    if (data.content) fullResult += data.content;
                                    if (data.error) throw new Error(data.error);
                                } catch (e) {}
                            }
                        }
                        readStream();
                    });
                }
                readStream();
            } else {
                response.json().then(function(data) {
                    if (data.error) throw new Error(data.error);
                    var content = data.content || JSON.stringify(data);
                    processWorkflowResult(content, cycleId, timestamp);
                }).catch(function(e) {
                    handleRequestComplete();
                    showWorkflow1Error(e.message);
                });
            }
        })
        .catch(function(error) {
            handleRequestComplete();
            console.error('工作流1错误:', error);
            showWorkflow1Error(error.message);
        });
    }

    /**
     * 处理请求完成后的逻辑
     * 检查缓冲池，如有等待消息则合并后继续处理
     */
    function handleRequestComplete() {
        isRequestPending = false;
        if (messageBuffer.length > 0) {
            var mergedMessage = messageBuffer.join('\n');
            console.log('[工作流1] 请求完成，缓冲池有 ' + messageBuffer.length + ' 条消息，已合并');
            messageBuffer = [];
            setTimeout(function() {
                processSend(mergedMessage);
            }, 100);
        }
    }

    /**
     * 处理工作流1返回的结果
     * 解析JSON响应、更新推荐问题缓冲区、显示到UI、添加历史记录
     * @param {string} content - API返回的原始内容
     * @param {string} cycleId - 当前处理周期的ID
     * @param {string} timestamp - 请求时间戳
     */
    function processWorkflowResult(content, cycleId, timestamp) {
        console.log('[工作流1] 收到原始内容:', content);
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        var sIds = ['s1', 's2', 's3', 's4', 's5'];
        var parsed = null;
        var isJson = false;
        var hasError = false;
        try {
            parsed = JSON.parse(content);
            isJson = true;
            console.log('[工作流1] 成功解析JSON:', parsed);
            if (parsed && parsed.error) {
                hasError = true;
                console.log('[工作流1] 响应包含错误，不更新显示内容');
            }
        } catch (e) {
            console.warn('[工作流1] 不是有效JSON，尝试提取JSON:', e);
            parsed = null;
            // 尝试从文本中提取 JSON
            var startIdx = content.indexOf('{');
            var endIdx = content.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                var jsonStr = content.substring(startIdx, endIdx + 1);
                try {
                    parsed = JSON.parse(jsonStr);
                    isJson = true;
                    console.log('[工作流1] 成功提取JSON:', parsed);
                } catch (e2) {
                    console.error('[工作流1] 提取JSON失败:', e2);
                }
            }
        }
        if (isJson && parsed && !hasError) {
            var hasUpdate = false;
            for (var i = 0; i < qIds.length; i++) {
                var newQuestion = parsed[qIds[i]];
                var newScore = parseFloat(parsed[sIds[i]]) || 0;
                if (!newQuestion) continue;
                var existingIndex = -1;
                for (var j = 0; j < qIds.length; j++) {
                    if (recommendedBuffer.questions[j] === newQuestion) {
                        existingIndex = j;
                        break;
                    }
                }
                if (existingIndex >= 0) {
                    if (newScore > recommendedBuffer.scores[existingIndex]) {
                        recommendedBuffer.scores[existingIndex] = newScore;
                        hasUpdate = true;
                    }
                } else {
                    var minScore = Infinity;
                    var minIndex = -1;
                    for (var k = 0; k < qIds.length; k++) {
                        if (!recommendedBuffer.questions[k]) {
                            minIndex = k;
                            break;
                        }
                        if (recommendedBuffer.scores[k] < minScore) {
                            minScore = recommendedBuffer.scores[k];
                            minIndex = k;
                        }
                    }
                    if (minIndex >= 0) {
                        recommendedBuffer.questions[minIndex] = newQuestion;
                        recommendedBuffer.scores[minIndex] = newScore;
                        hasUpdate = true;
                    }
                }
            }
            if (hasUpdate) {
                displayBufferQuestions();
            }
        }
        if (window.HistoryModule && window.HistoryModule.add) {
            window.HistoryModule.add(timestamp, content, parsed);
        }
        if (isJson && parsed && !hasError) {
            var bestIndex = -1;
            var bestScore = -Infinity;
            for (var m = 0; m < qIds.length; m++) {
                var score = recommendedBuffer.scores[m];
                if (recommendedBuffer.questions[m] && score > bestScore) {
                    bestScore = score;
                    bestIndex = m;
                }
            }
            if (bestIndex >= 0 && bestScore > 0) {
                compareAndUpdateBuffer(bestIndex, bestScore, cycleId);
            }
        }
        handleRequestComplete();
    }

    /**
     * 将缓冲区中的推荐问题显示到UI
     */
    function displayBufferQuestions() {
        console.log('[工作流1] 显示推荐问题，缓冲区:', recommendedBuffer.questions);
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        for (var i = 0; i < qIds.length; i++) {
            var contentDiv = document.getElementById('workflow1-' + qIds[i] + '-content');
            if (contentDiv) {
                var question = recommendedBuffer.questions[i];
                if (question) {
                    contentDiv.textContent = question;
                } else {
                    contentDiv.textContent = '';
                }
            } else {
                console.warn('[工作流1] 找不到元素: workflow1-' + qIds[i] + '-content');
            }
        }
    }

    /**
     * 比较并更新当前高亮显示的推荐问题
     * 只在分数更高且未锁定时才更新，并设置锁定时间防止频繁切换
     * @param {number} newIndex - 新问题的索引
     * @param {number} newScore - 新问题的分数
     * @param {string} cycleId - 当前处理周期ID
     */
    function compareAndUpdateBuffer(newIndex, newScore, cycleId) {
        if (cycleId !== recommendedBuffer.currentCycleId) return;
        if (recommendedBuffer.updateLocked) return;
        var currentScore = recommendedBuffer.currentIndex >= 0 ?
            recommendedBuffer.scores[recommendedBuffer.currentIndex] : 0;
        if (newScore <= currentScore) return;
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        if (recommendedBuffer.currentIndex >= 0) {
            var oldDiv = document.getElementById('workflow1-' + qIds[recommendedBuffer.currentIndex]);
            if (oldDiv) {
                oldDiv.style.background = '';
                oldDiv.style.borderColor = '';
            }
        }
        recommendedBuffer.currentIndex = newIndex;
        recommendedBuffer.updateLocked = true;
        var currentDiv = document.getElementById('workflow1-' + qIds[newIndex]);
        if (currentDiv) {
            currentDiv.style.background = 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(96, 165, 250, 0.1))';
            currentDiv.style.borderColor = '#3b82f6';
        }
        setTimeout(function() {
            if (recommendedBuffer.currentCycleId === cycleId) {
                recommendedBuffer.updateLocked = false;
            }
        }, UPDATE_LOCK_TIME);
    }

    /**
     * 显示工作流1的错误信息
     * 在所有推荐问题位置显示错误
     * @param {string} message - 错误消息
     */
    function showWorkflow1Error(message) {
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        qIds.forEach(function(qId) {
            var contentDiv = document.getElementById('workflow1-' + qId + '-content');
            if (contentDiv) {
                contentDiv.innerHTML = '<span style="color: #ef4444;">错误: ' + escapeHtml(message) + '</span>';
            }
        });
    }

    /**
     * 重置第一次请求标志
     * 下次请求时会再次包含基本信息
     */
    function resetFirstRequest() {
        isFirstRequest = true;
    }

    /**
     * 清空消息缓冲区
     */
    function clearBuffer() {
        messageBuffer = [];
    }

    // 暴露公共接口供外部调用
    window.Workflow1Module = {
        send: sendToWorkflow1,
        resetFirstRequest: resetFirstRequest,
        clearBuffer: clearBuffer
    };
})();
