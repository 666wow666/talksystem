/**
 * 侧边栏管理器模块
 * 单层审讯结构：每个审讯项完全独立隔离
 * 数据持久化：data/interrogations.json（服务器端）
 * 
 * 缓存链路（保存+加载）：
 *   保存: SpeechRecognitionModule.renderResult → saveToServer → SidebarManager.saveTranscription → PUT /api/interrogations/:id
 *   加载: SidebarManager.init → fetch /api/interrogations → loadActiveIntoWorkspace → SpeechRecognitionModule.setResultText
 */
(function() {
    'use strict';

    var state = {
        currentSection: 'interrogation',
        interrogations: [],
        activeId: null,
        saveTimer: null,
        collapsed: false,
        isLoading: false,
        initialLoad: true
    };

    function api(method, url, body) {
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body !== undefined) opts.body = JSON.stringify(body);
        return fetch(url, opts).then(function(r) { return r.json(); });
    }

    function loadFromServer() {
        return api('GET', '/api/interrogations').then(function(data) {
            state.interrogations = data.interrogations || [];
            state.activeId = data.activeId || null;
            console.log('[Sidebar] 服务器加载完成，审讯数:', state.interrogations.length, '当前激活:', state.activeId);
            if (state.interrogations.length > 0) {
                var active = state.interrogations.find(function(i) { return i.id === state.activeId; }) || state.interrogations[0];
                console.log('[Sidebar] 激活审讯名称:', active.name, 'transcribedText长度:', (active.data && active.data.transcribedText) ? active.data.transcribedText.length : 0);
            }
            return state;
        });
    }

    function scheduleSave(immediate) {
        if (state.saveTimer) clearTimeout(state.saveTimer);
        var doSave = function() {
            var active = getActiveInterrogation();
            if (active) {
                var saveData = {
                    content: {
                        recordContent: getRecordHtmlSafe(),
                        transcribedText: getResultText(),
                        recommendedQuestions: getQuestionsSnapshot(),
                        workflow1History: getWorkflow1History()
                    },
                    activeId: state.activeId
                };
                api('PUT', '/api/interrogations/' + active.id, saveData).then(function() {
                    console.log('[Sidebar] 保存成功，转写文本长度:', saveData.content.transcribedText.length);
                }).catch(function(err) {
                    console.error('[Sidebar] 保存失败:', err);
                });
            }
        };
        if (immediate) {
            doSave();
        } else {
            state.saveTimer = setTimeout(doSave, 800);
        }
    }

    function saveTranscription(text, immediate) {
        var active = getActiveInterrogation();
        if (!active) {
            console.log('[Sidebar] saveTranscription: 无激活审讯，自动创建新审讯');
            autoCreateAndSave(text);
            return;
        }

        var saveData = {
            content: {
                recordContent: getRecordHtmlSafe(),
                transcribedText: text || '',
                recommendedQuestions: getQuestionsSnapshot(),
                workflow1History: getWorkflow1History()
            },
            activeId: state.activeId
        };

        if (state.saveTimer) clearTimeout(state.saveTimer);

        var doSave = function() {
            api('PUT', '/api/interrogations/' + active.id, saveData).then(function(resp) {
                console.log('[Sidebar] saveTranscription: 保存成功，长度:', (text || '').length);
                if (resp && resp.item) {
                    var idx = state.interrogations.find(function(i) { return i.id === active.id; });
                    if (idx >= 0) {
                        state.interrogations[idx] = resp.item;
                    }
                }
            }).catch(function(err) {
                console.error('[Sidebar] saveTranscription: 保存失败:', err);
            });
        };

        if (immediate) {
            doSave();
        } else {
            state.saveTimer = setTimeout(doSave, 500);
        }
    }

    function autoCreateAndSave(text) {
        if (state._autoCreating) return;
        state._autoCreating = true;

        var count = state.interrogations.length + 1;
        var name = '心理谈话 ' + count;
        api('POST', '/api/interrogations', { name: name }).then(function(data) {
            if (data && data.item) {
                state.interrogations.push(data.item);
                state.activeId = data.item.id;
                var saveData = {
                    content: {
                        recordContent: '',
                        transcribedText: text || '',
                        recommendedQuestions: [null, null, null, null, null],
                        workflow1History: []
                    },
                    activeId: state.activeId
                };
                return api('PUT', '/api/interrogations/' + data.item.id, saveData).then(function(resp) {
                    if (resp && resp.item) {
                        var idx = state.interrogations.findIndex(function(i) { return i.id === data.item.id; });
                        if (idx >= 0) state.interrogations[idx] = resp.item;
                    }
                    console.log('[Sidebar] autoCreateAndSave: 已创建审讯并保存，长度:', (text || '').length);
                    renderMenu();
                    updateHeaderTitle();
                    state._autoCreating = false;
                });
            }
            state._autoCreating = false;
        }).catch(function(err) {
            console.error('[Sidebar] autoCreateAndSave: 失败:', err);
            state._autoCreating = false;
        });
    }

    function getRecordHtmlSafe() {
        var el = document.getElementById('record-output');
        if (!el) return '';
        var placeholder = el.querySelector('.record-placeholder');
        if (placeholder && !el.classList.contains('has-content') && placeholder.style.display !== 'none') {
            return '';
        }
        return el.innerHTML;
    }

    function getResultText() {
        if (window.SpeechRecognitionModule && typeof window.SpeechRecognitionModule.getResultText === 'function') {
            var moduleText = window.SpeechRecognitionModule.getResultText();
            if (moduleText !== undefined && moduleText !== null) {
                return moduleText;
            }
        }
        var el = document.getElementById('result');
        return el ? el.textContent || '' : '';
    }

    function getQuestionsSnapshot() {
        var q = [];
        for (var i = 1; i <= 5; i++) {
            var el = document.getElementById('workflow1-q' + i + '-content');
            q.push(el && el.textContent ? el.textContent.trim() : null);
        }
        return q;
    }

    function getWorkflow1History() {
        if (window.TalkGuideManager && typeof window.TalkGuideManager.getSnapshot === 'function') {
            return window.TalkGuideManager.getSnapshot();
        }
        return [];
    }

    function getActiveInterrogation() {
        if (!state.activeId) return null;
        return state.interrogations.find(function(i) { return i.id === state.activeId; }) || null;
    }

    function renderMenu() {
        var list = document.getElementById('interrogationList');
        if (!list) return;
        list.innerHTML = '';

        if (state.collapsed) {
            renderCollapsedInterrogations();
            updateSectionActiveState();
            return;
        }

        if (!state.interrogations || state.interrogations.length === 0) {
            var emptyHint = document.createElement('div');
            emptyHint.className = 'menu-empty-hint';
            emptyHint.textContent = '暂无谈话，点击 + 新建';
            list.appendChild(emptyHint);
            updateSectionActiveState();
            return;
        }

        state.interrogations.forEach(function(item) {
            var isActive = item.id === state.activeId;

            var row = document.createElement('div');
            row.className = 'menu-item menu-item-child' + (isActive ? ' active' : '');
            row.dataset.id = item.id;

            var icon = document.createElement('i');
            icon.className = 'menu-child-dot';
            row.appendChild(icon);

            var label = document.createElement('span');
            label.className = 'menu-label';
            label.textContent = item.name;
            label.title = '双击重命名';
            label.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                startRename(item, label);
            });
            row.appendChild(label);

            var actionGroup = document.createElement('span');
            actionGroup.className = 'menu-actions';

            var delBtn = document.createElement('button');
            delBtn.className = 'menu-delete-btn';
            delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            delBtn.title = '删除';
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteInterrogation(item);
            });
            actionGroup.appendChild(delBtn);

            row.appendChild(actionGroup);

            row.addEventListener('click', function() {
                selectInterrogation(item.id);
            });

            list.appendChild(row);
        });

        updateSectionActiveState();
    }

    function updateSectionActiveState() {
        document.querySelectorAll('.menu-section').forEach(function(sec) {
            var section = sec.dataset.section;
            var parentItem = sec.querySelector('.menu-item-parent');
            if (parentItem) {
                parentItem.classList.toggle('active', section === state.currentSection);
            }
        });
    }

    function startRename(item, labelEl) {
        var original = item.name;
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'menu-rename-input';
        input.value = original;
        labelEl.textContent = '';
        labelEl.appendChild(input);
        input.focus();
        input.select();

        function commit() {
            var newName = input.value.trim() || original;
            item.name = newName;
            labelEl.textContent = newName;
            api('PUT', '/api/interrogations/' + item.id, { name: newName });
            updateHeaderTitle();
        }

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commit();
            } else if (e.key === 'Escape') {
                labelEl.textContent = original;
            }
        });
        input.addEventListener('blur', commit);
        input.addEventListener('click', function(e) { e.stopPropagation(); });
    }

    function addInterrogation() {
        // 打开新建谈话选择弹窗
        if (window.ConversationManager && window.ConversationManager.openStartModal) {
            window.ConversationManager.openStartModal();
        } else {
            // 兜底：旧逻辑
            var oldActive = getActiveInterrogation();
            if (oldActive) {
                if (!oldActive.data) oldActive.data = {};
                oldActive.data.recordContent = getRecordHtmlSafe();
                oldActive.data.transcribedText = getResultText();
                oldActive.data.recommendedQuestions = getQuestionsSnapshot();
            }

            var count = state.interrogations.length + 1;
            var name = '心理谈话 ' + count;
            api('POST', '/api/interrogations', { name: name }).then(function(data) {
                if (data && data.item) {
                    state.interrogations.push(data.item);
                    state.activeId = data.item.id;
                    api('PUT', '/api/interrogations/' + data.item.id, {
                        content: {},
                        activeId: data.item.id
                    });
                    renderMenu();
                    loadActiveIntoWorkspace();
                }
            });
        }
    }

    function deleteInterrogation(item) {
        var confirmMsg = '确定删除谈话 "' + item.name + '" 吗？\n\n' +
                        '删除后将同时清除以下内容：\n' +
                        '• 谈话记录\n' +
                        '• 对话转写记录\n' +
                        '• 问题推荐历史\n\n' +
                        '此操作不可撤销！';
        if (!confirm(confirmMsg)) return;
        api('DELETE', '/api/interrogations/' + item.id).then(function(res) {
            if (res.success) {
                state.interrogations = state.interrogations.filter(function(i) { return i.id !== item.id; });
                if (state.activeId === item.id) {
                    state.activeId = state.interrogations.length > 0 ? state.interrogations[0].id : null;
                }
                renderMenu();
                loadActiveIntoWorkspace();
            } else {
                alert('删除失败：' + (res.error || '未知错误'));
            }
        }).catch(function() {
            alert('删除失败，请稍后重试');
        });
    }

    function selectInterrogation(id) {
        if (state.currentSection !== 'interrogation') {
            selectSection('interrogation');
        }
        if (id === state.activeId) return;

        var oldActive = getActiveInterrogation();
        if (oldActive) {
            if (!oldActive.data) oldActive.data = {};
            oldActive.data.recordContent = getRecordHtmlSafe();
            oldActive.data.transcribedText = getResultText();
            oldActive.data.recommendedQuestions = getQuestionsSnapshot();
        }

        state.activeId = id;
        renderMenu();
        loadActiveIntoWorkspace();
        scheduleSave();
    }

    function selectSection(section, params) {
        state.currentSection = section;
        document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
        if (section === 'interrogation') {
            document.getElementById('viewInterrogation').classList.add('active');
            // 如果当前激活的 interrogation 有 metadata（学生信息），更新页面显示
            var active = getActiveInterrogation();
            if (active && active.metadata && window.ConversationManager && window.ConversationManager.updateInterrogationPage) {
                window.ConversationManager.updateInterrogationPage();
            }
        } else if (section === 'case') {
            document.getElementById('viewCase').classList.add('active');
            // 激活学生档案页时自动加载学生列表
            if (window.StudentArchiveManager && window.StudentArchiveManager.loadStudentList) {
                window.StudentArchiveManager.loadStudentList();
            }
        } else if (section === 'profile') {
            document.getElementById('viewProfile').classList.add('active');
            // 激活个人画像页时加载学生信息
            if (window.StudentArchiveManager && window.StudentArchiveManager.loadProfile) {
                window.StudentArchiveManager.loadProfile(params);
            }
        } else if (section === 'start-conversation') {
            var el = document.getElementById('viewStartConversation');
            if (el) el.classList.add('active');
        }
        updateSectionActiveState();
        updateCollapsedSectionActiveState();
    }

    function loadActiveIntoWorkspace() {
        var active = getActiveInterrogation();
        var emptyEl = document.getElementById('interrogationEmpty');
        var gridEl = document.getElementById('interrogationGrid');

        if (!active) {
            if (emptyEl) emptyEl.classList.add('show');
            if (gridEl) gridEl.style.display = 'none';
            updateHeaderTitle();
            console.log('[Sidebar] loadActiveIntoWorkspace: 无激活审讯，清空');
            if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.setResultText) {
                window.SpeechRecognitionModule.setResultText('');
            }
            state.initialLoad = false;
            return;
        }
        if (emptyEl) emptyEl.classList.remove('show');
        if (gridEl) gridEl.style.display = 'grid';

        var data = active.data || {};

        var recordEl = document.getElementById('record-output');
        if (recordEl) {
            if (data.recordContent) {
                recordEl.innerHTML = data.recordContent;
                recordEl.classList.add('has-content');
            } else {
                recordEl.innerHTML = '<div class="record-placeholder"><i class="fas fa-file-alt"></i><span>请在此输入</span></div>';
                recordEl.classList.remove('has-content');
            }
        }

        var resultEl = document.getElementById('result');
        var savedText = data.transcribedText || '';
        console.log('[Sidebar] loadActiveIntoWorkspace: 审讯="', active.name, '" savedText长度:', savedText.length);

        if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.setResultText) {
            window.SpeechRecognitionModule.setResultText(savedText);
            console.log('[Sidebar] loadActiveIntoWorkspace: 已调用 setResultText，长度:', savedText.length);
        } else {
            if (resultEl) resultEl.textContent = savedText;
            console.log('[Sidebar] loadActiveIntoWorkspace: SpeechRecognitionModule 未就绪，直接写入DOM');
        }

        // 优先使用 workflow1History（完整的问题对象，包含 tag/reason）
        // 否则回退到 recommendedQuestions（旧格式：字符串数组）
        var questionList = null;
        if (data.workflow1History && Array.isArray(data.workflow1History) && data.workflow1History.length > 0) {
            questionList = data.workflow1History;
        } else if (data.recommendedQuestions && Array.isArray(data.recommendedQuestions)) {
            questionList = data.recommendedQuestions.filter(function(x) { return x && typeof x === 'string' && x.trim(); }).map(function(text) {
                return { content: text, tag: '', reason: '' };
            });
        }

        // 恢复到 TalkGuideManager
        if (window.TalkGuideManager) {
            if (typeof window.TalkGuideManager.restoreFrom === 'function') {
                window.TalkGuideManager.restoreFrom(questionList || []);
            } else if (typeof window.TalkGuideManager.clear === 'function') {
                window.TalkGuideManager.clear();
            }
        }

        updateHeaderTitle();
        state.initialLoad = false;
        console.log('[Sidebar] loadActiveIntoWorkspace: 完成，问题数:', questionList ? questionList.length : 0);
    }

    function updateHeaderTitle() {
        var titleEl = document.getElementById('caseTitle');
        var active = getActiveInterrogation();
        if (!active) {
            if (titleEl) titleEl.textContent = '心理谈话 1';
            return;
        }
        if (titleEl) titleEl.textContent = active.name;
    }

    function toggleSidebar() {
        state.collapsed = !state.collapsed;
        applyCollapsedState();
        localStorage.setItem('sidebarCollapsed', state.collapsed ? '1' : '0');
    }

    function applyCollapsedState() {
        var sidebar = document.querySelector('.sidebar');
        var appShell = document.querySelector('.app-shell');
        if (!sidebar) return;
        if (state.collapsed) {
            sidebar.classList.add('collapsed');
            updateCollapsedSectionActiveState();
            if (appShell) appShell.style.paddingLeft = '56px';
        } else {
            sidebar.classList.remove('collapsed');
            if (appShell) appShell.style.paddingLeft = '185px';
        }
        renderMenu();
    }

    function updateCollapsedSectionActiveState() {
        document.querySelectorAll('[data-action="collapsed-section"]').forEach(function(btn) {
            var section = btn.dataset.section;
            btn.classList.toggle('active', section === state.currentSection);
        });
    }

    function loadCollapsedState() {
        var saved = localStorage.getItem('sidebarCollapsed');
        if (saved === '1') {
            state.collapsed = true;
        } else {
            state.collapsed = false;
        }
        applyCollapsedState();
    }

    function renderCollapsedInterrogations() {
        var list = document.getElementById('collapsedInterrogationList');
        if (!list) return;
        list.innerHTML = '';

        var addBtn = document.createElement('button');
        addBtn.className = 'collapsed-item collapsed-add';
        addBtn.title = '新建谈话';
        addBtn.innerHTML = '<i class="fas fa-plus"></i><span class="collapsed-tooltip">新建谈话</span>';
        addBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            addInterrogation();
        });
        list.appendChild(addBtn);

        var displayItems = state.interrogations.slice(0, 8);
        displayItems.forEach(function(item) {
            var isActive = item.id === state.activeId;
            var row = document.createElement('button');
            row.className = 'collapsed-item collapsed-interrogation' + (isActive ? ' active' : '');
            row.title = item.name;
            row.innerHTML = '<i class="fas fa-file-alt"></i><span class="collapsed-tooltip">' +
                            escapeHtml(item.name) + '</span>';
            row.addEventListener('click', function(e) {
                e.stopPropagation();
                selectInterrogation(item.id);
            });
            list.appendChild(row);
        });

        if (state.interrogations.length > 8) {
            var moreBtn = document.createElement('button');
            moreBtn.className = 'collapsed-item collapsed-more';
            moreBtn.title = '更多审讯（展开查看）';
            moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i><span class="collapsed-tooltip">展开侧栏查看全部</span>';
            moreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSidebar();
            });
            list.appendChild(moreBtn);
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function bindEvents() {
        document.querySelectorAll('[data-action="add-interrogation"]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                addInterrogation();
            });
        });

        document.querySelectorAll('[data-action="select-section"]').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.menu-add-btn')) return;
                selectSection(item.dataset.section);
            });
        });

        document.querySelectorAll('[data-action="collapsed-section"]').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var section = item.dataset.section;
                selectSection(section);
            });
        });

        var collapseBtn = document.getElementById('sidebarCollapseBtn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSidebar();
            });
        }

        var expandBtn = document.getElementById('sidebarExpandBtn');
        if (expandBtn) {
            expandBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSidebar();
            });
        }

        var record = document.getElementById('record-output');
        if (record) {
            record.addEventListener('input', function() {
                var text = record.textContent.trim();
                if (text && text !== '请在此输入') {
                    record.classList.add('has-content');
                } else {
                    record.classList.remove('has-content');
                }
                scheduleSave();
            });
        }

        var completeBtn = document.getElementById('complete-case-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', function() {
                completeInterrogation();
            });
        }

        // 新的完成按钮（谈话记录页面）
        var interrogationFinishBtn = document.getElementById('interrogationFinishBtn');
        if (interrogationFinishBtn) {
            interrogationFinishBtn.addEventListener('click', function() {
                completeInterrogation();
            });
        }

        window.addEventListener('beforeunload', function(e) {
            var active = getActiveInterrogation();
            if (active) {
                var saveData = {
                    content: {
                        recordContent: getRecordHtmlSafe(),
                        transcribedText: getResultText(),
                        recommendedQuestions: getQuestionsSnapshot(),
                        workflow1History: getWorkflow1History()
                    },
                    activeId: state.activeId
                };
                if (navigator.sendBeacon) {
                    var blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
                    navigator.sendBeacon('/api/interrogations/' + active.id + '?method=PUT', blob);
                    console.log('[Sidebar] beforeunload: sendBeacon 已发送');
                } else {
                    api('PUT', '/api/interrogations/' + active.id, saveData);
                }
            }
        });
    }

    function completeInterrogation() {
        var active = getActiveInterrogation();
        if (!active) {
            alert('请先选择一个谈话记录');
            return;
        }

        // 清空实时引导 buffer（谈话结束）
        if (window.TalkGuideManager && typeof window.TalkGuideManager.clear === 'function') {
            window.TalkGuideManager.clear();
        }

        var transcriptContent = getResultText();
        if (!transcriptContent.trim()) {
            alert('暂无对话内容，请先进行录音');
            return;
        }

        // 检查是否有选中学生（优先从 interrogation.metadata 读取，其次从内存读取）
        var hasStudent = false;
        if (active && active.metadata && active.metadata.studentId) {
            hasStudent = true;
        } else if (window.ConversationManager && window.ConversationManager.getCurrentData) {
            var data = window.ConversationManager.getCurrentData();
            if (data && data.studentId) {
                hasStudent = true;
            }
        }

        if (!hasStudent) {
            alert('请先选择学生');
            return;
        }

        var completeBtn = document.getElementById('interrogationFinishBtn');
        if (completeBtn) {
            completeBtn.disabled = true;
            completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        // 调用工作流2进行角色分离
        fetch('/chat/2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: transcriptContent })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.innerHTML = '<i class="fas fa-check"></i> 完成';
            }

            var analysisResult = data.content || '';

            // 保存到学生档案文件夹
            if (window.ConversationManager && window.ConversationManager.saveConversation) {
                window.ConversationManager.saveConversation(transcriptContent, analysisResult)
                    .then(function(result) {
                        alert('谈话记录已保存到学生档案');
                    })
                    .catch(function(err) {
                        alert('保存失败: ' + (err.message || err || '未知错误'));
                    });
            } else {
                alert('保存模块未加载');
            }
        })
        .catch(function(err) {
            console.error('[完成谈话] 角色分离失败:', err);
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.innerHTML = '<i class="fas fa-check"></i> 完成';
            }
            alert('分析失败，请稍后重试');
        });
    }

    function extractTextFromElement(element) {
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

        var rawText = extractText(element);
        return rawText
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function init() {
        bindEvents();
        loadCollapsedState();
        loadFromServer().then(function() {
            renderMenu();
            loadActiveIntoWorkspace();
            console.log('[Sidebar] 初始化完成 ✓');
        });
    }

    window.SidebarManager = {
        init: init,
        selectInterrogation: selectInterrogation,
        selectSection: selectSection,
        getState: function() { return state; },
        getActive: getActiveInterrogation,
        scheduleSave: scheduleSave,
        saveTranscription: saveTranscription,
        renderMenu: renderMenu,
        getResultText: getResultText,
        loadActiveIntoWorkspace: loadActiveIntoWorkspace
    };

    // ==================== 全局：视图导航 ====================
    // navigateToView('interrogation' | 'case' | 'profile', params)
    window.navigateToView = function(section, params) {
        if (window.SidebarManager && window.SidebarManager.selectSection) {
            window.SidebarManager.selectSection(section, params);
        } else {
            // 兜底：直接切换DOM
            document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
            var el = document.getElementById('view' + section.charAt(0).toUpperCase() + section.slice(1));
            if (el) el.classList.add('active');
        }
    };
})();
