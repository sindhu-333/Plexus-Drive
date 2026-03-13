import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { FiUpload, FiX, FiCheck, FiAlertCircle, FiFile, FiImage, FiFileText, FiPaperclip, FiFolder } from 'react-icons/fi';

const UploadFile = ({ onUpload, currentFolderId = null }) => {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    
    // Enhanced upload features
    const [uploadQueue, setUploadQueue] = useState([]);
    const [uploadStats, setUploadStats] = useState({
        todayUploads: 0,
        todayStorage: 0,
        successRate: 100
    });
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        handleMultipleFiles(files);
    };

    // Handle multiple file selection
    const handleMultipleFiles = (files) => {
        const validFiles = [];
        const errors = [];

        files.forEach((file, index) => {
            const validation = validateFile(file);
            if (validation.isValid) {
                validFiles.push({
                    id: Date.now() + index,
                    file,
                    progress: 0,
                    status: 'pending', // pending, uploading, completed, error
                    error: null
                });
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        });

        if (validFiles.length > 0) {
            setUploadQueue(prev => [...prev, ...validFiles]);
        }

        if (errors.length > 0) {
            setError(errors.join('\n'));
        }
    };

    const validateFile = (file) => {
        // File size limit: 1GB
        if (file.size > 1024 * 1024 * 1024) {
            return { isValid: false, error: 'File size should be less than 1GB' };
        }

        // Supported file types - expanded to include video and audio
        const supportedTypes = [
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

        if (!supportedTypes.includes(file.type)) {
            return { isValid: false, error: 'Unsupported file type' };
        }

        return { isValid: true };
    };

    const validateAndSetFile = (file) => {
        setError('');
        const validation = validateFile(file);
        if (!validation.isValid) {
            setError(validation.error);
            return;
        }
        setFile(file);
    };

    const handleUpload = async () => {
        if (!file && uploadQueue.length === 0) {
            setError('Please select a file');
            return;
        }
        
        setError('');
        
        // Handle single file upload
        if (file) {
            setIsUploading(true);
            await uploadSingleFile(file, (progress) => setProgress(progress));
            setFile(null);
            setProgress(0);
            setIsUploading(false);
        }
        
        // Handle queue uploads
        if (uploadQueue.length > 0) {
            await processUploadQueue();
        }
    };

    const uploadSingleFile = async (file, progressCallback) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add folder_id if we're in a specific folder
        if (currentFolderId) {
            formData.append('folder_id', currentFolderId);
        }

        try {
            await api.post('/files/upload', formData, {
                onUploadProgress: e => progressCallback(Math.round((e.loaded * 100) / e.total))
            });
            
            // Update stats
            setUploadStats(prev => ({
                ...prev,
                todayUploads: prev.todayUploads + 1,
                todayStorage: prev.todayStorage + file.size
            }));
            
            onUpload();
            return { success: true };
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed. Please try again.');
            return { success: false, error: err.response?.data?.message || 'Upload failed' };
        }
    };

    const processUploadQueue = async () => {
        for (let i = 0; i < uploadQueue.length; i++) {
            const queueItem = uploadQueue[i];
            if (queueItem.status !== 'pending') continue;

            // Update status to uploading
            setUploadQueue(prev => prev.map(item => 
                item.id === queueItem.id ? { ...item, status: 'uploading' } : item
            ));

            const result = await uploadSingleFile(queueItem.file, (progress) => {
                setUploadQueue(prev => prev.map(item => 
                    item.id === queueItem.id ? { ...item, progress } : item
                ));
            });

            // Update final status
            setUploadQueue(prev => prev.map(item => 
                item.id === queueItem.id ? { 
                    ...item, 
                    status: result.success ? 'completed' : 'error',
                    error: result.error || null,
                    progress: result.success ? 100 : item.progress
                } : item
            ));
        }
    };

    const removeFromQueue = (id) => {
        setUploadQueue(prev => prev.filter(item => item.id !== id));
    };

    const clearCompletedUploads = () => {
        setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
    };

    // Smart upload features
    const handlePasteFromClipboard = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handleMultipleFiles([file]);
                }
            }
        }
    };

    const handleMultipleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        handleMultipleFiles(files);
        e.target.value = ''; // Reset input
    };

    const handleFolderSelect = (e) => {
        const files = Array.from(e.target.files);
        handleMultipleFiles(files);
        e.target.value = ''; // Reset input
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const getFileIcon = (filename) => {
        const ext = filename.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return <FiImage />;
        if (['pdf'].includes(ext)) return <FiFileText />;
        if (['doc', 'docx', 'txt'].includes(ext)) return <FiFileText />;
        return <FiFile />;
    };

    // Initialize today's stats (you can enhance this with localStorage or API)
    useEffect(() => {
        const today = new Date().toDateString();
        const savedStats = localStorage.getItem(`uploadStats_${today}`);
        if (savedStats) {
            setUploadStats(JSON.parse(savedStats));
        }
    }, []);

    // Save stats when they change
    useEffect(() => {
        const today = new Date().toDateString();
        localStorage.setItem(`uploadStats_${today}`, JSON.stringify(uploadStats));
    }, [uploadStats]);

    // Add keyboard shortcuts and clipboard listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'v') {
                    // Paste functionality is handled by onPaste event
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('paste', handlePasteFromClipboard);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('paste', handlePasteFromClipboard);
        };
    }, []);

    return (
        <div className="space-y-6">
            {/* Upload Statistics Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-lg border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <FiUpload className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-600">{uploadStats.todayUploads}</div>
                            <div className="text-sm text-gray-600">Today's Uploads</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-lg border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                            <FiFile className="text-green-600" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">
                                {formatFileSize(uploadStats.todayStorage)}
                            </div>
                            <div className="text-sm text-gray-600">Storage Used Today</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-lg border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-full">
                            <FiCheck className="text-purple-600" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-600">{uploadStats.successRate}%</div>
                            <div className="text-sm text-gray-600">Success Rate</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Upload Controls */}
            <div className="bg-white p-6 rounded-xl shadow-lg border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Smart Upload Options</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Multiple Files */}
                    <div>
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            onChange={handleMultipleFileSelect}
                            className="hidden"
                            id="multiple-files"
                        />
                        <label
                            htmlFor="multiple-files"
                            className="cursor-pointer flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
                        >
                            <FiFile size={20} className="text-gray-500" />
                            <div>
                                <div className="font-medium text-gray-700">Multiple Files</div>
                                <div className="text-xs text-gray-500">Select multiple files at once</div>
                            </div>
                        </label>
                    </div>

                    {/* Folder Upload */}
                    <div>
                        <input
                            type="file"
                            webkitdirectory=""
                            directory=""
                            multiple
                            ref={folderInputRef}
                            onChange={handleFolderSelect}
                            className="hidden"
                            id="folder-upload"
                        />
                        <label
                            htmlFor="folder-upload"
                            className="cursor-pointer flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all"
                        >
                            <FiFolder size={20} className="text-gray-500" />
                            <div>
                                <div className="font-medium text-gray-700">Upload Folder</div>
                                <div className="text-xs text-gray-500">Upload entire folders</div>
                            </div>
                        </label>
                    </div>

                    {/* Clipboard */}
                    <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                        <FiPaperclip size={20} className="text-gray-500" />
                        <div>
                            <div className="font-medium text-gray-700">Clipboard</div>
                            <div className="text-xs text-gray-500">Paste images (Ctrl+V)</div>
                        </div>
                    </div>
                </div>

                {/* Main Upload Area */}
                <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all
                        ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                        ${error ? 'border-red-500 bg-red-50' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <FiUpload size={48} className="mx-auto mb-4 text-gray-400" />
                    
                    <div className="mb-4">
                        <input 
                            type="file" 
                            onChange={e => e.target.files[0] && validateAndSetFile(e.target.files[0])}
                            className="hidden"
                            id="single-file-upload"
                        />
                        <label 
                            htmlFor="single-file-upload"
                            className="cursor-pointer inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                            SELECT FILE
                        </label>
                    </div>
                    
                    <p className="text-gray-600 mb-2">
                        or drag and drop your files here
                    </p>
                    <p className="text-sm text-gray-500">
                        Supports: Images, PDFs, Word, PowerPoint, Text files (Max: 100MB)
                    </p>

                    {file && (
                        <div className="mt-4 p-3 bg-gray-100 rounded-lg inline-block">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                {getFileIcon(file.name)}
                                <span>{file.name}</span>
                                <span className="text-gray-500">({formatFileSize(file.size)})</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-red-600">
                                <FiAlertCircle />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {progress > 0 && (
                        <div className="mt-4">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{progress}% uploaded</p>
                        </div>
                    )}

                    <div className="mt-4">
                        <button 
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                isUploading 
                                    ? 'bg-gray-400 cursor-not-allowed text-white' 
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                            onClick={handleUpload}
                            disabled={isUploading || (!file && uploadQueue.length === 0)}
                        >
                            {isUploading ? 'Uploading...' : `Upload ${file ? '1 File' : uploadQueue.length > 0 ? `${uploadQueue.length} Files` : ''}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Queue */}
            {uploadQueue.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-lg border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Upload Queue ({uploadQueue.length})</h3>
                        <button
                            onClick={clearCompletedUploads}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Clear Completed
                        </button>
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {uploadQueue.map(item => (
                            <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                                <div className="flex-shrink-0">
                                    {getFileIcon(item.file.name)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {item.file.name}
                                        </p>
                                        <span className="text-xs text-gray-500">
                                            {formatFileSize(item.file.size)}
                                        </span>
                                    </div>
                                    
                                    {item.status === 'uploading' && (
                                        <div className="mt-1">
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${item.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {item.error && (
                                        <p className="text-xs text-red-500 mt-1">{item.error}</p>
                                    )}
                                </div>
                                
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    {item.status === 'pending' && (
                                        <span className="text-xs text-gray-500">Pending</span>
                                    )}
                                    {item.status === 'uploading' && (
                                        <span className="text-xs text-blue-500">Uploading...</span>
                                    )}
                                    {item.status === 'completed' && (
                                        <FiCheck className="text-green-500" size={16} />
                                    )}
                                    {item.status === 'error' && (
                                        <FiAlertCircle className="text-red-500" size={16} />
                                    )}
                                    
                                    <button
                                        onClick={() => removeFromQueue(item.id)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadFile;