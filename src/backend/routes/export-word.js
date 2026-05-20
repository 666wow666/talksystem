const express = require('express');
const fs = require('fs');
const path = require('path');

try {
    var archiver = require('archiver');
} catch (e) {
    console.error('archiver not installed, using native zip');
}

const router = express.Router();

router.post('/export-word', async (req, res) => {
    try {
        console.log('[Export] Received export request');
        
        const { content, dateStr } = req.body;
        
        if (!content || !dateStr) {
            console.error('[Export] Missing parameters');
            return res.status(400).json({ success: false, error: '缺少参数' });
        }

        const tempDir = path.join(__dirname, '../../temp');
        console.log('[Export] Temp directory:', tempDir);
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log('[Export] Created temp directory');
        }

        const docxContent = generateDocxContent(content);
        
        const filename = `笔录_${dateStr}.docx`;
        const outputPath = path.join(tempDir, filename);
        console.log('[Export] Output path:', outputPath);
        
        await createDocxFile(docxContent, outputPath);

        res.json({
            success: true,
            filename: filename,
            message: 'Word文档生成成功'
        });
        console.log('[Export] Success:', filename);

    } catch (error) {
        console.error('[Export] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../../temp', filename);
        
        console.log('[Download] Requested:', filename);
        console.log('[Download] File path:', filePath);
        
        if (!fs.existsSync(filePath)) {
            console.error('[Download] File not found:', filePath);
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('[Download] Error:', err);
                res.status(500).json({ success: false, error: err.message });
            } else {
                console.log('[Download] Success:', filename);
            }
        });
    } catch (error) {
        console.error('[Download] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function generateDocxContent(htmlContent) {
    const textContent = htmlContent
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();

    const lines = textContent.split(/\r?\n/).filter(line => line.trim());

    let bodyContent = '';
    lines.forEach((line, index) => {
        line = escapeXml(line.trim());
        if (line) {
            bodyContent += `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`;
        }
    });

    return {
        'word/': {
            'document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p>
<w:r>
<w:rPr>
<w:rFonts w:ascii="FangSong" w:eastAsia="FangSong"/>
<w:sz w:val="52"/>
<w:b/>
</w:rPr>
<w:t>询问笔录</w:t>
</w:r>
</w:p>
${bodyContent}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId1"/>
<w:footerReference w:type="default" r:id="rId2"/>
</w:sectPr>
</w:body>
</w:document>`,
            'header1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p>
<w:pPr>
<w:jc w:val="right"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="FangSong" w:eastAsia="FangSong"/>
<w:sz w:val="32"/>
</w:rPr>
<w:t>第　　次</w:t>
</w:r>
</w:p>
</w:hdr>`,
            'footer1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p>
<w:pPr>
<w:jc w:val="right"/>
</w:pPr>
<w:r>
<w:rPr>
<w:rFonts w:ascii="FangSong" w:eastAsia="FangSong"/>
<w:sz w:val="28"/>
</w:rPr>
<w:t>第　　页　共　　页</w:t>
</w:r>
</w:p>
</w:ftr>`
        },
        'docProps/': {
            'app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Microsoft Office Word</Application>
</Properties>`,
            'core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">询问笔录</dc:title>
<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">CloudVoice</dc:creator>
<cp:lastModifiedBy>CloudVoice</cp:lastModifiedBy>
<cp:revision>1</cp:revision>
</cp:coreProperties>`
        },
        '_rels/': {
            '.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
        },
        'word/_rels/': {
            'document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`
        },
        '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`
    };
}

function escapeXml(text) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    };
    return text.replace(/[&<>"']/g, match => replacements[match]);
}

async function createDocxFile(content, outputPath) {
    return new Promise((resolve, reject) => {
        if (typeof archiver !== 'undefined') {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log('[Export] Archive closed');
                resolve();
            });
            output.on('error', (err) => {
                console.error('[Export] Output error:', err);
                reject(err);
            });

            archive.on('error', (err) => {
                console.error('[Export] Archive error:', err);
                reject(err);
            });

            archive.pipe(output);

            Object.keys(content).forEach(folder => {
                const files = content[folder];
                Object.keys(files).forEach(filename => {
                    archive.append(files[filename], { name: folder + filename });
                });
            });

            archive.finalize();
        } else {
            createZipNative(content, outputPath)
                .then(resolve)
                .catch(reject);
        }
    });
}

