// ============================================
// LOGGING INMEDIATO - ANTES DE CUALQUIER COSA
// ============================================
console.log('==============================================');
console.log('=== SERVIDOR VIDEO GENERATOR INICIANDO ===');
console.log('==============================================');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Current directory:', process.cwd());
console.log('Environment variables:');
console.log('  - PORT:', process.env.PORT);
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - API_KEY exists:', !!process.env.API_KEY);

// ============================================
// MANEJADORES DE ERRORES GLOBALES
// ============================================
process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
});

// ============================================
// CARGA DE MÓDULOS CON LOGGING
// ============================================
console.log('\n--- Cargando módulos ---');

let express, ffmpeg, cors, fetch, fs, path, os;

// Express
console.log('1. Cargando express...');
try {
  express = require('express');
  console.log('   ✓ Express cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando express:', error.message);
  process.exit(1);
}

// Fluent-ffmpeg
console.log('2. Cargando fluent-ffmpeg...');
try {
  ffmpeg = require('fluent-ffmpeg');
  console.log('   ✓ Fluent-ffmpeg cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando fluent-ffmpeg:', error.message);
  process.exit(1);
}

// CORS
console.log('3. Cargando cors...');
try {
  cors = require('cors');
  console.log('   ✓ CORS cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando cors:', error.message);
  process.exit(1);
}

// Node-fetch
console.log('4. Cargando node-fetch...');
try {
  fetch = require('node-fetch');
  console.log('   ✓ Node-fetch cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando node-fetch:', error.message);
  process.exit(1);
}

// FS y Path (built-in)
console.log('5. Cargando fs y path...');
try {
  fs = require('fs');
  path = require('path');
  os = require('os');
  console.log('   ✓ FS, Path y OS cargados correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando módulos built-in:', error.message);
  process.exit(1);
}

console.log('\n--- Todos los módulos cargados exitosamente ---\n');

// ============================================
// CONFIGURACIÓN DE FFMPEG
// ============================================
console.log('--- Configurando FFmpeg ---');

const ffmpegPath = '/usr/bin/ffmpeg';
const ffprobePath = '/usr/bin/ffprobe';

console.log('Verificando existencia de FFmpeg...');
if (fs.existsSync(ffmpegPath)) {
  console.log('   ✓ FFmpeg encontrado en:', ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.error('   ✗ FFmpeg NO encontrado en:', ffmpegPath);
  console.log('   Buscando en PATH del sistema...');
}

if (fs.existsSync(ffprobePath)) {
  console.log('   ✓ FFprobe encontrado en:', ffprobePath);
  ffmpeg.setFfprobePath(ffprobePath);
} else {
  console.error('   ✗ FFprobe NO encontrado en:', ffprobePath);
}

// ============================================
// CONFIGURACIÓN DE EXPRESS
// ============================================
console.log('\n--- Configurando Express ---');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'default-key';

console.log('Puerto configurado:', PORT);
console.log('API Key configurada:', API_KEY ? 'Sí (oculta)' : 'No');

// Middlewares
console.log('Aplicando middlewares...');
app.use(cors());
console.log('   ✓ CORS aplicado');
app.use(express.json({ limit: '50mb' }));
console.log('   ✓ JSON parser aplicado (limit: 50mb)');

// ============================================
// MIDDLEWARE DE LOGGING DE REQUESTS
// ============================================
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('   Headers:', JSON.stringify(req.headers, null, 2).substring(0, 500));
  next();
});

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================
const authenticateRequest = (req, res, next) => {
  console.log('   Verificando autenticación...');
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('   ✗ Sin header de autorización');
    return res.status(401).json({ error: 'No autorizado - falta token' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== API_KEY) {
    console.log('   ✗ Token inválido');
    return res.status(401).json({ error: 'No autorizado - token inválido' });
  }
  
  console.log('   ✓ Autenticación exitosa');
  next();
};

// ============================================
// RUTAS
// ============================================
console.log('\n--- Configurando rutas ---');

// Health check (sin autenticación)
app.get('/health', (req, res) => {
  console.log('   Health check solicitado');
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node: process.version,
    ffmpeg: fs.existsSync(ffmpegPath) ? 'installed' : 'not found'
  };
  console.log('   Respondiendo:', JSON.stringify(healthInfo));
  res.json(healthInfo);
});
console.log('   ✓ GET /health configurado');

