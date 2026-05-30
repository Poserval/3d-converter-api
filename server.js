import express from 'express';
import multer from 'multer';
import { NodeIO } from '@gltf-transform/core';
import { draco, prune } from '@gltf-transform/functions';

const app = express();
const PORT = process.env.PORT || 5046;

// Настройка multer для приёма файлов (макс. 200 МБ)
const upload = multer({
    limits: { fileSize: 200 * 1024 * 1024 },
    storage: multer.memoryStorage()
});

// Настройка CORS для доступа из вашего Android-приложения
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Функция сжатия GLB с помощью Draco
async function compressGLB(inputBuffer, compressionLevel = 'medium') {
    const io = new NodeIO();
    const document = await io.readBinary(new Uint8Array(inputBuffer));

    // Настройки квантования в зависимости от выбранного уровня качества
    let quantizePosition = 14;
    let quantizeNormal = 12;
    let quantizeTexcoord = 12;

    switch (compressionLevel) {
        case 'high':
            quantizePosition = 16; quantizeNormal = 14; quantizeTexcoord = 14;
            break;
        case 'low':
            quantizePosition = 12; quantizeNormal = 10; quantizeTexcoord = 10;
            break;
        case 'minimal':
            quantizePosition = 10; quantizeNormal = 8; quantizeTexcoord = 8;
            break;
        // 'medium' значения по умолчанию
    }

    // Применяем Draco сжатие с выбранными параметрами
    await document.transform(draco({
        quantizationPosition: quantizePosition,
        quantizationNormal: quantizeNormal,
        quantizationTexcoord: quantizeTexcoord
    }));

    // Удаляем неиспользуемые данные, чтобы уменьшить размер
    await document.transform(prune());

    const compressedBuffer = await io.writeBinary(document);
    return Buffer.from(compressedBuffer);
}

// Эндпоинт для сжатия
app.post('/compress', upload.single('file'), async (req, res) => {
    const startTime = Date.now();

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const originalSize = req.file.size;
        const compressionLevel = req.body.level || 'medium';

        console.log(`📥 Получен файл: ${req.file.originalname}`);
        console.log(`   Размер: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Уровень сжатия: ${compressionLevel}`);

        const compressedBuffer = await compressGLB(req.file.buffer, compressionLevel);
        const compressedSize = compressedBuffer.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        const timeMs = Date.now() - startTime;

        console.log(`✅ Сжато: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}%) за ${timeMs} мс`);

        // Отправляем сжатый файл обратно клиенту
        res.set({
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="compressed_${req.file.originalname}"`,
            'X-Compression-Ratio': `${ratio}%`
        });
        res.send(compressedBuffer);

    } catch (err) {
        console.error('❌ Ошибка сжатия:', err);
        res.status(500).json({ error: `Ошибка сервера: ${err.message}` });
    }
});

// Эндпоинт для проверки работоспособности сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🚀 3D CONVERTER API RUNNING                             ║
║     Версия: 2.0.0                                          ║
║     Порт: ${PORT}                                          ║
║     Для эмулятора: http://10.0.2.2:${PORT}                 ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