function createZipNative(content, outputPath) {
    const zlib = require('zlib');
    const { crc32 } = require('crc');
    
    return new Promise((resolve, reject) => {
        const files = [];
        
        Object.keys(content).forEach(folder => {
            const folderFiles = content[folder];
            Object.keys(folderFiles).forEach(filename => {
                files.push({
                    path: folder + filename,
                    content: folderFiles[filename]
                });
            });
        });

        let offset = 0;
        const fileEntries = [];

        files.forEach(file => {
            const contentBuffer = Buffer.from(file.content, 'utf8');
            const compressed = zlib.deflateSync(contentBuffer);
            
            const crc = crc32(contentBuffer);
            
            const localHeader = Buffer.alloc(30);
            localHeader.writeUInt32LE(0x04034b50, 0);
            localHeader.writeUInt16LE(20, 4);
            localHeader.writeUInt16LE(0, 6);
            localHeader.writeUInt16LE(8, 8);
            localHeader.writeUInt32LE(crc, 14);
            localHeader.writeUInt32LE(compressed.length, 18);
            localHeader.writeUInt32LE(contentBuffer.length, 22);
            localHeader.writeUInt16LE(file.path.length, 26);
            localHeader.writeUInt16LE(0, 28);

            fileEntries.push({
                localHeader,
                path: file.path,
                compressed,
                crc,
                uncompressedSize: contentBuffer.length,
                compressedSize: compressed.length,
                offset
            });

            offset += 30 + file.path.length + compressed.length;
        });

        const centralDirOffset = offset;
        let centralDirSize = 0;

        fileEntries.forEach(entry => {
            const centralHeader = Buffer.alloc(46);
            centralHeader.writeUInt32LE(0x02014b50, 0);
            centralHeader.writeUInt16LE(20, 4);
            centralHeader.writeUInt16LE(0, 6);
            centralHeader.writeUInt16LE(8, 8);
            centralHeader.writeUInt32LE(entry.crc, 16);
            centralHeader.writeUInt32LE(entry.compressedSize, 20);
            centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
            centralHeader.writeUInt16LE(entry.path.length, 28);
            centralHeader.writeUInt16LE(0, 30);
            centralHeader.writeUInt16LE(0, 32);
            centralHeader.writeUInt16LE(0, 34);
            centralHeader.writeUInt16LE(0, 36);
            centralHeader.writeUInt32LE(0, 38);
            centralHeader.writeUInt32LE(entry.offset, 42);

            offset += 46 + entry.path.length;
            centralDirSize += 46 + entry.path.length;
        });

        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4);
        eocd.writeUInt16LE(fileEntries.length, 8);
        eocd.writeUInt32LE(centralDirSize, 12);
        eocd.writeUInt32LE(centralDirOffset, 16);
        eocd.writeUInt16LE(0, 20);

        const totalSize = offset + 22;
        const buffer = Buffer.alloc(totalSize);
        let pos = 0;

        fileEntries.forEach(entry => {
            entry.localHeader.copy(buffer, pos);
            pos += entry.localHeader.length;
            
            buffer.write(entry.path, pos, 'utf8');
            pos += entry.path.length;
            
            entry.compressed.copy(buffer, pos);
            pos += entry.compressed.length;
        });

        fileEntries.forEach(entry => {
            const centralHeader = Buffer.alloc(46);
            centralHeader.writeUInt32LE(0x02014b50, 0);
            centralHeader.writeUInt16LE(20, 4);
            centralHeader.writeUInt16LE(0, 6);
            centralHeader.writeUInt16LE(8, 8);
            centralHeader.writeUInt32LE(entry.crc, 16);
            centralHeader.writeUInt32LE(entry.compressedSize, 20);
            centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
            centralHeader.writeUInt16LE(entry.path.length, 28);
            centralHeader.writeUInt16LE(0, 30);
            centralHeader.writeUInt16LE(0, 32);
            centralHeader.writeUInt16LE(0, 34);
            centralHeader.writeUInt16LE(0, 36);
            centralHeader.writeUInt32LE(0, 38);
            centralHeader.writeUInt32LE(entry.offset, 42);
            
            centralHeader.copy(buffer, pos);
            pos += centralHeader.length;
            buffer.write(entry.path, pos, 'utf8');
            pos += entry.path.length;
        });

        eocd.copy(buffer, pos);
        pos += eocd.length;

        fs.writeFile(outputPath, buffer, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = router;
