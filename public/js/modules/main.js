/**
 * 主模块
 * 应用初始化入口，协调各子模块的初始化，管理全局状态和函数
 */
(function() {
    /**
     * 初始化应用
     * 依次调用历史记录恢复、语音识别初始化等子模块
     */
    function init() {
        if (window.HistoryModule && window.HistoryModule.restore) {
            window.HistoryModule.restore();
        }
        if (window.SpeechRecognitionModule) {
            window.SpeechRecognitionModule.init();
        }
    }

    /**
     * 获取基本信息
     * 从localStorage读取并解析基本信息JSON
     * @returns {Object|null} - 基本信息对象或null
     */
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

    /**
     * 打开基本信息编辑弹窗
     * 填充已保存的基本信息到表单字段
     */
    function openBasicInfoModal() {
        var basicInfo = getBasicInfo();
        if (basicInfo) {
            if (document.getElementById('inquirerName')) document.getElementById('inquirerName').value = basicInfo.inquirerName || '';
            if (document.getElementById('respondentName')) document.getElementById('respondentName').value = basicInfo.respondentName || '';
            if (document.getElementById('idCard')) document.getElementById('idCard').value = basicInfo.idCard || '';
            if (document.getElementById('address')) document.getElementById('address').value = basicInfo.address || '';
            if (document.getElementById('phone')) document.getElementById('phone').value = basicInfo.phone || '';
            if (document.getElementById('occupation')) document.getElementById('occupation').value = basicInfo.occupation || '';
            if (document.getElementById('caseRelation')) document.getElementById('caseRelation').value = basicInfo.caseRelation || '';
            if (document.getElementById('caseInfo')) document.getElementById('caseInfo').value = basicInfo.caseInfo || '';
            if (basicInfo.politicalStatus) {
                var radios = document.querySelectorAll('input[name="politicalStatus"]');
                radios.forEach(function(radio) {
                    if (radio.value === basicInfo.politicalStatus) {
                        radio.checked = true;
                    }
                });
            }
        }
    }

    // 暴露公共接口供外部调用
    window.MainModule = {
        init: init,
        getBasicInfo: getBasicInfo,
        openBasicInfoModal: openBasicInfoModal
    };

    /**
     * 清除历史记录（全局函数）
     * 委托给HistoryModule处理
     */
    window.clearHistory = function() {
        if (window.HistoryModule && window.HistoryModule.clear) {
            window.HistoryModule.clear();
        }
    };

    /**
     * 导出录音记录（全局函数）
     * 从SpeechRecognitionModule获取记录，委托给ExportModule导出
     * @returns {boolean} - 导出是否成功
     */
    window.exportRecording = function() {
        var recordedEntries = [];
        if (window.SpeechRecognitionModule) {
            recordedEntries = window.SpeechRecognitionModule.getRecordedEntries() || [];
        }
        if (window.ExportModule) {
            return window.ExportModule.exportRecording(recordedEntries);
        }
        return false;
    };

    /**
     * 手动发送文本到工作流2生成笔录（全局函数）
     * @param {string} text - 录音转写文本
     * @param {Object} basicInfo - 基本信息对象
     */
    window.sendToWorkflow2Manual = function(text, basicInfo) {
        if (window.Workflow2Module) {
            window.Workflow2Module.send(text, basicInfo);
        }
    };
})();
