require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { config, printConfigValidation } = require('./src/backend/config');
const chatRouter = require('./src/backend/routes/chat');
const healthRouter = require('./src/backend/routes/health');
const { modelSelector } = require('./src/backend/services/modelSelector');

const app = express();
const port = config.port;
const DATA_DIR = path.join(__dirname, 'data');
const FILE_DIR = path.join(DATA_DIR, 'file');

if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('[数据] 已创建 data 目录: ' + DATA_DIR);
    } catch (e) {
        console.error('[数据] 创建 data 目录失败:', e.message);
    }
}

if (!fs.existsSync(FILE_DIR)) {
    try {
        fs.mkdirSync(FILE_DIR, { recursive: true });
        console.log('[数据] 已创建 file 目录: ' + FILE_DIR);
    } catch (e) {
        console.error('[数据] 创建 file 目录失败:', e.message);
    }
}

function getDataFile() {
    return path.join(DATA_DIR, 'interrogations.json');
}

function readInterrogations() {
    const file = getDataFile();
    if (!fs.existsSync(file)) {
        return { interrogations: [], activeId: null };
    }
    try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('[数据] 读取失败:', e.message);
        return { interrogations: [], activeId: null };
    }
}

function writeInterrogations(data) {
    const file = getDataFile();
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('[数据] 写入失败:', e.message);
        return false;
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
  res.redirect('/main.html');
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') ||
      req.path.startsWith('/chat') ||
      req.path.startsWith('/health') ||
      req.path.includes('.')) {
    return next();
  }

  const clientIP = req.headers['x-forwarded-for'] ||
                  req.connection?.remoteAddress ||
                  req.socket?.remoteAddress ||
                  'unknown';
  const reqPath = req.path.replace(/^\//, '') || 'main.html';

  const authed = req.query.authed === '1';

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  

  if (reqPath === 'data-collect.html') {
    if (!authed) {
      console.log(`[页面访问] ${clientIP} 尝试直接访问信息采集页，重定向到 auth.html`);
      return res.redirect('/auth.html');
    }
  }

  next();
});

app.use('/chat', chatRouter);
app.use('/health', healthRouter);

app.get('/api/interrogations', (req, res) => {
    const data = readInterrogations();
    res.json(data);
});

app.post('/api/interrogations', (req, res) => {
    const data = readInterrogations();
    const { name, metadata } = req.body || {};
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: '名称不能为空' });
    }
    const newItem = {
        id: 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        metadata: metadata || null,
        data: {
            recordContent: '',
            transcribedText: '',
            recommendedQuestions: [null, null, null, null, null],
            workflow1History: []
        }
    };
    data.interrogations.push(newItem);
    data.activeId = newItem.id;
    writeInterrogations(data);
    res.json({ success: true, item: newItem });
});

app.put('/api/interrogations/:id', (req, res) => {
    const data = readInterrogations();
    const { id } = req.params;
    const { name, content, metadata } = req.body || {};
    const idx = data.interrogations.findIndex(i => i.id === id);
    if (idx < 0) {
        return res.status(404).json({ success: false, error: '未找到' });
    }
    if (name !== undefined) data.interrogations[idx].name = name.trim();
    if (content !== undefined) data.interrogations[idx].data = { ...(data.interrogations[idx].data || {}), ...content };
    if (metadata !== undefined) data.interrogations[idx].metadata = metadata;
    if (req.body.activeId !== undefined) data.activeId = req.body.activeId;
    writeInterrogations(data);
    res.json({ success: true, item: data.interrogations[idx] });
});

