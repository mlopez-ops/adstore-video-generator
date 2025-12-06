// ============================================
// VIDEO GENERATOR SERVICE - RAILWAY
// ============================================
console.log('==============================================');
console.log('=== SERVIDOR VIDEO GENERATOR INICIANDO ===');
console.log('==============================================');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);

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
});

// ============================================
// CARGA DE MÓDULOS
// ============================================
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

console.log('✓ Todos los módulos cargados');

// ============================================
// CONFIGURACIÓN DE EXPRESS
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'default-key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logging de requests
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================
const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('✗ Sin header de autorización');
    return res.status(401).json({ error: 'No autorizado - falta token' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== API_KEY) {
    console.log('✗ Token inválido');
    return res.status(401).json({ error: 'No autorizado - token inválido' });
  }
  
  console.log('✓ Autenticación exitosa');
  next();
};

// ============================================
// RUTAS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    service: 'Video Generator Service',
    version: '2.0.0',
    status: 'running'
  });
});

// Generate video
app.post('/generate-video', authenticateRequest, async (req, res) => {
  console.log('=== INICIANDO GENERACIÓN DE VIDEO ===');
  const startTime = Date.now();
  
  const { 
    slideUrls, 
    videoName, 
    businessId, 
    duration = 4, 
    logoUrl,
    supabaseUrl, 
    supabaseServiceKey 
  } = req.body;
  
  console.log('Parámetros recibidos:', { 
    slideUrls, 
    videoName, 
    businessId, 
    duration, 
    logoUrl: logoUrl ? 'presente' : 'no presente' 
  });
  
  // Validaciones
  if (!slideUrls || !Array.isArray(slideUrls) || slideUrls.length !== 2) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requieren exactamente 2 slides' 
    });
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan credenciales de Supabase' 
    });
  }

  const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Directorio temporal:', tempDir);
    
    // Descargar slides
    console.log('Descargando slides...');
    const imagePaths = [];
    for (let i = 0; i < slideUrls.length; i++) {
      const response = await fetch(slideUrls[i]);
      if (!response.ok) {
        throw new Error(`Error descargando slide ${i + 1}: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const imagePath = path.join(tempDir, `slide_${i}.png`);
      fs.writeFileSync(imagePath, buffer);
      imagePaths.push(imagePath);
      console.log(`✓ Slide ${i + 1} descargado (${buffer.length} bytes)`);
    }
    
    // Descargar logo si existe
    let logoPath = null;
    if (logoUrl) {
      console.log('Descargando logo...');
      try {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
          logoPath = path.join(tempDir, 'logo.png');
          fs.writeFileSync(logoPath, logoBuffer);
          console.log(`✓ Logo descargado (${logoBuffer.length} bytes)`);
        }
      } catch (logoError) {
        console.log('⚠ No se pudo descargar el logo:', logoError.message);
      }
    }
    
    // Generar video con FFmpeg
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log('Ejecutando FFmpeg...');
    
    // Calcular duración de transición
    const transitionDuration = 0.5;
    const totalDuration = (duration * 2) - transitionDuration;
    
    // Construir argumentos de FFmpeg
    let ffmpegArgs = [
      '-y',
      '-loop', '1', '-t', String(duration), '-i', imagePaths[0],
      '-loop', '1', '-t', String(duration), '-i', imagePaths[1]
    ];
    
    // Agregar logo si existe
    if (logoPath) {
      ffmpegArgs.push('-i', logoPath);
    }
    
    // Construir filter_complex
    let filterComplex;
    if (logoPath) {
      // Con logo y transición crossfade
      filterComplex = [
        // Escalar slides a 1920x1080
        '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v0]',
        '[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v1]',
        // Escalar logo (120px de ancho)
        '[2:v]scale=120:-1[logo]',
        // Aplicar crossfade entre slides
        `[v0][v1]xfade=transition=fade:duration=${transitionDuration}:offset=${duration - transitionDuration}[xfaded]`,
        // Overlay del logo en esquina inferior derecha
        '[xfaded][logo]overlay=W-w-30:H-h-30[outv]'
      ].join(';');
    } else {
      // Solo transición crossfade, sin logo
      filterComplex = [
        '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v0]',
        '[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v1]',
        `[v0][v1]xfade=transition=fade:duration=${transitionDuration}:offset=${duration - transitionDuration}[outv]`
      ].join(';');
    }
    
    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-movflags', '+faststart',
      '-t', String(totalDuration),
      outputPath
    );
    
    console.log('FFmpeg args:', ffmpegArgs.join(' '));
    
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log progress
        const timeMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
          console.log('FFmpeg progress:', timeMatch[1]);
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✓ FFmpeg completado exitosamente');
          resolve();
        } else {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
      
      // Timeout de 60 segundos
      setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error('FFmpeg timeout after 60 seconds'));
      }, 60000);
    });
    
    // Verificar que el video se generó
    if (!fs.existsSync(outputPath)) {
      throw new Error('El archivo de video no fue creado');
    }
    
    const videoStats = fs.statSync(outputPath);
    console.log(`Video generado: ${videoStats.size} bytes`);
    
    // Subir a Supabase Storage
    console.log('Subiendo a Supabase Storage...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const videoBuffer = fs.readFileSync(outputPath);
    const videoFileName = `${businessId}/${Date.now()}_${videoName}.mp4`;
    
    const { error: uploadError } = await supabase.storage
      .from('generated-videos')
      .upload(videoFileName, videoBuffer, { 
        contentType: 'video/mp4',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Error subiendo video: ${uploadError.message}`);
    }
    
    const { data: urlData } = supabase.storage
      .from('generated-videos')
      .getPublicUrl(videoFileName);
    
    // Limpiar archivos temporales
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✓ Archivos temporales eliminados');
    
    const totalTime = Date.now() - startTime;
    console.log(`=== VIDEO GENERADO EXITOSAMENTE (${totalTime}ms) ===`);
    console.log('URL:', urlData.publicUrl);
    
    res.json({ 
      success: true, 
      videoUrl: urlData.publicUrl,
      processingTime: totalTime
    });
    
  } catch (error) {
    console.error('=== ERROR GENERANDO VIDEO ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    // Limpiar archivos temporales en caso de error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error limpiando:', cleanupError.message);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log(`=== SERVIDOR INICIADO EN PUERTO ${PORT} ===`);
  console.log('==============================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => process.exit(0));
});
