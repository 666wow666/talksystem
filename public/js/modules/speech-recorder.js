
(function() {
    var recorder;
    var onFrameRecorded, onStop, onStart, onError;

    function initRecorder(basePath) {
        recorder = new RecorderManager(basePath);
        recorder.onFrameRecorded = function(data) {
            if (onFrameRecorded) onFrameRecorded(data);
        };
        recorder.onStop = function() {
            if (onStop) onStop();
        };
        recorder.onStart = function() {
            if (onStart) onStart();
            if (window.SpeechRecognitionModule) {
                window.SpeechRecognitionModule.changeBtnStatus("OPEN");
            }
        };
        recorder.onError = function(error) {
            if (onError) onError(error);
            if (window.SpeechRecognitionModule) {
                window.SpeechRecognitionModule.changeBtnStatus("CLOSED");
            }
        };
    }

    function start(options) {
        if (recorder) {
            recorder.start(options);
        }
    }

    function stop() {
        if (recorder) {
            recorder.stop();
        }
    }

    function setCallbacks(callbacks) {
        onFrameRecorded = callbacks.onFrameRecorded;
        onStop = callbacks.onStop;
        onStart = callbacks.onStart;
        onError = callbacks.onError;
    }

    window.SpeechRecorder = {
        init: initRecorder,
        start: start,
        stop: stop,
        setCallbacks: setCallbacks
    };
})();