app.post('/api/interrogations/:id', (req, res) => {
    if (req.query.method === 'PUT') {
        const data = readInterrogations();
        const { id } = req.params;
        const { name, content, metadata } = req.body || {};
        const idx = data.interrogations.findIndex(i => i.id === id);
        if (idx < 0) {
            return res.status(404).json({ success: false, error: '未找到' });
        }
        if (name !== undefined) data.interrogations[idx].name = name.trim();
        if (content !== undefined) data.interrogations[idx].data = { ...(data.interrogations[idx].data || {}), ...content };
        if (metadata !== undefined) data.interrogations[idx].metadata = metadata;
        if (req.body.activeId !== undefined) data.activeId = req.body.activeId;
        writeInterrogations(data);
        console.log(`[数据] sendBeacon 保存成功，ID: ${id}`);
        return res.json({ success: true, item: data.interrogations[idx] });
    }
    res.status(405).json({ success: false, error: '方法不允许' });
});

function deleteInterrogationFiles(id) {
    try {
        const files = fs.readdirSync(DATA_DIR);
        let deletedCount = 0;
        files.forEach(file => {
            if (file.includes(id)) {
                const filePath = path.join(DATA_DIR, file);
                if (fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`[数据] 删除关联文件: ${file}`);
                }
            }
        });
        return { success: true, deletedFiles: deletedCount };
    } catch (e) {
        console.error('[数据] 删除关联文件失败:', e.message);
        return { success: false, error: e.message };
    }
}

app.delete('/api/interrogations/:id', (req, res) => {
    const data = readInterrogations();
    const { id } = req.params;
    const before = data.interrogations.length;
    
    const fileResult = deleteInterrogationFiles(id);
    if (!fileResult.success) {
        console.warn('[数据] 文件删除部分失败，但继续删除数据库记录');
    }
    
    data.interrogations = data.interrogations.filter(i => i.id !== id);
    if (data.activeId === id) {
        data.activeId = data.interrogations.length > 0 ? data.interrogations[0].id : null;
    }
    writeInterrogations(data);
    
    res.json({ 
        success: true, 
        removed: before - data.interrogations.length,
        deletedFiles: fileResult.deletedFiles || 0 
    });
});

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  const storedHash = process.env.AUTH_PASSWORD_HASH;

  if (!storedHash) {
    return res.status(500).json({ success: false, error: '认证配置未设置' });
  }

  const inputHash = sha256(password);

  if (inputHash === storedHash) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: '密码错误' });
  }
});

app.get('/api/config', (req, res) => {
  console.log('[调试] XFYUN_APPID:', process.env.XFYUN_APPID);
  console.log('[调试] XFYUN_API_KEY:', process.env.XFYUN_API_KEY);
  console.log('[调试] 完整 process.env:', Object.keys(process.env).filter(k => k.includes('XF')));
  
  res.json({
    xfyunAppId: process.env.XFYUN_APPID || '',
    xfyunApiKey: process.env.XFYUN_API_KEY || ''
  });
});

app.get('/api/models', (req, res) => {
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  const models = [];
  
  if (config.glm.apiKey) models.push({ name: 'glm', displayName: '智谱GLM', configured: true, current: workflow1Model === 'glm' });
  else models.push({ name: 'glm', displayName: '智谱GLM', configured: false, current: false });
  
  if (config.deepseek.apiKey) models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: true, current: workflow1Model === 'deepseek' });
  else models.push({ name: 'deepseek', displayName: 'DeepSeek', configured: false, current: false });
  
  if (config.doubao.apiKey) models.push({ name: 'doubao', displayName: '豆包', configured: true, current: workflow1Model === 'doubao' });
  else models.push({ name: 'doubao', displayName: '豆包', configured: false, current: false });
  
  if (config.kimi.apiKey) models.push({ name: 'kimi', displayName: 'Kimi', configured: true, current: workflow1Model === 'kimi' });
  else models.push({ name: 'kimi', displayName: 'Kimi', configured: false, current: false });
  
  if (config.qianwen.apiKey) models.push({ name: 'qianwen', displayName: '千问', configured: true, current: workflow1Model === 'qianwen' });
  else models.push({ name: 'qianwen', displayName: '千问', configured: false, current: false });
  
  if (config.ernie.apiKey && config.ernie.secretKey) models.push({ name: 'ernie', displayName: '文心一言', configured: true, current: workflow1Model === 'ernie' });
  else models.push({ name: 'ernie', displayName: '文心一言', configured: false, current: false });
  
  if (config.nvidia.apiKey) models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: true, current: workflow1Model === 'nvidia' });
  else models.push({ name: 'nvidia', displayName: 'NVIDIA', configured: false, current: false });
  
  res.json({
    workflow1Model: workflow1Model,
    workflow2Model: workflow2Model,
    currentModel: workflow1Model,
    models: models
  });
});

