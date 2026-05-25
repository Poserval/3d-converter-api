# Используем официальный образ Node.js
FROM node:18-slim

# Устанавливаем Assimp для конвертации 3D файлов
RUN apt-get update && apt-get install -y assimp && rm -rf /var/lib/apt/lists/*

# Создаём рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Создаём папку для временных файлов
RUN mkdir -p uploads

# Открываем порт
EXPOSE 3000

# Запускаем сервер
CMD ["node", "server.js"]
