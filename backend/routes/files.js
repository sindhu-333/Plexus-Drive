const express = require("express");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const crypto = require("crypto");

const { pool } = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");
const { Dropbox } = require("dropbox");
const fetch = require("node-fetch");
const JSZip = require("jszip");
const { spawn } = require('child_process');
const NotificationService = require('../services/notificationService');


// Common LibreOffice paths
const possiblePaths = [
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
];

// Try to find soffice.exe
function getSofficePath() {
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  if (process.env.LIBREOFFICE_PATH && fs.existsSync(process.env.LIBREOFFICE_PATH)) {
    return process.env.LIBREOFFICE_PATH;
  }
  throw new Error("LibreOffice executable not found. Please install LibreOffice or set LIBREOFFICE_PATH environment variable.");
}

// Convert Office file buffer to PDF
async function convertToPdf(fileBuffer, mimetype) {
  const sofficePath = getSofficePath(); // auto-detect
  const extMap = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/msword': '.doc',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.ms-powerpoint': '.ppt',
  };
  const ext = extMap[mimetype] || '.docx';

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const inputFile = path.join(tempDir, `input_${timestamp}${ext}`);
  const outputFile = path.join(tempDir, `input_${timestamp}.pdf`);

  fs.writeFileSync(inputFile, fileBuffer);
  console.log("Input file:", inputFile);
  console.log("Expecting PDF at:", outputFile);

  return new Promise((resolve, reject) => {
    const child = spawn(sofficePath, ['--headless', '--convert-to', 'pdf', inputFile], { cwd: tempDir });

    child.stdout.on('data', data => console.log("soffice stdout:", data.toString()));
    child.stderr.on('data', data => console.error("soffice stderr:", data.toString()));

    child.on('close', code => {
      console.log("soffice exit code:", code);

      try {
        if (code === 0 && fs.existsSync(outputFile)) {
          const pdfBuffer = fs.readFileSync(outputFile);
          resolve(pdfBuffer);
        } else if (code === 0) {
          reject(new Error("Conversion succeeded but PDF not found."));
        } else {
          reject(new Error(`LibreOffice conversion failed with exit code ${code}`));
        }
      } finally {
        // Cleanup temp files
        try { fs.unlinkSync(inputFile); } catch {}
        try { fs.unlinkSync(outputFile); } catch {}
      }
    });

    child.on('error', err => {
      console.error("soffice spawn error:", err);
      try { fs.unlinkSync(inputFile); } catch {}
      try { fs.unlinkSync(outputFile); } catch {}
      reject(err);
    });
  });
}


module.exports = convertToPdf;

global.fetch = fetch;
const router = express.Router();

// Helper: get Dropbox client
function getDropboxClient() {
  if (!process.env.DROPBOX_REFRESH_TOKEN) {
    throw new Error("DROPBOX_REFRESH_TOKEN not set in .env");
  }
  return new Dropbox({
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    fetch: global.fetch,
  });
}

// Helper: coerce various possible fileBinary forms into a Buffer
function toBuffer(fileBinary) {
  if (!fileBinary) return null;
  if (Buffer.isBuffer(fileBinary)) return fileBinary;
  // ArrayBuffer
  if (fileBinary instanceof ArrayBuffer) return Buffer.from(new Uint8Array(fileBinary));
  // TypedArray / Uint8Array
  if (ArrayBuffer.isView(fileBinary)) return Buffer.from(fileBinary.buffer, fileBinary.byteOffset, fileBinary.byteLength);
  // If it's a string (binary string)
  if (typeof fileBinary === "string") return Buffer.from(fileBinary, "binary");
  // If an object with 'data' array
  if (fileBinary && Array.isArray(fileBinary.data)) return Buffer.from(fileBinary.data);
  // Otherwise try Buffer.from
  try {
    return Buffer.from(fileBinary);
  } catch (e) {
    return null;
  }
}

/* -----------------------
   ROUTES
   ----------------------- */

// Upload file
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { folder_id } = req.body;
    
    // If folder_id is provided, verify it exists and belongs to user
    if (folder_id) {
      const folderCheck = await pool.query(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
        [folder_id, req.user.id]
      );
      
      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ message: "Folder not found" });
      }
    }

    const dbx = getDropboxClient();
    const dropboxPath = "/" + req.file.originalname;

    const uploadRes = await dbx.filesUpload({
      path: dropboxPath,
      contents: req.file.buffer,
      mode: { ".tag": "add" },
      autorename: true,
    });

    const result = await pool.query(
      `INSERT INTO files
        (user_id, filename, dropbox_path, filepath, filesize, mimetype, analysis_status, folder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.user.id, req.file.originalname, uploadRes.result.path_display, uploadRes.result.path_display, req.file.size, req.file.mimetype, "pending", folder_id || null]
    );

    // Check storage quota and send notification if approaching limit
    try {
      const storageResult = await pool.query(
        'SELECT SUM(filesize) as total_used FROM files WHERE user_id = $1',
        [req.user.id]
      );
      
      const totalUsed = parseInt(storageResult.rows[0].total_used) || 0;
      const maxStorage = 2 * 1024 * 1024 * 1024; // 2GB default limit
      const usedPercentage = Math.round((totalUsed / maxStorage) * 100);
      
      // Send warning at 80% and 95%
      if (usedPercentage >= 80) {
        await NotificationService.notifyStorageWarning(req.user.id, usedPercentage);
      }
    } catch (storageError) {
      console.error('Storage check error:', storageError);
    }

    res.json({ message: "File uploaded successfully", file: result.rows[0] });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// Get recent files
router.get("/recent", authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const query = `
      SELECT f.id, f.user_id, f.filename, f.dropbox_path, f.filesize, f.mimetype,
             f.analysis_status, f.created_at, f.updated_at, f.last_accessed_at, f.folder_id,
             CASE WHEN ff.id IS NOT NULL THEN true ELSE false END as is_favorite,
             folders.name as folder_name
      FROM files f
      LEFT JOIN file_favorites ff ON f.id = ff.file_id AND ff.user_id = $1
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = $1 
        AND f.last_accessed_at IS NOT NULL
        AND f.last_accessed_at >= NOW() - INTERVAL '15 days'
      ORDER BY f.last_accessed_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [req.user.id, parseInt(limit), parseInt(offset)]);
    
    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM files 
       WHERE user_id = $1 
         AND last_accessed_at IS NOT NULL 
         AND last_accessed_at >= NOW() - INTERVAL '15 days'`,
      [req.user.id]
    );
    
    res.json({
      files: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error("Recent files error:", error);
    res.status(500).json({ message: "Failed to get recent files" });
  }
});

// Get files by category (Quick Access)
router.get("/category/:category", authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Define MIME type patterns for each category
    const categoryMimes = {
      images: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 
        'image/svg+xml', 'image/webp', 'image/tiff', 'image/ico'
      ],
      documents: [
        'application/pdf', // PDF files
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
      ],
      videos: [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 
        'video/webm', 'video/mkv', 'video/3gp', 'video/m4v'
      ],
      audio: [
        'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 
        'audio/wma', 'audio/m4a', 'audio/opus', 'audio/mpeg'
      ],
      others: [
        'application/msword', 'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/rtf', 'application/rtf', 'application/zip', 
        'application/x-rar-compressed', 'application/x-7z-compressed',
        'application/x-tar', 'application/gzip', 'application/x-bzip2'
      ]
    };
    
    if (!categoryMimes[category]) {
      return res.status(400).json({ message: "Invalid category" });
    }
    
    const mimeTypes = categoryMimes[category];
    const placeholders = mimeTypes.map((_, index) => `$${index + 2}`).join(', ');
    
    const query = `
      SELECT f.id, f.user_id, f.filename, f.dropbox_path, f.filesize, f.mimetype,
             f.analysis_status, f.created_at, f.updated_at, f.folder_id,
             CASE WHEN ff.id IS NOT NULL THEN true ELSE false END as is_favorite,
             folders.name as folder_name
      FROM files f
      LEFT JOIN file_favorites ff ON f.id = ff.file_id AND ff.user_id = $1
      LEFT JOIN folders ON f.folder_id = folders.id
      WHERE f.user_id = $1 
        AND f.mimetype IN (${placeholders})
      ORDER BY f.created_at DESC 
      LIMIT $${mimeTypes.length + 2} OFFSET $${mimeTypes.length + 3}
    `;
    
    const params = [req.user.id, ...mimeTypes, parseInt(limit), parseInt(offset)];
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM files 
      WHERE user_id = $1 AND mimetype IN (${placeholders})
    `;
    const countParams = [req.user.id, ...mimeTypes];
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      files: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      category: category
    });
    
  } catch (error) {
    console.error("Category files error:", error);
    res.status(500).json({ message: "Failed to get category files" });
  }
});

// Get category counts for sidebar
router.get("/category-counts", authMiddleware, async (req, res) => {
  try {
    // Define MIME type patterns for each category (same as above)
    const categoryMimes = {
      images: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 
        'image/svg+xml', 'image/webp', 'image/tiff', 'image/ico'
      ],
      documents: [
        'application/pdf', // PDF files
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
      ],
      videos: [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 
        'video/webm', 'video/mkv', 'video/3gp', 'video/m4v'
      ],
      audio: [
        'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 
        'audio/wma', 'audio/m4a', 'audio/opus', 'audio/mpeg'
      ],
      others: [
        'application/msword', 'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/rtf', 'application/rtf', 'application/zip', 
        'application/x-rar-compressed', 'application/x-7z-compressed',
        'application/x-tar', 'application/gzip', 'application/x-bzip2'
      ]
    };

    const counts = {};
    
    // Get count for each category
    for (const [category, mimeTypes] of Object.entries(categoryMimes)) {
      const placeholders = mimeTypes.map((_, index) => `$${index + 2}`).join(', ');
      
      const countQuery = `
        SELECT COUNT(*) FROM files 
        WHERE user_id = $1 AND mimetype IN (${placeholders})
      `;
      const countParams = [req.user.id, ...mimeTypes];
      const countResult = await pool.query(countQuery, countParams);
      
      counts[category] = parseInt(countResult.rows[0].count);
    }

    res.json(counts);
    
  } catch (error) {
    console.error("Category counts error:", error);
    res.status(500).json({ message: "Failed to get category counts" });
  }
});

// List files
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const { folder_id } = req.query;
    
    let query = `SELECT f.id, f.user_id, f.filename, f.dropbox_path, f.filesize, f.mimetype,
              f.analysis_status, f.created_at, f.updated_at, f.folder_id,
              CASE WHEN ff.id IS NOT NULL THEN true ELSE false END as is_favorite
       FROM files f
       LEFT JOIN file_favorites ff ON f.id = ff.file_id AND ff.user_id = f.user_id
       WHERE f.user_id = $1`;
    
    const params = [req.user.id];
    
    if (folder_id !== undefined) {
      if (folder_id === 'root' || folder_id === '' || folder_id === null) {
        query += ' AND f.folder_id IS NULL';
      } else {
        query += ' AND f.folder_id = $2';
        params.push(folder_id);
      }
    }
    
    query += ' ORDER BY f.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ message: "Failed to fetch files", error: err.message });
  }
});

// Delete single file
router.delete("/:id", authMiddleware, async (req, res) => {
  const fileId = req.params.id;
  try {
    const result = await pool.query("SELECT * FROM files WHERE id=$1 AND user_id=$2", [fileId, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: "File not found" });

    const file = result.rows[0];
    const dbx = getDropboxClient();

    try {
      if (file.dropbox_path) await dbx.filesDeleteV2({ path: file.dropbox_path });
    } catch (dropboxErr) {
      console.warn(`Failed to delete ${file.filename} from Dropbox:`, dropboxErr.error_summary || dropboxErr.message);
    }

    await pool.query("DELETE FROM files WHERE id=$1", [fileId]);
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Failed to delete file", error: err.message });
  }
});

