import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

function cleanupFiles(paths) {
    paths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Ошибка удаления:', filePath);
            });
        }
    });
}

// Простая конвертация через копирование (пока нет XMLHttpRequest)
app.post('/convert', upload.single('file'), async (req, res) => {
    const inputFile = req.file;
    const toFormat = req.body.toFormat;
    
    if (!inputFile) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    console.log(`🔄 Обработка: ${inputFile.originalname} → ${toFormat}`);
    
    try {
        const inputPath = inputFile.path;
        const baseName = inputFile.originalname.substring(0, inputFile.originalname.lastIndexOf('.'));
        const outputFileName = `${baseName}_converted.${toFormat}`;
        const outputPath = path.join(process.cwd(), 'uploads', outputFileName);
        
        // Временно: копируем файл (пока нет реальной конвертации)
        fs.copyFileSync(inputPath, outputPath);
        const outputBuffer = fs.readFileSync(outputPath);
        
        cleanupFiles([inputPath, outputPath]);
        
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(outputBuffer);
        
        console.log(`✅ Готово: ${outputFileName}`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        cleanupFiles([inputFile.path]);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер на порту ${PORT}`);
});
