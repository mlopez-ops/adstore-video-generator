FROM node:20-alpine

# Instalar FFmpeg
RUN apk add --no-cache ffmpeg

# Verificar instalación de FFmpeg
RUN echo "=== Verificando FFmpeg ===" && ffmpeg -version

WORKDIR /app

# Copiar package.json primero para cache de layers
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Verificar que index.js existe y mostrar primeras líneas
RUN echo "=== Verificando index.js ===" && ls -la && head -5 index.js

EXPOSE 3000

# Comando de inicio con logging
CMD echo "=== Iniciando aplicación ===" && node index.js

