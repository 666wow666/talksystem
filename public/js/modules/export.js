
(function() {
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

    window.ExportModule = {
        exportRecording: exportRecording
    };
})();
