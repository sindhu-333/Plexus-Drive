const multer = require('multer');

const storage = multer.memoryStorage(); // store in memory first

const upload = multer({ 
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
    fieldSize: 1024 * 1024 * 1024, // 1GB field size limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types including video and audio
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 
      'image/svg+xml', 'image/webp', 'image/tiff', 'image/ico',
      // Documents
      'application/pdf', 'application/msword', 'text/plain', 'text/rtf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
      // Videos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 
      'video/webm', 'video/mkv', 'video/3gp', 'video/m4v', 'video/quicktime',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 
      'audio/wma', 'audio/m4a', 'audio/opus', 'audio/mpeg',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/x-tar', 'application/gzip', 'application/x-bzip2',
      // Others
      'application/rtf', 'text/csv', 'application/json', 'text/xml'
    ];
    
    // Accept the file if it's in allowed types or if no specific restriction is needed
    cb(null, true); // Accept all files for now, you can add restrictions later if needed
  }
});

module.exports = upload;
