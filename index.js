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

let express, cors, fetch, fs, path, os;
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Express
console.log('1. Cargando express...');
try {
  express = require('express');
  console.log('   ✓ Express cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando express:', error.message);
  process.exit(1);
}

// CORS
console.log('2. Cargando cors...');
try {
  cors = require('cors');
  console.log('   ✓ CORS cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando cors:', error.message);
  process.exit(1);
}

// Node-fetch
console.log('3. Cargando node-fetch...');
try {
  fetch = require('node-fetch');
  console.log('   ✓ Node-fetch cargado correctamente');
} catch (error) {
  console.error('   ✗ ERROR cargando node-fetch:', error.message);
  process.exit(1);
}

// FS y Path (built-in)
console.log('4. Cargando fs, path, os...');
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
// CONFIGURACIÓN DE EXPRESS
// ============================================
console.log('\n--- Configurando Express ---');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'default-key';

console.log('Puerto configurado:', PORT);
console.log('API Key configurada:', API_KEY ? 'Sí (oculta)' : 'No');

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// MIDDLEWARE DE LOGGING DE REQUESTS
// ============================================
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
    return res.status(401).json({ error: 'No autorizado - falta token' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== API_KEY) {
    return res.status(401).json({ error: 'No autorizado - token inválido' });
  }
  
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
    uptime: process.uptime(),
    node: process.version
  });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    service: 'Video Generator Service',
    version: '2.0.0',
    status: 'running',
    endpoints: ['/health', '/generate-video']
  });
});

// Generate video
app.post('/generate-video', authenticateRequest, async (req, res) => {
  console.log('=== INICIANDO GENERACIÓN DE VIDEO ===');
  const startTime = Date.now();
  
  const { slideUrls, videoName, businessId, duration = 3, logoUrl, supabaseUrl, supabaseServiceKey } = req.body;
  
  console.log('Parámetros recibidos:', { 
    slideUrls: slideUrls?.length + ' slides', 
    videoName, 
    businessId, 
    duration,
    logoUrl: logoUrl ? 'provided' : 'none'
  });
  
  if (!slideUrls || slideUrls.length !== 2) {
    return res.status(400).json({ success: false, error: 'Se requieren exactamente 2 slides' });
  }

  const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Directorio temporal:', tempDir);
    
    // Download slides
    console.log('Descargando slides...');
    const imagePaths = [];
    for (let i = 0; i < slideUrls.length; i++) {
      const response = await fetch(slideUrls[i]);
      const buffer = Buffer.from(await response.arrayBuffer());
      const imagePath = path.join(tempDir, `slide_${i}.png`);
      fs.writeFileSync(imagePath, buffer);
      imagePaths.push(imagePath);
      console.log(`   Slide ${i + 1} descargado: ${buffer.length} bytes`);
    }
    
    // Download logo if provided
    let logoPath = null;
    if (logoUrl) {
      console.log('Descargando logo...');
      try {
        const logoResponse = await fetch(logoUrl);
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        logoPath = path.join(tempDir, 'logo.png');
        fs.writeFileSync(logoPath, logoBuffer);
        console.log(`   Logo descargado: ${logoBuffer.length} bytes`);
      } catch (logoError) {
        console.log('   Error descargando logo, continuando sin él:', logoError.message);
      }
    }
    
    // Generate video with FFmpeg using complex filter for crossfade and logo
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log('Ejecutando FFmpeg con transición crossfade...');
    
    // Build FFmpeg command with crossfade transition
    const crossfadeDuration = 0.5;
    const slideDuration = duration;
    
    // Complex filter for crossfade between 2 images + optional logo overlay
    // Output: 1920x1080 (landscape HD)
    let filterComplex = `[0:v]loop=loop=${Math.floor((slideDuration + crossfadeDuration) * 25)}:size=1:start=0,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];` +
      `[1:v]loop=loop=${Math.floor((slideDuration + crossfadeDuration) * 25)}:size=1:start=0,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];` +
      `[v0][v1]xfade=transition=fade:duration=${crossfadeDuration}:offset=${slideDuration}[video]`;
    
    let ffmpegArgs = [
      '-i', imagePaths[0],
      '-i', imagePaths[1]
    ];
    
    // Add logo if available
    if (logoPath) {
      ffmpegArgs.push('-i', logoPath);
      // Logo overlay: scale to 120px wide, position bottom-right with 30px margin
      filterComplex += `;[2:v]scale=120:-1[logo];[video][logo]overlay=W-w-30:H-h-30[final]`;
      filterComplex = filterComplex.replace('[final]', '[final]');
    } else {
      filterComplex = filterComplex.replace('[video]', '[final]');
    }
    
    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', '[final]',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'medium',
      '-crf', '23',
      '-movflags', '+faststart',
      '-t', String((slideDuration * 2) + crossfadeDuration),
      '-y',
      outputPath
    );
    
    console.log('FFmpeg args:', ffmpegArgs.join(' '));
    
    await new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      let stderrOutput = '';
      ffmpegProcess.stderr.on('data', data => {
        stderrOutput += data.toString();
      });
      
      ffmpegProcess.on('close', code => {
        if (code === 0) {
          console.log('   ✓ FFmpeg completado exitosamente');
          resolve();
        } else {
          console.error('   ✗ FFmpeg error, código:', code);
          console.error('   Stderr:', stderrOutput.slice(-1000));
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpegProcess.on('error', err => {
        console.error('   ✗ Error spawning FFmpeg:', err.message);
        reject(err);
      });
    });
    
    console.log('Video generado, subiendo a Supabase...');
    
    // Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const videoBuffer = fs.readFileSync(outputPath);
    const videoFileName = `${businessId}/${Date.now()}_${videoName}.mp4`;
    
    console.log(`   Tamaño del video: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    const { error: uploadError } = await supabase.storage
      .from('generated-videos')
      .upload(videoFileName, videoBuffer, { contentType: 'video/mp4' });
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage.from('generated-videos').getPublicUrl(videoFileName);
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    const totalTime = Date.now() - startTime;
    console.log(`=== VIDEO GENERADO Y SUBIDO (${totalTime}ms) ===`);
    console.log('URL:', urlData.publicUrl);
    
    res.json({ success: true, videoUrl: urlData.publicUrl });
    
  } catch (error) {
    console.error('=== ERROR GENERANDO VIDEO ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
    
    res.status(500).json({ success: false, error: error.message });
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
  console.log('=== SERVIDOR INICIADO ===');
  console.log('Puerto:', PORT);
  console.log('==============================================');
});

server.on('error', (error) => {
  console.error('Error al iniciar servidor:', error.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
