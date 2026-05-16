var RecorderManager = (function () {
    'use strict';

    function getUserMedia() {
        var t = navigator,
            r = t.getUserMedia || t.webkitGetUserMedia || t.mozGetUserMedia;
        return (t.mediaDevices && t.mediaDevices.getUserMedia) 
            ? t.mediaDevices.getUserMedia({ audio: true, video: false })
            : r 
                ? new Promise(function (e, t) { r.call(navigator, { audio: true, video: false }, e, t); })
                : Promise.reject(new Error("不支持录音"));
    }

    var cachedWorker = null;

    function RecorderManager(e) {
        this.processorPath = e;
        this.audioBuffers = [];
        this.audioWorklet = null;
    }

    RecorderManager.prototype.start = function (o) {
        var that = this;
        var sampleRate = o.sampleRate || 16000;
        var frameSize = o.frameSize || 1280;
        var arrayBufferType = o.arrayBufferType || "short16";
        
        // 获取麦克风权限
        getUserMedia()
            .then(function (stream) {
                that.audioTracks = stream.getAudioTracks();
                
                // 创建音频上下文
                var audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });
                that.audioContext = audioContext;
                
                // 创建媒体流源
                var mediaStreamSource = audioContext.createMediaStreamSource(stream);
                
                // 创建 Worker
                if (cachedWorker) {
                    that.audioWorklet = cachedWorker;
                    return setupAudioWorklet(that, audioContext, mediaStreamSource, sampleRate, frameSize, arrayBufferType);
                } else {
                    return new Promise(function (resolve, reject) {
                        try {
                            var worker = new Worker(that.processorPath + "/processor.worker.js");
                            worker.onerror = function(e) {
                                console.error("Worker 创建失败:", e);
                                reject(e);
                            };
                            cachedWorker = worker;
                            that.audioWorklet = worker;
                            setupAudioWorklet(that, audioContext, mediaStreamSource, sampleRate, frameSize, arrayBufferType)
                                .then(resolve)
                                .catch(reject);
                        } catch (e) {
                            reject(e);
                        }
                    });
                }
            })
            .then(function () {
                if (that.onStart) {
                    that.onStart();
                }
            })
            .catch(function (e) {
                console.error("录音启动失败:", e);
                if (that.onError) {
                    that.onError(e);
                }
            });
    };

    function setupAudioWorklet(that, audioContext, mediaStreamSource, sampleRate, frameSize, arrayBufferType) {
        return new Promise(function (resolve, reject) {
            if (!that.audioWorklet) {
                reject(new Error("Worker 未初始化"));
                return;
            }

            var worker = that.audioWorklet;
            
            // 设置 Worker 消息处理
            worker.onmessage = function (event) {
                var data = event.data;
                var frameBuffer = data.frameBuffer;
                var isLastFrame = data.isLastFrame;
                
                if (frameSize && that.onFrameRecorded) {
                    if (frameBuffer && frameBuffer.byteLength) {
                        for (var a = 0; a < frameBuffer.byteLength;) {
                            that.onFrameRecorded({
                                isLastFrame: isLastFrame && a + frameSize >= frameBuffer.byteLength,
                                frameBuffer: frameBuffer.slice(a, a + frameSize)
                            });
                            a += frameSize;
                        }
                    } else if (frameBuffer) {
                        that.onFrameRecorded(data);
                    }
                }
                
                if (that.onStop && isLastFrame) {
                    that.onStop(that.audioBuffers);
                }
            };

            // 初始化 Worker
            worker.postMessage({
                type: "init",
                data: {
                    frameSize: frameSize,
                    toSampleRate: sampleRate,
                    fromSampleRate: audioContext.sampleRate,
                    arrayBufferType: arrayBufferType
                }
            });

            // 创建 ScriptProcessor 处理音频
            var bufferSize = 4096;
            try {
                var scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
                scriptNode.onaudioprocess = function (e) {
                    if (worker && worker.postMessage) {
                        var inputData = e.inputBuffer.getChannelData(0);
                        worker.postMessage({
                            type: "message",
                            data: inputData
                        });
                    }
                };
                mediaStreamSource.connect(scriptNode);
                scriptNode.connect(audioContext.destination);
            } catch (e) {
                console.warn("ScriptProcessor 创建失败:", e);
                reject(e);
                return;
            }
            
            audioContext.resume();
            resolve();
        });
    }

    RecorderManager.prototype.stop = function () {
        if (this.audioWorklet && this.audioWorklet.postMessage) {
            this.audioWorklet.postMessage({ type: "stop" });
        }
        if (this.audioTracks && this.audioTracks[0]) {
            this.audioTracks[0].stop();
        }
        if (this.audioContext && this.audioContext.state === "running") {
            this.audioContext.close();
        }
    };

    return RecorderManager;
})();