// Root
app.get('/', (req, res) => {
  console.log('   Root endpoint solicitado');
  res.json({ 
    service: 'Video Generator Service',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/health', '/generate-video']
  });
});
console.log('   ✓ GET / configurado');

// Generate video (con autenticación)
app.post('/generate-video', authenticateRequest, async (req, res) => {
  console.log('=== INICIANDO GENERACIÓN DE VIDEO ===');
  const startTime = Date.now();
  
  try {
    const { slideUrls, videoName, duration = 3 } = req.body;
    
    console.log('Parámetros recibidos:');
    console.log('   - slideUrls:', slideUrls);
    console.log('   - videoName:', videoName);
    console.log('   - duration:', duration);
    
    // Validaciones
    if (!slideUrls || !Array.isArray(slideUrls) || slideUrls.length === 0) {
      console.log('   ✗ Error: slideUrls inválido');
      return res.status(400).json({ error: 'slideUrls es requerido y debe ser un array' });
    }
    
    if (!videoName) {
      console.log('   ✗ Error: videoName requerido');
      return res.status(400).json({ error: 'videoName es requerido' });
    }
    
    // Crear directorio temporal
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-'));
    console.log('   Directorio temporal creado:', tempDir);
    
    // Descargar imágenes
    console.log('   Descargando imágenes...');
    const imagePaths = [];
    
    for (let i = 0; i < slideUrls.length; i++) {
      const url = slideUrls[i];
      console.log(`   Descargando imagen ${i + 1}/${slideUrls.length}: ${url.substring(0, 50)}...`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        const imagePath = path.join(tempDir, `slide_${i}.png`);
        fs.writeFileSync(imagePath, buffer);
        imagePaths.push(imagePath);
        console.log(`   ✓ Imagen ${i + 1} guardada: ${imagePath} (${buffer.length} bytes)`);
      } catch (downloadError) {
        console.error(`   ✗ Error descargando imagen ${i + 1}:`, downloadError.message);
        throw new Error(`Error descargando imagen ${i + 1}: ${downloadError.message}`);
      }
    }
    
    // Crear archivo de lista para FFmpeg
    const listPath = path.join(tempDir, 'list.txt');
    let listContent = '';
    for (const imgPath of imagePaths) {
      listContent += `file '${imgPath}'\n`;
      listContent += `duration ${duration}\n`;
    }
    listContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
    fs.writeFileSync(listPath, listContent);
    console.log('   Lista FFmpeg creada:', listPath);
    console.log('   Contenido:', listContent);
    
    // Generar video
    const outputPath = path.join(tempDir, `${videoName}.mp4`);
    console.log('   Generando video con FFmpeg...');
    console.log('   Output:', outputPath);
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-vsync', 'vfr',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('   FFmpeg comando:', cmd);
        })
        .on('progress', (progress) => {
          console.log('   Progreso:', progress.percent ? `${progress.percent.toFixed(1)}%` : 'procesando...');
        })
        .on('end', () => {
          console.log('   ✓ FFmpeg completado');
          resolve();
        })
        .on('error', (err) => {
          console.error('   ✗ FFmpeg error:', err.message);
          reject(err);
        })
        .run();
    });
    
    // Leer video generado
    console.log('   Leyendo video generado...');
    const videoBuffer = fs.readFileSync(outputPath);
    console.log('   Video size:', videoBuffer.length, 'bytes');
    
    // Limpiar archivos temporales
    console.log('   Limpiando archivos temporales...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('   ✓ Limpieza completada');
    
    const totalTime = Date.now() - startTime;
    console.log(`=== VIDEO GENERADO EXITOSAMENTE (${totalTime}ms) ===`);
    
    // Responder con el video en base64
    res.json({
      success: true,
      videoBase64: videoBuffer.toString('base64'),
      fileName: `${videoName}.mp4`,
      size: videoBuffer.length,
      processingTime: totalTime
    });
    
  } catch (error) {
    console.error('=== ERROR GENERANDO VIDEO ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error generando video',
      details: error.message 
    });
  }
});
console.log('   ✓ POST /generate-video configurado');

