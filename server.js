const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// Очистка временных файлов
function cleanupFiles(paths) {
    paths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Ошибка удаления:', filePath);
            });
        }
    });
}

// Прямое копирование для теста (временное решение)
app.post('/convert', upload.single('file'), async (req, res) => {
    const inputFile = req.file;
    const fromFormat = req.body.fromFormat;
    const toFormat = req.body.toFormat;
    
    if (!inputFile) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    if (!fromFormat || !toFormat) {
        cleanupFiles([inputFile.path]);
        return res.status(400).json({ error: 'Не указаны форматы' });
    }
    
    console.log(`🔄 Конвертация: ${inputFile.originalname} (${fromFormat} → ${toFormat})`);
    
    try {
        const inputPath = inputFile.path;
        const baseName = inputFile.originalname.substring(0, inputFile.originalname.lastIndexOf('.'));
        const outputFileName = `${baseName}_converted.${toFormat}`;
        const outputPath = path.join(__dirname, 'uploads', outputFileName);
        
        // ВРЕМЕННО: просто копируем файл (пока нет реальной конвертации)
        fs.copyFileSync(inputPath, outputPath);
        
        const outputBuffer = fs.readFileSync(outputPath);
        
        // Очищаем временные файлы
        cleanupFiles([inputPath, outputPath]);
        
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(outputBuffer);
        
        console.log(`✅ Конвертация завершена: ${outputFileName} (${outputBuffer.length} bytes)`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        cleanupFiles([inputFile.path]);
        res.status(500).json({ error: error.message });
    }
});

// Тестовый endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 Адрес: http://localhost:${PORT}`);
});
