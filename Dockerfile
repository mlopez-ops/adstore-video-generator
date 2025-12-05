FROM node:20-alpine

# Instalar FFmpeg
RUN apk add --no-cache ffmpeg

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependencias (cambiado de npm ci a npm install)
RUN npm install --omit=dev

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "index.js"]

