/**
 * 谈心谈话实时引导智能体 - 前端管理模块
 *
 * 核心规则：
 *   - 文本缓冲（ASR 流累积）
 *   - 5 秒固定周期轮询触发 AI 请求
 *   - 上一个请求未回复 → 跳过本次轮询（不并发）
 *   - 录音结束 → 强制发送一次（即便没满足 5 秒）
 *   - 三级状态管理：historyQuestions / currentQuestion / latestQuestions
 *   - 左右两侧点击翻页 + 键盘 ← → 翻页
 *   - 页码指示器
 *
 * 使用方式：
 *   TalkGuideManager.send("新增文本");          发送文本（累积到 buffer）
 *   TalkGuideManager.setRecordingState(true);   录音开始（启动 5 秒轮询）
 *   TalkGuideManager.setRecordingState(false);  录音结束（强制发送一次）
 *   TalkGuideManager.clear();                   清空所有状态
 *
 * DOM 目标（main.html）：
 *   #guideTag            左上角标签（.visible 类控制显示）
 *   #guideQuestion       主推荐问题
 *   #guideReasonText     原因说明
 *   #guideNavLeft        左侧翻页热区
 *   #guideNavRight       右侧翻页热区
 *   #guidePagination     页码指示器
 */
(function() {
    'use strict';

    // ==================== 配置 ====================
    var REQUEST_INTERVAL_MS = 5000;    // 5 秒轮询周期
    var BUFFER_MAX_LENGTH = 500;        // 最大缓冲字数
    var LATEST_MAX_SIZE = 5;           // 最新问题池容量
    var MIN_DISPLAY_MS = 8000;         // 进入历史所需的最小显示时长（8 秒）
    var API_ENDPOINT = '/chat/1';

    // ==================== 状态 ====================

    // 文本缓冲 & 请求控制
    var buffer = '';
    var intervalTimer = null;         // 轮询定时器（setInterval）
    var isRecording = false;           // 是否在录音中
    var pendingRequest = false;       // 请求进行中标记
    var requestCounter = 0;           // 请求序号（用于丢弃过期响应）

    // 三级问题状态（时间轴）
    var historyQuestions = [];          // 已浏览过的问题
    var currentQuestion = null;        // 当前显示的问题
    var latestQuestions = [];         // AI 新生成的问题（缓冲池，最多 5 条）
    var currentQuestionDisplayStart = 0;  // 当前问题的显示起始时间（毫秒时间戳）

    // ==================== 工具函数 ====================

    function createQuestion(content, tag, reason) {
        return {
            id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            content: content || '',
            tag: tag || '心理状态',
            reason: reason || '',
            createTime: Date.now()
        };
    }

    function isSameQuestion(q1, q2) {
        if (!q1 || !q2) return false;
        return q1.content === q2.content && q1.tag === q2.tag && q1.reason === q2.reason;
    }

    // ==================== DOM 渲染 ====================

    function render() {
        // 标签
        var tagEl = document.getElementById('guideTag');
        if (tagEl) {
            if (currentQuestion && currentQuestion.tag) {
                tagEl.textContent = currentQuestion.tag;
                tagEl.setAttribute('data-tag', currentQuestion.tag);
                tagEl.classList.add('visible');
            } else {
                tagEl.textContent = '';
                tagEl.removeAttribute('data-tag');
                tagEl.classList.remove('visible');
            }
        }

        // 问题
        var questionEl = document.getElementById('guideQuestion');
        if (questionEl) {
            if (currentQuestion && currentQuestion.content) {
                questionEl.textContent = currentQuestion.content;
            } else {
                questionEl.innerHTML = '<i class="fas fa-comment-dots guide-question-placeholder"></i>';
            }
        }

        // 原因
        var reasonTextEl = document.getElementById('guideReasonText');
        if (reasonTextEl) {
            if (currentQuestion && currentQuestion.reason && currentQuestion.reason.trim()) {
                reasonTextEl.textContent = currentQuestion.reason;
            } else {
                reasonTextEl.innerHTML = '<span class="guide-reason-placeholder">等待语音输入...</span>';
            }
        }

        // 翻页热区可用性
        var navLeft = document.getElementById('guideNavLeft');
        if (navLeft) {
            navLeft.classList.toggle('disabled', historyQuestions.length === 0);
        }

        var navRight = document.getElementById('guideNavRight');
        if (navRight) {
            navRight.classList.toggle('disabled', latestQuestions.length === 0);
        }

        // 页码指示器
        var pagination = document.getElementById('guidePagination');
        if (pagination) {
            var total = historyQuestions.length + (currentQuestion ? 1 : 0) + latestQuestions.length;
            var currentPage = historyQuestions.length + (currentQuestion ? 1 : 0);
            if (total > 1) {
                pagination.classList.add('visible');
                var pageCurrent = pagination.querySelector('.guide-page-current');
                var pageTotal = pagination.querySelector('.guide-page-total');
                if (pageCurrent) pageCurrent.textContent = currentPage;
                if (pageTotal) pageTotal.textContent = total;
            } else {
                pagination.classList.remove('visible');
            }
        }
    }

    // ==================== 翻页逻辑 ====================

    /**
     * 下一题：currentQuestion → history（停留 ≥8秒才进入），latestQuestions[0] → current
     */
    function showNextQuestion() {
        if (latestQuestions.length === 0) return false;

        if (currentQuestion) {
            var displayDuration = Date.now() - currentQuestionDisplayStart;

            if (displayDuration >= MIN_DISPLAY_MS) {
                // 停留 8 秒以上 → 进入历史
                historyQuestions.push(currentQuestion);
            } else {
                // 停留不足 8 秒 → 直接丢弃，不进入历史
                console.log('[实时引导] 问题停留 ' + Math.round(displayDuration / 1000) + 's < 8s，不计入历史');
            }
        }

        currentQuestion = latestQuestions.shift();
        currentQuestionDisplayStart = Date.now();  // 新问题从此刻开始计时
        render();
        return true;
    }

    /**
     * 上一题：historyQuestions.pop → current，current → latestQuestions.unshift
     */
    function showPrevQuestion() {
        if (historyQuestions.length === 0) return false;

        if (currentQuestion) {
            latestQuestions.unshift(currentQuestion);
            if (latestQuestions.length > LATEST_MAX_SIZE) {
                latestQuestions.pop();
            }
        }

        currentQuestion = historyQuestions.pop();
        currentQuestionDisplayStart = Date.now();  // 从历史恢复的问题重新计时
        render();
        return true;
    }

    // ==================== 录音状态管理 ====================

    /**
     * 录音状态变更回调
     *   true  → 开始录音 → 启动 5 秒轮询
     *   false → 停止录音 → 强制发送一次 + 清除定时器
     */
    function setRecordingState(recording) {
        isRecording = !!recording;

        if (isRecording) {
            // 录音开始：启动 5 秒轮询
            if (intervalTimer) {
                clearInterval(intervalTimer);
            }
            intervalTimer = setInterval(function() {
                triggerRequest();
            }, REQUEST_INTERVAL_MS);
            console.log('[实时引导] 录音开始，启动 ' + REQUEST_INTERVAL_MS + 'ms 轮询');
        } else {
            // 录音结束：清除定时器
            if (intervalTimer) {
                clearInterval(intervalTimer);
                intervalTimer = null;
            }

            // 强制发送一次（即便没满足 5 秒）
            if (buffer && buffer.trim() && !pendingRequest) {
                console.log('[实时引导] 录音结束，强制发送一次（buffer 长度: ' + buffer.length + '）');
                triggerRequest();
            }
        }
    }

    // ==================== 文本输入 & 请求触发 ====================

    /**
     * 收到文本（只累积到 buffer，不再触发 scheduleRequest）
     * 发送由 5 秒轮询和录音结束时的强制发送驱动
     */
    function appendText(text) {
        if (!text || typeof text !== 'string' || !text.trim()) {
            return;
        }

        buffer += text;

        // 500 字上限
        if (buffer.length > BUFFER_MAX_LENGTH) {
            buffer = buffer.substr(buffer.length - BUFFER_MAX_LENGTH);
        }
    }

    /**
     * 实际触发请求
     * 规则：上一个请求未回复则跳过本次
     */
    function triggerRequest() {
        // 规则 1：无内容不发送
        if (!buffer || !buffer.trim()) {
            return;
        }

        // 规则 2：上一个请求未回复 → 跳过本次
        if (pendingRequest) {
            console.log('[实时引导] 请求进行中，跳过本次轮询');
            return;
        }

        var myReqId = ++requestCounter;
        pendingRequest = true;

        fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: buffer })
        })
            .then(function(resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function(data) {
                // 丢弃过期响应
                if (myReqId !== requestCounter) {
                    console.log('[实时引导] 丢弃过期响应 #' + myReqId);
                    return;
                }

                if (!data || !data.content) {
                    console.warn('[实时引导] 返回数据缺少 content 字段:', data);
                    return;
                }

                var newQuestion = createQuestion(
                    data.content,
                    data.tag || '心理状态',
                    data.reason || ''
                );

                // 防闪烁：与当前问题相同则跳过
                if (isSameQuestion(newQuestion, currentQuestion)) {
                    return;
                }

                // 防重复：缓冲池中已存在则跳过
                var alreadyInLatest = latestQuestions.some(function(q) {
                    return q.content === newQuestion.content;
                });
                if (alreadyInLatest) {
                    return;
                }

                // 首次 → 当前；已有 → 缓冲池
                if (!currentQuestion) {
                    currentQuestion = newQuestion;
                    currentQuestionDisplayStart = Date.now();  // 新问题开始计时
                } else {
                    latestQuestions.push(newQuestion);
                    while (latestQuestions.length > LATEST_MAX_SIZE) {
                        latestQuestions.shift();
                    }
                }

                render();
            })
            .catch(function(err) {
                console.error('[实时引导] API 调用失败:', err);
            })
            .finally(function() {
                pendingRequest = false;
                // 不自调度，下一次发送由 setInterval 5 秒周期驱动
            });
    }

    // ==================== 清空 ====================

    function clear() {
        buffer = '';

        // 清除轮询定时器
        if (intervalTimer) {
            clearInterval(intervalTimer);
            intervalTimer = null;
        }

        pendingRequest = false;
        requestCounter = 0;
        isRecording = false;

        // 清空三级状态
        historyQuestions = [];
        currentQuestion = null;
        latestQuestions = [];
        currentQuestionDisplayStart = 0;

        render();

        console.log('[实时引导] 状态已清空');
    }

    // ==================== 事件绑定 ====================

    function initEventListeners() {
        // 左侧点击 → 上一题
        var navLeft = document.getElementById('guideNavLeft');
        if (navLeft) {
            navLeft.addEventListener('click', function(e) {
                e.preventDefault();
                if (showPrevQuestion()) {
                    triggerGlow(navLeft);
                }
            });
        }

        // 右侧点击 → 下一题
        var navRight = document.getElementById('guideNavRight');
        if (navRight) {
            navRight.addEventListener('click', function(e) {
                e.preventDefault();
                if (showNextQuestion()) {
                    triggerGlow(navRight);
                }
            });
        }

        // 键盘 ← → 翻页（输入框内不响应）
        document.addEventListener('keydown', function(e) {
            var active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                if (showPrevQuestion()) {
                    triggerGlow(navLeft);
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowRight') {
                if (showNextQuestion()) {
                    triggerGlow(navRight);
                    e.preventDefault();
                }
            }
        });
    }

    function triggerGlow(zoneEl) {
        if (!zoneEl) return;
        zoneEl.classList.remove('flashing');
        void zoneEl.offsetWidth;
        zoneEl.classList.add('flashing');
        setTimeout(function() {
            zoneEl.classList.remove('flashing');
        }, 400);
    }

    // ==================== 初始化 ====================

    function init() {
        initEventListeners();
        render();
        console.log('[实时引导] 模块已初始化，轮询 ' + REQUEST_INTERVAL_MS + 'ms，缓冲池 ' + LATEST_MAX_SIZE + ' 条');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 100);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 100);
        });
    }

    // ==================== 序列化/反序列化 ====================

    function getSnapshot() {
        var list = [];
        historyQuestions.forEach(function(q) {
            list.push({ content: q.content, tag: q.tag, reason: q.reason });
        });
        if (currentQuestion) {
            list.push({ content: currentQuestion.content, tag: currentQuestion.tag, reason: currentQuestion.reason });
        }
        latestQuestions.forEach(function(q) {
            list.push({ content: q.content, tag: q.tag, reason: q.reason });
        });
        return list;
    }

    function restoreFrom(questionList) {
        buffer = '';
        historyQuestions = [];
        currentQuestion = null;
        latestQuestions = [];

        if (!questionList || !Array.isArray(questionList) || questionList.length === 0) {
            render();
            return;
        }

        var first = questionList[0];
        if (first && first.content && first.content.trim()) {
            currentQuestion = createQuestion(first.content, first.tag || '心理状态', first.reason || '');
            currentQuestionDisplayStart = Date.now();  // 恢复后重新计时
        }

        for (var i = 1; i < questionList.length; i++) {
            var q = questionList[i];
            if (q && q.content && q.content.trim()) {
                latestQuestions.push(createQuestion(q.content, q.tag || '心理状态', q.reason || ''));
                if (latestQuestions.length >= LATEST_MAX_SIZE) break;
            }
        }

        render();
        console.log('[实时引导] 已从快照恢复 ' + (currentQuestion ? 1 : 0) + ' + ' + latestQuestions.length + ' 条问题');
    }

    // ==================== 公共接口 ====================

    window.TalkGuideManager = {
        send: appendText,
        appendText: appendText,
        clear: clear,
        showNextQuestion: showNextQuestion,
        showPrevQuestion: showPrevQuestion,
        getSnapshot: getSnapshot,
        restoreFrom: restoreFrom,

        setRecordingState: setRecordingState,

        getState: function() {
            return {
                historyQuestions: historyQuestions,
                currentQuestion: currentQuestion,
                latestQuestions: latestQuestions,
                buffer: buffer,
                pendingRequest: pendingRequest,
                isRecording: isRecording,
                currentQuestionDisplayStart: currentQuestionDisplayStart
            };
        },

        getDisplayDuration: function() {
            if (!currentQuestion || !currentQuestionDisplayStart) return 0;
            return Date.now() - currentQuestionDisplayStart;
        },

        REQUEST_INTERVAL_MS: REQUEST_INTERVAL_MS,
        MIN_DISPLAY_MS: MIN_DISPLAY_MS,
        BUFFER_MAX_LENGTH: BUFFER_MAX_LENGTH,
        LATEST_MAX_SIZE: LATEST_MAX_SIZE
    };
})();
