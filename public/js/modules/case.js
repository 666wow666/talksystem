/**
 * 案件管理模块
 * 处理案件列表加载、材料列表、文本展示等功能
 */
(function() {
    'use strict';

    var currentCase = null;
    var currentMaterial = null;

    // ==================== API 封装 ====================

    function api(url, options) {
        var opts = options || {};
        var method = opts.method || 'GET';
        var body = opts.body;

        var fetchOpts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body) fetchOpts.body = JSON.stringify(body);

        return fetch(url, fetchOpts).then(function(r) { return r.json(); });
    }

    // ==================== 加载案件列表 ====================

    function loadCaseList() {
        var listEl = document.getElementById('caseList');
        if (!listEl) return;

        listEl.innerHTML = '<div class="case-loading"><i class="fas fa-spinner fa-spin"></i><span>加载中...</span></div>';

        api('/api/case/list').then(function(data) {
            if (data.success && data.cases.length > 0) {
                renderCaseList(data.cases);
            } else {
                listEl.innerHTML = '<div class="case-empty-list"><i class="fas fa-folder-open"></i><p>暂无案件<br><small>完成审讯后将自动创建案件</small></p></div>';
            }
        }).catch(function(err) {
            console.error('[案件] 加载失败:', err);
            listEl.innerHTML = '<div class="case-empty-list"><i class="fas fa-exclamation-triangle"></i><p>加载失败，请稍后重试</p></div>';
        });
    }

    function renderCaseList(cases) {
        var listEl = document.getElementById('caseList');
        if (!listEl) return;

        listEl.innerHTML = '';

        cases.forEach(function(caseItem) {
            var itemEl = document.createElement('div');
            itemEl.className = 'case-item';
            itemEl.dataset.id = caseItem.id;

            var filesHtml = '';
            var hasRecord = false;
            var hasDoc = false;
            var hasTranscript = false;

            if (caseItem.files) {
                caseItem.files.forEach(function(f) {
                    if (f.includes('笔录')) hasRecord = true;
                    if (f.endsWith('.doc')) hasDoc = true;
                    if (f.includes('转写')) hasTranscript = true;
                });
            }

            if (hasDoc) {
                filesHtml += '<span class="case-file-tag record"><i class="fas fa-file-word"></i> 笔录(Word)</span>';
            } else if (hasRecord) {
                filesHtml += '<span class="case-file-tag record"><i class="fas fa-file-alt"></i> 笔录</span>';
            }
            if (hasTranscript) {
                filesHtml += '<span class="case-file-tag transcript"><i class="fas fa-microphone-alt"></i> 转写</span>';
            }

            itemEl.innerHTML = '<div class="case-item-body">' +
                '<div class="case-item-left">' +
                '<i class="fas fa-folder case-item-icon"></i>' +
                '<span class="case-item-name">' + escapeHtml(caseItem.name) + '</span>' +
                '</div>' +
                '<div class="case-item-right">' +
                '<span class="case-item-date">' + formatDate(caseItem.date) + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="case-item-files">' + filesHtml + '</div>';

            itemEl.addEventListener('click', function() {
                selectCase(caseItem.id);
            });

            listEl.appendChild(itemEl);
        });
    }

    // ==================== 选择案件 ====================

    function selectCase(caseId) {
        // 更新案件列表选中状态
        document.querySelectorAll('.case-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.id === caseId);
        });

        // 加载案件详情（包含材料列表）
        loadCaseDetail(caseId);
    }

    function loadCaseDetail(caseId) {
        api('/api/case/' + caseId).then(function(data) {
            if (data.success && data.case) {
                currentCase = data.case;
                renderMaterialsList(data.case);
                // 右侧显示空状态
                showEmptyDetail();
            } else {
                showEmptyMaterials();
            }
        }).catch(function(err) {
            console.error('[案件] 加载详情失败:', err);
            showEmptyMaterials();
        });
    }

    function renderMaterialsList(caseData) {
        var cardEl = document.getElementById('materialsCard');
        var listEl = document.getElementById('caseMaterialsList');
        if (!cardEl || !listEl) return;

        cardEl.classList.remove('hidden');
        listEl.innerHTML = '';

        if (!caseData.files || caseData.files.length === 0) {
            listEl.innerHTML = '<div class="case-empty-list"><i class="fas fa-file"></i><p>暂无材料</p></div>';
            return;
        }

        caseData.files.forEach(function(file) {
            var fileType = getFileType(file.name);
            var icon = getFileIcon(fileType);
            var iconClass = getFileIconClass(fileType);
            var size = formatFileSize(file.size);

            var itemEl = document.createElement('div');
            itemEl.className = 'material-item';
            itemEl.dataset.filename = file.name;

            itemEl.innerHTML = '<div class="material-icon ' + iconClass + '"><i class="' + icon + '"></i></div>' +
                '<div class="material-info">' +
                '<div class="material-name">' + escapeHtml(file.name) + '</div>' +
                '<div class="material-size">' + size + '</div>' +
                '</div>';

            itemEl.addEventListener('click', function() {
                selectMaterial(file.name);
            });

            listEl.appendChild(itemEl);
        });
    }

    function showEmptyMaterials() {
        var cardEl = document.getElementById('materialsCard');
        var listEl = document.getElementById('caseMaterialsList');
        if (!cardEl || !listEl) return;

        cardEl.classList.remove('hidden');
        listEl.innerHTML = '<div class="case-empty-list"><i class="fas fa-arrow-left"></i><p>请选择案件<br><small>查看材料列表</small></p></div>';
    }

    // ==================== 选择材料 ====================

    function selectMaterial(filename) {
        if (!currentCase) return;

        // 更新材料列表选中状态
        document.querySelectorAll('.material-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.filename === filename);
        });

        loadMaterialContent(filename);
    }

    function loadMaterialContent(filename) {
        var detailEl = document.getElementById('caseDetailPanel');
        if (!detailEl || !currentCase) return;

        currentMaterial = { caseId: currentCase.id, filename: filename };
        var fileType = getFileType(filename);

        // 显示加载状态
        detailEl.innerHTML = '<div class="case-viewer">' +
            '<div class="case-viewer-header">' +
            '<h3><i class="fas fa-file-alt"></i> ' + escapeHtml(filename) + '</h3>' +
            '<button class="case-download-btn" onclick="downloadMaterial(\'' + currentCase.id + '\', \'' + encodeURIComponent(filename) + '\')">' +
            '<i class="fas fa-download"></i> 下载</button>' +
            '</div>' +
            '<div class="case-viewer-body">' +
            '<div class="case-loading"><i class="fas fa-spinner fa-spin"></i><span>加载中...</span></div>' +
            '</div>' +
            '</div>';

        api('/api/case/' + currentCase.id + '/file/' + encodeURIComponent(filename)).then(function(data) {
            if (data.success) {
                renderMaterialContent(data.content, fileType);
            } else {
                renderMaterialContent('加载失败：' + (data.error || '未知错误'), 'error');
            }
        }).catch(function(err) {
            console.error('[材料] 加载失败:', err);
            renderMaterialContent('加载失败，请稍后重试', 'error');
        });
    }

    function renderMaterialContent(content, fileType) {
        var bodyEl = document.querySelector('.case-viewer-body');
        if (!bodyEl) return;

        if (fileType === 'error') {
            bodyEl.innerHTML = '<pre style="color: #dc2626;">' + escapeHtml(content) + '</pre>';
        } else if (fileType === 'doc') {
            // doc 文件是 HTML 格式的 Word 文档，用 iframe 隔离渲染
            var iframe = document.createElement('iframe');
            iframe.style.cssText = 'flex: 1; min-height: 0; width: 100%; border: 1px solid #e5e7eb; background: #ffffff; border-radius: 6px;';
            bodyEl.style.padding = '12px';
            bodyEl.innerHTML = '';
            bodyEl.appendChild(iframe);
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();
        } else {
            // txt / 转写 等文本文件
            bodyEl.style.padding = '';
            bodyEl.innerHTML = '<pre>' + escapeHtml(content) + '</pre>';
        }
    }

    function showEmptyDetail() {
        var detailEl = document.getElementById('caseDetailPanel');
        if (!detailEl) return;

        detailEl.innerHTML = '<div class="case-empty">' +
            '<div class="case-empty-icon"><i class="fas fa-file-alt"></i></div>' +
            '<div class="case-empty-title">选择材料查看内容</div>' +
            '<div class="case-empty-hint">从左侧选择一个材料文件，查看详细内容</div>' +
            '</div>';
    }

    // ==================== 工具函数 ====================

    function getFileType(filename) {
        if (filename.endsWith('.doc')) return 'doc';
        if (filename.includes('转写')) return 'transcript';
        if (filename.includes('笔录')) return 'txt';
        return 'default';
    }

    function getFileIcon(type) {
        switch(type) {
            case 'doc': return 'fas fa-file-word';
            case 'transcript': return 'fas fa-microphone-alt';
            case 'txt': return 'fas fa-file-alt';
            default: return 'fas fa-file';
        }
    }

    function getFileIconClass(type) {
        switch(type) {
            case 'doc': return 'doc';
            case 'transcript': return 'transcript';
            case 'txt': return 'txt';
            default: return '';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        // 数字：毫秒时间戳
        if (typeof dateStr === 'number' || /^\d+$/.test(String(dateStr))) {
            var ts = Number(dateStr);
            if (ts > 1000000000000) {
                // 毫秒时间戳
                var d = new Date(ts);
                var y = d.getFullYear();
                var m = String(d.getMonth() + 1).padStart(2, '0');
                var day = String(d.getDate()).padStart(2, '0');
                var h = String(d.getHours()).padStart(2, '0');
                var min = String(d.getMinutes()).padStart(2, '0');
                return y + '-' + m + '-' + day + ' ' + h + ':' + min;
            }
        }
        if (String(dateStr).length === 8) {
            return dateStr.slice(0, 4) + '-' + dateStr.slice(4, 6) + '-' + dateStr.slice(6, 8);
        }
        return dateStr;
    }

    function formatFileSize(bytes) {
        if (!bytes) return '未知大小';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== 导出函数 ====================

    window.downloadMaterial = function(caseId, filename) {
        window.open('/api/case/' + caseId + '/download/' + filename, '_blank');
    };

    // ==================== 初始化 ====================

    function init() {
        // 案件视图显示时加载列表
        var caseView = document.getElementById('viewCase');
        if (caseView) {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'class') {
                        if (caseView.classList.contains('active')) {
                            loadCaseList();
                            showEmptyMaterials();
                        }
                    }
                });
            });
            observer.observe(caseView, { attributes: true });
        }

        // ESC 关闭
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // 可以添加其他关闭逻辑
            }
        });
    }

    // ==================== 导出 ====================

    window.CaseManager = {
        init: init,
        loadCaseList: loadCaseList,
        selectCase: selectCase
    };
})();
