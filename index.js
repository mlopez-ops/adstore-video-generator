const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const API_KEY = process.env.API_KEY || 'development-key';
const PORT = process.env.PORT || 3000;

// Middleware de autenticación
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint principal para generar video
app.post('/generate-video', authenticate, async (req, res) => {
  const { slides, duration = 4, width = 1080, height = 1920 } = req.body;
  
  if (!slides || !Array.isArray(slides) || slides.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 slides' });
  }

  const tempDir = path.join('/tmp', `video-${Date.now()}`);
  const outputPath = path.join(tempDir, 'output.mp4');
  
  try {
    await mkdir(tempDir, { recursive: true });
    
    // Descargar imágenes
    const imagePaths = [];
    for (let i = 0; i < slides.length; i++) {
      const response = await axios.get(slides[i], { responseType: 'arraybuffer' });
      const imagePath = path.join(tempDir, `slide-${i}.png`);
      await writeFile(imagePath, response.data);
      imagePaths.push(imagePath);
    }

    // Crear archivo de concat para FFmpeg
    const concatFilePath = path.join(tempDir, 'concat.txt');
    const concatContent = imagePaths.map(p => `file '${p}'\nduration ${duration}`).join('\n');
    await writeFile(concatFilePath, concatContent + `\nfile '${imagePaths[imagePaths.length - 1]}'`);

    // Generar video
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          `-vf`, `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Leer el video generado y convertir a base64
    const videoBuffer = fs.readFileSync(outputPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Limpiar archivos temporales
    for (const imagePath of imagePaths) {
      await unlink(imagePath).catch(() => {});
    }
    await unlink(concatFilePath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    fs.rmdirSync(tempDir, { recursive: true });

    res.json({ 
      success: true,
      video: videoBase64,
      mimeType: 'video/mp4'
    });

  } catch (error) {
    console.error('Error generando video:', error);
    // Limpiar en caso de error
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(500).json({ error: 'Error generando video', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video generator service running on port ${PORT}`);
});