// Download single file
router.get("/download/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    const result = await pool.query("SELECT * FROM files WHERE id=$1 AND user_id=$2", [fileId, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: "File not found" });

    const file = result.rows[0];
    const dbx = getDropboxClient();
    
    let downloadRes;
    try {
      downloadRes = await dbx.filesDownload({ path: file.dropbox_path });
    } catch (dropboxError) {
      console.error('Dropbox download error:', dropboxError);
      
      if (dropboxError.status === 409 && dropboxError.error?.error_summary?.includes('path/not_found')) {
        await pool.query("UPDATE files SET status = 'missing' WHERE id = $1", [fileId]);
        return res.status(404).json({ 
          message: "File not found in cloud storage", 
          error: "DROPBOX_FILE_MISSING" 
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to download file from cloud storage",
        error: "DROPBOX_DOWNLOAD_ERROR"
      });
    }

    const raw = downloadRes.result && downloadRes.result.fileBinary;
    const fileBuffer = toBuffer(raw);
    if (!fileBuffer) return res.status(500).json({ message: "Failed to parse file from Dropbox" });

    // Update last accessed time for recent files tracking
    try {
      await pool.query("UPDATE files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1", [fileId]);
    } catch (updateError) {
      console.error("Failed to update access time:", updateError);
      // Don't fail the download if access tracking fails
    }

    res.set({
      "Content-Type": downloadRes.result.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": fileBuffer.length
    });
    res.send(fileBuffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Failed to download file", error: err.message });
  }
});

// Bulk delete
router.post("/deleteMany", authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ message: "No file IDs provided" });

    const result = await pool.query("SELECT * FROM files WHERE id = ANY($1::int[]) AND user_id=$2", [ids, req.user.id]);
    const dbx = getDropboxClient();

    for (const file of result.rows) {
      try {
        if (file.dropbox_path) await dbx.filesDeleteV2({ path: file.dropbox_path });
      } catch (dropboxErr) {
        console.warn(`Failed to delete ${file.filename}:`, dropboxErr.error_summary || dropboxErr.message);
      }
    }

    await pool.query("DELETE FROM files WHERE id = ANY($1::int[]) AND user_id=$2", [ids, req.user.id]);
    
    res.json({ message: `${ids.length} file(s) deleted successfully` });
  } catch (err) {
    console.error("Bulk delete error:", err);
    res.status(500).json({ message: "Failed to delete files", error: err.message });
  }
});

// Bulk download
router.post("/downloadMany", authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ message: "No file IDs provided" });

    const result = await pool.query("SELECT * FROM files WHERE id = ANY($1::int[]) AND user_id=$2", [ids, req.user.id]);
    const dbx = getDropboxClient();
    const zip = new JSZip();

    for (const file of result.rows) {
      try {
        const downloadRes = await dbx.filesDownload({ path: file.dropbox_path });
        const raw = downloadRes.result && downloadRes.result.fileBinary;
        const fileBuffer = toBuffer(raw);
        if (fileBuffer) zip.file(file.filename, fileBuffer);
      } catch (err) {
        console.warn(`Failed to download ${file.filename}:`, err);
        
        // Mark file as missing if it's not found in Dropbox
        if (err.status === 409 && err.error?.error_summary?.includes('path/not_found')) {
          await pool.query("UPDATE files SET status = 'missing' WHERE id = $1", [file.id]);
        }
      }
    }

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=selected-files.zip",
      "Content-Length": zipContent.length,
    });
    res.send(zipContent);
  } catch (err) {
    console.error("Bulk download error:", err);
    res.status(500).json({ message: "Failed to download files", error: err.message });
  }
});

/* -----------------------
   Preview route — serves inline content or converts Office files to PDF
   ----------------------- */
