const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const NotificationService = require('../services/notificationService');

const router = express.Router();

// Get all folders for the current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, 
                    (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count,
                    (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count
             FROM folders f 
             WHERE f.user_id = $1 
             ORDER BY f.parent_id NULLS FIRST, f.name ASC`,
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Get folder tree structure
router.get('/tree', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `WITH RECURSIVE folder_tree AS (
                -- Base case: root folders (no parent)
                SELECT id, name, parent_id, user_id, created_at, updated_at, 0 as level,
                       ARRAY[name] as path, ARRAY[id] as id_path
                FROM folders 
                WHERE parent_id IS NULL AND user_id = $1
                
                UNION ALL
                
                -- Recursive case: child folders
                SELECT f.id, f.name, f.parent_id, f.user_id, f.created_at, f.updated_at, 
                       ft.level + 1,
                       ft.path || f.name,
                       ft.id_path || f.id
                FROM folders f
                INNER JOIN folder_tree ft ON f.parent_id = ft.id
                WHERE f.user_id = $1
            )
            SELECT *, 
                   (SELECT COUNT(*) FROM files WHERE folder_id = folder_tree.id) as file_count,
                   (SELECT COUNT(*) FROM folders WHERE parent_id = folder_tree.id) as subfolder_count
            FROM folder_tree 
            ORDER BY level, name`,
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching folder tree:', error);
        res.status(500).json({ error: 'Failed to fetch folder tree' });
    }
});

// Create a new folder
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        // Check if parent folder exists and belongs to user (if parent_id is provided)
        if (parent_id) {
            const parentCheck = await pool.query(
                'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
                [parent_id, req.user.id]
            );
            
            if (parentCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
        }
        
        // Check if folder with same name already exists in the same parent
        const existingFolder = await pool.query(
            'SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND user_id = $3',
            [name.trim(), parent_id || null, req.user.id]
        );
        
        if (existingFolder.rows.length > 0) {
            return res.status(409).json({ error: 'Folder with this name already exists' });
        }
        
        const result = await pool.query(
            'INSERT INTO folders (name, parent_id, user_id) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), parent_id || null, req.user.id]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Update a folder
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        // Check if folder exists and belongs to user
        const folderCheck = await pool.query(
            'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (folderCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Check if parent folder exists and belongs to user (if parent_id is provided)
        if (parent_id) {
            const parentCheck = await pool.query(
                'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
                [parent_id, req.user.id]
            );
            
            if (parentCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            
            // Prevent moving folder into itself or its descendants
            if (parent_id == id) {
                return res.status(400).json({ error: 'Cannot move folder into itself' });
            }
        }
        
        // Check if folder with same name already exists in the same parent
        const existingFolder = await pool.query(
            'SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND user_id = $3 AND id != $4',
            [name.trim(), parent_id || null, req.user.id, id]
        );
        
        if (existingFolder.rows.length > 0) {
            return res.status(409).json({ error: 'Folder with this name already exists' });
        }
        
        const result = await pool.query(
            'UPDATE folders SET name = $1, parent_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [name.trim(), parent_id || null, id, req.user.id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// Delete a folder
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query; // ?force=true for cascade delete
        
        // Check if folder exists and belongs to user
        const folderCheck = await pool.query(
            'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (folderCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Check if folder has files or subfolders
        const contentCheck = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM files WHERE folder_id = $1) as file_count,
                (SELECT COUNT(*) FROM folders WHERE parent_id = $1) as subfolder_count`,
            [id]
        );
        
        const { file_count, subfolder_count } = contentCheck.rows[0];
        
        if ((file_count > 0 || subfolder_count > 0) && force !== 'true') {
            return res.status(409).json({ 
                error: 'Cannot delete folder that contains files or subfolders. Use force=true to delete all contents.',
                file_count: parseInt(file_count),
                subfolder_count: parseInt(subfolder_count)
            });
        }
        
        // If force delete, remove all contents first
        if (force === 'true') {
            // Delete all files in this folder (and its subfolders recursively)
            await pool.query(`
                WITH RECURSIVE folder_descendants AS (
                    SELECT id FROM folders WHERE id = $1
                    UNION ALL
                    SELECT f.id FROM folders f
                    INNER JOIN folder_descendants fd ON f.parent_id = fd.id
                )
                DELETE FROM files WHERE folder_id IN (SELECT id FROM folder_descendants)
            `, [id]);
            
            // Delete all subfolders recursively
            await pool.query(`
                WITH RECURSIVE folder_descendants AS (
                    SELECT id FROM folders WHERE parent_id = $1
                    UNION ALL
                    SELECT f.id FROM folders f
                    INNER JOIN folder_descendants fd ON f.parent_id = fd.id
                )
                DELETE FROM folders WHERE id IN (SELECT id FROM folder_descendants)
            `, [id]);
        }
        
        // Delete the folder itself
        await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        
        res.json({ 
            message: 'Folder deleted successfully',
            deleted_files: force === 'true' ? parseInt(file_count) : 0,
            deleted_subfolders: force === 'true' ? parseInt(subfolder_count) : 0
        });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// Get a single folder by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT f.*, 
                    (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count,
                    (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count
             FROM folders f 
             WHERE f.id = $1 AND f.user_id = $2`,
            [id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching folder:', error);
        res.status(500).json({ error: 'Failed to fetch folder' });
    }
});

// Get files in a specific folder
router.get('/:id/files', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if folder exists and belongs to user
        const folderCheck = await pool.query(
            'SELECT id, name FROM folders WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (folderCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        const result = await pool.query(
            `SELECT f.*, 
                    CASE WHEN fav.file_id IS NOT NULL THEN true ELSE false END as is_favorite
             FROM files f
             LEFT JOIN favorites fav ON f.id = fav.file_id AND fav.user_id = $2
             WHERE f.folder_id = $1 AND f.user_id = $2
             ORDER BY f.uploaded_at DESC`,
            [id, req.user.id]
        );
        
        res.json({
            folder: folderCheck.rows[0],
            files: result.rows
        });
    } catch (error) {
        console.error('Error fetching folder files:', error);
        res.status(500).json({ error: 'Failed to fetch folder files' });
    }
});

// Move file to folder
router.put('/:folderId/files/:fileId', authMiddleware, async (req, res) => {
    try {
        const { folderId, fileId } = req.params;
        
        // Check if folder exists and belongs to user (or folderId is 'root' for root level)
        if (folderId !== 'root') {
            const folderCheck = await pool.query(
                'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
                [folderId, req.user.id]
            );
            
            if (folderCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Folder not found' });
            }
        }
        
        // Check if file exists and belongs to user
        const fileCheck = await pool.query(
            'SELECT id FROM files WHERE id = $1 AND user_id = $2',
            [fileId, req.user.id]
        );
        
        if (fileCheck.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Move file to folder (or root if folderId is 'root')
        const folderIdValue = folderId === 'root' ? null : folderId;
        await pool.query(
            'UPDATE files SET folder_id = $1 WHERE id = $2 AND user_id = $3',
            [folderIdValue, fileId, req.user.id]
        );
        
        res.json({ message: 'File moved successfully' });
    } catch (error) {
        console.error('Error moving file:', error);
        res.status(500).json({ error: 'Failed to move file' });
    }
});

module.exports = router;