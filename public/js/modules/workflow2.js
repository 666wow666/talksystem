
/**
 * 工作流2模块：笔录自动生成
 * 根据审讯录音内容和基本信息，自动生成规范的询问笔录文档
 */
(function() {
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
     * 发送文本到工作流2生成笔录
     * @param {string} text - 录音转写文本
     * @param {Object} basicInfo - 基本信息对象
     */
    function sendToWorkflow2(text, basicInfo) {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;
        recordOutput.innerHTML = '<p>正在生成笔录...</p>';
        var message = text;
        if (basicInfo) {
            message = '【基本信息】\n' +
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
        fetch('/chat/2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                var reader = response.body.getReader();
                var decoder = new TextDecoder();
                var result = '';
                function readStream() {
                    reader.read().then(function(res) {
                        if (res.done) {
                            console.log('工作流2最终结果:', result);
                            if (result) {
                                renderRecordContent(result);
                            } else {
                                recordOutput.innerHTML = '<p>收到空响应</p>';
                            }
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
                                    console.log('工作流2数据:', data);
                                    if (data.content) {
                                        result += data.content;
                                        renderRecordContent(result);
                                    }
                                    if (data.error) {
                                        throw new Error(data.error);
                                    }
                                } catch (e) {
                                    console.error('解析失败:', e);
                                }
                            }
                        }
                        readStream();
                    });
                }
                readStream();
            } else {
                response.json().then(function(data) {
                    console.log('工作流2非流式响应:', data);
                    if (data.error) throw new Error(data.error);
                    var content = data.content || JSON.stringify(data);
                    renderRecordContent(content);
                }).catch(function(e) {
                    recordOutput.innerHTML = '<p>生成失败: ' + e.message + '</p>';
                });
            }
        })
        .catch(function(error) {
            console.error('工作流2错误:', error);
            recordOutput.innerHTML = '<p>生成失败: ' + error.message + '</p>';
        });
    }

    /**
     * 渲染笔录内容到UI
     * 解析响应内容、显示到页面
     * @param {string} content - API返回的内容
     */
    function renderRecordContent(content) {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;
        var outputContent = content;
        try {
            var lastBrace = content.lastIndexOf('}');
            var firstBrace = content.lastIndexOf('{');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                var jsonStr = content.substring(firstBrace, lastBrace + 1);
                var json = JSON.parse(jsonStr);
                if (json.output) {
                    outputContent = json.output;
                }
            }
        } catch (e) {}
        outputContent = outputContent.trim();
        if (outputContent) {
            displayTextContent(outputContent);
        }
    }

    /**
     * 将笔录文本显示到页面
     * 对文本进行格式化处理，添加标题、加粗等样式
     * @param {string} text - 笔录文本内容
     */
    function displayTextContent(text) {
        console.log('[工作流2] 显示文本内容:', text);
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) {
            console.error('[工作流2] 找不到 record-output 元素');
            return;
        }
        var placeholder = recordOutput.querySelector('.record-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        text = text.trim();
        if (!text) text = '文档内容为空';
        var lines = text.split('\n');
        var html = '<div style="font-family: 仿宋, FangSong, serif; font-size: 16px; line-height: 2; padding: 20px;">';
        lines.forEach(function(line) {
            if (line.trim()) {
                html += '<p>' + escapeHtml(line) + '</p>';
            } else {
                html += '<p>&nbsp;</p>';
            }
        });
        html += '</div>';
        recordOutput.innerHTML = html;
        recordOutput.classList.add('has-content');
        recordOutput.scrollTop = recordOutput.scrollHeight;
        console.log('[工作流2] 文本已显示，行数:', lines.length);
    }

    // 暴露公共接口供外部调用
    window.Workflow2Module = {
        send: sendToWorkflow2
    };
})();