router.get("/preview/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    console.log(`🔍 Preview request - File ID: ${fileId}, User ID: ${req.user?.id || 'UNDEFINED'}`);
    
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.log(`❌ No authenticated user found`);
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // First check if file exists at all
    const fileExistsResult = await pool.query("SELECT id, user_id, filename FROM files WHERE id=$1", [fileId]);
    if (!fileExistsResult.rows[0]) {
      console.log(`❌ File ${fileId} does not exist in database`);
      return res.status(404).json({ message: "File not found" });
    }
    
    console.log(`📁 File exists: ${fileExistsResult.rows[0].filename}, Owner: ${fileExistsResult.rows[0].user_id}`);
    
    // Check if user owns the file OR has access through sharing
    const dbResult = await pool.query(`
      SELECT f.* FROM files f 
      WHERE f.id=$1 AND (
        f.user_id=$2 OR 
        f.id IN (
          SELECT fs.file_id FROM file_shares fs 
          WHERE fs.file_id=$1 AND fs.shared_with_email=$3 AND fs.is_active=true
        )
      )
    `, [fileId, req.user.id, req.user.email]);
    
    if (!dbResult.rows[0]) {
      console.log(`🚫 User ${req.user.id} does not have access to file ${fileId} (owned by ${fileExistsResult.rows[0].user_id})`);
      return res.status(404).json({ message: "File not found or access denied" });
    }

    const file = dbResult.rows[0];
    const dbx = getDropboxClient();
    
    let downloadRes;
    try {
      downloadRes = await dbx.filesDownload({ path: file.dropbox_path });
    } catch (dropboxError) {
      console.error('Dropbox download error for preview:', dropboxError);
      
      if (dropboxError.status === 409 && dropboxError.error?.error_summary?.includes('path/not_found')) {
        await pool.query("UPDATE files SET status = 'missing' WHERE id = $1", [fileId]);
        return res.status(404).json({ 
          message: "File not found in cloud storage", 
          error: "DROPBOX_FILE_MISSING" 
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to download file from cloud storage",
        error: "DROPBOX_DOWNLOAD_ERROR"
      });
    }
    
    const raw = downloadRes.result && downloadRes.result.fileBinary;
    const fileBuffer = toBuffer(raw);
    if (!fileBuffer || fileBuffer.length === 0) return res.status(500).json({ message: "File buffer is empty or invalid" });

    // Update last accessed time for recent files tracking
    try {
      await pool.query("UPDATE files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1", [fileId]);
    } catch (updateError) {
      console.error("Failed to update access time on preview:", updateError);
      // Don't fail the preview if access tracking fails
    }

    const inlineTypes = ["application/pdf", "text/plain", "application/json", "application/xml"];

    // Serve PDFs, images, and text inline directly
    if (inlineTypes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
      res.set({
        "Content-Type": file.mimetype,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Content-Length": fileBuffer.length,
      });
      return res.send(fileBuffer);
    }
    
    // Serve video and audio files for HTML5 media player with range support
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/")) {
      console.log(`🎥 Serving media file: ${file.filename} (${file.mimetype}, ${fileBuffer.length} bytes)`);
      const fileSize = fileBuffer.length;
      const range = req.headers.range;
      console.log(`📡 Range header: ${range || 'None'}`);

      if (range) {
        // Handle range requests for seeking/progressive download
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const chunk = fileBuffer.slice(start, end + 1);

        res.status(206).set({
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": file.mimetype,
          "Cache-Control": "public, max-age=31536000"
        });
        console.log(`📤 Sending range: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
        return res.send(chunk);
      } else {
        // Send entire file if no range requested
        res.set({
          "Content-Type": file.mimetype,
          "Content-Disposition": `inline; filename="${file.filename}"`,
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000"
        });
        console.log(`📤 Sending full file: ${fileSize} bytes`);
        return res.send(fileBuffer);
      }
    }
    
    if (file.mimetype.startsWith("text/") || file.mimetype === "application/json" || file.mimetype === "application/xml") {
      const text = fileBuffer.toString("utf8");
      res.set({
        "Content-Type": file.mimetype + "; charset=utf-8",
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Content-Length": Buffer.byteLength(text, "utf8"),
      });
      return res.send(text);
    }

    // For Office documents: convert to PDF
    console.log(`Converting file "${file.filename}" to PDF...`);
    const pdfBuffer = await convertToPdf(fileBuffer, file.mimetype);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.parse(file.filename).name}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);

    console.log(`Successfully converted "${file.filename}" to PDF (size: ${pdfBuffer.length} bytes)`);

  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ message: "Failed to preview file", error: err.message });
  }
});

/* -----------------------
   File access check route — for debugging
   ----------------------- */
router.get("/check/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    console.log(`🔍 Access check - File ID: ${fileId}, User ID: ${req.user.id}`);
    
    // Check if file exists
    const fileExistsResult = await pool.query("SELECT id, user_id, filename, mimetype, filesize FROM files WHERE id=$1", [fileId]);
    if (!fileExistsResult.rows[0]) {
      return res.status(404).json({ 
        exists: false, 
        message: "File not found in database" 
      });
    }
    
    const file = fileExistsResult.rows[0];
    const isOwner = file.user_id === req.user.id;
    
    // Check if user has access (owns it or it's shared with them)
    const accessResult = await pool.query(`
      SELECT f.id FROM files f 
      WHERE f.id=$1 AND (
        f.user_id=$2 OR 
        f.id IN (
          SELECT fs.file_id FROM file_shares fs 
          WHERE fs.file_id=$1 AND fs.shared_with_user_id=$2 AND fs.status='active'
        )
      )
    `, [fileId, req.user.id]);
    
    const hasAccess = accessResult.rows.length > 0;
    
    res.json({
      exists: true,
      hasAccess: hasAccess,
      isOwner: isOwner,
      file: {
        id: file.id,
        filename: file.filename,
        mimetype: file.mimetype,
        filesize: file.filesize,
        owner_id: file.user_id
      },
      currentUser: req.user.id
    });
    
  } catch (error) {
    console.error("File access check error:", error);
    res.status(500).json({ message: "Failed to check file access" });
  }
});

/* -----------------------
   Convert route — explicit PDF conversion
   ----------------------- */
router.get("/convert/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    const dbResult = await pool.query(
      "SELECT * FROM files WHERE id=$1 AND user_id=$2",
      [fileId, req.user.id]
    );
    if (!dbResult.rows.length) return res.status(404).json({ message: "File not found" });

    const file = dbResult.rows[0];
    const dbx = getDropboxClient();
    
    let downloadRes;
    try {
      downloadRes = await dbx.filesDownload({ path: file.dropbox_path });
    } catch (dropboxError) {
      console.error('Dropbox download error for convert:', dropboxError);
      
      // If file not found in Dropbox, mark as missing in database
      if (dropboxError.status === 409 && dropboxError.error?.error_summary?.includes('path/not_found')) {
        await pool.query("UPDATE files SET status = 'missing' WHERE id = $1", [fileId]);
        return res.status(404).json({ 
          message: "File not found in cloud storage", 
          error: "DROPBOX_FILE_MISSING" 
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to download file from cloud storage",
        error: "DROPBOX_DOWNLOAD_ERROR"
      });
    }
    
    const raw = downloadRes.result && downloadRes.result.fileBinary;
    const fileBuffer = toBuffer(raw);
    if (!fileBuffer || fileBuffer.length === 0) return res.status(500).json({ message: "File buffer is empty or invalid" });

    // Update last accessed time for recent files tracking
    try {
      await pool.query("UPDATE files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1", [fileId]);
    } catch (updateError) {
      console.error("Failed to update access time on convert:", updateError);
      // Don't fail the conversion if access tracking fails
    }

    console.log(`Converting file "${file.filename}" to PDF...`);
    const pdfBuffer = await convertToPdf(fileBuffer, file.mimetype);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.parse(file.filename).name}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);

    console.log(`Successfully converted "${file.filename}" to PDF (size: ${pdfBuffer.length} bytes)`);

  } catch (err) {
    console.error("Conversion error:", err);
    res.status(500).json({ message: "File conversion failed", error: err.message });
  }
});

/* -----------------------
   AI Analysis routes
   ----------------------- */

// Get analysis statistics for user (must come before /:id route)
router.get("/analysis/stats", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_files,
         COUNT(CASE WHEN analysis_status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN analysis_status = 'processing' THEN 1 END) as processing,
         COUNT(CASE WHEN analysis_status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN analysis_status = 'failed' THEN 1 END) as failed,
         COUNT(far.id) as analyzed_files
       FROM files f
       LEFT JOIN file_ai_results far ON f.id = far.file_id
       WHERE f.user_id = $1`,
      [req.user.id]
    );
    
    const stats = result.rows[0];
    
    // Convert string counts to integers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]) || 0;
    });
    
    res.json(stats);
    
  } catch (err) {
    console.error("Get analysis stats error:", err);
    res.status(500).json({ message: "Failed to fetch analysis stats", error: err.message });
  }
});

