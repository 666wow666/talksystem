/**
 * 工作区管理器模块
 * 负责笔录编辑、导出功能、基本信息管理、全屏模式等
 */
(function() {
    'use strict';

    // ==================== 笔录编辑功能 ====================

    /**
     * 执行富文本编辑命令
     * @param {string} cmd - 编辑命令（如 bold, italic, fontSize 等）
     * @param {*} value - 命令参数
     * @param {HTMLElement} targetElement - 目标编辑区域元素
     */
    function formatDoc(cmd, value, targetElement) {
        var target = targetElement || document.getElementById('record-output');
        if (target) {
            target.focus();
            document.execCommand(cmd, false, value);
        }
    }

    /**
     * 获取笔录HTML内容
     * @returns {string} - 笔录HTML内容
     */
    function getRecordContent() {
        var recordOutput = document.getElementById('record-output');
        return recordOutput ? recordOutput.innerHTML : '';
    }

    /**
     * 保存笔录内容到localStorage
     */
    function saveRecordContent() {
        var content = getRecordContent();
        if (content) {
            localStorage.setItem('recordContent', content);
        }
    }

    /**
     * 从localStorage加载笔录内容
     */
    function loadRecordContent() {
        var savedContent = localStorage.getItem('recordContent');
        if (savedContent) {
            var recordOutput = document.getElementById('record-output');
            if (recordOutput) {
                recordOutput.innerHTML = savedContent;
                var placeholder = recordOutput.querySelector('.record-placeholder');
                if (placeholder && recordOutput.textContent.trim()) {
                    placeholder.style.display = 'none';
                }
            }
        }
    }

    /**
     * 初始化笔录内容监听
     */
    function initRecordInput() {
        var recordOutput = document.getElementById('record-output');
        if (!recordOutput) return;

        recordOutput.addEventListener('input', function() {
            var text = this.textContent.trim();
            if (text) {
                this.classList.add('has-content');
            } else {
                this.classList.remove('has-content');
            }
            if (window.recordSaveTimer) clearTimeout(window.recordSaveTimer);
            window.recordSaveTimer = setTimeout(saveRecordContent, 500);
        });
    }

    // ==================== 导出功能 ====================

    /**
     * 显示导出格式选择菜单
     */
    function showExportMenu() {
        var outputDiv = document.getElementById('record-output');
        if (!outputDiv) return;
        var textContent = outputDiv.textContent.trim();

        if (!textContent || textContent === '笔录内容将显示在这里' ||
            textContent === '可点击生成笔录后编辑，或直接在此输入' ||
            textContent === '请在此输入') {
            alert('请先生成笔录内容或手动输入');
            return;
        }

        var menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML =
            '<div class="export-menu-content">' +
                '<div class="export-menu-title">选择导出格式</div>' +
                '<div class="export-menu-options">' +
                    '<button class="export-menu-btn" onclick="WorkspaceManager.exportRecord(\'doc\')">' +
                        '<i class="fas fa-file-word"></i>' +
                        '<span>.doc</span>' +
                    '</button>' +
                    '<button class="export-menu-btn" onclick="WorkspaceManager.exportRecord(\'txt\')">' +
                        '<i class="fas fa-file-alt"></i>' +
                        '<span>.txt</span>' +
                    '</button>' +
                '</div>' +
            '</div>';

        menu.addEventListener('click', function(e) {
            if (e.target === menu) {
                menu.remove();
            }
        });

        document.body.appendChild(menu);
        menu.classList.add('active');

        setTimeout(function() {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target.id !== 'export-record-btn') {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 10);
    }

    /**
     * 执行笔录导出
     * @param {string} format - 导出格式，'doc' 或 'txt'
     */
    function exportRecord(format) {
        var outputDiv = document.getElementById('record-output');
        if (!outputDiv) return;
        var content = outputDiv.innerHTML.trim();
        var textContent = outputDiv.textContent.trim();

        if (!textContent || textContent === '笔录内容将显示在这里' ||
            textContent === '可点击生成笔录后编辑，或直接在此输入' ||
            textContent === '请在此输入') {
            alert('请先生成笔录内容或手动输入');
            return;
        }

        var now = new Date();
        var dateStr = now.getFullYear() +
                      String(now.getMonth() + 1).padStart(2, '0') +
                      String(now.getDate()).padStart(2, '0') + '_' +
                      String(now.getHours()).padStart(2, '0') +
                      String(now.getMinutes()).padStart(2, '0');

        if (format === 'doc') {
            exportAsDoc(content, dateStr);
        } else if (format === 'txt') {
            exportAsTxt(outputDiv, dateStr);
        }
    }

    /**
     * 导出为Word文档格式（.doc）
     * @param {string} content - HTML内容
     * @param {string} dateStr - 文件名日期部分
     */
    function exportAsDoc(content, dateStr) {
        try {
            var htmlContent =
                '<!DOCTYPE html>' +
                '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
                '<head>' +
                '<meta charset="utf-8">' +
                '<title>询问笔录</title>' +
                '<style>' +
                'body { font-family: \'仿宋_GB2312\', \'仿宋\', FangSong, SimSun; font-size: 10pt !important; margin: 2cm 2.5cm 2cm 2cm; }' +
                'h1 { text-align: center; font-size: 20pt; font-weight: bold; margin: 30px 0; }' +
                'div, p { font-size: inherit !important; }' +
                '</style>' +
                '<!--[if gte mso 9]>' +
                '<xml>' +
                '<w:WordDocument>' +
                '<w:View>Print</w:View>' +
                '</w:WordDocument>' +
                '</xml>' +
                '<![endif]-->' +
                '</head>' +
                '<body>' +
                '<h1>询问笔录</h1>' +
                content +
                '</body>' +
                '</html>';

            var blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '笔录_' + dateStr + '.doc';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            alert('导出失败，请稍后重试');
        }
    }

    /**
     * 导出为纯文本格式（.txt）
     * @param {HTMLElement} outputDiv - 笔录内容DOM元素
     * @param {string} dateStr - 文件名日期部分
     */
    function exportAsTxt(outputDiv, dateStr) {
        function extractText(node) {
            var result = '';
            if (node.nodeType === Node.TEXT_NODE) {
                result = node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                var tagName = node.tagName.toLowerCase();
                if (tagName === 'p' || tagName === 'div' || tagName === 'h1' ||
                    tagName === 'h2' || tagName === 'h3' || tagName === 'li' ||
                    tagName === 'br') {
                    if (tagName === 'br') {
                        result = '\n';
                    } else {
                        for (var i = 0; i < node.childNodes.length; i++) {
                            result += extractText(node.childNodes[i]);
                        }
                        result += '\n';
                    }
                } else {
                    for (var j = 0; j < node.childNodes.length; j++) {
                        result += extractText(node.childNodes[j]);
                    }
                }
            }
            return result;
        }

        var rawText = extractText(outputDiv);
        var txtContent = rawText
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '询问笔录_' + dateStr + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== 身份证号处理 ====================

    /**
     * 从身份证号提取出生日期和计算年龄
     * @param {string} idCard - 18位身份证号
     * @returns {Object} - 包含birthDate和age和gender的对象
     */
    function parseIdCard(idCard) {
        if (!idCard || idCard.length !== 18) {
            return { birthDate: '', age: '', gender: '' };
        }

        const year = idCard.substring(6, 10);
        const month = idCard.substring(10, 12);
        const day = idCard.substring(12, 14);
        const birthDateStr = year + '年' + month + '月' + day + '日';

        const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        const genderCode = parseInt(idCard.charAt(16));
        let gender = '';
        if (!isNaN(genderCode)) {
            gender = genderCode % 2 === 1 ? '男' : '女';
        }

        return { birthDate: birthDateStr, age: age + '岁', gender: gender };
    }

    // ==================== 基本信息管理 ====================

    /**
     * 获取基本信息
     * @returns {Object|null} - 基本信息对象或null
     */
    function getBasicInfo() {
        var savedInfo = localStorage.getItem('basicInfo');
        return savedInfo ? JSON.parse(savedInfo) : null;
    }

    /**
     * 打开基本信息弹窗
     */
    function openBasicInfoModal() {
        loadBasicInfoToDisplay();
        document.getElementById('basicInfoModal').classList.add('active');
        switchToDisplayMode();
    }

    /**
     * 关闭基本信息弹窗
     */
    function closeBasicInfoModal() {
        document.getElementById('basicInfoModal').classList.remove('active');
    }

    /**
     * 加载基本信息到显示区域
     */
    function loadBasicInfoToDisplay() {
        var info = getBasicInfo() || {};

        var els = {
            displayInquirerName: info.inquirerName || '-',
            displayRespondentName: info.respondentName || '-',
            displayIdCard: info.idCard || '-',
            displayBirthDate: info.birthDate || '-',
            displayAge: info.age || '-',
            displayGender: info.gender || '-',
            displayAddress: info.address || '-',
            displayRegisteredAddress: info.registeredAddress || '-',
            displayPhone: info.phone || '-',
            displayOccupation: info.occupation || '-',
            displayIsNPCDeputy: info.isNPCDeputy || '-',
            displayCaseRelation: info.caseRelation || '-'
        };

        Object.keys(els).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = els[id];
        });
    }

    /**
     * 切换到编辑模式
     */
    function switchToEditMode() {
        var info = getBasicInfo() || {};

        var editEls = {
            editInquirerName: info.inquirerName || '',
            editRespondentName: info.respondentName || '',
            editIdCard: info.idCard || '',
            editBirthDate: info.birthDate || '',
            editAge: info.age || '',
            editGender: info.gender || '',
            editAddress: info.address || '',
            editRegisteredAddress: info.registeredAddress || '',
            editPhone: info.phone || '',
            editOccupation: info.occupation || '',
            editCaseRelation: info.caseRelation || ''
        };

        Object.keys(editEls).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = editEls[id];
        });

        // 设置单选按钮状态
        var radios = document.getElementsByName('editIsNPCDeputy');
        for (var r = 0; r < radios.length; r++) {
            radios[r].checked = radios[r].value === (info.isNPCDeputy || '否');
        }

        handleEditIdCardChange();

        var idCardInput = document.getElementById('editIdCard');
        if (idCardInput) {
            idCardInput.addEventListener('input', handleEditIdCardChange);
        }

        document.getElementById('infoDisplayArea').classList.add('hidden');
        document.getElementById('infoEditArea').classList.add('active');

        document.getElementById('infoFooter').innerHTML =
            '<button class="basic-info-btn cancel" onclick="WorkspaceManager.switchToDisplayMode()">' +
                '<i class="fas fa-times mr-1"></i>取消' +
            '</button>' +
            '<button class="basic-info-btn save" onclick="WorkspaceManager.saveBasicInfo()">' +
                '<i class="fas fa-save mr-1"></i>保存' +
            '</button>';
    }

    /**
     * 切换到显示模式
     */
    function switchToDisplayMode() {
        document.getElementById('infoDisplayArea').classList.remove('hidden');
        document.getElementById('infoEditArea').classList.remove('active');
        document.getElementById('infoFooter').innerHTML =
            '<button class="basic-info-btn edit" onclick="WorkspaceManager.switchToEditMode()">' +
                '<i class="fas fa-edit mr-1"></i>修改' +
            '</button>';
        loadBasicInfoToDisplay();
    }

    /**
     * 处理身份证号输入变化
     */
    function handleEditIdCardChange() {
        const idCard = document.getElementById('editIdCard').value.trim();
        const birthAgeGenderRow = document.getElementById('editBirthAgeGenderRow');
        const birthDateInput = document.getElementById('editBirthDate');
        const ageInput = document.getElementById('editAge');
        const genderInput = document.getElementById('editGender');

        if (idCard.length === 18) {
            const result = parseIdCard(idCard);
            if (birthDateInput) birthDateInput.value = result.birthDate;
            if (ageInput) ageInput.value = result.age;
            if (genderInput) genderInput.value = result.gender;
            if (birthAgeGenderRow) birthAgeGenderRow.style.display = 'flex';
        } else {
            if (birthDateInput) birthDateInput.value = '';
            if (ageInput) ageInput.value = '';
            if (genderInput) genderInput.value = '';
            if (birthAgeGenderRow) birthAgeGenderRow.style.display = 'none';
        }
    }

    /**
     * 保存基本信息
     */
    function saveBasicInfo() {
        var formData = {
            inquirerName: document.getElementById('editInquirerName').value.trim(),
            respondentName: document.getElementById('editRespondentName').value.trim(),
            idCard: document.getElementById('editIdCard').value.trim(),
            birthDate: document.getElementById('editBirthDate').value.trim(),
            age: document.getElementById('editAge').value.trim(),
            gender: document.getElementById('editGender').value.trim(),
            address: document.getElementById('editAddress').value.trim(),
            registeredAddress: document.getElementById('editRegisteredAddress').value.trim(),
            phone: document.getElementById('editPhone').value.trim(),
            occupation: document.getElementById('editOccupation').value.trim(),
            isNPCDeputy: document.querySelector('input[name="editIsNPCDeputy"]:checked').value,
            caseRelation: document.getElementById('editCaseRelation').value.trim()
        };

        localStorage.setItem('basicInfo', JSON.stringify(formData));
        switchToDisplayMode();
    }

    /**
     * 从基本信息插入笔录头部
     */
    function insertRecordHeaderFromBasicInfo() {
        var basicInfo = getBasicInfo();
        if (window.Workflow2Module && window.Workflow2Module.insertRecordHeader) {
            window.Workflow2Module.setCurrentBasicInfo(basicInfo);
            window.Workflow2Module.insertRecordHeader(basicInfo);
        }
    }

    // ==================== 全屏功能 ====================

    /**
     * 打开笔录区域全屏模式
     */
    function openWorkflow2Fullscreen() {
        var recordWrapper = document.querySelector('.record-wrapper');
        if (!recordWrapper) return;

        var originalRecordOutput = document.getElementById('record-output');
        var toolbar = recordWrapper.querySelector('.record-toolbar');

        // 保存原元素的位置信息（供关闭时恢复）
        window._fullscreenState = {
            originalParent: originalRecordOutput.parentNode,
            originalNextSibling: originalRecordOutput.nextSibling,
            originalToolbar: toolbar
        };

        var fullscreenModal = document.createElement('div');
        fullscreenModal.className = 'fullscreen-modal active';
        fullscreenModal.id = 'fullscreenModal';

        fullscreenModal.innerHTML =
            '<div class="fullscreen-content wf2-fullscreen">' +
                '<div class="fullscreen-header">' +
                    '<span>笔录</span>' +
                    '<button class="fullscreen-close" onclick="WorkspaceManager.closeWorkflow2Fullscreen()">' +
                        '<i class="fas fa-times"></i>' +
                    '</button>' +
                '</div>' +
                '<div class="wf2-fullscreen-body">' +
                    '<div class="record-toolbar-fullscreen"></div>' +
                    '<div class="record-output-container"></div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(fullscreenModal);

        var fullscreenToolbarContainer = fullscreenModal.querySelector('.record-toolbar-fullscreen');
        var fullscreenOutputContainer = fullscreenModal.querySelector('.record-output-container');

        var toolbarClone = toolbar.cloneNode(true);
        fullscreenToolbarContainer.appendChild(toolbarClone);
        fullscreenOutputContainer.appendChild(originalRecordOutput);

        rebindToolbarButtons(toolbarClone, originalRecordOutput);

        fullscreenModal.addEventListener('click', function(e) {
            if (e.target === fullscreenModal) closeWorkflow2Fullscreen();
        });
    }

    /**
     * 关闭笔录全屏模式
     */
    function closeWorkflow2Fullscreen() {
        var modal = document.getElementById('fullscreenModal');
        var state = window._fullscreenState;
        if (modal && state) {
            var recordOutput = document.getElementById('record-output');
            if (state.originalNextSibling) {
                state.originalParent.insertBefore(recordOutput, state.originalNextSibling);
            } else {
                state.originalParent.appendChild(recordOutput);
            }
            modal.classList.remove('active');
            setTimeout(function() { modal.remove(); }, 300);
            window._fullscreenState = null;
        }
    }

    /**
     * 重新绑定工具栏按钮事件
     * @param {HTMLElement} toolbar - 工具栏元素
     * @param {HTMLElement} targetElement - 目标编辑区域元素
     */
    function rebindToolbarButtons(toolbar, targetElement) {
        var buttons = toolbar.querySelectorAll('button');
        buttons.forEach(function(btn) {
            var onclick = btn.getAttribute('onclick');
            if (onclick) {
                var match = onclick.match(/formatDoc\(['"]([^'"]+)['"]\)/);
                if (match) {
                    var formatType = match[1];
                    btn.onclick = function() {
                        formatDoc(formatType, targetElement);
                    };
                }
            }
        });

        var selects = toolbar.querySelectorAll('select');
        selects.forEach(function(select) {
            var onchange = select.getAttribute('onchange');
            if (onchange) {
                var match = onchange.match(/formatDoc\(['"]([^'"]+)['"],\s*this\.value\)/);
                if (match) {
                    var formatType = match[1];
                    select.onchange = function() {
                        var value = this.value;
                        if (value) {
                            formatDoc(formatType, value, targetElement);
                        }
                        this.value = '';
                    };
                }
            }
        });
    }

    /**
     * 打开面板全屏模式（通用）
     * @param {string} panelId - 面板ID
     * @param {string} title - 标题
     */
    function openFullscreen(panelId, title) {
        var panel = document.getElementById(panelId);
        if (!panel) return;

        var fullscreenModal = document.createElement('div');
        fullscreenModal.className = 'fullscreen-modal active';
        fullscreenModal.id = 'fullscreenModal';
        fullscreenModal.innerHTML =
            '<div class="fullscreen-content">' +
                '<div class="fullscreen-header">' +
                    '<span>' + title + '</span>' +
                    '<button class="fullscreen-close" onclick="WorkspaceManager.closeFullscreen()">' +
                        '<i class="fas fa-times"></i>' +
                    '</button>' +
                '</div>' +
                '<div class="fullscreen-body">' + panel.innerHTML + '</div>' +
            '</div>';

        document.body.appendChild(fullscreenModal);
        fullscreenModal.addEventListener('click', function(e) {
            if (e.target === fullscreenModal) closeFullscreen();
        });
    }

    /**
     * 关闭全屏模式（通用）
     */
    function closeFullscreen() {
        var modal = document.getElementById('fullscreenModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(function() { modal.remove(); }, 300);
        }
    }

    // ==================== 按钮事件绑定 ====================

    /**
     * 绑定工作区按钮事件
     */
    function bindButtonEvents() {
        // 生成笔录按钮
        var generateBtn = document.getElementById('generate-record-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', function() {
                var recordText = document.getElementById('result');
                recordText = recordText ? recordText.textContent.trim() : '';
                var recordOutput = document.getElementById('record-output');
                var savedRecordContent = recordOutput ? recordOutput.textContent.trim() : '';

                if (savedRecordContent && savedRecordContent !== '请在此输入') {
                    return;
                }

                if (!recordText) {
                    alert('请先录音或手动输入内容');
                    return;
                }

                var basicInfo = getBasicInfo();
                if (window.Workflow2Module && window.Workflow2Module.send) {
                    window.Workflow2Module.send(recordText, basicInfo);
                }
            });
        }

        // 导出笔录按钮
        var exportBtn = document.getElementById('export-record-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', showExportMenu);
        }

        // 导出录音按钮
        var exportResultBtn = document.getElementById('export-result-btn');
        if (exportResultBtn) {
            exportResultBtn.addEventListener('click', function() {
                if (window.ExportModule && window.ExportModule.exportRecording) {
                    var recordedEntries = [];
                    if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.getRecordedEntries) {
                        recordedEntries = window.SpeechRecognitionModule.getRecordedEntries() || [];
                    }
                    window.ExportModule.exportRecording(recordedEntries);
                }
            });
        }

        // 基本信息按钮
        var basicInfoBtn = document.getElementById('basic-info-btn');
        if (basicInfoBtn) {
            basicInfoBtn.addEventListener('click', openBasicInfoModal);
        }
    }

    // ==================== 初始化 ====================

    function init() {
        initRecordInput();
        bindButtonEvents();
    }

    // ==================== 导出公共接口 ====================

    window.WorkspaceManager = {
        init: init,
        formatDoc: formatDoc,
        getRecordContent: getRecordContent,
        saveRecordContent: saveRecordContent,
        loadRecordContent: loadRecordContent,
        showExportMenu: showExportMenu,
        exportRecord: exportRecord,
        exportAsDoc: exportAsDoc,
        exportAsTxt: exportAsTxt,
        parseIdCard: parseIdCard,
        getBasicInfo: getBasicInfo,
        openBasicInfoModal: openBasicInfoModal,
        closeBasicInfoModal: closeBasicInfoModal,
        switchToEditMode: switchToEditMode,
        switchToDisplayMode: switchToDisplayMode,
        saveBasicInfo: saveBasicInfo,
        insertRecordHeaderFromBasicInfo: insertRecordHeaderFromBasicInfo,
        openWorkflow2Fullscreen: openWorkflow2Fullscreen,
        closeWorkflow2Fullscreen: closeWorkflow2Fullscreen,
        openFullscreen: openFullscreen,
        closeFullscreen: closeFullscreen
    };
})();
