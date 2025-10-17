// api/index.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Konfigurasi penyimpanan di memory (karena Vercel tidak punya persistent storage)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size (Vercel limit)
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// "Database" in-memory (akan reset setiap cold start)
let fileDatabase = new Map();

// Helper function untuk generate URL
function generateFileUrl(req, filename) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}/api/file/${filename}`;
}

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = crypto.randomBytes(16).toString('hex');
    const fileInfo = {
      id: fileId,
      originalName: req.file.originalname,
      filename: fileId,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date(),
      buffer: req.file.buffer,
      url: generateFileUrl(req, fileId)
    };

    fileDatabase.set(fileId, fileInfo);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: fileInfo
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Endpoint untuk mendapatkan file
app.get('/api/file/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = fileDatabase.get(fileId);

    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', fileInfo.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.originalName}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 jam
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send file buffer
    res.send(fileInfo.buffer);
  } catch (error) {
    res.status(500).json({ error: 'File retrieval failed', details: error.message });
  }
});

// Endpoint untuk mendapatkan info file
app.get('/api/info/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = fileDatabase.get(fileId);

    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Return file info without buffer
    const { buffer, ...fileInfoWithoutBuffer } = fileInfo;
    res.json({
      success: true,
      data: fileInfoWithoutBuffer
    });
  } catch (error) {
    res.status(500).json({ error: 'Info retrieval failed', details: error.message });
  }
});

// Endpoint untuk list semua file
app.get('/api/files', (req, res) => {
  try {
    const files = Array.from(fileDatabase.values()).map(file => {
      const { buffer, ...fileWithoutBuffer } = file;
      return fileWithoutBuffer;
    });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get file list', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    filesCount: fileDatabase.size,
    environment: process.env.NODE_ENV
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'CDN Backend API is running!',
    endpoints: {
      upload: 'POST /api/upload',
      getFile: 'GET /api/file/:id',
      fileInfo: 'GET /api/info/:id',
      listFiles: 'GET /api/files',
      health: 'GET /api/health'
    }
  });
});

// Export untuk Vercel
module.exports = app;