// Get AI analysis results for a specific file
router.get("/analysis/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // First check if user owns the file
    const fileResult = await pool.query(
      "SELECT id, filename, analysis_status FROM files WHERE id=$1 AND user_id=$2",
      [fileId, req.user.id]
    );
    
    if (!fileResult.rows[0]) {
      return res.status(404).json({ message: "File not found" });
    }
    
    const file = fileResult.rows[0];
    
    // Get analysis results
    const analysisResult = await pool.query(
      `SELECT id, summary, keywords, sentiment, document_category, 
              analysis_metadata, created_at, updated_at
       FROM file_ai_results 
       WHERE file_id = $1`,
      [fileId]
    );
    
    if (!analysisResult.rows[0]) {
      return res.json({
        status: file.analysis_status,
        message: getAnalysisStatusMessage(file.analysis_status),
        results: null
      });
    }
    
    const results = analysisResult.rows[0];
    
    // Parse JSON fields
    try {
      results.keywords = typeof results.keywords === 'string' ? 
        JSON.parse(results.keywords) : results.keywords;
      results.analysis_metadata = typeof results.analysis_metadata === 'string' ? 
        JSON.parse(results.analysis_metadata) : results.analysis_metadata;
    } catch (parseError) {
      console.warn('Failed to parse JSON fields:', parseError);
    }
    
    res.json({
      status: file.analysis_status,
      results: results
    });
    
  } catch (err) {
    console.error("Get analysis error:", err);
    res.status(500).json({ message: "Failed to fetch analysis", error: err.message });
  }
});

// Get analysis status for multiple files
router.post("/analysis/status", authMiddleware, async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return res.status(400).json({ message: "fileIds array is required" });
    }
    
    const result = await pool.query(
      `SELECT f.id, f.filename, f.analysis_status, 
              CASE WHEN far.id IS NOT NULL THEN true ELSE false END as has_results
       FROM files f
       LEFT JOIN file_ai_results far ON f.id = far.file_id
       WHERE f.id = ANY($1::int[]) AND f.user_id = $2`,
      [fileIds, req.user.id]
    );
    
    const statusMap = {};
    result.rows.forEach(row => {
      statusMap[row.id] = {
        status: row.analysis_status,
        hasResults: row.has_results,
        message: getAnalysisStatusMessage(row.analysis_status)
      };
    });
    
    res.json(statusMap);
    
  } catch (err) {
    console.error("Get analysis status error:", err);
    res.status(500).json({ message: "Failed to fetch analysis status", error: err.message });
  }
});

// Trigger re-analysis of a file
router.post("/analysis/:id/reanalyze", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // Check if user owns the file
    const fileResult = await pool.query(
      "SELECT id, filename FROM files WHERE id=$1 AND user_id=$2",
      [fileId, req.user.id]
    );
    
    if (!fileResult.rows[0]) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Reset analysis status to pending
    await pool.query(
      "UPDATE files SET analysis_status='pending', updated_at=NOW() WHERE id=$1",
      [fileId]
    );
    
    // Clear existing results
    await pool.query(
      "DELETE FROM file_ai_results WHERE file_id=$1",
      [fileId]
    );
    
    res.json({ 
      message: "File queued for re-analysis", 
      status: "pending" 
    });
    
  } catch (err) {
    console.error("Reanalyze error:", err);
    res.status(500).json({ message: "Failed to queue re-analysis", error: err.message });
  }
});


/* -----------------------
   File Favorites routes
   ----------------------- */

// Add file to favorites (star)
router.post("/:id/favorite", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    
    // Check if file exists and user owns it or has access
    const fileResult = await pool.query(
      "SELECT id FROM files WHERE id=$1 AND user_id=$2",
      [fileId, userId]
    );
    
    if (!fileResult.rows[0]) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Add to favorites (ignore if already exists due to UNIQUE constraint)
    await pool.query(
      `INSERT INTO file_favorites (user_id, file_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, file_id) DO NOTHING`,
      [userId, fileId]
    );
    
    res.json({ message: "File added to favorites", fileId, starred: true });
    
  } catch (err) {
    console.error("Add favorite error:", err);
    res.status(500).json({ message: "Failed to add favorite", error: err.message });
  }
});

// Remove file from favorites (unstar)
router.delete("/:id/favorite", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    
    // Remove from favorites
    const result = await pool.query(
      "DELETE FROM file_favorites WHERE user_id=$1 AND file_id=$2",
      [userId, fileId]
    );
    
    res.json({ 
      message: "File removed from favorites", 
      fileId, 
      starred: false,
      removed: result.rowCount > 0
    });
    
  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ message: "Failed to remove favorite", error: err.message });
  }
});