// 404 handler
app.use((req, res) => {
  console.log('   ✗ Ruta no encontrada:', req.method, req.url);
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('=== ERROR GLOBAL EN EXPRESS ===');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
console.log('\n--- Iniciando servidor ---');
console.log('Intentando escuchar en puerto', PORT, 'en 0.0.0.0...');

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log('=== SERVIDOR INICIADO EXITOSAMENTE ===');
  console.log('==============================================');
  console.log('Puerto:', PORT);
  console.log('Host: 0.0.0.0');
  console.log('Timestamp:', new Date().toISOString());
  console.log('PID:', process.pid);
  console.log('Endpoints disponibles:');
  console.log('   - GET  /');
  console.log('   - GET  /health');
  console.log('   - POST /generate-video');
  console.log('==============================================');
});

server.on('error', (error) => {
  console.error('=== ERROR AL INICIAR SERVIDOR ===');
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error('El puerto', PORT, 'ya está en uso');
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n=== SIGTERM recibido, cerrando servidor... ===');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n=== SIGINT recibido, cerrando servidor... ===');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

console.log('\n--- Script index.js ejecutado completamente ---');
console.log('Esperando que el servidor inicie...\n');

const { createClient } = require('@supabase/supabase-js');

app.post('/generate-video', async (req, res) => {
  const { slideUrls, videoName, businessId, duration = 3, supabaseUrl, supabaseServiceKey } = req.body;
  
  console.log('Received video generation request:', { slideUrls, videoName, businessId, duration });
  
  if (!slideUrls || slideUrls.length !== 2) {
    return res.status(400).json({ success: false, error: 'Se requieren exactamente 2 slides' });
  }

  const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Download slides
    console.log('Downloading slides...');
    const imagePaths = [];
    for (let i = 0; i < slideUrls.length; i++) {
      const response = await fetch(slideUrls[i]);
      const buffer = Buffer.from(await response.arrayBuffer());
      const imagePath = path.join(tempDir, `slide_${i}.png`);
      fs.writeFileSync(imagePath, buffer);
      imagePaths.push(imagePath);
    }
    
    // Create concat list for FFmpeg
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    let concatContent = '';
    for (const imagePath of imagePaths) {
      concatContent += `file '${imagePath}'\n`;
      concatContent += `duration ${duration}\n`;
    }
    concatContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
    fs.writeFileSync(concatListPath, concatContent);
    
    // Generate video with FFmpeg
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log('Running FFmpeg...');
    
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-vsync', 'vfr',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        outputPath
      ]);
      
      ffmpeg.stderr.on('data', data => console.log('FFmpeg:', data.toString()));
      ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
    });
    
    console.log('Video generated, uploading to Supabase...');
    
    // Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const videoBuffer = fs.readFileSync(outputPath);
    const videoFileName = `${businessId}/${Date.now()}_${videoName}.mp4`;
    
    const { error: uploadError } = await supabase.storage
      .from('generated-videos')
      .upload(videoFileName, videoBuffer, { contentType: 'video/mp4' });
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage.from('generated-videos').getPublicUrl(videoFileName);
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('Video uploaded successfully:', urlData.publicUrl);
    res.json({ success: true, videoUrl: urlData.publicUrl });
    
  } catch (error) {
    console.error('Error:', error);
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(500).json({ success: false, error: error.message });
  }
});
