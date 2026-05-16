// 录音听写功能 - 实时转发到AI工作流
(function () {
    let btnStatus = "UNDEFINED";
    let btnControl, resultElement, statusText, recorder;

    let waveAnimationId = null;
    let iatWS;
    let resultText = "";
    let lastSentText = ""; // 记录上次发送的文本，避免重复发送
    let pendingText = "";  // 待发送的句子（用于显示）
    
    // 存储带时间戳的录音记录
    let recordedEntries = [];

    // 初始化
    function initRecognition() {
        btnControl = document.getElementById("btn_control");
        resultElement = document.getElementById("result");
        statusText = document.getElementById("status_text");
        recorder = new RecorderManager("public/js");

        // 恢复历史记录
        restoreHistoryFromStorage();
        
        // 帧录制回调
        recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }) => {
            if (iatWS && iatWS.readyState === iatWS.OPEN) {
                iatWS.send(new Int8Array(frameBuffer));
                if (isLastFrame) {
                    iatWS.send('{"end": true}');
                    changeBtnStatus("CLOSING");
                }
            }
        };

        // 录音停止回调
        recorder.onStop = () => {
            console.log("录音已停止");
        };

        // 录音开始回调
        recorder.onStart = () => {
            changeBtnStatus("OPEN");
        };

        // 录音错误回调
        recorder.onError = (error) => {
            console.error("录音错误:", error);
            changeBtnStatus("CLOSED");
            if (statusText) statusText.textContent = "录音出错: " + error.message;
            if (iatWS) {
                iatWS.close();
            }
        };
        
        if (btnControl) {
            btnControl.onclick = async function () {
                if (btnStatus === "UNDEFINED" || btnStatus === "CLOSED") {
                    await connectWebSocket();
                } else if (btnStatus === "CONNECTING" || btnStatus === "OPEN") {
                    recorder.stop();
                }
            };
        }
    }

    // 发送文本到Coze工作流（只发送给工作流1自动处理）
    function sendToCozeWorkflow(text) {
        if (!text || text.trim() === "") return;
        
        // 只发送给工作流1（自动处理）
        sendToWorkflow1(text);
    }

    // ========================================
    // 推荐问题缓冲区管理
    // ========================================
    
    // 缓冲区状态 - 保存5个问题
    const recommendedBuffer = {
        questions: [null, null, null, null, null],  // 保存5个问题
        scores: [0, 0, 0, 0, 0],                  // 对应分数
        currentIndex: -1,                          // 当前推荐的问题索引
        currentCycleId: null,                       // 当前对比周期ID
        updateLocked: false                         // 更新锁
    };

    // 更新锁定时间（毫秒）
    const UPDATE_LOCK_TIME = 2000;

    function generateCycleId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ========================================
    // 发送给工作流1
    // ========================================
    function sendToWorkflow1(text) {
        const timestamp = new Date().toLocaleTimeString();
        
        // 生成新的对比周期
        const cycleId = generateCycleId();
        recommendedBuffer.currentCycleId = cycleId;
        recommendedBuffer.updateLocked = false;

        // 不在q1-q5显示"正在分析"，保持静态

        fetch('/chat/1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = response.headers.get('content-type');
            let fullResult = '';

            if (contentType && contentType.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            // 流结束时处理最终结果
                            processWorkflowResult(fullResult, cycleId, timestamp);
                            return;
                        }
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            if (line.startsWith('data:')) {
                                const dataStr = line.slice(5).trim();
                                if (dataStr === '[DONE]') continue;
                                try {
                                    const data = JSON.parse(dataStr);
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
                response.json().then(data => {
                    if (data.error) throw new Error(data.error);
                    const content = data.content || JSON.stringify(data);
                    processWorkflowResult(content, cycleId, timestamp);
                }).catch(e => {
                    showWorkflow1Error(e.message);
                });
            }
        })
        .catch(error => {
            console.error('工作流1错误:', error);
            showWorkflow1Error(error.message);
        });
    }

    // 处理工作流结果
    function processWorkflowResult(content, cycleId, timestamp) {
        const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        const sIds = ['s1', 's2', 's3', 's4', 's5'];
        
        // 尝试解析JSON
        let parsed = null;
        let isJson = false;
        
        try {
            parsed = JSON.parse(content);
            isJson = true;
        } catch (e) {
            // 不是JSON格式，使用原始内容
            parsed = null;
        }

        // 如果是JSON格式，提取问题到缓冲区
        if (isJson && parsed) {
            // 获取新返回的5个问题
            let hasUpdate = false;
            
            for (let i = 0; i < qIds.length; i++) {
                const newQuestion = parsed[qIds[i]];
                const newScore = parseFloat(parsed[sIds[i]]) || 0;
                
                if (!newQuestion) continue;
                
                // 检查这个问题是否已经在缓冲区中
                let existingIndex = -1;
                for (let j = 0; j < qIds.length; j++) {
                    if (recommendedBuffer.questions[j] === newQuestion) {
                        existingIndex = j;
                        break;
                    }
                }
                
                if (existingIndex >= 0) {
                    // 问题已存在，只在分数更高时更新
                    if (newScore > recommendedBuffer.scores[existingIndex]) {
                        recommendedBuffer.scores[existingIndex] = newScore;
                        hasUpdate = true;
                    }
                } else {
                    // 问题不在缓冲区中，找一个空位或分数最低的位置
                    let minScore = Infinity;
                    let minIndex = -1;
                    
                    for (let j = 0; j < qIds.length; j++) {
                        if (!recommendedBuffer.questions[j]) {
                            // 找到空位
                            minIndex = j;
                            break;
                        }
                        if (recommendedBuffer.scores[j] < minScore) {
                            minScore = recommendedBuffer.scores[j];
                            minIndex = j;
                        }
                    }
                    
                    if (minIndex >= 0) {
                        recommendedBuffer.questions[minIndex] = newQuestion;
                        recommendedBuffer.scores[minIndex] = newScore;
                        hasUpdate = true;
                    }
                }
            }

            // 只在有更新时刷新显示
            if (hasUpdate) {
                displayBufferQuestions();
            }
        }

        // 将完整输出添加到历史记录
        addToHistory(timestamp, content, parsed);

        // 如果是JSON格式，执行分数对比逻辑（高亮最高分）
        if (isJson && parsed) {
            // 找到最高分的问题
            let bestIndex = -1;
            let bestScore = -Infinity;
            for (let i = 0; i < qIds.length; i++) {
                const score = recommendedBuffer.scores[i];
                if (recommendedBuffer.questions[i] && score > bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }
            
            if (bestIndex >= 0 && bestScore > 0) {
                compareAndUpdateBuffer(bestIndex, bestScore, cycleId);
            }
        }
    }

    // 显示缓冲区中的问题到q1-q5（不显示分数）
    function displayBufferQuestions() {
        const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        
        for (let i = 0; i < qIds.length; i++) {
            const contentDiv = document.getElementById('workflow1-' + qIds[i] + '-content');
            
            if (contentDiv) {
                const question = recommendedBuffer.questions[i];
                if (question) {
                    contentDiv.textContent = question;
                } else {
                    contentDiv.textContent = '';
                }
            }
        }
    }

    // 添加到历史记录（解析JSON并排版显示）
    function addToHistory(timestamp, content, parsed) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        // 移除空提示
        const emptyMsg = historyList.querySelector('.history-empty');
        if (emptyMsg) emptyMsg.remove();

        // 解析JSON内容（如果没有传入parsed参数）
        let htmlContent = '';
        const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        const sIds = ['s1', 's2', 's3', 's4', 's5'];
        
        if (parsed) {
            // 构建格式化的HTML内容
            htmlContent = '<div class="history-parsed">';
            
            // 显示问题和分数
            qIds.forEach((qId, index) => {
                const question = parsed[qId];
                const score = parsed[sIds[index]];
                if (question) {
                    htmlContent += `<div class="history-question">
                        <span class="history-label">问题${index + 1}：</span>
                        <span class="history-q-text">${escapeHtml(question)}</span>
                        <span class="history-score">（匹配度: ${score || 0}）</span>
                    </div>`;
                }
            });
            
            htmlContent += '</div>';
        } else {
            // 不是JSON，原样显示
            htmlContent = `<div class="history-text">${escapeHtml(content)}</div>`;
        }

        // 创建历史项
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-item-header">
                <span class="history-badge">推荐问题</span>
                <span class="history-time">${timestamp}</span>
            </div>
            <div class="history-content">${htmlContent}</div>
        `;

        // 添加到列表开头
        historyList.insertBefore(item, historyList.firstChild);

        // 限制数量
        const maxItems = 50;
        while (historyList.children.length > maxItems) {
            historyList.removeChild(historyList.lastChild);
        }

        // 保存到 localStorage
        saveHistoryToStorage();
    }

    // 保存历史记录到 localStorage
    function saveHistoryToStorage() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        const items = historyList.querySelectorAll('.history-item');
        const historyData = [];

        items.forEach(function(item) {
            const badge = item.querySelector('.history-badge');
            const time = item.querySelector('.history-time');
            const parsedDiv = item.querySelector('.history-parsed');
            
            if (parsedDiv) {
                // 工作流1格式
                const questions = [];
                const questionDivs = parsedDiv.querySelectorAll('.history-question');
                questionDivs.forEach(function(qDiv) {
                    const qText = qDiv.querySelector('.history-q-text');
                    const qScore = qDiv.querySelector('.history-score');
                    if (qText) {
                        questions.push({
                            q: qText.textContent,
                            s: qScore ? qScore.textContent.replace('（匹配度: ', '').replace('）', '') : '0'
                        });
                    }
                });
                historyData.push({
                    type: 'workflow1',
                    time: time ? time.textContent : '',
                    questions: questions
                });
            } else {
                // 普通格式
                const textDiv = item.querySelector('.history-text');
                historyData.push({
                    type: 'record',
                    time: time ? time.textContent : '',
                    text: textDiv ? textDiv.textContent : ''
                });
            }
        });

        try {
            localStorage.setItem('workflow1History', JSON.stringify(historyData));
        } catch (e) {
            console.error('保存历史失败:', e);
        }
    }

    // 页面加载时恢复历史记录
    function restoreHistoryFromStorage() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        try {
            // 检查是否已经有历史记录，避免重复恢复
            const existingItems = historyList.querySelectorAll('.history-item');
            if (existingItems.length > 0) {
                // 已有记录，不再重复恢复
                return;
            }

            const historyData = JSON.parse(localStorage.getItem('workflow1History') || '[]');
            if (historyData.length === 0) return;

            // 移除空提示
            const emptyMsg = historyList.querySelector('.history-empty');
            if (emptyMsg) emptyMsg.remove();

            historyData.forEach(function(item) {
                const div = document.createElement('div');
                div.className = 'history-item';

                if (item.type === 'workflow1' && item.questions) {
                    // 工作流1格式
                    let html = `<div class="history-item-header">
                        <span class="history-badge">推荐问题</span>
                        <span class="history-time">${item.time}</span>
                    </div>
                    <div class="history-content">
                        <div class="history-parsed">`;
                    
                    item.questions.forEach(function(q, index) {
                        html += `<div class="history-question">
                            <span class="history-label">问题${index + 1}：</span>
                            <span class="history-q-text">${escapeHtml(q.q)}</span>
                            <span class="history-score">（匹配度: ${q.s}）</span>
                        </div>`;
                    });
                    
                    html += '</div></div>';
                    div.innerHTML = html;
                } else {
                    // 普通格式
                    div.innerHTML = `<div class="history-item-header">
                        <span class="history-badge">记录</span>
                        <span class="history-time">${item.time}</span>
                    </div>
                    <div class="history-content">
                        <div class="history-text">${escapeHtml(item.text || '')}</div>
                    </div>`;
                }

                historyList.appendChild(div);
            });
        } catch (e) {
            console.error('恢复历史失败:', e);
        }
    }

    // 比较并更新缓冲区
    function compareAndUpdateBuffer(newIndex, newScore, cycleId) {
        // 如果不是当前周期，不处理
        if (cycleId !== recommendedBuffer.currentCycleId) return;
        
        // 检查是否在锁定时间内
        if (recommendedBuffer.updateLocked) {
            return;
        }

        // 获取当前推荐问题的分数
        const currentScore = recommendedBuffer.currentIndex >= 0 
            ? recommendedBuffer.scores[recommendedBuffer.currentIndex] 
            : 0;

        // 比较分数：新分数 <= 当前分数，不更新
        if (newScore <= currentScore) {
            return;
        }

        // 取消之前的高亮
        const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        if (recommendedBuffer.currentIndex >= 0) {
            const oldDiv = document.getElementById('workflow1-' + qIds[recommendedBuffer.currentIndex]);
            if (oldDiv) {
                oldDiv.style.background = '';
                oldDiv.style.borderColor = '';
            }
        }

        // 执行更新
        recommendedBuffer.currentIndex = newIndex;
        recommendedBuffer.updateLocked = true;

        // 高亮显示当前推荐问题
        const currentDiv = document.getElementById('workflow1-' + qIds[newIndex]);
        if (currentDiv) {
            currentDiv.style.background = 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(96, 165, 250, 0.1))';
            currentDiv.style.borderColor = '#3b82f6';
        }

        // 锁定更新（防止连续变更）
        setTimeout(() => {
            if (recommendedBuffer.currentCycleId === cycleId) {
                recommendedBuffer.updateLocked = false;
            }
        }, UPDATE_LOCK_TIME);
    }

    function showWorkflow1Error(message) {
        const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        qIds.forEach(qId => {
            const contentDiv = document.getElementById('workflow1-' + qId + '-content');
            if (contentDiv) {
                contentDiv.innerHTML = `<span style="color: #ef4444;">错误: ${escapeHtml(message)}</span>`;
            }
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 获取WebSocket URL（支持异步获取配置）
    async function getWebSocketUrl() {
        var url = "wss://rtasr.xfyun.cn/v1/ws";
        var appId = APPID;
        var secretKey = API_KEY;
        
        // 如果配置还没有获取到，尝试从服务端获取
        if (!appId || !secretKey) {
            try {
                const response = await fetch('/api/config');
                if (response.ok) {
                    const config = await response.json();
                    appId = config.xfyunAppId || '';
                    secretKey = config.xfyunApiKey || '';
                }
            } catch (e) {
                console.warn('获取配置失败，使用现有值');
            }
        }
        
        var ts = Math.floor(new Date().getTime() / 1000);
        var signa = hex_md5(appId + ts);
        var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
        var signature = CryptoJS.enc.Base64.stringify(signatureSha);
        signature = encodeURIComponent(signature);
        return `${url}?appid=${appId}&ts=${ts}&signa=${signature}&roleType=2`;
    }

    // 更新按钮状态
    function changeBtnStatus(status) {
        btnStatus = status;
        
        const micIcon = document.getElementById('mic-icon');
        const recordingDots = document.getElementById('recording-dots');
        const waveContainer = document.getElementById('wave-container');

        if (status === "OPEN") {
            // 隐藏麦克风图标，显示三点动画和波形
            if (micIcon) micIcon.style.display = 'none';
            if (recordingDots) recordingDots.classList.add('active');
            if (waveContainer) waveContainer.style.display = 'flex';
            if (statusText) statusText.textContent = "正在录音...";
        } else {
            // 显示麦克风图标，隐藏动画
            if (micIcon) micIcon.style.display = 'block';
            if (recordingDots) recordingDots.classList.remove('active');
            if (waveContainer) waveContainer.style.display = 'none';
            if (status === "CLOSED") {
                if (statusText) statusText.textContent = "点击麦克风开始录音";
            }
        }

        if (status === "CONNECTING") {
            if (statusText) statusText.textContent = "正在连接...";
        } else if (status === "CLOSING") {
            if (statusText) statusText.textContent = "正在关闭...";
        }
    }

    // 渲染结果
    function renderResult(resultData) {
        let jsonData = JSON.parse(resultData);
        if (jsonData.action == "started") {
            console.log("握手成功");
        } else if (jsonData.action == "result") {
            const data = JSON.parse(jsonData.data);

            let resultTextTemp = "";
            data.cn.st.rt.forEach((j) => {
                j.ws.forEach((k) => {
                    k.cw.forEach((l) => {
                        resultTextTemp += l.w;
                    });
                });
            });

            let rolePrefix = "";
            let needNewLine = false;

            if (data.cn && data.cn.st && data.cn.st.rl !== undefined) {
                const rlValue = data.cn.st.rl;
                if (rlValue >= 1) {
                    rolePrefix = "角色" + rlValue + "：";
                    needNewLine = true;
                }
            }

            // 【关键】检查 type，type=0 表示一句话结束
            if (data.cn.st.type == 0) {
                // 最终识别结果，一句话结束
                if (needNewLine) {
                    resultText += "\n" + rolePrefix + resultTextTemp;
                } else {
                    resultText += resultTextTemp;
                }

                // 检测到句子结束时，发送到Coze工作流1（自动处理）
                const completeSentence = (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;
                const trimmedSentence = completeSentence.trim();
                
                // 检查是否与上一次发送的内容重复（用于去重）
                if (trimmedSentence && trimmedSentence !== lastSentText.trim()) {
                    console.log("【检测到句子结束】发送:", completeSentence);
                    lastSentText = resultText;
                    
                    // 记录带时间戳的录音内容（去重）
                    const timestamp = new Date().toLocaleTimeString();
                    const isDuplicate = recordedEntries.some(entry => entry.text === trimmedSentence);
                    
                    if (!isDuplicate) {
                        recordedEntries.push({
                            time: timestamp,
                            text: trimmedSentence
                        });
                    }
                    
                    sendToCozeWorkflow(trimmedSentence);
                }

                resultTextTemp = "";
            }

            // 输出到文本框
            resultElement.innerText = resultText + (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;

        } else if (jsonData.action == "error") {
            console.log("出错了:", jsonData);
            if (statusText) statusText.textContent = "出错了: " + (jsonData.desc || "未知错误");
        }
    }

    // 连接WebSocket
    async function connectWebSocket() {
        const websocketUrl = await getWebSocketUrl();
        if ("WebSocket" in window) {
            iatWS = new WebSocket(websocketUrl);
        } else if ("MozWebSocket" in window) {
            iatWS = new MozWebSocket(websocketUrl);
        } else {
            alert("浏览器不支持WebSocket");
            return;
        }
        changeBtnStatus("CONNECTING");
        
        // 只重置发送标记（用于去重），保留原有识别结果
        lastSentText = "";
        // 注意：不再重置 resultText，保留之前的录音记录
        
        iatWS.onopen = (e) => {
            recorder.start({ sampleRate: 16000, frameSize: 1280 });
        };
        iatWS.onmessage = (e) => { renderResult(e.data); };
        iatWS.onerror = (e) => {
            console.error(e);
            recorder.stop();
            changeBtnStatus("CLOSED");
            if (statusText) statusText.textContent = "连接出错";
        };
        iatWS.onclose = (e) => {
            recorder.stop();
            changeBtnStatus("CLOSED");
        };
    }

    // 暴露初始化函数
    window.initRecognition = initRecognition;
    
    // 导出录音原文（带时间戳）- 暴露到全局
    window.exportRecording = function() {
        if (recordedEntries.length === 0) {
            alert('暂无录音内容可导出');
            return false;
        }
        
        // 生成导出内容
        let content = '';
        recordedEntries.forEach(function(entry) {
            content += '【' + entry.time + '】\n' + entry.text + '\n\n';
        });
        
        // 创建下载
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 生成文件名
        const now = new Date();
        const filename = '录音原文_' + now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0') + '_' +
                      String(now.getHours()).padStart(2, '0') + 
                      String(now.getMinutes()).padStart(2, '0') + '.txt';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    };
    
    // 手动发送给工作流2（生成笔录）- 暴露到全局供按钮调用
    window.sendToWorkflow2Manual = function(text, basicInfo) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        // 清空之前的输出
        recordOutput.innerHTML = '<p>正在生成笔录...</p>';

        // 构建包含基本信息的消息
        let message = text;
        if (basicInfo) {
            message = '【基本信息】\n' +
                      '询问人：' + (basicInfo.inquirerName || '-') + '\n' +
                      '被询问人姓名：' + (basicInfo.respondentName || '-') + '\n' +
                      '身份证号：' + (basicInfo.idCard || '-') + '\n' +
                      '住址：' + (basicInfo.address || '-') + '\n' +
                      '联系方式：' + (basicInfo.phone || '-') + '\n' +
                      '职业：' + (basicInfo.occupation || '-') + '\n' +
                      '政治面貌：' + (basicInfo.politicalStatus || '-') + '\n' +
                      '与案件关系：' + (basicInfo.caseRelation || '-') + '\n\n' +
                      '【录音内容】\n' + text;
        }

        fetch('/chat/2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let result = '';

                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            // 流结束时，处理最终内容
                            console.log('工作流2最终返回:', result);
                            if (result) {
                                renderRecordContent(result);
                            } else {
                                recordOutput.innerHTML = '<p>收到空响应</p>';
                            }
                            return;
                        }

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            if (line.startsWith('data:')) {
                                const dataStr = line.slice(5).trim();
                                if (dataStr === '[DONE]') continue;

                                try {
                                    const data = JSON.parse(dataStr);
                                    console.log('工作流2数据块:', data);
                                    if (data.content) {
                                        result += data.content;
                                        renderRecordContent(result);
                                    }
                                    if (data.error) {
                                        throw new Error(data.error);
                                    }
                                } catch (e) {
                                    console.error('解析数据块失败:', e);
                                }
                            }
                        }
                        readStream();
                    });
                }
                readStream();
            } else {
                response.json().then(data => {
                    console.log('工作流2非流式响应:', data);
                    if (data.error) throw new Error(data.error);
                    const content = data.content || JSON.stringify(data);
                    renderRecordContent(content);
                }).catch(e => {
                    recordOutput.innerHTML = '<p>生成失败: ' + e.message + '</p>';
                });
            }
        })
        .catch(error => {
            console.error('工作流2错误:', error);
            recordOutput.innerHTML = '<p>生成失败: ' + error.message + '</p>';
        });
    };

    // 渲染笔录内容
    function renderRecordContent(content) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        // 提取output字段的内容
        let outputContent = content;
        
        // 尝试从内容中提取 JSON 对象中的 output 字段
        try {
            // 查找最后一个完整的 JSON 对象
            const lastBrace = content.lastIndexOf('}');
            const firstBrace = content.lastIndexOf('{');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                const jsonStr = content.substring(firstBrace, lastBrace + 1);
                const json = JSON.parse(jsonStr);
                if (json.output) {
                    outputContent = json.output;
                }
            }
        } catch (e) {
            // 解析失败，使用原始内容
        }

        outputContent = outputContent.trim();

        // 如果内容为空，不显示
        if (!outputContent) {
            return;
        }

        // 检查是否为文件下载链接
        if (outputContent.startsWith('http://') || outputContent.startsWith('https://')) {
            // 显示下载状态
            recordOutput.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="margin-bottom: 20px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #3b82f6;"></i>
                    </div>
                    <h3 style="color: #333; margin-bottom: 10px;">正在处理笔录...</h3>
                    <p style="color: #666; font-size: 14px;">自动下载中</p>
                </div>
            `;

            // 自动下载文件
            autoDownloadDocx(outputContent);
        } else {
            // 普通文本 - 将 \n 转换为换行显示
            displayTextContent(outputContent);
        }
    }

    // 自动下载docx文件
    function autoDownloadDocx(url) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        // 提取文件名
        let filename = '询问笔录.docx';
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');
            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1];
                if (lastPart.includes('.')) {
                    filename = lastPart;
                }
            }
        } catch (e) {}

        // 下载文件
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('下载失败');
                return response.blob();
            })
            .then(blob => {
                // 1. 自动下载文件到本地
                const downloadUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(downloadUrl);

                // 2. 读取文件内容并显示
                return readDocxContent(blob);
            })
            .then(textContent => {
                // 显示文件内容
                displayTextContent(textContent);
            })
            .catch(error => {
                console.error('处理失败:', error);
                // 下载失败时显示下载链接
                showDocDownloadLink(url);
            });
    }

    // 读取docx文件内容
    function readDocxContent(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    const text = extractTextFromDocx(arrayBuffer);
                    resolve(text);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = function() {
                reject(new Error('读取文件失败'));
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    // 从docx中提取文本内容
    function extractTextFromDocx(arrayBuffer) {
        // 解析docx (实际上docx是zip格式)
        const zip = new JSZip();
        zip.loadAsync(arrayBuffer).then(function(zipContent) {
            // 读取document.xml
            return zipContent.file('word/document.xml').async('string');
        }).then(function(docXml) {
            // 从XML中提取文本
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(docXml, 'text/xml');
            const textNodes = xmlDoc.getElementsByTagName('w:t');
            let text = '';
            for (let i = 0; i < textNodes.length; i++) {
                text += textNodes[i].textContent + '\n';
            }
            // 显示内容
            displayTextContent(text);
        }).catch(function(error) {
            // 解析失败，显示原始链接
            const recordOutput = document.getElementById('record-output');
            if (recordOutput) {
                showDocDownloadLink('解析失败，请手动下载');
            }
        });
    }

    // 显示文本内容
    function displayTextContent(text) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        // 隐藏占位符
        const placeholder = recordOutput.querySelector('.record-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // 清理文本
        text = text.trim();
        if (!text) {
            text = '文档内容为空';
        }

        // 格式化显示
        const lines = text.split('\n').filter(line => line.trim());
        let html = '<div style="font-family: 仿宋, FangSong, serif; font-size: 16px; line-height: 2; padding: 20px;">';
        
        // 检查第一行是否是标题，如果是则加大显示
        let isFirstLine = true;
        lines.forEach(function(line) {
            line = line.trim();
            if (line) {
                // 标题样式（询问笔录等）
                if (line.match(/^(询问笔录|询问记录|笔录)/)) {
                    html += '<h1 style="font-size: 24px; font-weight: bold; text-align: center; color: #1e3a5f; margin: 20px 0 30px 0;">' + escapeHtml(line) + '</h1>';
                } else if (line.match(/^(询问人|被询问人|时间|地点|一、二、三、四、五)/) || 
                    line.length < 20 && !line.includes('。') && !line.includes('，')) {
                    html += '<p style="font-weight: bold; color: #1e3a5f; margin-top: 15px;">' + escapeHtml(line) + '</p>';
                } else {
                    html += '<p style="text-indent: 2em; margin: 5px 0;">' + escapeHtml(line) + '</p>';
                }
                isFirstLine = false;
            }
        });
        
        // 添加内容
        recordOutput.innerHTML = html;
        recordOutput.scrollTop = recordOutput.scrollHeight;
    }

    // 显示文档下载链接（备选方案）
    function showDocDownloadLink(url) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        recordOutput.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="margin-bottom: 20px;">
                    <i class="fas fa-file-word" style="font-size: 64px; color: #2b579a;"></i>
                </div>
                <h3 style="color: #333; margin-bottom: 20px;">笔录已生成</h3>
                <a href="${escapeHtml(url)}" 
                   target="_blank"
                   style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #2b579a, #1e3a5f); color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    <i class="fas fa-download" style="margin-right: 8px;"></i>
                    下载文档
                </a>
            </div>
        `;
    }

    // 显示HTML内容（保留）
    function displayDocContent(content) {
        const recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        let cleanContent = content
            .replace(/<[^>]*>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n\s*\n/g, '\n\n');

        const lines = cleanContent.split('\n');
        let html = '<div style="font-family: 仿宋, FangSong, serif; font-size: 16px; line-height: 2; padding: 20px;">';
        
        lines.forEach(function(line) {
            line = line.trim();
            if (line) {
                // 标题样式（询问笔录等）
                if (line.match(/^(询问笔录|询问记录|笔录)/)) {
                    html += '<h1 style="font-size: 24px; font-weight: bold; text-align: center; color: #1e3a5f; margin: 20px 0 30px 0;">' + escapeHtml(line) + '</h1>';
                } else if (line.match(/^(一、二、三、四、五|询问人|被询问人|时间|地点)/)) {
                    html += '<p style="font-weight: bold; margin-top: 10px;">' + escapeHtml(line) + '</p>';
                } else {
                    html += '<p style="text-indent: 2em; margin: 5px 0;">' + escapeHtml(line) + '</p>';
                }
            }
        });
        
        // 末尾签名区域（居右显示）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        html += '<div style="margin-top: 60px; text-align: right; line-height: 2.5;">';
        html += '<p>被讯问人：__________</p>';
        html += '<p>时间：' + year + '年' + month + '月' + day + '日</p>';
        html += '<p>讯问人签名：__________</p>';
        html += '</div>';
        
        html += '</div>';
        recordOutput.innerHTML = html;
        recordOutput.scrollTop = recordOutput.scrollHeight;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