// Get all favorite files for user
router.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT f.*, ff.created_at as favorited_at,
              CASE WHEN s.id IS NOT NULL THEN true ELSE false END as is_shared,
              COUNT(s.id) as share_count
       FROM files f
       INNER JOIN file_favorites ff ON f.id = ff.file_id
       LEFT JOIN shares s ON f.id = s.file_id
       WHERE ff.user_id = $1
       GROUP BY f.id, ff.created_at, s.id
       ORDER BY ff.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
    
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Failed to fetch favorites", error: err.message });
  }
});

// Get all available document categories
router.get("/categories", authMiddleware, async (req, res) => {
  try {
    const { getCategoriesGrouped, getCategoryInfo } = require('../utils/ai');
    
    const groupedCategories = getCategoriesGrouped();
    const categoryDetails = {};
    
    // Add category details for each category
    Object.keys(groupedCategories).forEach(group => {
      groupedCategories[group].forEach(category => {
        categoryDetails[category] = getCategoryInfo(category);
      });
    });
    
    res.json({
      groups: groupedCategories,
      details: categoryDetails,
      total: Object.keys(categoryDetails).length
    });
    
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

// Helper function to get status messages
function getAnalysisStatusMessage(status) {
  const messages = {
    'pending': 'Analysis queued - will be processed soon',
    'processing': 'AI analysis in progress...',
    'completed': 'Analysis completed successfully',
    'failed': 'Analysis failed - please try again'
  };
  
  return messages[status] || 'Unknown status';
}

// Move file to folder
router.put("/:id/move", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { folder_id } = req.body;
    
    // Verify file exists and belongs to user
    const fileCheck = await pool.query(
      'SELECT id FROM files WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // If folder_id is provided, verify it exists and belongs to user
    if (folder_id && folder_id !== null) {
      const folderCheck = await pool.query(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
        [folder_id, req.user.id]
      );
      
      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ message: "Folder not found" });
      }
    }
    
    // Update file's folder_id
    const result = await pool.query(
      'UPDATE files SET folder_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [folder_id || null, id, req.user.id]
    );
    
    res.json({ 
      message: "File moved successfully", 
      file: result.rows[0] 
    });
  } catch (err) {
    console.error("Move file error:", err);
    res.status(500).json({ message: "Failed to move file", error: err.message });
  }
});

// Trigger AI analysis for a specific file
router.post('/analyze/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the file
    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const file = fileResult.rows[0];
    
    // Check if file already has analysis
    const analysisResult = await pool.query(
      'SELECT summary FROM file_ai_results WHERE file_id = $1',
      [id]
    );
    
    if (analysisResult.rows.length > 0) {
      return res.json({ 
        message: 'Analysis already exists', 
        analysis: analysisResult.rows[0] 
      });
    }
    
    // Set analysis status to pending
    await pool.query(
      'UPDATE files SET analysis_status = $1 WHERE id = $2',
      ['pending', id]
    );
    
    res.json({ 
      message: 'Analysis queued successfully',
      file: {
        id: file.id,
        filename: file.filename,
        mimetype: file.mimetype,
        analysis_status: 'pending'
      }
    });
    
  } catch (err) {
    console.error('Analysis trigger error:', err);
    res.status(500).json({ message: 'Failed to trigger analysis', error: err.message });
  }
});

// Get analysis results for a file
router.get('/analysis/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the file
    const fileResult = await pool.query(
      'SELECT f.*, ai.* FROM files f LEFT JOIN file_ai_results ai ON f.id = ai.file_id WHERE f.id = $1 AND f.user_id = $2',
      [id, req.user.id]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const result = fileResult.rows[0];
    
    res.json({
      file: {
        id: result.id,
        filename: result.filename,
        mimetype: result.mimetype,
        analysis_status: result.analysis_status
      },
      analysis: result.summary ? {
        summary: result.summary,
        keywords: result.keywords,
        sentiment: result.sentiment,
        document_category: result.document_category,
        analysis_metadata: result.analysis_metadata
      } : null
    });
    
  } catch (err) {
    console.error('Get analysis error:', err);
    res.status(500).json({ message: 'Failed to get analysis', error: err.message });
  }
});

