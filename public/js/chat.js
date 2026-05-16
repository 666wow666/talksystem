// Coze工作流聊天功能 - 支持多个工作流
(function () {
    // 存储各工作流的组件引用
    const workflows = {};

    // 历史记录管理
    const MAX_HISTORY = 50;
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem('workflowHistory') || '[]');
        } catch { return []; }
    }
    function saveHistory(history) {
        localStorage.setItem('workflowHistory', JSON.stringify(history));
    }
    function addToHistory(workflowNum, userMessage, aiResponse) {
        const history = getHistory();
        history.unshift({
            id: Date.now(),
            workflow: workflowNum,
            user: userMessage,
            response: aiResponse,
            time: new Date().toLocaleString('zh-CN')
        });
        if (history.length > MAX_HISTORY) history.pop();
        saveHistory(history);
    }
    function renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        const history = getHistory();
        if (history.length === 0) {
            list.innerHTML = '<div class="history-empty"><i class="fas fa-inbox"></i><p>暂无历史记录</p></div>';
            return;
        }
        list.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-badge">工作流${item.workflow}</span>
                    <span class="history-time">${item.time}</span>
                </div>
                <div class="history-user">${escapeHtml(item.user)}</div>
                <div class="history-response">${escapeHtml(item.response)}</div>
            </div>
        `).join('');
    }
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    window.renderHistory = renderHistory;

    // 初始化指定编号的工作流
    function initChat(workflowNum) {
        const sendButton = document.getElementById(`send-button-${workflowNum}`);
        const messageInput = document.getElementById(`message-input-${workflowNum}`);
        const chatContainer = document.getElementById(`chat-container-${workflowNum}`);

        if (!sendButton || !messageInput || !chatContainer) return;

        // 添加欢迎消息
        addMessage(workflowNum, `您好！我是工作流 ${workflowNum} 助手。有什么可以帮助您的吗？`, false);

        // 暴露发送函数到全局
        window[`sendMessage_${workflowNum}`] = function() {
            sendMessage(workflowNum);
        };
    }

    // 添加消息到指定工作流的聊天界面
    function addMessage(workflowNum, text, isUser) {
        const chatContainer = document.getElementById(`chat-container-${workflowNum}`);
        if (!chatContainer) return;

        const div = document.createElement('div');
        div.className = isUser ? 'user-message' : 'ai-message';
        div.textContent = text;
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 添加打字指示器
    function addTypingIndicator(workflowNum) {
        const chatContainer = document.getElementById(`chat-container-${workflowNum}`);
        if (!chatContainer) return;

        const div = document.createElement('div');
        div.id = `typing-indicator-${workflowNum}`;
        div.className = 'ai-message typing-indicator';
        div.innerHTML = '<span></span><span></span><span></span>';
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 移除打字指示器
    function removeTypingIndicator(workflowNum) {
        const indicator = document.getElementById(`typing-indicator-${workflowNum}`);
        if (indicator) indicator.remove();
    }

    // 获取按钮颜色
    function getButtonColor(workflowNum) {
        return workflowNum === 1 ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600';
    }

    // 解析工作流响应，提取q1-q5和output（用于工作流1）
    function parseWorkflowResponse(workflowNum, content) {
        let result = { 
            q1: null, 
            q2: null, 
            q3: null, 
            q4: null, 
            q5: null,
            output: content 
        };
        try {
            const json = JSON.parse(content);
            if (json.q1) result.q1 = json.q1;
            if (json.q2) result.q2 = json.q2;
            if (json.q3) result.q3 = json.q3;
            if (json.q4) result.q4 = json.q4;
            if (json.q5) result.q5 = json.q5;
            if (json.output) result.output = json.output;
        } catch (e) { /* not JSON */ }
        return result;
    }

    // 发送消息 - 可被全局调用
    async function sendMessage(workflowNum) {
        const messageInput = document.getElementById(`message-input-${workflowNum}`);
        const sendButton = document.getElementById(`send-button-${workflowNum}`);
        const chatContainer = document.getElementById(`chat-container-${workflowNum}`);
        
        if (!messageInput || !sendButton || !chatContainer) return;

        const message = messageInput.value.trim();
        if (!message) return;

        addMessage(workflowNum, message, true);
        messageInput.value = '';

        // 添加打字指示器
        addTypingIndicator(workflowNum);

        // 禁用按钮
        const originalClass = sendButton.className;
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>处理中...';

        let fullResponse = '';

        try {
            const response = await fetch(`/chat/${workflowNum}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // 移除打字指示器
            removeTypingIndicator(workflowNum);

            // 创建AI消息容器
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'ai-message';
            chatContainer.appendChild(aiMessageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            // 检查是否是流式响应
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/event-stream')) {
                // 流式响应处理
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        if (line.startsWith('data:')) {
                            const dataStr = line.slice(5).trim();
                            
                            if (dataStr === '[DONE]') {
                                console.log(`工作流${workflowNum}流式响应结束`);
                                continue;
                            }

                            try {
                                const data = JSON.parse(dataStr);
                                
                                if (data.content) {
                                    // 尝试解析content中的JSON
                                    let displayContent = data.content;
                                    try {
                                        const contentJson = JSON.parse(data.content);
                                        if (contentJson.output) {
                                            displayContent = contentJson.output;
                                        }
                                    } catch (e) {
                                        // content不是JSON，使用原值
                                    }
                                    
                                    fullResponse += displayContent;
                                    aiMessageDiv.textContent = fullResponse;
                                    chatContainer.scrollTop = chatContainer.scrollHeight;
                                }
                                
                                if (data.error) {
                                    console.error(`工作流${workflowNum}收到错误:`, data.error);
                                    throw new Error(data.error);
                                }
                            } catch (e) {
                                if (e.message !== 'JSON.parse: error') {
                                    console.warn('解析JSON失败:', e, dataStr);
                                }
                            }
                        }
                    }
                }

                if (!fullResponse) {
                    addMessage(workflowNum, '收到空响应', false);
                    fullResponse = '收到空响应';
                }

            } else {
                // 非流式响应处理
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                if (data.content) {
                    try {
                        const contentJson = JSON.parse(data.content);
                        fullResponse = contentJson.output || data.content;
                        aiMessageDiv.textContent = fullResponse;
                    } catch (e) {
                        fullResponse = data.content;
                        aiMessageDiv.textContent = data.content;
                    }
                } else {
                    fullResponse = JSON.stringify(data);
                    aiMessageDiv.textContent = JSON.stringify(data);
                }
            }

            // 保存到历史记录
            addToHistory(workflowNum, message, fullResponse);
            
            // 如果是工作流1，解析并显示q1-q5
            if (workflowNum === 1) {
                const parsed = parseWorkflowResponse(workflowNum, fullResponse);
                const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
                qIds.forEach(qId => {
                    const contentDiv = document.getElementById(`workflow1-${qId}-content`);
                    const value = parsed[qId];
                    if (contentDiv) {
                        if (value) {
                            contentDiv.innerHTML = `<pre class="whitespace-pre-wrap">${escapeHtml(value)}</pre>`;
                        } else {
                            contentDiv.innerHTML = '<div class="workflow-output-placeholder">暂无内容</div>';
                        }
                    }
                });
            }

            // 刷新历史面板（如果可见）
            renderHistory();

        } catch (error) {
            console.error(error);
            removeTypingIndicator(workflowNum);
            addMessage(workflowNum, '错误: ' + error.message, false);
            fullResponse = '错误: ' + error.message;
        } finally {
            sendButton.disabled = false;
            sendButton.className = originalClass;
            sendButton.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>发送';
        }
    }

    // 暴露到全局
    window.initChat = initChat;
    window.sendMessage = sendMessage;

})();
