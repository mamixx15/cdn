// api/index.js
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const app = express();

// Middleware yang lebih aman untuk Vercel
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Enable CORS untuk Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Storage di memory untuk Vercel
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
    files: 5 // max 5 files sekaligus
  }
});

// In-memory storage (sementara)
const fileDatabase = new Map();

// Helper function untuk Vercel
function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${host}`;
}

// Health check pertama
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    platform: 'Vercel',
    memory: process.memoryUsage()
  });
});

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'CDN Backend API is running on Vercel!',
    endpoints: {
      upload: 'POST /api/upload',
      getFile: 'GET /api/file/:id',
      fileInfo: 'GET /api/info/:id',
      listFiles: 'GET /api/files',
      health: 'GET /api/health'
    },
    limits: {
      maxFileSize: '20MB',
      maxFiles: '5 per request'
    }
  });
});

// Upload endpoint dengan error handling yang lebih baik
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    // Validasi request
    if (!req.file) {
      return res.status(400).json({ 
        error: 'NO_FILE',
        message: 'Tidak ada file yang diupload' 
      });
    }

    // Validasi file size
    if (req.file.size > 20 * 1024 * 1024) {
      return res.status(400).json({
        error: 'FILE_TOO_LARGE',
        message: 'File terlalu besar. Maksimal 20MB'
      });
    }

    const fileId = crypto.randomBytes(16).toString('hex');
    const baseUrl = getBaseUrl(req);
    
    const fileInfo = {
      id: fileId,
      originalName: req.file.originalname || 'unknown',
      filename: fileId,
      mimetype: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      buffer: req.file.buffer,
      url: `${baseUrl}/api/file/${fileId}`
    };

    // Simpan ke memory
    fileDatabase.set(fileId, fileInfo);

    console.log(`File uploaded: ${fileInfo.originalName} (${fileInfo.size} bytes)`);

    res.json({
      success: true,
      message: 'File berhasil diupload',
      data: {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        url: fileInfo.url,
        uploadDate: fileInfo.uploadDate
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: 'Upload gagal',
      details: error.message
    });
  }
});

// Get file endpoint
app.get('/api/file/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = fileDatabase.get(fileId);

    if (!fileInfo) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File tidak ditemukan'
      });
    }

    // Set headers yang aman
    res.setHeader('Content-Type', fileInfo.mimetype);
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.originalName}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');

    // Send file buffer
    res.send(fileInfo.buffer);

  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({
      error: 'RETRIEVAL_FAILED',
      message: 'Gagal mengambil file'
    });
  }
});

// File info endpoint
app.get('/api/info/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = fileDatabase.get(fileId);

    if (!fileInfo) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File tidak ditemukan'
      });
    }

    // Return tanpa buffer
    const { buffer, ...fileInfoWithoutBuffer } = fileInfo;
    res.json({
      success: true,
      data: fileInfoWithoutBuffer
    });

  } catch (error) {
    res.status(500).json({
      error: 'INFO_RETRIEVAL_FAILED',
      message: 'Gagal mengambil info file'
    });
  }
});

// List files endpoint
app.get('/api/files', (req, res) => {
  try {
    const files = Array.from(fileDatabase.values()).map(file => {
      const { buffer, ...fileWithoutBuffer } = file;
      return fileWithoutBuffer;
    });
    
    res.json({
      success: true,
      count: files.length,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      error: 'LIST_RETRIEVAL_FAILED',
      message: 'Gagal mengambil daftar file'
    });
  }
});

// Cleanup endpoint (opsional)
app.delete('/api/file/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const deleted = fileDatabase.delete(fileId);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'File berhasil dihapus'
      });
    } else {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File tidak ditemukan'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Gagal menghapus file'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'FILE_TOO_LARGE',
        message: 'File terlalu besar'
      });
    }
  }
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Terjadi kesalahan internal'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'ENDPOINT_NOT_FOUND',
    message: 'Endpoint tidak ditemukan'
  });
});

// Export untuk Vercel
module.exports = app;
