
/**
 * 语音识别模块
 * 负责录音、与讯飞语音识别API通信、实时转写语音为文字
 */
(function() {
    // 录音按钮状态：UNDEFINED(未初始化)/CONNECTING(连接中)/OPEN(录音中)/CLOSING(关闭中)/CLOSED(已关闭)
    var btnStatus = "UNDEFINED";
    var btnControl, resultElement, statusText; // DOM元素引用
    var waveAnimationId = null; // 波形动画ID
    var iatWS; // 讯飞语音识别WebSocket连接
    var resultText = ""; // 累积的转写文本
    var lastSentText = ""; // 上一次发送给工作流的文本
    var pendingText = ""; // 待处理文本
    var recordedEntries = []; // 记录的句子条目，包含时间戳和文本

    /**
     * 初始化语音识别模块
     * 绑定DOM元素、设置录音回调、绑定按钮点击事件
     */
    function initSpeechRecognition() {
        btnControl = document.getElementById("btn_control");
        resultElement = document.getElementById("result");
        statusText = document.getElementById("status_text");

        if (window.SpeechRecorder) {
            window.SpeechRecorder.init('public/js');
            window.SpeechRecorder.setCallbacks({
                onFrameRecorded: function(data) {
                    if (iatWS && iatWS.readyState === iatWS.OPEN) {
                        iatWS.send(new Int8Array(data.frameBuffer));
                        if (data.isLastFrame) {
                            iatWS.send('{"end": true}');
                            changeBtnStatus('CLOSING');
                        }
                    }
                },
                onStop: function() {
                    console.log('录音已停止');
                },
                onStart: function() {
                    changeBtnStatus('OPEN');
                },
                onError: function(error) {
                    console.error('录音错误:', error);
                    changeBtnStatus('CLOSED');
                }
            });
        }

        if (btnControl) {
            btnControl.onclick = function() {
                if (btnStatus === "UNDEFINED" || btnStatus === "CLOSED") {
                    connectWebSocket();
                } else if (btnStatus === "CONNECTING" || btnStatus === "OPEN") {
                    if (window.SpeechRecorder) {
                        window.SpeechRecorder.stop();
                    }
                }
            };
        }
    }

    /**
     * 构建讯飞语音识别WebSocket连接URL
     * 使用AppID和API密钥生成签名，构建带认证信息的连接地址
     * @returns {string} - WebSocket连接URL
     */
    function getWebSocketUrl() {
        var url = "wss://rtasr.xfyun.cn/v1/ws";
        var appId = window.APPID;
        var secretKey = window.API_KEY;
        
        var ts = Math.floor(new Date().getTime() / 1000);
        var signa = hex_md5(appId + ts);
        var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
        var signature = CryptoJS.enc.Base64.stringify(signatureSha);
        signature = encodeURIComponent(signature);
        return url + "?appid=" + appId + "&ts=" + ts + "&signa=" + signature + "&roleType=2";
    }

    /**
     * 更新录音按钮的状态和UI显示
     * @param {string} status - 新状态，可选值：UNDEFINED/CONNECTING/OPEN/CLOSING/CLOSED
     */
    function changeBtnStatus(status) {
        btnStatus = status;
        var micIcon = document.getElementById('mic-icon');
        var recordingDots = document.getElementById('recording-dots');
        var waveContainer = document.getElementById('wave-container');

        if (status === "OPEN") {
            if (micIcon) micIcon.style.display = 'none';
            if (recordingDots) recordingDots.classList.add('active');
            if (waveContainer) waveContainer.style.display = 'flex';
            if (statusText) statusText.textContent = "正在录音...";
        } else {
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

    /**
     * 处理并渲染讯飞语音识别API返回的结果
     * 解析JSON数据、提取文本、处理角色标记、更新显示并发送给工作流1
     * @param {string} resultData - WebSocket接收到的JSON字符串数据
     */
    function renderResult(resultData) {
        var jsonData = JSON.parse(resultData);
        if (jsonData.action == "started") {
            console.log("握手成功");
        } else if (jsonData.action == "result") {
            var data = JSON.parse(jsonData.data);
            var resultTextTemp = "";
            data.cn.st.rt.forEach(function(j) {
                j.ws.forEach(function(k) {
                    k.cw.forEach(function(l) {
                        resultTextTemp += l.w;
                    });
                });
            });
            var rolePrefix = "";
            var needNewLine = false;
            if (data.cn && data.cn.st && data.cn.st.rl !== undefined) {
                var rlValue = data.cn.st.rl;
                if (rlValue >= 1) {
                    rolePrefix = "角色" + rlValue + "：";
                    needNewLine = true;
                }
            }
            if (data.cn.st.type == 0) {
                if (needNewLine) {
                    resultText += "\n" + rolePrefix + resultTextTemp;
                } else {
                    resultText += resultTextTemp;
                }
                var completeSentence = (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;
                var trimmedSentence = completeSentence.trim();
                if (trimmedSentence && trimmedSentence !== lastSentText.trim()) {
                    console.log("[检测到句子] 发送:", completeSentence);
                    lastSentText = resultText;
                    var timestamp = new Date().toLocaleTimeString();
                    var isDuplicate = recordedEntries.some(function(entry) {
                        return entry.text === trimmedSentence;
                    });
                    if (!isDuplicate) {
                        recordedEntries.push({ time: timestamp, text: trimmedSentence });
                    }
                    if (window.Workflow1Module && window.Workflow1Module.send) {
                        window.Workflow1Module.send(trimmedSentence);
                    }
                }
                resultTextTemp = "";
            }
            resultElement.innerText = resultText + (needNewLine ? "\n" + rolePrefix : "") + resultTextTemp;
        } else if (jsonData.action == "error") {
            console.log("错误:", jsonData);
            if (statusText) statusText.textContent = "错误: " + (jsonData.desc || "未知错误");
        }
    }

    /**
     * 建立与讯飞语音识别服务的WebSocket连接
     * 配置连接事件处理、开始录音、接收并处理转写结果
     */
    function connectWebSocket() {
        var websocketUrl = getWebSocketUrl();
        if ("WebSocket" in window) {
            iatWS = new WebSocket(websocketUrl);
        } else if ("MozWebSocket" in window) {
            iatWS = new MozWebSocket(websocketUrl);
        } else {
            alert("浏览器不支持 WebSocket");
            return;
        }
        changeBtnStatus("CONNECTING");
        lastSentText = "";
        iatWS.onopen = function(e) {
            if (window.SpeechRecorder) {
                window.SpeechRecorder.start({ sampleRate: 16000, frameSize: 1280 });
            }
        };
        iatWS.onmessage = function(e) { renderResult(e.data); };
        iatWS.onerror = function(e) {
            console.error(e);
            if (window.SpeechRecorder) {
                window.SpeechRecorder.stop();
            }
            changeBtnStatus("CLOSED");
            if (statusText) statusText.textContent = "连接错误";
        };
        iatWS.onclose = function(e) {
            if (window.SpeechRecorder) {
                window.SpeechRecorder.stop();
            }
            changeBtnStatus("CLOSED");
        };
    }

    /**
     * 获取当前累积的全部转写文本
     * @returns {string} - 完整的转写文本内容
     */
    function getResultText() {
        return resultText;
    }

    /**
     * 获取所有已记录的句子条目
     * @returns {Array} - 记录条目数组，每个条目包含time(时间戳)和text(文本)
     */
    function getRecordedEntries() {
        return recordedEntries;
    }

    // 暴露公共接口供外部调用
    window.SpeechRecognitionModule = {
        init: initSpeechRecognition,
        getResultText: getResultText,
        getRecordedEntries: getRecordedEntries,
        changeBtnStatus: changeBtnStatus
    };
})();
