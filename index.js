// Logging inmediato ANTES de cualquier import
console.log('=== SERVIDOR INICIANDO ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('PORT env:', process.env.PORT);

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
});

// Imports con try-catch
let express, ffmpeg, cors, fetch, Readable;

try {
  console.log('📦 Cargando express...');
  express = require('express');
  console.log('✅ express cargado');
} catch (e) {
  console.error('❌ Error cargando express:', e.message);
  process.exit(1);
}

try {
  console.log('📦 Cargando fluent-ffmpeg...');
  ffmpeg = require('fluent-ffmpeg');
  console.log('✅ fluent-ffmpeg cargado');
  
  // Configurar path explícito de FFmpeg
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  ffmpeg.setFfprobePath('/usr/bin/ffprobe');
  console.log('✅ FFmpeg paths configurados');
} catch (e) {
  console.error('❌ Error cargando fluent-ffmpeg:', e.message);
  process.exit(1);
}

try {
  console.log('📦 Cargando cors...');
  cors = require('cors');
  console.log('✅ cors cargado');
} catch (e) {
  console.error('❌ Error cargando cors:', e.message);
  process.exit(1);
}

try {
  console.log('📦 Cargando node-fetch...');
  const nodeFetch = require('node-fetch');
  fetch = nodeFetch.default || nodeFetch;
  Readable = require('stream').Readable;
  console.log('✅ node-fetch cargado');
} catch (e) {
  console.error('❌ Error cargando node-fetch:', e.message);
  process.exit(1);
}

console.log('✅ Todos los módulos cargados correctamente');

// Crear app Express
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

console.log('✅ Express app configurada');

// Health check SIMPLE
app.get('/health', (req, res) => {
  console.log('📥 Health check recibido');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: 'Video Generator API', status: 'running' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
console.log('🚀 Intentando iniciar servidor en puerto:', PORT);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`✅ SERVIDOR CORRIENDO EN PUERTO ${PORT}`);
  console.log('========================================');
});

server.on('error', (err) => {
  console.error('❌ Error al iniciar servidor:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido');
  server.close(() => {
    console.log('👋 Servidor cerrado');
    process.exit(0);
  });
});
