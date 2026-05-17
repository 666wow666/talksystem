
(function() {
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
        if (!outputContent) return;
        if (outputContent.indexOf('http://') === 0 || outputContent.indexOf('https://') === 0) {
            recordOutput.innerHTML = '<div style="text-align: center; padding: 40px 20px;">' +
                '<div style="margin-bottom: 20px;">' +
                '<i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #3b82f6;"></i>' +
                '</div>' +
                '<h3 style="color: #333; margin-bottom: 10px;">正在处理笔录...</h3>' +
                '<p style="color: #666; font-size: 14px;">自动下载中</p>' +
                '</div>';
            autoDownloadDocx(outputContent);
        } else {
            displayTextContent(outputContent);
        }
    }

    function autoDownloadDocx(url) {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;
        var filename = 'record.docx';
        try {
            var urlObj = new URL(url);
            var pathname = urlObj.pathname;
            var parts = pathname.split('/');
            if (parts.length > 0) {
                var lastPart = parts[parts.length - 1];
                if (lastPart.indexOf('.') !== -1) {
                    filename = lastPart;
                }
            }
        } catch (e) {}
        fetch(url)
            .then(function(response) {
                if (!response.ok) throw new Error('下载失败');
                return response.blob();
            })
            .then(function(blob) {
                var downloadUrl = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(downloadUrl);
                return readDocxContent(blob);
            })
            .then(function(textContent) {
                displayTextContent(textContent);
            })
            .catch(function(error) {
                console.error('处理失败:', error);
                showDocDownloadLink(url);
            });
    }

    function readDocxContent(blob) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var arrayBuffer = e.target.result;
                    var text = extractTextFromDocx(arrayBuffer);
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

    function extractTextFromDocx(arrayBuffer) {
        var zip = new JSZip();
        zip.loadAsync(arrayBuffer).then(function(zipContent) {
            return zipContent.file('word/document.xml').async('string');
        }).then(function(docXml) {
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(docXml, 'text/xml');
            var textNodes = xmlDoc.getElementsByTagName('w:t');
            var text = '';
            for (var i = 0; i < textNodes.length; i++) {
                text += textNodes[i].textContent + '\n';
            }
            displayTextContent(text);
        }).catch(function(error) {
            var recordOutput = document.getElementById('record-output');
            if (recordOutput) {
                showDocDownloadLink('解析失败，请手动下载');
            }
        });
    }

    function displayTextContent(text) {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;
        var placeholder = recordOutput.querySelector('.record-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        text = text.trim();
        if (!text) text = '文档内容为空';
        var lines = text.split('\n').filter(function(line) { return line.trim(); });
        var html = '<div style="font-family: 仿宋, FangSong, serif; font-size: 16px; line-height: 2; padding: 20px;">';
        lines.forEach(function(line) {
            line = line.trim();
            if (line) {
                if (line.match(/^(询问笔录|询问记录|笔录)/)) {
                    html += '<h1 style="font-size: 24px; font-weight: bold; text-align: center; color: #1e3a5f; margin: 20px 0 30px 0;">' + escapeHtml(line) + '</h1>';
                } else if (line.match(/^(询问人|被询问人|时间|地点|一、|二、|三、|四、|五、)/)) {
                    html += '<p style="font-weight: bold; color: #1e3a5f; margin-top: 15px;">' + escapeHtml(line) + '</p>';
                } else {
                    html += '<p style="text-indent: 2em; margin: 5px 0;">' + escapeHtml(line) + '</p>';
                }
            }
        });
        recordOutput.innerHTML = html;
        recordOutput.scrollTop = recordOutput.scrollHeight;
    }

    function showDocDownloadLink(url) {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;
        recordOutput.innerHTML = '<div style="text-align: center; padding: 40px 20px;">' +
            '<div style="margin-bottom: 20px;">' +
            '<i class="fas fa-file-word" style="font-size: 64px; color: #2b579a;"></i>' +
            '</div>' +
            '<h3 style="color: #333; margin-bottom: 20px;">笔录已生成</h3>' +
            '<a href="' + escapeHtml(url) + '" target="_blank" ' +
            'style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #2b579a, #1e3a5f); color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">' +
            '<i class="fas fa-download" style="margin-right: 8px;"></i>下载文档</a></div>';
    }

    window.Workflow2Module = {
        send: sendToWorkflow2
    };
})();
