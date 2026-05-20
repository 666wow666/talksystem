
/**
 * 历史记录模块
 * 管理工作流1生成的推荐问题的历史记录，支持保存、恢复和清除
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
     * 添加历史记录
     * @param {string} timestamp - 时间戳
     * @param {string} content - 原始内容
     * @param {Object} parsed - 解析后的JSON对象
     */
    function add(timestamp, content, parsed) {
        var historyList = document.getElementById('historyList');
        if (!historyList) return;
        var emptyMsg = historyList.querySelector('.history-empty');
        if (emptyMsg) emptyMsg.remove();
        var htmlContent = '';
        var qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        var sIds = ['s1', 's2', 's3', 's4', 's5'];
        if (parsed) {
                htmlContent = '<div class="history-parsed">';
                qIds.forEach(function(qId, index) {
                    var question = parsed[qId];
                    var score = parsed[sIds[index]];
                    if (question) {
                        htmlContent += '<div class="history-question">' +
                            '<span class="history-label">问题' + (index + 1) + '：</span>' +
                            '<span class="history-q-text">' + escapeHtml(question) + '</span>' +
                            '<span class="history-score">（匹配度: ' + (score || 0) + '）</span>' +
                            '</div>';
                    }
                });
                htmlContent += '</div>';
            } else {
                htmlContent = '<div class="history-text">' + escapeHtml(content) + '</div>';
            }
            var item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = '<div class="history-item-header">' +
                '<span class="history-badge">推荐问题</span>' +
                '<span class="history-time">' + timestamp + '</span>' +
                '</div>' +
                '<div class="history-content">' + htmlContent + '</div>';
        historyList.insertBefore(item, historyList.firstChild);
        var maxItems = 50;
        while (historyList.children.length > maxItems) {
            historyList.removeChild(historyList.lastChild);
        }
        save();
    }

    /**
     * 将历史记录保存到localStorage
     */
    function save() {
        var historyList = document.getElementById('historyList');
        if (!historyList) return;
        var items = historyList.querySelectorAll('.history-item');
        var historyData = [];
        items.forEach(function(item) {
            var time = item.querySelector('.history-time');
            var parsedDiv = item.querySelector('.history-parsed');
            if (parsedDiv) {
                var questions = [];
                var questionDivs = parsedDiv.querySelectorAll('.history-question');
                questionDivs.forEach(function(qDiv) {
                    var qText = qDiv.querySelector('.history-q-text');
                    var qScore = qDiv.querySelector('.history-score');
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
                var textDiv = item.querySelector('.history-text');
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
            console.error('Failed to save history:', e);
        }
    }

    /**
     * 从localStorage恢复历史记录到UI
     */
    function restore() {
        var historyList = document.getElementById('historyList');
        if (!historyList) return;
        try {
            var existingItems = historyList.querySelectorAll('.history-item');
            if (existingItems.length > 0) {
                return;
            }
            var historyData = JSON.parse(localStorage.getItem('workflow1History') || '[]');
            if (historyData.length === 0) return;
            var emptyMsg = historyList.querySelector('.history-empty');
            if (emptyMsg) emptyMsg.remove();
            historyData.forEach(function(item) {
                var div = document.createElement('div');
                div.className = 'history-item';
                if (item.type === 'workflow1' && item.questions) {
                    var html = '<div class="history-item-header">' +
                        '<span class="history-badge">推荐问题</span>' +
                        '<span class="history-time">' + item.time + '</span>' +
                        '</div>' +
                        '<div class="history-content">' +
                        '<div class="history-parsed">';
                    item.questions.forEach(function(q, index) {
                        html += '<div class="history-question">' +
                            '<span class="history-label">问题' + (index + 1) + '：</span>' +
                            '<span class="history-q-text">' + escapeHtml(q.q) + '</span>' +
                            '<span class="history-score">（匹配度: ' + q.s + '）</span>' +
                            '</div>';
                    });
                    html += '</div></div>';
                    div.innerHTML = html;
                } else {
                    div.innerHTML = '<div class="history-item-header">' +
                        '<span class="history-badge">记录</span>' +
                        '<span class="history-time">' + item.time + '</span>' +
                        '</div>' +
                        '<div class="history-content">' +
                        '<div class="history-text">' + escapeHtml(item.text || '') + '</div>' +
                        '</div>';
                }
                historyList.appendChild(div);
            });
        } catch (e) {
            console.error('恢复历史失败:', e);
        }
    }

    /**
     * 清除所有历史记录
     * 需要用户确认，显示确认对话框
     */
    function clear() {
        if (!confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
            return;
        }
        var historyList = document.getElementById('historyList');
        if (!historyList) return;
        historyList.innerHTML = '<div class="history-empty">' +
            '<i class="fas fa-inbox"></i>' +
            '<p>暂无历史记录</p>' +
            '</div>';
        try {
            localStorage.removeItem('workflow1History');
            console.log('历史记录已清除');
        } catch (e) {
            console.error('清除历史失败:', e);
        }
    }

    // 暴露公共接口供外部调用
    window.HistoryModule = {
        add: add,
        save: save,
        restore: restore,
        clear: clear
    };
})();
