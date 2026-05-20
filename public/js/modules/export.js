/**
 * 录音导出模块
 * 将录音转写的内容导出为TXT文本文件
 */
(function() {
    /**
     * 导出录音记录
     * 将recordedEntries中的内容格式化为带时间戳的文本并下载
     * @param {Array} recordedEntries - 录音条目数组，每个条目包含time和text
     * @returns {boolean} - 导出是否成功
     */
    function exportRecording(recordedEntries) {
        if (!recordedEntries || recordedEntries.length === 0) {
            alert('暂无录音内容可导出');
            return false;
        }
        var content = '';
        recordedEntries.forEach(function(entry) {
            content += '【' + entry.time + '】\n' + entry.text + '\n\n';
        });
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var now = new Date();
        var filename = 'recording_' + now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') + '.txt';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }

    // 暴露公共接口供外部调用
    window.ExportModule = {
        exportRecording: exportRecording
    };
})();
