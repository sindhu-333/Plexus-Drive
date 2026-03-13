require('dotenv').config(); // Load .env variables
const { pool } = require('./db');
const { analyzeFile, checkAIHealth } = require('./utils/ai'); // Your AI analysis function
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

global.fetch = fetch;

// Track processing statistics
const stats = {
    processed: 0,
    failed: 0,
    startTime: Date.now()
};

// Helper to create Dropbox client
function getDropboxClient() {
    if (!process.env.DROPBOX_REFRESH_TOKEN) {
        throw new Error('DROPBOX_REFRESH_TOKEN not set in .env');
    }
    return new Dropbox({
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        fetch
    });
}

// Enhanced worker function with better error handling and progress tracking
async function processJobs() {
    let fileBeingProcessed = null;
    
    try {
        // Get first pending file with more details
        const res = await pool.query(
            `SELECT id, filename, dropbox_path, mimetype, filesize, user_id
             FROM files 
             WHERE analysis_status = 'pending' 
             ORDER BY created_at ASC 
             LIMIT 1`
        );

        if (res.rows.length === 0) {
            // Only log every 30 seconds to reduce noise
            if (Date.now() % 30000 < 5000) {
                console.log('⏳ No pending files...');
            }
            return;
        }

        const file = res.rows[0];
        fileBeingProcessed = file;

        // Check file size limit (1GB)
        if (file.filesize > 1024 * 1024 * 1024) {
            await markFileAsFailed(file.id, 'File too large for analysis (>1GB)');
            console.log(`⚠️ File ${file.filename} skipped: too large (${Math.round(file.filesize / 1024 / 1024)}MB)`);
            return;
        }

        // Mark as processing
        await pool.query(
            `UPDATE files SET analysis_status=$1, updated_at=NOW() WHERE id=$2`,
            ['processing', file.id]
        );
        
        console.log(`🚀 Processing: ${file.filename} (${Math.round(file.filesize / 1024)}KB, ${file.mimetype})`);

        let buffer;
        
        // Handle different file sources
        if (file.dropbox_path === 'local') {
            // For local files, we might need different handling
            console.log('⚠️ Local file detected - skipping Dropbox download');
            await markFileAsFailed(file.id, 'Local file path not supported in worker');
            return;
        } else {
            // Download from Dropbox
            const dbx = getDropboxClient();
            console.log(`📥 Downloading from Dropbox: ${file.dropbox_path}`);
            
            const downloadRes = await dbx.filesDownload({ path: file.dropbox_path });
            buffer = downloadRes.result.fileBinary;
        }

        // Perform AI analysis
        console.log(`🧠 Starting AI analysis...`);
        const startTime = Date.now();
        
        const analysisResult = await analyzeFile(buffer, file.filename, file.mimetype);
        
        const processingTime = Date.now() - startTime;
        console.log(`⚡ Analysis completed in ${processingTime}ms`);

        // Store results in file_ai_results table
        await storeAnalysisResults(file.id, analysisResult);

        // Update file status
        await pool.query(
            `UPDATE files SET analysis_status=$1, updated_at=NOW() WHERE id=$2`,
            ['completed', file.id]
        );

        stats.processed++;
        console.log(`✅ ${file.filename} analyzed successfully! (Total processed: ${stats.processed})`);

    } catch (err) {
        console.error('❌ Worker error:', err.message);
        
        stats.failed++;
        
        // Mark file as failed if we have file info
        if (fileBeingProcessed?.id) {
            await markFileAsFailed(fileBeingProcessed.id, err.message);
            console.log(`⚠️ File ${fileBeingProcessed.filename} marked as failed`);
        }
    }
}

// Helper function to store analysis results
async function storeAnalysisResults(fileId, analysisResult) {
    try {
        // Check if results already exist
        const existingRes = await pool.query(
            'SELECT id FROM file_ai_results WHERE file_id = $1',
            [fileId]
        );

        if (existingRes.rows.length > 0) {
            // Update existing results
            await pool.query(
                `UPDATE file_ai_results 
                 SET summary=$1, keywords=$2, sentiment=$3, document_category=$4, 
                     extracted_text=$5, analysis_metadata=$6, updated_at=NOW() 
                 WHERE file_id=$7`,
                [
                    analysisResult.summary,
                    JSON.stringify(analysisResult.keywords),
                    analysisResult.sentiment,
                    analysisResult.document_category,
                    analysisResult.extracted_text,
                    JSON.stringify(analysisResult.analysis_metadata),
                    fileId
                ]
            );
        } else {
            // Insert new results
            await pool.query(
                `INSERT INTO file_ai_results 
                 (file_id, summary, keywords, sentiment, document_category, extracted_text, analysis_metadata) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    fileId,
                    analysisResult.summary,
                    JSON.stringify(analysisResult.keywords),
                    analysisResult.sentiment,
                    analysisResult.document_category,
                    analysisResult.extracted_text,
                    JSON.stringify(analysisResult.analysis_metadata)
                ]
            );
        }
    } catch (error) {
        console.error('Failed to store analysis results:', error);
        throw error;
    }
}

// Helper function to mark file as failed
async function markFileAsFailed(fileId, errorMessage) {
    try {
        await pool.query(
            `UPDATE files SET analysis_status=$1, updated_at=NOW() WHERE id=$2`,
            ['failed', fileId]
        );
        
        // Also store error in analysis results
        await pool.query(
            `INSERT INTO file_ai_results (file_id, analysis_metadata) 
             VALUES ($1, $2) 
             ON CONFLICT (file_id) DO UPDATE SET 
             analysis_metadata = $2, updated_at = NOW()`,
            [fileId, JSON.stringify({ error: errorMessage, timestamp: new Date().toISOString() })]
        );
    } catch (error) {
        console.error('Failed to mark file as failed:', error);
    }
}

// Health check function
async function performHealthCheck() {
    try {
        const aiHealth = await checkAIHealth();
        const dbHealth = await pool.query('SELECT 1');
        
        console.log(`🏥 Health Check - AI: ${aiHealth.status}, DB: Connected, Stats: ${stats.processed} processed, ${stats.failed} failed`);
        
        if (aiHealth.status !== 'healthy') {
            console.warn('⚠️ AI service is not healthy:', aiHealth.error);
        }
        
        return aiHealth.status === 'healthy' && dbHealth.rowCount >= 0;
    } catch (error) {
        console.error('❌ Health check failed:', error);
        return false;
    }
}

// Initialize worker with health check
async function initializeWorker() {
    console.log('🚀 Initializing AI Analysis Worker...');
    
    // Perform initial health check
    const isHealthy = await performHealthCheck();
    
    if (!isHealthy) {
        console.error('❌ Worker initialization failed - services not healthy');
        process.exit(1);
    }
    
    console.log('✅ Worker initialized successfully!');
    
    // Start processing jobs every 5 seconds
    setInterval(processJobs, 5000);
    
    // Perform health check every 5 minutes
    setInterval(performHealthCheck, 300000);
    
    console.log('👷 Worker started - polling for jobs every 5 seconds');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down worker gracefully...');
    console.log(`📊 Final stats: ${stats.processed} processed, ${stats.failed} failed`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Worker terminated');
    process.exit(0);
});

// Only self-start when run directly (node worker.js), not when required by index.js
if (require.main === module) {
    initializeWorker().catch(error => {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    });
}

module.exports = { processJobs };
