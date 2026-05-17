
(function() {
    var recommendedBuffer = {
        questions: [null, null, null, null, null],
        scores: [0, 0, 0, 0, 0],
        currentIndex: -1,
        currentCycleId: null,
        updateLocked: false
    };
    var UPDATE_LOCK_TIME = 2000;
    var isFirstRequest = true;
    var isRequestPending = false;
    var messageBuffer = [];

    function generateCycleId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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

    function sendToWorkflow1(text) {
        if (isRequestPending) {
            messageBuffer.push(text);
            console.log('[工作流1] 请求中，新消息加入缓冲池，当前缓冲: ' + messageBuffer.length + ' 条');
            return;
        }
        processSend(text);
    }

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

    function processWorkflowResult(content, cycleId, timestamp) {
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        var sIds = ['s1', 's2', 's3', 's4', 's5'];
        var parsed = null;
        var isJson = false;
        var hasError = false;
        try {
            parsed = JSON.parse(content);
            isJson = true;
            if (parsed && parsed.error) {
                hasError = true;
                console.log('[工作流1] 响应包含错误，不更新显示内容');
            }
        } catch (e) {
            parsed = null;
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

    function displayBufferQuestions() {
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
            }
        }
    }

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

    function showWorkflow1Error(message) {
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        qIds.forEach(function(qId) {
            var contentDiv = document.getElementById('workflow1-' + qId + '-content');
            if (contentDiv) {
                contentDiv.innerHTML = '<span style="color: #ef4444;">错误: ' + escapeHtml(message) + '</span>';
            }
        });
    }

    function resetFirstRequest() {
        isFirstRequest = true;
    }

    function clearBuffer() {
        messageBuffer = [];
    }

    window.Workflow1Module = {
        send: sendToWorkflow1,
        resetFirstRequest: resetFirstRequest,
        clearBuffer: clearBuffer
    };
})();
