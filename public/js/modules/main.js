
(function() {
    function init() {
        if (window.HistoryModule && window.HistoryModule.restore) {
            window.HistoryModule.restore();
        }
        if (window.SpeechRecognitionModule) {
            window.SpeechRecognitionModule.init();
        }
    }

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

    window.MainModule = {
        init: init,
        getBasicInfo: getBasicInfo,
        openBasicInfoModal: openBasicInfoModal
    };

    window.clearHistory = function() {
        if (window.HistoryModule && window.HistoryModule.clear) {
            window.HistoryModule.clear();
        }
    };

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

    window.sendToWorkflow2Manual = function(text, basicInfo) {
        if (window.Workflow2Module) {
            window.Workflow2Module.send(text, basicInfo);
        }
    };
})();
