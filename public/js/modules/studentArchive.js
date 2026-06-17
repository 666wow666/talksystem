/**
 * 学生档案管理模块
 * - 学生档案页：卡片网格（照片 + 区队 + 姓名）
 * - 个人画像页：点击卡片后跳转
 * - 新增学生：弹窗收集信息（照片/姓名/区队/学号/性别/出生日期/学院/专业/生源地）
 */
(function() {
    'use strict';

    var currentStudentId = null;
    var currentPhotoData = null;  // 当前上传的照片base64数据

    // ==================== 工具函数 ====================

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 简化 Markdown → HTML 渲染器（无蓝色、无背景，简洁格式）
    // 支持：标题（首行特殊处理）、*斜体*、**粗体**
    function renderMarkdown(md) {
        if (!md) return '<div style="color:#94a3b8;text-align:center;padding:30px;">暂无内容</div>';

        var lines = String(md).split(/\r?\n/);
        var html = '';
        var paragraphBuffer = [];
        var isFirstLine = true;

        function flushParagraph() {
            if (paragraphBuffer.length > 0) {
                var text = paragraphBuffer.join('\n');
                text = processInline(text);
                html += '<div class="md-paragraph">' + text + '</div>';
                paragraphBuffer = [];
            }
        }

        function processInline(text) {
            var escaped = escapeHtml(text);
            escaped = escaped.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
            escaped = escaped.replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>');
            return escaped;
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            if (line.trim() === '') {
                flushParagraph();
                continue;
            }

            // 第一行作为标题（不管有没有 # 标记）
            if (isFirstLine) {
                var titleText = line.trim();
                // 如果开头有 # 则去掉
                titleText = titleText.replace(/^#+\s*/, '');
                html += '<div class="md-title">' + processInline(titleText) + '</div>';
                isFirstLine = false;
                continue;
            }

            // 其他行作为普通段落
            paragraphBuffer.push(line);
        }

        flushParagraph();

        return html;
    }

    // 根据出生日期计算年龄
    function calcAge(birthday) {
        if (!birthday) return null;
        var b = new Date(birthday);
        if (isNaN(b.getTime())) return null;
        var now = new Date();
        var age = now.getFullYear() - b.getFullYear();
        var m = now.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
        return age >= 0 ? age : null;
    }

    // 统一构建头像 HTML：支持 data URL、文件名、以及图片加载失败回退到图标
    function buildAvatarHtml(student, info, gender, name) {
        var genderIconCls = (gender === '女') ? 'fa-venus' : 'fa-user-graduate';
        var safeName = escapeHtml(name || '学生');

        // 无 photo 字段或字段为空 → 使用图标
        var photoField = info && info.photo ? String(info.photo).trim() : '';
        if (!photoField) {
            return '<i class="fas ' + genderIconCls + '"></i>';
        }

        // 如果是 data URL（兼容旧数据）→ 直接作为图片 src
        if (photoField.substring(0, 11) === 'data:image/') {
            return '<img src="' + photoField + '" alt="' + safeName + '"' +
                ' onerror="window.StudentArchiveManager._onAvatarError(this, \'' + genderIconCls + '\')">';
        }

        // 否则：photo 字段是文件名（如 "photo.jpg"）→ 通过 API 访问
        // 需要 encodeURIComponent 以正确处理中文/特殊字符
        var studentId = '';
        if (student && typeof student === 'object' && student.id) {
            studentId = String(student.id);
        } else if (typeof student === 'string') {
            studentId = student;
        }
        if (!studentId) {
            return '<i class="fas ' + genderIconCls + '"></i>';
        }

        var photoUrl = '/api/student-archive/' + encodeURIComponent(studentId) + '/photo';
        return '<img src="' + photoUrl + '" alt="' + safeName + '"' +
            ' onerror="window.StudentArchiveManager._onAvatarError(this, \'' + genderIconCls + '\')">';
    }

    // ==================== API 封装 ====================

    function api(url, options) {
        var opts = options || {};
        var method = opts.method || 'GET';
        var body = opts.body;

        var fetchOpts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body) fetchOpts.body = JSON.stringify(body);

        return fetch(url, fetchOpts).then(function(r) { return r.json(); });
    }

    // 用 FormData 上传（支持照片）
    function apiFormData(url, formData) {
        return fetch(url, {
            method: 'POST',
            body: formData
        }).then(function(r) { return r.json(); });
    }

    // ==================== 学生档案：加载卡片网格 ====================

    function loadStudentList() {
        var gridEl = document.getElementById('studentGrid');
        if (!gridEl) return;

        gridEl.innerHTML = '<div class="case-loading"><i class="fas fa-spinner fa-spin"></i><span>加载中...</span></div>';

        api('/api/student-archive/list').then(function(data) {
            if (data.success && data.students && data.students.length > 0) {
                renderStudentCards(data.students);
            } else {
                gridEl.innerHTML = '<div class="student-empty">' +
                    '<i class="fas fa-user-graduate"></i>' +
                    '<p>暂无学生档案</p>' +
                    '<p>点击右上角"新增"按钮添加</p>' +
                    '</div>';
            }
        }).catch(function(err) {
            console.error('[学生档案] 加载失败:', err);
            gridEl.innerHTML = '<div class="student-empty">' +
                '<i class="fas fa-exclamation-triangle"></i>' +
                '<p>加载失败，请稍后重试</p>' +
                '</div>';
        });
    }

    function renderStudentCards(students) {
        var gridEl = document.getElementById('studentGrid');
        if (!gridEl) return;

        gridEl.innerHTML = '';

        students.forEach(function(student) {
            var cardEl = document.createElement('div');
            cardEl.className = 'student-card';
            cardEl.dataset.id = student.id;

            var info = student.info || {};
            var name = info.name || student.name || student.id;
            var team = info.team || '未设置区队';
            var gender = info.gender || '男';

            // 构造头像（统一处理：支持 data URL 和文件方式，并添加 onerror 回退）
            var avatarHtml = buildAvatarHtml(student, info, gender, name);

            cardEl.innerHTML =
                '<div class="student-photo">' + avatarHtml + '</div>' +
                '<div class="student-name">' + escapeHtml(name) + '</div>' +
                '<div class="student-class">' + escapeHtml(team) + '</div>';

            cardEl.addEventListener('click', function() {
                openStudentProfile(student.id);
            });

            gridEl.appendChild(cardEl);
        });
    }

    // ==================== 学生信息采集弹窗 ====================

    function openStudentFormModal() {
        var modal = document.getElementById('studentFormModal');
        if (!modal) return;

        // 重置表单
        document.getElementById('form-name').value = '';
        document.getElementById('form-team').value = '';
        document.getElementById('form-studentId').value = '';
        document.getElementById('form-birthday').value = '';
        document.getElementById('form-college').value = '';
        document.getElementById('form-major').value = '';
        document.getElementById('form-origin').value = '';
        var radios = document.querySelectorAll('input[name="form-gender"]');
        radios.forEach(function(r) { if (r.value === '男') r.checked = true; });
        currentPhotoData = null;

        // 重置照片预览
        var preview = document.getElementById('photoPreview');
        if (preview) {
            preview.innerHTML = '<i class="fas fa-user"></i>';
        }

        // 绑定照片上传事件（只绑一次）
        var fileInput = document.getElementById('photoFile');
        if (fileInput && !fileInput._bound) {
            fileInput._bound = true;
            fileInput.addEventListener('change', handlePhotoUpload);
        }

        modal.classList.add('active');

        // 默认聚焦姓名
        setTimeout(function() {
            var n = document.getElementById('form-name');
            if (n) n.focus();
        }, 50);
    }

    function closeStudentFormModal() {
        var modal = document.getElementById('studentFormModal');
        if (modal) modal.classList.remove('active');
        currentPhotoData = null;
    }

    function handlePhotoUpload(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;

        // 简单校验
        if (!/^image\//.test(file.type)) {
            alert('请上传图片文件（jpg/png等）');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('照片大小不能超过 2MB');
            return;
        }

        var reader = new FileReader();
        reader.onload = function(evt) {
            currentPhotoData = evt.target.result;  // data URL
            var preview = document.getElementById('photoPreview');
            if (preview) {
                preview.innerHTML = '<img src="' + currentPhotoData + '" alt="照片预览">';
            }
        };
        reader.onerror = function() {
            alert('照片读取失败，请重试');
        };
        reader.readAsDataURL(file);
    }

    function submitStudentForm() {
        // 收集数据
        var name = (document.getElementById('form-name').value || '').trim();
        var team = (document.getElementById('form-team').value || '').trim();

        if (!name) { alert('请填写姓名'); document.getElementById('form-name').focus(); return; }
        if (!team) { alert('请填写区队'); document.getElementById('form-team').focus(); return; }

        var studentId = (document.getElementById('form-studentId').value || '').trim();
        var birthday = (document.getElementById('form-birthday').value || '').trim();
        var college = (document.getElementById('form-college').value || '').trim();
        var major = (document.getElementById('form-major').value || '').trim();
        var origin = (document.getElementById('form-origin').value || '').trim();

        var gender = '男';
        var radios = document.querySelectorAll('input[name="form-gender"]');
        radios.forEach(function(r) { if (r.checked) gender = r.value; });

        // 构造表单数据（用 FormData 以便后续扩展文件上传）
        var formData = new FormData();
        formData.append('name', name);
        formData.append('team', team);
        formData.append('studentId', studentId);
        formData.append('gender', gender);
        formData.append('birthday', birthday);
        formData.append('college', college);
        formData.append('major', major);
        formData.append('origin', origin);
        if (currentPhotoData) {
            formData.append('photo', currentPhotoData);
        }

        // 按钮状态
        var footerBtns = document.querySelectorAll('.student-form-footer .student-form-btn-primary');
        if (footerBtns && footerBtns[0]) {
            footerBtns[0].disabled = true;
            var oldText = footerBtns[0].innerHTML;
            footerBtns[0].innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }

        apiFormData('/api/student-archive', formData).then(function(data) {
            if (data.success) {
                closeStudentFormModal();
                loadStudentList();
            } else {
                alert('创建失败：' + (data.error || '未知错误'));
            }
        }).catch(function(err) {
            console.error('[学生档案] 创建失败:', err);
            alert('创建失败，请稍后重试');
        }).finally(function() {
            var btns = document.querySelectorAll('.student-form-footer .student-form-btn-primary');
            if (btns && btns[0]) {
                btns[0].disabled = false;
                btns[0].innerHTML = '<i class="fas fa-save"></i> 保存';
            }
        });
    }

    // ==================== 打开个人画像页 ====================

    function openStudentProfile(studentId) {
        currentStudentId = studentId;
        window.navigateToView('profile', { studentId: studentId });
    }

    // ==================== 个人画像页：加载学生信息 ====================

    function loadProfile(params) {
        var studentId = (params && params.studentId) || currentStudentId;
        if (!studentId) {
            renderProfileEmpty();
            return;
        }

        var contentEl = document.getElementById('profileContent');
        if (!contentEl) return;

        contentEl.innerHTML = '<div class="profile-empty">' +
            '<i class="fas fa-spinner fa-spin profile-empty-icon"></i>' +
            '<p class="profile-empty-text">加载中...</p>' +
            '</div>';

        api('/api/student-archive/' + encodeURIComponent(studentId)).then(function(data) {
            if (data.success && data.student) {
                renderProfile(data.student);
            } else {
                renderProfileEmpty();
            }
        }).catch(function(err) {
            console.error('[个人画像] 加载失败:', err);
            renderProfileEmpty();
        });
    }

    function renderProfile(student) {
        var contentEl = document.getElementById('profileContent');
        if (!contentEl) return;

        var info = student.info || {};
        var name = info.name || student.name || student.id;
        var team = info.team || '未设置区队';
        var college = info.college || '';
        var major = info.major || '';
        var origin = info.origin || '';
        var studentId = info.studentId || '—';
        var gender = info.gender || '男';
        var age = calcAge(info.birthday) || info.age || '—';
        var genderIcon = (gender === '女') ? 'fa-venus' : 'fa-mars';
        var genderColor = (gender === '女') ? '#ec4899' : '#3b82f6';

        // 头像（统一处理）
        var avatarHtml = buildAvatarHtml(student, info, gender, name);

        // 五维雷达
        var dimensions = info.dimensions || {
            '学业状况': 88, '人际关系': 75, '心理状态': 82, '生活管理': 71, '个人规划': 65
        };
        var keys = Object.keys(dimensions);
        var values = keys.map(function(k) { return dimensions[k]; });

        // 综合发展指数
        var score = info.score || 86;
        var scoreLevel = '良好', scoreColor = '#10b981';
        if (score >= 90) { scoreLevel = '优秀'; scoreColor = '#2563eb'; }
        else if (score >= 75) { scoreLevel = '良好'; scoreColor = '#10b981'; }
        else if (score >= 60) { scoreLevel = '合格'; scoreColor = '#f59e0b'; }
        else { scoreLevel = '待提升'; scoreColor = '#ef4444'; }
        var rank = info.rank || '年级排名：A档（前20%）';

        // AI画像
        var aiText = info.aiSummary ||
            '<p>' + escapeHtml(name) + '整体发展良好，学业表现稳定，学习目标较明确。</p>' +
            '<p>在人际关系方面，同伴互动积极，乐于参与集体活动。</p>' +
            '<p>近期压力主要来源于升学规划与考试压力。</p>';
        var suggestion = info.aiSuggestion || '<strong>建议关注：</strong>时间管理能力、长期目标建立、适当放松休息';

        // 成长轨迹
        var timelineData = buildTimelineFromFiles(student.files);
        var timelineItemsHtml = '';
        if (timelineData.length === 0) {
            timelineItemsHtml = '<div style="padding:30px 20px; text-align:center; color:#94a3b8; font-size:12px;">暂无谈话记录</div>';
        } else {
            timelineData.forEach(function(item) {
                var tagClass = 'tag-' + item.category;
                timelineItemsHtml +=
                    '<div class="timeline-item" data-filename="' + escapeHtml(item.filename) + '" data-title="' + escapeHtml(item.title) + '">' +
                        '<span class="timeline-date">' + escapeHtml(item.date) + '</span>' +
                        '<span class="timeline-dot" style="background:' + getCategoryColor(item.category) + '"></span>' +
                        '<div class="timeline-content">' +
                            '<span class="timeline-tag ' + tagClass + '">' + getCategoryLabel(item.category) + '</span>' +
                            '<div class="timeline-title">' + escapeHtml(item.title) + '</div>' +
                            '<div class="timeline-desc">' + escapeHtml(item.desc) + '</div>' +
                        '</div>' +
                    '</div>';
            });
        }

        // 组装页面
        contentEl.innerHTML =
            '<div class="profile-left-panel">' +
                // 头部：头像+姓名+指数
                '<div class="pp-header">' +
                    '<div class="pp-avatar">' + avatarHtml + '</div>' +
                    '<div class="pp-baseinfo">' +
                        '<h2 class="pp-name">' + escapeHtml(name) + '</h2>' +
                        '<p class="pp-class">' + escapeHtml(team) + '</p>' +
                        '<p><i class="fas ' + genderIcon + '" style="color:' + genderColor + '"></i> ' + escapeHtml(age) + '岁</p>' +
                        '<p><i class="fas fa-id-badge"></i> 学号：' + escapeHtml(studentId) + '</p>' +
                        (college ? '<p><i class="fas fa-university"></i> ' + escapeHtml(college) + '</p>' : '') +
                        (major ? '<p><i class="fas fa-book"></i> ' + escapeHtml(major) + '</p>' : '') +
                        (origin ? '<p><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(origin) + '</p>' : '') +
                    '</div>' +
                    '<div class="pp-score">' +
                        '<div class="pp-score-label">综合发展指数</div>' +
                        '<div class="pp-score-num" style="color:' + scoreColor + ';">' + score + '<span class="pp-score-denom">/100</span></div>' +
                        '<div class="pp-score-badge" style="background:' + scoreColor + ';">' + scoreLevel + '</div>' +
                        '<div class="pp-score-rank"><i class="fas fa-trophy"></i> ' + escapeHtml(rank) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pp-divider"></div>' +
                // 雷达图
                '<div class="pp-section">' +
                    '<div class="pp-section-title"><i class="fas fa-chart-pie"></i> 五维成长画像</div>' +
                    '<div class="pp-radar">' + buildRadarSvg(keys, values) + '</div>' +
                '</div>' +
                '<div class="pp-divider"></div>' +
                // AI画像
                '<div class="pp-section">' +
                    '<div class="pp-section-title">综合建议</div>' +
                    '<div class="pp-ai-text">' + aiText + '</div>' +
                    '<div class="pp-ai-tip">' + suggestion + '</div>' +
                '</div>' +
            '</div>' +
            // 右侧成长轨迹面板：列表区与内容区二选一
            '<div class="profile-right-panel">' +
                '<div class="profile-card profile-timeline-card">' +
                    '<h3>成长轨迹</h3>' +
                    '<div class="timeline-list" id="timelineList">' + timelineItemsHtml + '</div>' +
                    '<div class="timeline-content-panel" id="timelineContentPanel" style="display:none;">' +
                        '<div class="timeline-content-header">' +
                            '<button class="timeline-content-back" id="timelineContentBack">' +
                                '<i class="fas fa-arrow-left"></i>' +
                            '</button>' +
                            '<span class="timeline-content-title" id="timelineContentTitle"></span>' +
                        '</div>' +
                        '<div class="timeline-content-body" id="timelineContentBody">' +
                            '<div style="display:flex; align-items:center; justify-content:center; padding:30px; color:#94a3b8; font-size:12px;">' +
                                '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>加载中...' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // 绑定时间线条目点击事件（替换式切换）
        var timelineItems = contentEl.querySelectorAll('.timeline-item');
        timelineItems.forEach(function(item) {
            item.addEventListener('click', function() {
                var filename = item.getAttribute('data-filename');
                var title = item.getAttribute('data-title') || filename;
                if (!filename) return;

                // 替换：隐藏列表，显示内容区
                var listEl = document.getElementById('timelineList');
                var panelEl = document.getElementById('timelineContentPanel');
                if (listEl) listEl.style.display = 'none';
                if (panelEl) panelEl.style.display = 'flex';

                showFileContentInline(student.id, filename, title);
            });
        });

        // 返回按钮
        var backBtn = document.getElementById('timelineContentBack');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                var listEl = document.getElementById('timelineList');
                var panelEl = document.getElementById('timelineContentPanel');
                if (panelEl) panelEl.style.display = 'none';
                if (listEl) listEl.style.display = 'flex';
            });
        }
    }

    // ==================== 辅助：雷达图SVG生成 ====================

    function buildRadarSvg(labels, values) {
        var cx = 115, cy = 105, maxR = 80;
        var n = labels.length;
        var angleStep = (Math.PI * 2) / n;
        var startAngle = -Math.PI / 2;

        var gridLines = '';
        for (var layer = 1; layer <= 4; layer++) {
            var r = (maxR * layer) / 4;
            var pts = [];
            for (var i = 0; i < n; i++) {
                var ang = startAngle + angleStep * i;
                pts.push((cx + r * Math.cos(ang)) + ',' + (cy + r * Math.sin(ang)));
            }
            gridLines += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
        }

        var axisLines = '';
        for (var j = 0; j < n; j++) {
            var ang2 = startAngle + angleStep * j;
            axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + maxR * Math.cos(ang2)) + '" y2="' + (cy + maxR * Math.sin(ang2)) + '" stroke="#e2e8f0" stroke-width="1"/>';
        }

        var dataPts = [];
        var labelTexts = [];
        for (var k = 0; k < n; k++) {
            var v = values[k] / 100;
            var ang3 = startAngle + angleStep * k;
            var px = cx + (maxR * v) * Math.cos(ang3);
            var py = cy + (maxR * v) * Math.sin(ang3);
            dataPts.push(px + ',' + py);

            var labelR = maxR + 18;
            var lx = cx + labelR * Math.cos(ang3);
            var ly = cy + labelR * Math.sin(ang3);
            labelTexts.push('<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#64748b" font-weight="500">' + escapeHtml(labels[k]) + '</text>' +
                '<text x="' + lx + '" y="' + (ly + 12) + '" text-anchor="middle" font-size="10" fill="#3b82f6" font-weight="700">' + values[k] + '</text>');
        }

        return '<svg width="230" height="215" viewBox="0 0 230 215">' +
                '<defs>' +
                    '<radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">' +
                        '<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>' +
                        '<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.08"/>' +
                    '</radialGradient>' +
                '</defs>' +
                gridLines + axisLines +
                '<polygon points="' + dataPts.join(' ') + '" fill="url(#radarGrad)" stroke="#3b82f6" stroke-width="2"/>' +
                dataPts.map(function(pt) {
                    var xy = pt.split(',');
                    return '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>';
                }).join('') +
                labelTexts.join('') +
            '</svg>';
    }

    // ==================== 辅助：时间线分类 ====================

    function getCategoryColor(cat) {
        if (cat === 'study') return '#2563eb';
        if (cat === 'social') return '#10b981';
        if (cat === 'psychology') return '#ec4899';
        if (cat === 'life') return '#f59e0b';
        if (cat === 'plan') return '#8b5cf6';
        return '#64748b';
    }

    function getCategoryLabel(cat) {
        var map = { 'study': '学业', 'social': '人际', 'psychology': '心理', 'life': '生活', 'plan': '规划' };
        return map[cat] || '谈话';
    }

    function buildTimelineFromFiles(files) {
        if (!files || files.length === 0) return [];
        var result = [];
        var sorted = files.slice().sort(function(a, b) {
            var aTime = a.createdAt || 0, bTime = b.createdAt || 0;
            return bTime - aTime;
        });
        sorted.forEach(function(f) {
            var dateStr = '';
            if (f.createdAt) {
                var d = new Date(f.createdAt);
                dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            } else {
                dateStr = (f.name || '').slice(0, 10).replace(/_/g, '-');
            }

            var category = 'psychology';
            var name = f.name || '';
            if (/学习|期中|期末|成绩|学业/.test(name)) category = 'study';
            else if (/人际|同学|老师|社交|家庭|父母/.test(name)) category = 'social';
            else if (/心理|访谈|情绪|压力/.test(name)) category = 'psychology';
            else if (/生活|作息|身体|运动/.test(name)) category = 'life';
            else if (/规划|目标|未来|职业/.test(name)) category = 'plan';

            var title = name
                .replace(/^\d{4}_\d{2}_\d{2}_\d{4}_/, '')
                .replace(/^\d{4}-\d{2}-\d{2}_\d{4}_/, '')
                .replace(/\.md$/i, '')
                .replace(/[_]+/g, ' ');
            if (!title) title = '谈话记录';

            var desc = '点击查看谈话内容';
            if (typeof f.size === 'number') {
                if (f.size < 1024) desc = f.size + ' 字节 · 点击查看';
                else if (f.size < 1024 * 1024) desc = Math.round(f.size / 1024) + ' KB · 点击查看';
                else desc = (f.size / (1024 * 1024)).toFixed(1) + ' MB · 点击查看';
            }

            result.push({ date: dateStr, category: category, title: title, desc: desc, filename: f.name });
        });
        return result;
    }

    // ==================== 辅助：markdown文件内容内联展开显示 ====================

    function showFileContentInline(studentId, filename, title) {
        var panel = document.getElementById('timelineContentPanel');
        var titleEl = document.getElementById('timelineContentTitle');
        var bodyEl = document.getElementById('timelineContentBody');

        if (!panel || !bodyEl) return;

        panel.style.display = 'flex';
        if (titleEl) titleEl.textContent = title || filename;

        bodyEl.innerHTML =
            '<div style="display:flex; align-items:center; justify-content:center; padding:30px; color:#94a3b8; font-size:12px;">' +
                '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>加载中...' +
            '</div>';

        fetch('/api/student-archive/' + encodeURIComponent(studentId) + '/file/' + encodeURIComponent(filename))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.content) {
                    bodyEl.innerHTML =
                        '<div class="md-render">' +
                        renderMarkdown(data.content) +
                        '</div>';
                } else {
                    bodyEl.innerHTML = '<div style="padding:30px; text-align:center; color:#94a3b8;">加载失败：' + escapeHtml(data.error || '未知错误') + '</div>';
                }
            })
            .catch(function(err) {
                console.error('[读取文件] 失败:', err);
                bodyEl.innerHTML = '<div style="padding:30px; text-align:center; color:#ef4444;">加载失败，请稍后重试</div>';
            });
    }

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // 如果内容区正在显示，则返回到列表
            var panel = document.getElementById('timelineContentPanel');
            var list = document.getElementById('timelineList');
            if (panel && panel.style.display !== 'none') {
                panel.style.display = 'none';
                if (list) list.style.display = 'flex';
                return;
            }
            // 关闭学生信息弹窗
            var m = document.getElementById('studentFormModal');
            if (m && m.classList.contains('active')) closeStudentFormModal();
        }
    });

    function renderProfileEmpty() {
        var contentEl = document.getElementById('profileContent');
        if (!contentEl) return;
        contentEl.innerHTML =
            '<div class="profile-empty" style="padding:60px 20px; grid-column:1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8;">' +
                '<i class="fas fa-user-circle" style="font-size:56px; margin-bottom:12px; opacity:0.5;"></i>' +
                '<p style="margin:0; font-size:14px;">请从学生档案中选择一个学生</p>' +
            '</div>';
    }

    // 图片加载失败时：把 <img> 替换为字体图标（避免显示破损图标）
    function _onAvatarError(imgEl, iconClass) {
        try {
            if (!imgEl) return;
            var parent = imgEl.parentNode;
            if (!parent) return;
            var icon = document.createElement('i');
            icon.className = 'fas ' + (iconClass || 'fa-user-graduate');
            parent.replaceChild(icon, imgEl);
        } catch (e) {
            // 静默忽略
        }
    }

    // ==================== 模块对外接口 ====================

    window.StudentArchiveManager = {
        loadStudentList: loadStudentList,
        openStudentFormModal: openStudentFormModal,
        closeStudentFormModal: closeStudentFormModal,
        submitStudentForm: submitStudentForm,
        loadProfile: loadProfile,
        showFileContentInline: showFileContentInline,
        _onAvatarError: _onAvatarError
    };

})();
