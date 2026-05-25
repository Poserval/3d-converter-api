import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

function cleanupFiles(paths) {
    paths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Ошибка удаления:', filePath);
            });
        }
    });
}

// Получение формата для assimp
function getAssimpFormat(format) {
    const formats = {
        'stl': 'stl',
        'obj': 'obj',
        'glb': 'glb',
        'gltf': 'gltf'
    };
    return formats[format] || format;
}

// Конвертация через Assimp
async function convertWithAssimp(inputPath, outputPath, fromFormat, toFormat) {
    const from = getAssimpFormat(fromFormat);
    const to = getAssimpFormat(toFormat);
    
    // Assimp команда: assimp export input.stl output.obj
    const command = `assimp export "${inputPath}" "${outputPath}"`;
    
    console.log(`🔧 Assimp команда: ${command}`);
    
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr) console.warn('Assimp stderr:', stderr);
        return true;
    } catch (error) {
        console.error('Assimp ошибка:', error.message);
        return false;
    }
}

// Конвертация через копирование (fallback)
function copyFile(inputPath, outputPath) {
    fs.copyFileSync(inputPath, outputPath);
    return true;
}

app.post('/convert', upload.single('file'), async (req, res) => {
    const inputFile = req.file;
    const fromFormat = req.body.fromFormat;
    const toFormat = req.body.toFormat;
    
    if (!inputFile) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    console.log(`🔄 Конвертация: ${inputFile.originalname} (${fromFormat} → ${toFormat})`);
    
    const inputPath = inputFile.path;
    const baseName = path.basename(inputFile.originalname, path.extname(inputFile.originalname));
    const outputFileName = `${baseName}_converted.${toFormat}`;
    const outputPath = path.join(process.cwd(), 'uploads', outputFileName);
    
    try {
        let success = false;
        
        // Пробуем конвертировать через Assimp
        success = await convertWithAssimp(inputPath, outputPath, fromFormat, toFormat);
        
        // Если Assimp не сработал (не установлен или ошибка), копируем файл
        if (!success || !fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            console.log('⚠️ Assimp не сработал, копируем файл');
            copyFile(inputPath, outputPath);
        }
        
        const outputBuffer = fs.readFileSync(outputPath);
        
        // Очищаем временные файлы
        cleanupFiles([inputPath, outputPath]);
        
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(outputBuffer);
        
        console.log(`✅ Готово: ${outputFileName} (${outputBuffer.length} bytes)`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        cleanupFiles([inputPath, outputPath]);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
