const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Загружаем Three.js для Node.js
const THREE = require('three');
const { STLLoader } = require('three/examples/jsm/loaders/STLLoader.js');
const { OBJLoader } = require('three/examples/jsm/loaders/OBJLoader.js');
const { STLExporter } = require('three/examples/jsm/exporters/STLExporter.js');
const { OBJExporter } = require('three/examples/jsm/exporters/OBJExporter.js');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');

const app = express();
const PORT = 3000;

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

// Загрузка модели в зависимости от формата
async function loadModel(filePath, format) {
    return new Promise((resolve, reject) => {
        if (format === 'stl') {
            const loader = new STLLoader();
            loader.load(filePath, (geometry) => {
                const material = new THREE.MeshStandardMaterial({ color: 0x66ccff });
                const mesh = new THREE.Mesh(geometry, material);
                const group = new THREE.Group();
                group.add(mesh);
                resolve(group);
            }, null, reject);
        } 
        else if (format === 'obj') {
            const loader = new OBJLoader();
            loader.load(filePath, (obj) => resolve(obj), null, reject);
        }
        else if (format === 'glb' || format === 'gltf') {
            const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            loader.load(filePath, (gltf) => resolve(gltf.scene), null, reject);
        }
        else {
            reject(new Error(`Формат ${format} не поддерживается для загрузки`));
        }
    });
}

// Экспорт модели в нужный формат
async function exportModel(scene, format) {
    return new Promise((resolve, reject) => {
        const group = new THREE.Group();
        if (scene.isGroup || scene.isScene) {
            group.add(...scene.children);
        } else {
            group.add(scene);
        }
        
        if (format === 'stl') {
            const exporter = new STLExporter();
            const data = exporter.parse(group, { binary: false });
            resolve(Buffer.from(data, 'utf-8'));
        }
        else if (format === 'obj') {
            const exporter = new OBJExporter();
            const data = exporter.parse(group);
            resolve(Buffer.from(data, 'utf-8'));
        }
        else if (format === 'glb') {
            const exporter = new GLTFExporter();
            exporter.parse(group, (result) => {
                resolve(Buffer.from(result));
            }, reject, { binary: true });
        }
        else if (format === 'gltf') {
            const exporter = new GLTFExporter();
            exporter.parse(group, (result) => {
                const jsonStr = JSON.stringify(result, null, 2);
                resolve(Buffer.from(jsonStr, 'utf-8'));
            }, reject, { binary: false });
        }
        else {
            reject(new Error(`Формат ${format} не поддерживается для экспорта`));
        }
    });
}

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

// Основной endpoint конвертации
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
    
    if (fromFormat === toFormat) {
        cleanupFiles([inputFile.path]);
        return res.status(400).json({ error: 'Нельзя конвертировать в тот же формат' });
    }
    
    console.log(`🔄 Конвертация: ${inputFile.originalname} (${fromFormat} → ${toFormat})`);
    
    try {
        // Загружаем модель
        const scene = await loadModel(inputFile.path, fromFormat);
        
        // Экспортируем в нужный формат
        const outputBuffer = await exportModel(scene, toFormat);
        
        // Очищаем временные файлы
        cleanupFiles([inputFile.path]);
        
        // Формируем имя выходного файла
        const originalName = inputFile.originalname;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
        const outputFileName = `${baseName}_converted.${toFormat}`;
        
        // Отправляем результат
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(outputBuffer);
        
        console.log(`✅ Конвертация завершена: ${outputFileName} (${outputBuffer.length} bytes)`);
        
    } catch (error) {
        console.error('❌ Ошибка конвертации:', error);
        cleanupFiles([inputFile.path]);
        res.status(500).json({ error: error.message });
    }
});

// Тестовый endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📍 Для телефона: http://ВАШ_IP:${PORT}`);
    console.log(`📁 Поддерживаемые форматы: STL ↔ OBJ ↔ GLB/GLTF`);
});