// ==================== 案件材料 API ====================

// 获取所有案件列表
app.get('/api/case/list', (req, res) => {
    try {
        const cases = [];
        if (!fs.existsSync(FILE_DIR)) {
            return res.json({ success: true, cases: [] });
        }
        
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .sort((a, b) => {
                const statA = fs.statSync(path.join(FILE_DIR, a.name));
                const statB = fs.statSync(path.join(FILE_DIR, b.name));
                return statB.mtime.getTime() - statA.mtime.getTime();
            });
        
        folders.forEach(folder => {
            const casePath = path.join(FILE_DIR, folder.name);
            const files = fs.readdirSync(casePath);
            const stat = fs.statSync(casePath);
            
            // 解析文件夹名称格式：案件名称_日期_id
            const parts = folder.name.split('_');
            const id = parts.pop();
            const date = parts.pop();
            const name = parts.join('_');
            
            cases.push({
                id: id,
                name: name,
                date: date,
                folderName: folder.name,
                createdAt: stat.birthtime,
                updatedAt: stat.mtime,
                files: files,
                hasDoc: files.some(f => f.endsWith('.doc')),
                hasRecordTxt: files.some(f => f.includes('笔录') && f.endsWith('.txt')),
                hasTranscriptTxt: files.some(f => f.includes('转写'))
            });
        });
        
        res.json({ success: true, cases: cases });
    } catch (e) {
        console.error('[案件] 获取列表失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 完成审讯 - 创建案件文件夹并保存材料
app.post('/api/case/complete', (req, res) => {
    try {
        const { interrogationId, interrogationName, recordHtml, recordText, transcriptContent } = req.body;
        
        if (!interrogationId) {
            return res.status(400).json({ success: false, error: '缺少审讯ID' });
        }
        
        // 生成案件文件夹名称：名称_日期_id
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const folderName = `${interrogationName || '审讯'}_${date}_${interrogationId}`;
        const casePath = path.join(FILE_DIR, folderName);
        
        // 创建案件文件夹
        if (!fs.existsSync(casePath)) {
            fs.mkdirSync(casePath, { recursive: true });
            console.log('[案件] 已创建案件文件夹:', casePath);
        }
        
        const savedFiles = [];
        
        // 1. 保存笔录内容（.doc 格式，HTML 转 Word）
        if (recordHtml) {
            const docContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>询问笔录</title>
<style>
body { font-family: '仿宋_GB2312', '仿宋', FangSong, SimSun; font-size: 10pt !important; margin: 2cm 2.5cm 2cm 2cm; }
h1 { text-align: center; font-size: 20pt; font-weight: bold; margin: 30px 0; }
div, p { font-size: inherit !important; }
</style>
</head>
<body>
<h1>询问笔录</h1>
${recordHtml}
</body>
</html>`;
            const docFile = path.join(casePath, '询问笔录.doc');
            fs.writeFileSync(docFile, docContent, 'utf-8');
            savedFiles.push({ name: '询问笔录.doc', path: docFile });
            console.log('[案件] 已保存笔录(Word):', docFile);
        }
        
        // 2. 保存笔录内容（.txt 格式，纯文本）
        if (recordText) {
            const txtFile = path.join(casePath, '询问笔录.txt');
            fs.writeFileSync(txtFile, recordText, 'utf-8');
            savedFiles.push({ name: '询问笔录.txt', path: txtFile });
            console.log('[案件] 已保存笔录(文本):', txtFile);
        }
        
        // 3. 保存对话转写/录音记录
        if (transcriptContent) {
            const transcriptFile = path.join(casePath, '对话转写.txt');
            fs.writeFileSync(transcriptFile, transcriptContent, 'utf-8');
            savedFiles.push({ name: '对话转写.txt', path: transcriptFile });
            console.log('[案件] 已保存对话转写:', transcriptFile);
        }
        
        res.json({
            success: true,
            message: '案件材料已保存',
            caseId: interrogationId,
            folderName: folderName,
            savedFiles: savedFiles.map(f => f.name)
        });
        
    } catch (e) {
        console.error('[案件] 保存失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 获取案件详情和文件列表
app.get('/api/case/:caseId', (req, res) => {
    try {
        const { caseId } = req.params;
        
        if (!fs.existsSync(FILE_DIR)) {
            return res.json({ success: true, case: null, files: [] });
        }
        
        // 查找对应的案件文件夹
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));
        
        if (folders.length === 0) {
            return res.json({ success: true, case: null, files: [] });
        }
        
        const folder = folders[0];
        const casePath = path.join(FILE_DIR, folder.name);
        const files = fs.readdirSync(casePath);
        const stat = fs.statSync(casePath);
        
        const parts = folder.name.split('_');
        const id = parts.pop();
        const date = parts.pop();
        const name = parts.join('_');
        
        const caseData = {
            id: id,
            name: name,
            date: date,
            folderName: folder.name,
            createdAt: stat.birthtime,
            updatedAt: stat.mtime,
            files: files.map(file => {
                const fileStat = fs.statSync(path.join(casePath, file));
                return {
                    name: file,
                    size: fileStat.size,
                    createdAt: fileStat.birthtime
                };
            })
        };
        
        res.json({ success: true, case: caseData });
        
    } catch (e) {
        console.error('[案件] 获取详情失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 读取案件文件内容
app.get('/api/case/:caseId/file/:filename', (req, res) => {
    try {
        const { caseId, filename } = req.params;
        
        if (!fs.existsSync(FILE_DIR)) {
            return res.status(404).json({ success: false, error: '文件目录不存在' });
        }
        
        // 查找案件文件夹
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));
        
        if (folders.length === 0) {
            return res.status(404).json({ success: false, error: '案件不存在' });
        }
        
        const filePath = path.join(FILE_DIR, folders[0].name, decodeURIComponent(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ success: true, content: content, filename: filename });
        
    } catch (e) {
        console.error('[案件] 读取文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 下载案件文件
app.get('/api/case/:caseId/download/:filename', (req, res) => {
    try {
        const { caseId, filename } = req.params;
        
        if (!fs.existsSync(FILE_DIR)) {
            return res.status(404).json({ success: false, error: '文件目录不存在' });
        }
        
        const folders = fs.readdirSync(FILE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory() && dir.name.endsWith(`_${caseId}`));
        
        if (folders.length === 0) {
            return res.status(404).json({ success: false, error: '案件不存在' });
        }
        
        const filePath = path.join(FILE_DIR, folders[0].name, decodeURIComponent(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        res.download(filePath, decodeURIComponent(filename));
        
    } catch (e) {
        console.error('[案件] 下载文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==================== 学生档案 API ====================

const STUDENT_ARCHIVE_DIR = path.join(DATA_DIR, 'student-archives');

// 确保学生档案目录存在
if (!fs.existsSync(STUDENT_ARCHIVE_DIR)) {
    try {
        fs.mkdirSync(STUDENT_ARCHIVE_DIR, { recursive: true });
        console.log('[学生档案] 已创建目录:', STUDENT_ARCHIVE_DIR);
    } catch (e) {
        console.error('[学生档案] 创建目录失败:', e.message);
    }
}

// 获取学生档案列表
app.get('/api/student-archive/list', (req, res) => {
    try {
        const students = [];
        
        if (!fs.existsSync(STUDENT_ARCHIVE_DIR)) {
            return res.json({ success: true, students: [] });
        }
        
        const folders = fs.readdirSync(STUDENT_ARCHIVE_DIR, { withFileTypes: true })
            .filter(dir => dir.isDirectory())
            .sort((a, b) => {
                const statA = fs.statSync(path.join(STUDENT_ARCHIVE_DIR, a.name));
                const statB = fs.statSync(path.join(STUDENT_ARCHIVE_DIR, b.name));
                return statB.mtime.getTime() - statA.mtime.getTime();
            });
        
        folders.forEach(folder => {
            const studentPath = path.join(STUDENT_ARCHIVE_DIR, folder.name);
            const files = fs.readdirSync(studentPath);
            const stat = fs.statSync(studentPath);

            let info = {};
            const infoFile = path.join(studentPath, '.info.json');
            if (fs.existsSync(infoFile)) {
                try {
                    info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
                } catch (e) {
                    // info文件解析失败，使用默认
                }
            }

            students.push({
                id: folder.name,
                name: folder.name,
                info: info,
                date: stat.mtime.getTime(),
                createdAt: stat.birthtime,
                updatedAt: stat.mtime,
                files: files
            });
        });
        
        res.json({ success: true, students: students });
    } catch (e) {
        console.error('[学生档案] 获取列表失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 创建学生档案（支持 FormData/JSON，含照片和新字段）
app.post('/api/student-archive', async (req, res) => {
    try {
        let data = {};
        let photoUrl = null;

        // 判断是否为 multipart/form-data
        const contentType = req.headers['content-type'] || '';
        if (contentType.toLowerCase().includes('multipart/form-data')) {
            // 手动解析 FormData：读取整个 body
            const chunks = [];
            await new Promise((resolve, reject) => {
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', resolve);
                req.on('error', reject);
            });
            const rawBody = Buffer.concat(chunks);
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
            if (!boundaryMatch) {
                return res.status(400).json({ success: false, error: '无法解析 multipart boundary' });
            }
            const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim();

            const parts = rawBody.toString('binary').split(boundary);
            for (const part of parts) {
                if (!part || part === '--' || part === '\r\n' || part === '--\r\n') continue;

                // 解析 headers 和 content
                const [headerBlock, ...rest] = part.split('\r\n\r\n');
                if (!headerBlock) continue;
                const content = rest.join('\r\n\r\n').replace(/\r\n$/, '');

                const headers = {};
                headerBlock.split('\r\n').forEach(line => {
                    const idx = line.indexOf(':');
                    if (idx > -1) {
                        const key = line.slice(0, idx).trim().toLowerCase();
                        const val = line.slice(idx + 1).trim();
                        headers[key] = val;
                    }
                });

                const disposition = headers['content-disposition'] || '';
                const nameMatch = disposition.match(/name="([^"]+)"/);
                const fieldName = nameMatch ? nameMatch[1] : null;
                const filenameMatch = disposition.match(/filename="([^"]+)"/);
                const hasFilename = filenameMatch !== null;

                if (!fieldName) continue;

                if (hasFilename) {
                    // 文件字段（作为备选：若浏览器把 photo 当作文件上传）
                    const photoHeader = headers['content-type'] || '';
                    const photoContent = Buffer.from(content, 'binary');
                    if (photoContent && photoContent.length > 10) {
                        let mimeType = photoHeader.trim().split(';')[0].trim();
                        if (!mimeType || !mimeType.startsWith('image/')) mimeType = 'image/png';
                        photoUrl = 'data:' + mimeType + ';base64,' + photoContent.toString('base64');
                    }
                } else {
                    // 普通文本字段
                    const value = Buffer.from(content, 'binary').toString('utf8').replace(/\r\n$/, '').trim();
                    if (fieldName === 'photo' && value) {
                        // photo 字段是 data URL 字符串
                        photoUrl = value;
                    } else {
                        data[fieldName] = value;
                    }
                }
            }
        } else {
            // 兼容旧逻辑：JSON body
            data = req.body || {};
        }

        const name = data.name || '';
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: '学生姓名不能为空' });
        }
        const studentName = name.trim();

        // 用"姓名_学号"或姓名作为文件夹名，同时防止路径穿越
        let folderName = studentName;
        if (data.studentId) {
            folderName = studentName + '_' + String(data.studentId).replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
        }
        folderName = folderName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, folderName);

        if (fs.existsSync(studentPath)) {
            return res.json({ success: true, student: { id: folderName, name: studentName }, message: '学生档案已存在' });
        }

        fs.mkdirSync(studentPath, { recursive: true });

        let photoFilename = '';
        if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('data:image/')) {
            const commaIdx = photoUrl.indexOf(',');
            if (commaIdx > -1) {
                const mimeMatch = photoUrl.substring(0, commaIdx).match(/image\/(png|jpeg|jpg|gif|webp|bmp)/i);
                const ext = mimeMatch ? ((mimeMatch[1] === 'jpeg') ? 'jpg' : mimeMatch[1].toLowerCase()) : 'jpg';
                photoFilename = 'photo.' + ext;
                try {
                    const photoBuffer = Buffer.from(photoUrl.substring(commaIdx + 1), 'base64');
                    fs.writeFileSync(path.join(studentPath, photoFilename), photoBuffer);
                } catch (e) {
                    console.error('[学生档案] 保存照片文件失败:', e.message);
                    photoFilename = '';
                }
            }
        } else if (photoUrl && typeof photoUrl === 'string' && photoUrl.length > 0 && !photoUrl.startsWith('data:')) {
            photoFilename = photoUrl;
        }

        // 保存 .info.json（photo 字段只存文件名，不存 data URL）
        const info = {
            name: studentName,
            team: data.team || '',
            studentId: data.studentId || '',
            gender: data.gender || '男',
            birthday: data.birthday || '',
            college: data.college || '',
            major: data.major || '',
            origin: data.origin || '',
            photo: photoFilename
        };

        const infoFile = path.join(studentPath, '.info.json');
        fs.writeFileSync(infoFile, JSON.stringify(info, null, 2), 'utf-8');

        console.log('[学生档案] 已创建学生档案:', studentPath);
        res.json({ success: true, student: { id: folderName, name: studentName, info: info } });
    } catch (e) {
        console.error('[学生档案] 创建失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 访问学生照片文件
app.get('/api/student-archive/:id/photo', (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !id.trim()) {
            return res.status(400).send('Invalid id');
        }
        // Express 已自动解码一次，避免重复 decodeURIComponent
        const folderId = String(id);
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, folderId);

        if (!fs.existsSync(studentPath)) {
            return res.status(404).send('Not found');
        }

        let photoFile = null;
        let photoExt = 'jpg';
        try {
            const files = fs.readdirSync(studentPath);
            for (const f of files) {
                const lower = String(f).toLowerCase();
                if (lower.startsWith('photo.') &&
                    /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(lower)) {
                    photoFile = f;
                    const dotIdx = lower.lastIndexOf('.');
                    photoExt = lower.substring(dotIdx + 1);
                    break;
                }
            }
        } catch (readErr) {
            console.error('[学生档案] 读取文件夹失败:', readErr.message);
            photoFile = null;
        }

        if (!photoFile) {
            return res.status(404).send('No photo');
        }

        const photoPath = path.join(studentPath, photoFile);
        if (!fs.existsSync(photoPath)) {
            return res.status(404).send('Photo missing');
        }

        let stat;
        try {
            stat = fs.statSync(photoPath);
        } catch (statErr) {
            return res.status(404).send('Stat failed');
        }

        const mime = (photoExt === 'jpg') ? 'image/jpeg' : 'image/' + photoExt;
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

        const stream = fs.createReadStream(photoPath);
        stream.on('error', (e) => {
            console.error('[学生档案] 照片读取失败:', e.message);
            if (!res.headersSent) {
                res.status(500).send('Failed');
            }
        });
        stream.pipe(res);
    } catch (e) {
        console.error('[学生档案] 照片访问失败:', e.message);
        if (!res.headersSent) {
            res.status(500).send('Error');
        } else {
            res.end();
        }
    }
});

// 获取学生档案详情
app.get('/api/student-archive/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !id.trim()) {
            return res.json({ success: true, student: null, files: [] });
        }
        // Express 已自动解码一次，避免重复 decodeURIComponent
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, String(id));
        
        if (!fs.existsSync(studentPath)) {
            return res.json({ success: true, student: null, files: [] });
        }
        
        const files = fs.readdirSync(studentPath);
        const stat = fs.statSync(studentPath);
        
        // 读取学生信息文件（如果有）
        let info = {};
        const infoFile = path.join(studentPath, '.info.json');
        if (fs.existsSync(infoFile)) {
            try {
                info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
            } catch (e) {
                console.warn('[学生档案] 读取信息文件失败:', e.message);
            }
        }

        // 过滤markdown文件，读取详细信息
        const mdFiles = files
            .filter(function(f) { return f.endsWith('.md') || f.endsWith('.MD'); })
            .map(function(f) {
                try {
                    const fileStat = fs.statSync(path.join(studentPath, f));
                    return {
                        name: f,
                        createdAt: fileStat.birthtime.getTime ? fileStat.birthtime.getTime() : new Date(fileStat.birthtime).getTime(),
                        size: fileStat.size
                    };
                } catch (e) {
                    return { name: f, createdAt: Date.now(), size: 0 };
                }
            })
            .sort(function(a, b) { return b.createdAt - a.createdAt; });

        const studentData = {
            id: String(id),
            name: info.name || String(id),
            info: info,
            date: stat.mtime.getTime(),
            createdAt: stat.birthtime,
            updatedAt: stat.mtime,
            files: mdFiles
        };
        
        res.json({ success: true, student: studentData });
    } catch (e) {
        console.error('[学生档案] 获取详情失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 保存谈话记录到学生档案
app.post('/api/student-archive/:id/save', (req, res) => {
    try {
        const { id } = req.params;
        const { transcriptContent, analysisContent, conversationName } = req.body || {};
        
        if (!transcriptContent) {
            return res.status(400).json({ success: false, error: '谈话内容不能为空' });
        }
        
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, String(id));
        
        // 确保学生档案目录存在
        if (!fs.existsSync(studentPath)) {
            fs.mkdirSync(studentPath, { recursive: true });
        }
        
        // 生成文件名：日期时间_谈话记录.md
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const fileName = `${dateStr}_${timeStr}_谈话记录.md`;
        const filePath = path.join(studentPath, fileName);
        
        // 构建 Markdown 内容
        let mdContent = '';
        
        // 如果有分析结果（角色分离），先添加到开头
        if (analysisContent && analysisContent.trim()) {
            mdContent += '## 角色分析\n\n';
            mdContent += analysisContent.trim() + '\n\n';
            mdContent += '---\n\n';
        }
        
        mdContent += '## 谈话记录\n\n';
        mdContent += transcriptContent.trim();
        
        // 保存文件
        fs.writeFileSync(filePath, mdContent, 'utf-8');
        console.log('[学生档案] 已保存谈话记录:', filePath);
        
        res.json({ success: true, fileName: fileName, path: filePath });
    } catch (e) {
        console.error('[学生档案] 保存失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 保存谈话记录到学生档案（新版，支持完整元数据）
app.post('/api/student-archive/:id/conversation', (req, res) => {
    try {
        const { id } = req.params;
        const { content, analysis, filename } = req.body || {};

        if (!content) {
            return res.status(400).json({ success: false, error: '谈话内容不能为空' });
        }

        const studentPath = path.join(STUDENT_ARCHIVE_DIR, String(id));

        // 确保学生档案目录存在
        if (!fs.existsSync(studentPath)) {
            return res.status(404).json({ success: false, error: '学生档案不存在' });
        }

        // 使用传入的文件名或生成新文件名
        const fileName = filename || (new Date().toISOString().replace(/[:.]/g, '-') + '_谈话记录.md');
        const filePath = path.join(studentPath, fileName);

        // 保存文件
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('[学生档案] 已保存谈话记录:', filePath);

        // 如果有分析数据，同时保存一份 JSON 分析数据
        if (analysis) {
            const jsonFileName = fileName.replace('.md', '.analysis.json');
            const jsonFilePath = path.join(studentPath, jsonFileName);
            try {
                const analysisObj = typeof analysis === 'string' ? { content: analysis } : analysis;
                fs.writeFileSync(jsonFilePath, JSON.stringify(analysisObj, null, 2), 'utf-8');
                console.log('[学生档案] 已保存分析数据:', jsonFilePath);
            } catch (jsonErr) {
                console.error('[学生档案] 保存分析数据失败:', jsonErr.message);
            }
        }

        res.json({ success: true, fileName: fileName, path: filePath });
    } catch (e) {
        console.error('[学生档案] 保存谈话记录失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 读取学生档案文件内容
app.get('/api/student-archive/:id/file/:filename', (req, res) => {
    try {
        const { id, filename } = req.params;
        if (!id || !filename) {
            return res.status(400).json({ success: false, error: '参数错误' });
        }
        // Express 已自动解码，避免重复 decodeURIComponent
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, String(id));
        
        if (!fs.existsSync(studentPath)) {
            return res.status(404).json({ success: false, error: '学生档案不存在' });
        }
        
        const filePath = path.join(studentPath, String(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ success: true, content: content, filename: filename });
    } catch (e) {
        console.error('[学生档案] 读取文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 下载学生档案文件
app.get('/api/student-archive/:id/download/:filename', (req, res) => {
    try {
        const { id, filename } = req.params;
        const studentPath = path.join(STUDENT_ARCHIVE_DIR, String(id));
        
        if (!fs.existsSync(studentPath)) {
            return res.status(404).json({ success: false, error: '学生档案不存在' });
        }
        
        const filePath = path.join(studentPath, String(filename));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        res.download(filePath, String(filename));
    } catch (e) {
        console.error('[学生档案] 下载文件失败:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

async function startServer() {
  console.log('\n正在初始化 谈心谈话系统...\n');
  printConfigValidation();
  
  const modelNames = {
    glm: '智谱GLM',
    deepseek: 'DeepSeek',
    doubao: '豆包',
    kimi: 'Kimi',
    ernie: '文心一言',
    nvidia: 'NVIDIA',
    qianwen: '千问'
  };
  
  if (config.enableTerminalSelection) {
    console.log('📋 终端模型选择已启用\n');
    await modelSelector.promptForSelection();
  } else {
    console.log('📋 终端模型选择已禁用，直接使用默认模型\n');
  }
  
  const workflow1Model = modelSelector.getModelForWorkflow(1);
  const workflow2Model = modelSelector.getModelForWorkflow(2);
  
  function getModelVersion(modelName, workflowNum) {
    const modelConfig = config[modelName];
    if (!modelConfig) return '';
    if (workflowNum === 1 && modelConfig.workflow1Model) {
      return ` (${modelConfig.workflow1Model})`;
    } else if (workflowNum === 2 && modelConfig.workflow2Model) {
      return ` (${modelConfig.workflow2Model})`;
    } else if (modelConfig.model) {
      return ` (${modelConfig.model})`;
    }
    return '';
  }
  
  console.log(`\n🚀 服务器运行在 http://localhost:${port}`);
  console.log(`🤖 工作流1（推荐问题）模型: ${modelNames[workflow1Model] || workflow1Model}${getModelVersion(workflow1Model, 1)}`);
  console.log(`🤖 工作流2（笔录生成）模型: ${modelNames[workflow2Model] || workflow2Model}${getModelVersion(workflow2Model, 2)}`);
  console.log('');
  
  app.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  谈心谈话系统 服务已启动');
    console.log('═══════════════════════════════════════════════════════════\n');
  });
}

startServer().catch(console.error);