// Global file search
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { 
      q: query, 
      type, 
      category, 
      size_min, 
      size_max, 
      date_from, 
      date_to,
      limit = 50,
      offset = 0 
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log(`🔍 Search request: "${query}" for user ${req.user.id}`);
    
    // Build the search query
    let searchQuery = `
      SELECT DISTINCT f.*, ai.summary, ai.keywords, ai.document_category,
             CASE 
               WHEN f.filename ILIKE $2 THEN 3
               WHEN ai.summary ILIKE $2 THEN 2
               WHEN ai.keywords::text ILIKE $2 THEN 1
               ELSE 0
             END as relevance_score
      FROM files f
      LEFT JOIN file_ai_results ai ON f.id = ai.file_id
      WHERE f.user_id = $1 AND (
        f.filename ILIKE $2 OR
        ai.summary ILIKE $2 OR
        ai.keywords::text ILIKE $2 OR
        ai.extracted_text ILIKE $2
      )
    `;
    
    const queryParams = [req.user.id, `%${query}%`];
    let paramIndex = 2;

    // Add filters
    if (type) {
      paramIndex++;
      searchQuery += ` AND f.mimetype LIKE $${paramIndex}`;
      queryParams.push(`${type}/%`);
    }

    if (category) {
      paramIndex++;
      searchQuery += ` AND ai.document_category = $${paramIndex}`;
      queryParams.push(category);
    }

    if (size_min) {
      paramIndex++;
      searchQuery += ` AND f.filesize >= $${paramIndex}`;
      queryParams.push(parseInt(size_min));
    }

    if (size_max) {
      paramIndex++;
      searchQuery += ` AND f.filesize <= $${paramIndex}`;
      queryParams.push(parseInt(size_max));
    }

    if (date_from) {
      paramIndex++;
      searchQuery += ` AND f.created_at >= $${paramIndex}`;
      queryParams.push(new Date(date_from));
    }

    if (date_to) {
      paramIndex++;
      searchQuery += ` AND f.created_at <= $${paramIndex}`;
      queryParams.push(new Date(date_to));
    }

    // Order by relevance and date
    searchQuery += ` ORDER BY relevance_score DESC, f.created_at DESC LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Execute search
    const searchResult = await pool.query(searchQuery, queryParams);
    
    // Get total count for pagination
    let countQuery = searchQuery.split('ORDER BY')[0].replace(
      'SELECT DISTINCT f.*, ai.summary, ai.keywords, ai.document_category, CASE WHEN f.filename ILIKE $2 THEN 3 WHEN ai.summary ILIKE $2 THEN 2 WHEN ai.keywords::text ILIKE $2 THEN 1 ELSE 0 END as relevance_score',
      'SELECT COUNT(DISTINCT f.id)'
    );
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);
    
    const results = searchResult.rows.map(file => ({
      ...file,
      searchSnippet: generateSearchSnippet(file, query)
    }));

    console.log(`✅ Search completed: ${results.length} results for "${query}"`);

    res.json({
      results,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      query,
      filters: { type, category, size_min, size_max, date_from, date_to }
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// Search suggestions/autocomplete
router.get('/search/suggestions', authMiddleware, async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get filename suggestions
    const filenameQuery = `
      SELECT DISTINCT filename
      FROM files 
      WHERE user_id = $1 AND filename ILIKE $2
      LIMIT 5
    `;
    
    // Get keyword suggestions from AI analysis
    const keywordQuery = `
      SELECT DISTINCT keyword
      FROM (
        SELECT jsonb_array_elements_text(keywords) as keyword
        FROM file_ai_results ai
        JOIN files f ON ai.file_id = f.id
        WHERE f.user_id = $1
      ) keywords_expanded
      WHERE keyword ILIKE $2
      LIMIT 5
    `;

    const [filenameResults, keywordResults] = await Promise.all([
      pool.query(filenameQuery, [req.user.id, `%${query}%`]),
      pool.query(keywordQuery, [req.user.id, `%${query}%`])
    ]);

    const suggestions = [
      ...filenameResults.rows.map(r => ({ text: r.filename, type: 'filename' })),
      ...keywordResults.rows.map(r => ({ text: r.keyword, type: 'keyword' }))
    ];

    res.json({ suggestions: suggestions.slice(0, 8) });

  } catch (err) {
    console.error('Search suggestions error:', err);
    res.status(500).json({ message: 'Failed to get search suggestions', error: err.message });
  }
});

// Helper function to generate search snippets
function generateSearchSnippet(file, query) {
  const queryLower = query.toLowerCase();
  
  // Check filename first
  if (file.filename.toLowerCase().includes(queryLower)) {
    return {
      source: 'filename',
      text: file.filename,
      highlight: true
    };
  }
  
  // Check summary
  if (file.summary && file.summary.toLowerCase().includes(queryLower)) {
    const summaryText = file.summary.replace(/[*#]/g, ''); // Remove markdown
    const index = summaryText.toLowerCase().indexOf(queryLower);
    const start = Math.max(0, index - 50);
    const end = Math.min(summaryText.length, index + query.length + 50);
    const snippet = summaryText.substring(start, end);
    
    return {
      source: 'summary',
      text: (start > 0 ? '...' : '') + snippet + (end < summaryText.length ? '...' : ''),
      highlight: true
    };
  }
  
  // Check keywords (handle both array and JSONB)
  if (file.keywords) {
    const keywords = Array.isArray(file.keywords) ? file.keywords : 
                    (typeof file.keywords === 'string' ? JSON.parse(file.keywords) : 
                    (file.keywords && file.keywords.length ? file.keywords : []));
    
    if (keywords.length > 0 && keywords.some(k => k.toLowerCase().includes(queryLower))) {
      const matchingKeywords = keywords.filter(k => k.toLowerCase().includes(queryLower));
      return {
        source: 'keywords',
        text: `Keywords: ${matchingKeywords.join(', ')}`,
        highlight: true
      };
    }
  }
  
  // Fallback to file info
  return {
    source: 'file',
    text: `${file.mimetype} • ${Math.round(file.filesize / 1024)} KB`,
    highlight: false
  };
}

// Check for updates endpoint - used by refresh manager
router.get('/check-updates', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { last_check } = req.query;
    
    // Parse last check timestamp
    const lastCheckDate = last_check ? new Date(last_check) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
    
    // Check for new AI analysis results
    const newAnalysisQuery = `
      SELECT COUNT(*) as count
      FROM file_ai_results ai
      JOIN files f ON ai.file_id = f.id 
      WHERE f.user_id = $1 AND ai.created_at > $2
    `;
    const newAnalysisResult = await pool.query(newAnalysisQuery, [userId, lastCheckDate]);
    const newAnalysis = parseInt(newAnalysisResult.rows[0].count) > 0;
    
    // Check for recently uploaded files
    const newFilesQuery = `
      SELECT COUNT(*) as count
      FROM files 
      WHERE user_id = $1 AND created_at > $2
    `;
    const newFilesResult = await pool.query(newFilesQuery, [userId, lastCheckDate]);
    const newFiles = parseInt(newFilesResult.rows[0].count) > 0;
    
    // Check for recently shared files
    const newSharesQuery = `
      SELECT COUNT(*) as count
      FROM shares s
      JOIN files f ON s.file_id = f.id 
      WHERE f.user_id = $1 AND s.created_at > $2
    `;
    const newSharesResult = await pool.query(newSharesQuery, [userId, lastCheckDate]);
    const newShares = parseInt(newSharesResult.rows[0].count) > 0;
    
    // Check for status changes (favorites, etc.)
    const statusChangesQuery = `
      SELECT COUNT(*) as count
      FROM files 
      WHERE user_id = $1 AND updated_at > $2 AND updated_at != created_at
    `;
    const statusChangesResult = await pool.query(statusChangesQuery, [userId, lastCheckDate]);
    const statusChanges = parseInt(statusChangesResult.rows[0].count) > 0;
    
    const hasUpdates = newAnalysis || newFiles || newShares || statusChanges;
    
    // Generate user-friendly update message
    let message = '';
    if (hasUpdates) {
      const updates = [];
      if (newAnalysis) updates.push(`${newAnalysisResult.rows[0].count} files analyzed`);
      if (newFiles) updates.push(`${newFilesResult.rows[0].count} new files`);
      if (newShares) updates.push(`${newSharesResult.rows[0].count} new shares`);
      if (statusChanges) updates.push(`${statusChangesResult.rows[0].count} files updated`);
      
      message = updates.join(', ') + ' - Click to refresh';
    }
    
    res.json({
      hasUpdates,
      newAnalysis,
      newFiles, 
      newShares,
      statusChanges,
      message,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ 
      error: 'Failed to check for updates',
      hasUpdates: false 
    });
  }
});

// Detect duplicate files
router.get('/duplicates', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find potential duplicates by filename and filesize
    const duplicatesQuery = `
      WITH file_groups AS (
        SELECT 
          filename,
          filesize,
          mimetype,
          array_agg(
            json_build_object(
              'id', id,
              'filename', filename,
              'filepath', filepath,
              'filesize', filesize,
              'mimetype', mimetype,
              'created_at', created_at,
              'folder_id', folder_id
            ) ORDER BY created_at ASC
          ) as files,
          COUNT(*) as duplicate_count
        FROM files 
        WHERE user_id = $1 
        GROUP BY filename, filesize, mimetype
        HAVING COUNT(*) > 1
      )
      SELECT 
        filename,
        filesize,
        mimetype,
        files,
        duplicate_count,
        (filesize * (duplicate_count - 1)) as wasted_space
      FROM file_groups
      ORDER BY wasted_space DESC, duplicate_count DESC
    `;
    
    const duplicatesResult = await pool.query(duplicatesQuery, [userId]);
    
    // Calculate total wasted space
    const totalWastedSpace = duplicatesResult.rows.reduce((total, group) => {
      return total + parseInt(group.wasted_space);
    }, 0);
    
    // Count total duplicate files (excluding one original of each group)
    const totalDuplicateFiles = duplicatesResult.rows.reduce((total, group) => {
      return total + (group.duplicate_count - 1);
    }, 0);
    
    res.json({
      duplicateGroups: duplicatesResult.rows,
      totalGroups: duplicatesResult.rows.length,
      totalDuplicateFiles,
      totalWastedSpace,
      totalWastedSpaceMB: Math.round(totalWastedSpace / (1024 * 1024) * 100) / 100
    });
    
  } catch (err) {
    console.error('Duplicate detection error:', err);
    res.status(500).json({ message: 'Failed to detect duplicates', error: err.message });
  }
});

// Delete duplicate files (keep selected file)
router.post('/duplicates/clean', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupIndex, keepFileId, action = 'delete_others' } = req.body;
    
    if (action === 'delete_others' && !keepFileId) {
      return res.status(400).json({ message: 'keepFileId is required when deleting others' });
    }
    
    // Get the duplicate group first
    const duplicatesQuery = `
      WITH file_groups AS (
        SELECT 
          filename,
          filesize,
          mimetype,
          array_agg(
            json_build_object(
              'id', id,
              'filename', filename,
              'filepath', filepath,
              'filesize', filesize,
              'created_at', created_at,
              'folder_id', folder_id
            ) ORDER BY created_at ASC
          ) as files,
          COUNT(*) as duplicate_count,
          ROW_NUMBER() OVER (ORDER BY (filesize * (COUNT(*) - 1)) DESC, COUNT(*) DESC) as group_rank
        FROM files 
        WHERE user_id = $1 
        GROUP BY filename, filesize, mimetype
        HAVING COUNT(*) > 1
      )
      SELECT * FROM file_groups WHERE group_rank = $2
    `;
    
    const groupResult = await pool.query(duplicatesQuery, [userId, groupIndex + 1]);
    
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: 'Duplicate group not found' });
    }
    
    const group = groupResult.rows[0];
    const files = group.files;
    
    let filesToDelete = [];
    
    if (action === 'delete_others') {
      // Keep specific file, delete others
      filesToDelete = files.filter(file => file.id !== keepFileId);
    } else if (action === 'keep_oldest') {
      // Keep oldest (first in array), delete others
      filesToDelete = files.slice(1);
    } else if (action === 'keep_newest') {
      // Keep newest (last in array), delete others
      filesToDelete = files.slice(0, -1);
    }
    
    // Delete files from database and Dropbox
    const dbx = getDropboxClient();
    const deletedFiles = [];
    
    for (const file of filesToDelete) {
      try {
        // Delete from Dropbox
        const dropboxResult = await pool.query(
          'SELECT dropbox_path FROM files WHERE id = $1 AND user_id = $2',
          [file.id, userId]
        );
        
        if (dropboxResult.rows[0]?.dropbox_path) {
          await dbx.filesDeleteV2({ path: dropboxResult.rows[0].dropbox_path });
        }
        
        // Delete from database
        await pool.query('DELETE FROM files WHERE id = $1 AND user_id = $2', [file.id, userId]);
        deletedFiles.push(file);
        
      } catch (deleteError) {
        console.error(`Failed to delete file ${file.id}:`, deleteError);
      }
    }
    
    const spaceSaved = deletedFiles.reduce((total, file) => total + file.filesize, 0);
    
    res.json({
      message: `Deleted ${deletedFiles.length} duplicate files`,
      deletedCount: deletedFiles.length,
      deletedFiles,
      spaceSaved,
      spaceSavedMB: Math.round(spaceSaved / (1024 * 1024) * 100) / 100
    });
    
  } catch (err) {
    console.error('Clean duplicates error:', err);
    res.status(500).json({ message: 'Failed to clean duplicates', error: err.message });
  }
});

module.exports = router;
