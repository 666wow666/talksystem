
(function() {
    var btnStatus = "UNDEFINED";
    var btnControl, resultElement, statusText;
    var waveAnimationId = null;
    var iatWS;
    var resultText = "";
    var lastSentText = "";
    var pendingText = "";
    var recordedEntries = [];

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
            btnControl.onclick = async function() {
                if (btnStatus === "UNDEFINED" || btnStatus === "CLOSED") {
                    await connectWebSocket();
                } else if (btnStatus === "CONNECTING" || btnStatus === "OPEN") {
                    if (window.SpeechRecorder) {
                        window.SpeechRecorder.stop();
                    }
                }
            };
        }
    }

    async function getWebSocketUrl() {
        var url = "wss://rtasr.xfyun.cn/v1/ws";
        var appId = window.APPID;
        var secretKey = window.API_KEY;
        
        if (!appId || !secretKey) {
            try {
                var response = await fetch('/api/config');
                if (response.ok) {
                    var config = await response.json();
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
        return url + "?appid=" + appId + "&ts=" + ts + "&signa=" + signature + "&roleType=2";
    }

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

    async function connectWebSocket() {
        var websocketUrl = await getWebSocketUrl();
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

    function getResultText() {
        return resultText;
    }

    function getRecordedEntries() {
        return recordedEntries;
    }

    window.SpeechRecognitionModule = {
        init: initSpeechRecognition,
        getResultText: getResultText,
        getRecordedEntries: getRecordedEntries,
        changeBtnStatus: changeBtnStatus
    };
})();
