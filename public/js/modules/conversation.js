/**
 * 谈心谈话会话管理模块
 * - 新建谈话预处理（类型/谈话人/学生选择）
 * - 将学生/类型等信息持久化到 interrogation.metadata
 * - 完成时从 interrogation.metadata 恢复数据并保存到学生档案
 */

(function() {
    'use strict';

    // ============ 状态 ============
    var selectedStudent = null;
    var studentList = [];
    var currentConversationData = null;

    // 谈话类型映射
    var CONVERSATION_TYPES = {
        'daily': '同学日常交流',
        'academic': '学业情况谈心谈话',
        'psychology': '心理状况谈心谈话'
    };

    // ============ 工具函数 ============

    function getActiveInterrogation() {
        if (window.SidebarManager && typeof window.SidebarManager.getState === 'function') {
            var state = window.SidebarManager.getState();
            if (state && state.activeId && state.interrogations) {
                return state.interrogations.find(function(i) { return i.id === state.activeId; }) || null;
            }
        }
        return null;
    }

    function refreshSidebarMenu() {
        if (window.SidebarManager && typeof window.SidebarManager.renderMenu === 'function') {
            window.SidebarManager.renderMenu();
        }
    }

    // ============ 页面控制（替代原先的模态弹窗） ============

    function openStartModal() {
        selectedStudent = null;
        var listEl = document.getElementById('conversationStudentList');

        // 切换到新建谈话视图
        if (window.navigateToView) {
            window.navigateToView('start-conversation');
        } else {
            document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
            var el = document.getElementById('viewStartConversation');
            if (el) el.classList.add('active');
        }

        // 禁用确认按钮
        var confirmBtn = document.getElementById('conversationStartConfirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }

        // 显示加载状态
        if (listEl) {
            listEl.innerHTML = '<div class="conversation-student-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
        }

        // 加载学生列表
        loadStudentList();
    }

    function closeStartModal() {
        selectedStudent = null;
        // 返回学生档案页面
        if (window.navigateToView) {
            window.navigateToView('case');
        } else {
            document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
            var el = document.getElementById('viewCase');
            if (el) el.classList.add('active');
        }
    }

    // ============ 学生列表加载 ============

    function loadStudentList() {
        var listEl = document.getElementById('conversationStudentList');
        if (!listEl) return;

        fetch('/api/student-archive/list')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data || !data.students || data.students.length === 0) {
                    listEl.innerHTML = '<div class="conversation-student-empty"><i class="fas fa-user-friends"></i> 暂无学生档案</div>';
                    return;
                }

                studentList = data.students;
                renderStudentList(data.students);
            })
            .catch(function(err) {
                console.error('[谈心谈话] 加载学生列表失败:', err);
                listEl.innerHTML = '<div class="conversation-student-empty"><i class="fas fa-exclamation-triangle"></i> 加载失败</div>';
            });
    }

    function renderStudentList(students) {
        var listEl = document.getElementById('conversationStudentList');
        if (!listEl) return;

        if (!students || students.length === 0) {
            listEl.innerHTML = '<div class="conversation-student-empty"><i class="fas fa-user-friends"></i> 暂无学生档案</div>';
            return;
        }

        var html = '';
        students.forEach(function(student) {
            var info = student.info || {};
            var name = info.name || student.name || '未知';
            var photoUrl = '/api/student-archive/' + encodeURIComponent(student.id) + '/photo';

            html +=
                '<div class="conversation-student-card" data-id="' + escapeHtml(student.id) + '" onclick="ConversationManager.selectStudent(\'' + escapeHtml(student.id) + '\')">' +
                    '<div class="conversation-student-card-photo">' +
                        '<img src="' + photoUrl + '" alt="' + escapeHtml(name) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                        '<i class="fas fa-user-graduate" style="display:none;"></i>' +
                    '</div>' +
                    '<div class="conversation-student-card-name">' + escapeHtml(name) + '</div>' +
                '</div>';
        });

        listEl.innerHTML = html;
    }

    function selectStudent(studentId) {
        selectedStudent = studentList.find(function(s) { return s.id === studentId; });

        // 更新选中状态
        var items = document.querySelectorAll('.conversation-student-card');
        items.forEach(function(item) {
            if (item.dataset.id === studentId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // 启用确认按钮
        var confirmBtn = document.getElementById('conversationStartConfirm');
        if (confirmBtn) {
            confirmBtn.disabled = !selectedStudent;
        }
    }

    // ============ 确认开始：创建 interrogation 并保存 metadata ============

    function confirmStart() {
        if (!selectedStudent) {
            alert('请选择学生');
            return;
        }

        // 清空实时引导 buffer（新谈话开始）
        if (window.TalkGuideManager && typeof window.TalkGuideManager.clear === 'function') {
            window.TalkGuideManager.clear();
        }

        // 获取谈话类型和谈话人
        var typeEl = document.querySelector('input[name="conversationType"]:checked');
        var interviewerEl = document.querySelector('input[name="interviewer"]:checked');

        var conversationType = typeEl ? typeEl.value : 'daily';
        var interviewer = interviewerEl ? interviewerEl.value : '中队长';

        var typeLabel = CONVERSATION_TYPES[conversationType] || '同学日常交流';
        var studentInfo = selectedStudent.info || {};
        var studentName = studentInfo.name || selectedStudent.name || '未知';

        // 构造 metadata（学生信息持久化到后端）
        var metadata = {
            studentId: selectedStudent.id,
            studentName: studentName,
            studentInfo: studentInfo,
            conversationType: conversationType,
            conversationTypeLabel: typeLabel,
            interviewer: interviewer,
            startTime: new Date().toISOString()
        };

        // 更新内存数据
        currentConversationData = metadata;

        var name = studentName + ' - ' + typeLabel;

        // 创建后端谈话记录（携带 metadata）
        fetch('/api/interrogations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, metadata: metadata })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.item) {
                // 更新 Sidebar 内存状态
                if (window.SidebarManager && typeof window.SidebarManager.getState === 'function') {
                    var state = window.SidebarManager.getState();
                    if (state) {
                        state.interrogations.push(data.item);
                        state.activeId = data.item.id;
                    }
                }

                // 刷新侧边栏菜单
                refreshSidebarMenu();

                // 更新谈话页面学生信息显示
                updateInterrogationPage();

                // 跳转到谈心谈话页面
                if (window.navigateToView) {
                    window.navigateToView('interrogation');
                }

                console.log('[谈心谈话] 创建成功:', data.item.id, '学生:', studentName);
            }
        })
        .catch(function(err) {
            console.error('[谈心谈话] 创建失败:', err);
            alert('创建谈话记录失败，请重试');
        });
    }

    // ============ 更新谈话页面学生信息显示 ============

    function updateInterrogationPage() {
        var data = getCurrentConversationData();
        if (!data) return;

        var studentInfo = data.studentInfo || {};
        var studentName = data.studentName || '-';
        var team = studentInfo.team || studentInfo.class || '-';
        var studentId = studentInfo.studentId || '-';
        var college = studentInfo.college || '-';

        var nameEl = document.getElementById('interrogationStudentName');
        var teamEl = document.getElementById('interrogationStudentTeam');
        var idEl = document.getElementById('interrogationStudentId');
        var collegeEl = document.getElementById('interrogationStudentCollege');
        var statusEl = document.getElementById('interrogationStudentStatus');

        if (nameEl) nameEl.textContent = studentName;
        if (teamEl) teamEl.textContent = team || '-';
        if (idEl) idEl.textContent = studentId || '-';
        if (collegeEl) collegeEl.textContent = college || '-';
        if (statusEl) statusEl.textContent = '开始谈话中... (' + (data.conversationTypeLabel || '') + ')';
    }

    // ============ 获取当前谈话数据（优先内存，回退到 interrogation.metadata） ============

    function getCurrentConversationData() {
        // 1. 优先使用内存数据
        if (currentConversationData) {
            return currentConversationData;
        }
        // 2. 回退到当前激活 interrogation 的 metadata（持久化数据）
        var active = getActiveInterrogation();
        if (active && active.metadata) {
            return active.metadata;
        }
        return null;
    }

    // ============ 保存谈话记录到学生档案（完成时调用） ============

    function saveConversation(transcriptContent, analysisResult) {
        var data = getCurrentConversationData();
        if (!data || !data.studentId) {
            console.error('[谈心谈话] 缺少学生信息，无法保存');
            return Promise.reject('缺少学生信息');
        }
        if (!transcriptContent) {
            return Promise.reject('缺少谈话内容');
        }

        var studentId = data.studentId;
        var studentName = data.studentName || '学生';
        var typeLabel = data.conversationTypeLabel || '谈话记录';
        var interviewer = data.interviewer || '谈话人';

        // 生成文件名：mm-dd谈话类型
        var now = new Date();
        var mm = String(now.getMonth() + 1).padStart(2, '0');
        var dd = String(now.getDate()).padStart(2, '0');
        var filename = mm + '-' + dd + typeLabel + '.md';

        // 生成时间格式：HH:MM
        var hh = String(now.getHours()).padStart(2, '0');
        var mi = String(now.getMinutes()).padStart(2, '0');
        var timeStr = hh + ':' + mi;

        // 生成日期格式：YYYY-MM-DD
        var yyyy = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var dateStr = yyyy + '-' + month + '-' + day;

        // 生成 markdown 文件内容（简洁格式）
        var markdownContent = '**谈话人**: ' + interviewer + '\n';
        markdownContent += '**谈话类型**: ' + typeLabel + '\n';
        markdownContent += '**谈话时间**: ' + dateStr + ' ' + timeStr + '\n\n';
        markdownContent += (analysisResult || transcriptContent) + '\n';

        // 生成分析数据（用于更新雷达图等）
        var analysisData = {
            conversationType: data.conversationType,
            conversationTypeLabel: typeLabel,
            interviewer: interviewer,
            transcript: transcriptContent,
            analysis: analysisResult || ''
        };

        return fetch('/api/student-archive/' + encodeURIComponent(studentId) + '/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: markdownContent,
                analysis: analysisData,
                filename: filename
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(resp) {
            console.log('[谈心谈话] 保存成功:', resp);
            return resp;
        })
        .catch(function(err) {
            console.error('[谈心谈话] 保存失败:', err);
            throw err;
        });
    }

    // ============ 辅助函数 ============

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        var h = String(date.getHours()).padStart(2, '0');
        var mi = String(date.getMinutes()).padStart(2, '0');
        return y + '-' + m + '-' + d + ' ' + h + ':' + mi;
    }

    // ============ 初始化 ============

    function init() {
        // 绑定新建按钮事件（如果有的话）
        var addBtn = document.querySelector('[data-action="add-interrogation"]');
        if (addBtn) {
            addBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                openStartModal();
            });
        }
        console.log('[ConversationManager] 初始化完成');
    }

    // ============ 暴露接口 ============

    window.ConversationManager = {
        init: init,
        openStartModal: openStartModal,
        closeStartModal: closeStartModal,
        selectStudent: selectStudent,
        confirmStart: confirmStart,
        saveConversation: saveConversation,
        getCurrentData: getCurrentConversationData,
        updateInterrogationPage: updateInterrogationPage
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
