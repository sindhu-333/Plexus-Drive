import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { FiDownload, FiTrash2, FiEye, FiShare2, FiUsers, FiGlobe } from 'react-icons/fi';
import FileActionsDropdown from './FileActionsDropdown';
import AnalysisResultsModal from './AnalysisResultsModal';
import ShareModal from './ShareModal';
import MediaPlayer from './MediaPlayer';

const FileList = ({ 
  files, 
  selectedFiles, 
  setSelectedFiles, 
  fetchFiles, 
  showLastAccessed = false, 
  formatLastAccessed 
}) => {
  const [deletingFile, setDeletingFile] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [isConverted, setIsConverted] = useState(false);
  const allCheckboxRef = useRef(null);
  
  // Analysis modal state
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisFile, setAnalysisFile] = useState(null);

  // Share modal state - GLOBAL for all files
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFile, setShareFile] = useState(null);

  // Media player state
  const [showMediaPlayer, setShowMediaPlayer] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);

  // Debug state changes
  console.log('📊 FileList render - showAnalysisModal:', showAnalysisModal, 'analysisFile:', analysisFile?.filename || 'none');
  console.log('🔗 FileList render - showShareModal:', showShareModal, 'shareFile:', shareFile?.filename || 'none');

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  // Manage select all checkbox state
  useEffect(() => {
    if (allCheckboxRef.current) {
      const allSelected = selectedFiles.length === files.length;
      const someSelected = selectedFiles.length > 0 && !allSelected;
      allCheckboxRef.current.checked = allSelected;
      allCheckboxRef.current.indeterminate = someSelected;
    }
  }, [selectedFiles, files]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const toggleSelection = (id) => {
    setSelectedFiles(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedFiles(files.map(f => f.id));
    else setSelectedFiles([]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      setDeletingFile(id);
      await api.delete(`/files/${id}`);
      fetchFiles();
      setSelectedFiles(prev => prev.filter(selectedId => selectedId !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete file');
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDownload = async (file) => {
    try {
      setDownloadingFile(file.id);
      setError('');
      const response = await api.get(`/files/download/${file.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedFiles.length} selected file(s)?`)) return;
    try {
      await api.post('/files/deleteMany', { ids: selectedFiles });
      fetchFiles();
      setSelectedFiles([]);
      window.alert(`${selectedFiles.length} file(s) deleted successfully.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete selected files');
    }
  };

  const handleBulkDownload = async () => {
    try {
      const response = await api.post('/files/downloadMany', { ids: selectedFiles }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'selected-files.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      window.alert(`${selectedFiles.length} file(s) downloaded successfully as ZIP.`);
      setSelectedFiles([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download selected files');
    }
  };

  const handlePreview = async (file) => {
  try {
    // Check if it's a media file and use media player
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      setSelectedMediaFile(file);
      setShowMediaPlayer(true);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // xlsx
    ];

    let response, blob;

    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
      blob = response.data;
      setPreviewType(file.mimetype === "application/pdf" ? "pdf" : "image");
      setIsConverted(false);

    } else if (file.mimetype.startsWith("text/") || ["application/json", "application/xml", "text/plain"].includes(file.mimetype)) {
      response = await api.get(`/files/preview/${file.id}`, { responseType: "text" });
      setPreviewType("text");
      setPreviewContent(response.data);
      setIsConverted(false);

    } else if (officeTypes.includes(file.mimetype)) {
      // Convert Office file to PDF
      response = await api.get(`/files/convert/${file.id}`, { responseType: "blob" });
      blob = response.data;
      setPreviewType("pdf");
      setIsConverted(true);

    } else if (file.mimetype.startsWith("video/")) {
      response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
      blob = response.data;
      setPreviewType("video");
      setIsConverted(false);

    } else if (file.mimetype.startsWith("audio/")) {
      response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
      blob = response.data;
      setPreviewType("audio");
      setIsConverted(false);

    } else {
      // Fallback: try converting to PDF
      response = await api.get(`/files/convert/${file.id}`, { responseType: "blob" });
      blob = response.data;
      setPreviewType("pdf");
      setIsConverted(true);
    }

    if (blob) setPreviewUrl(URL.createObjectURL(blob));
    setPreviewFile(file);
    setShowPreview(true);

  } catch (err) {
    console.error("Preview error:", err);
    setPreviewType("unsupported");
    setShowPreview(true);
    setIsConverted(false);
  }
};

  // Handle content analysis
  const handleContentAnalysis = (file) => {
    console.log('🔍 handleContentAnalysis called with file:', file?.filename || 'NO FILE');
    console.log('📋 Setting analysisFile to:', file);
    console.log('🚪 Setting showAnalysisModal to: true');
    setAnalysisFile(file);
    setShowAnalysisModal(true);
  };

  const handleShareRequest = (file) => {
    console.log('🔗 handleShareRequest called with file:', file?.filename || 'NO FILE');
    console.log('📋 Setting shareFile to:', file);
    console.log('🚪 Setting showShareModal to: true');
    setShareFile(file);
    setShowShareModal(true);
  };

  const handleFileShared = (file, shareData) => {
    console.log('🔗 File shared:', file?.filename, 'Share data:', shareData);
    // Close the modal and refresh files
    setShowShareModal(false);
    setShareFile(null);
    fetchFiles();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-400';
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-400';
      case 'processing': return 'bg-blue-400';
      case 'completed': return 'bg-green-400';
      case 'failed': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  // ===========================
  // Smart Auto-Refresh
  // ===========================
  useEffect(() => {
    const interval = setInterval(async () => {
      if (deletingFile || downloadingFile) return;
      try {
        const response = await api.get('/files/list');
        const latestFiles = response.data;

        const hasChange =
          latestFiles.length !== files.length ||
          latestFiles.some((file, idx) => files[idx]?.analysis_status !== file.analysis_status);

        if (hasChange) fetchFiles();
      } catch (err) {
        console.error('Auto-refresh error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [files, deletingFile, downloadingFile, fetchFiles]);

  if (files.length === 0) return <p className="text-center py-8 text-gray-500">No files uploaded yet</p>;

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}

      {/* Select All & Bulk Actions */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" ref={allCheckboxRef} onChange={handleSelectAll} className="rounded accent-blue-500 w-5 h-5" />
          <span className="text-sm text-gray-700">
            Select All ({selectedFiles.length} / {files.length})
          </span>
        </label>

        {selectedFiles.length > 1 && (
          <div className="flex gap-3">
            <button onClick={handleBulkDelete} className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-lg">Delete ({selectedFiles.length})</button>
            <button onClick={handleBulkDownload} className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-lg">Download ({selectedFiles.length})</button>
          </div>
        )}
      </div>

      {/* File Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {files.map(file => (
          <div 
            key={file.id} 
            data-file-id={file.id}
            className={`relative bg-white backdrop-blur-md border border-white rounded-xl p-4 shadow-lg hover:shadow-2xl transform transition-all flex flex-col justify-between ${
              selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
          >
            {/* Share indicator - Top Left Corner */}
            {file.is_shared && (
              <div className="absolute top-2 left-2">
                <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg" title={`Shared with ${file.share_count} ${file.share_count === 1 ? 'person' : 'people'}`}>
                  <FiGlobe size={12} />
                </div>
              </div>
            )}
            
            {/* Three-dot dropdown menu - Top Right Corner */}
            <div className="absolute top-2 right-2">
              <FileActionsDropdown
                file={file}
                onContentAnalysis={handleContentAnalysis}
                onShareRequest={handleShareRequest}
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-4">
              <div className={`flex items-center gap-2 pr-8 ${file.is_shared ? 'pl-8' : ''}`}>
                <input type="checkbox" checked={selectedFiles.includes(file.id)} onChange={() => toggleSelection(file.id)} className="rounded-md accent-blue-500 w-5 h-5"/>
                <h3 className="font-semibold text-gray-900 truncate">{file.filename}</h3>
                <span className="text-xs text-gray-700 ml-auto">{formatFileSize(file.filesize)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`px-3 py-1 rounded-full text-white font-medium text-xs ${getStatusColor(file.analysis_status)}`}>{file.analysis_status || 'Uploaded'}</span>
                {file.is_shared && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                    <FiShare2 size={10} />
                    Shared
                    {file.share_count > 0 && (
                      <span className="bg-blue-200 text-blue-800 rounded-full px-1.5 py-0.5 text-xs font-bold ml-1">
                        {file.share_count}
                      </span>
                    )}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-gray-200 rounded-full text-gray-700 text-xs">{file.mimetype?.split('/')[1] || 'unknown'}</span>
                <span className="px-2 py-0.5 bg-gray-200 rounded-full text-gray-700 text-xs">{new Date(file.created_at).toLocaleDateString()}</span>
                {showLastAccessed && file.last_accessed_at && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    Accessed {formatLastAccessed(file.last_accessed_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto">
              {/* Quick action buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePreview(file)} 
                  className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  title="Preview"
                >
                  <FiEye size={16}/>
                </button>
                <button 
                  onClick={() => handleDownload(file)} 
                  disabled={downloadingFile === file.id} 
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-white transition-colors ${
                    downloadingFile === file.id ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  title="Download"
                >
                  <FiDownload size={16}/>
                </button>
                <button 
                  onClick={() => handleDelete(file.id)} 
                  disabled={deletingFile === file.id} 
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-white transition-colors ${
                    deletingFile === file.id ? 'bg-gray-300' : 'bg-red-500 hover:bg-red-600'
                  }`}
                  title="Delete"
                >
                  <FiTrash2 size={16}/>
                </button>
              </div>
              
              {/* Debug: Check if handler exists */}
              {console.log('🔧 handleContentAnalysis function:', typeof handleContentAnalysis, handleContentAnalysis)}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Preview Modal */}
      {showPreview && previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-2 sm:p-4 overflow-auto">
          <div className="relative w-full h-full sm:w-[95%] sm:h-[95%] bg-white rounded-xl shadow-2xl flex flex-col">
            <button onClick={() => {
              setShowPreview(false); setPreviewFile(null); setPreviewContent('');
              if(previewUrl){ URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }
              setIsConverted(false);
            }} className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg">Close</button>

            <h3 className="text-lg sm:text-xl font-semibold text-center mt-8 sm:mt-12 mb-4 px-2 truncate">{previewFile.filename}</h3>

            {isConverted && <p className="text-center text-sm text-gray-600 mb-2">Converted to PDF only for preview as this file type is unsupported for preview.</p>}

            <div className="flex-1 overflow-auto flex justify-center items-center p-2">
              {previewType==='image' && <img src={previewUrl} alt={previewFile.filename} className="max-w-full max-h-full object-contain rounded-lg shadow-md"/>}
              {previewType==='pdf' && <iframe src={previewUrl} className="w-full h-full border-none rounded-lg" title={previewFile.filename}/>}
              {previewType==='text' && <pre className="whitespace-pre-wrap text-sm sm:text-base bg-gray-100 p-4 rounded max-w-full max-h-full overflow-auto">{previewContent}</pre>}
              {previewType==='video' && <video src={previewUrl} controls className="w-full h-full"/>}
              {previewType==='audio' && <audio src={previewUrl} controls className="w-full"/>}
              {previewType==='binary' && <iframe src={previewUrl} className="w-full h-full border-none rounded-lg" title={previewFile.filename}/>}
              {previewType==='unsupported' && <p className="text-gray-700">Preview not available. Please download to view.</p>}
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Results Modal */}
      <AnalysisResultsModal
        file={analysisFile}
        isOpen={showAnalysisModal}
        onClose={() => {
          setShowAnalysisModal(false);
          setAnalysisFile(null);
        }}
      />

      {/* Share Modal - GLOBAL for all files */}
      <ShareModal
        file={shareFile}
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareFile(null);
        }}
        onShareCreated={(shareData) => {
          console.log('📤 Share created:', shareData);
          handleFileShared(shareFile, shareData);
        }}
      />

      {/* Media Player Modal */}
      {showMediaPlayer && selectedMediaFile && (
        <MediaPlayer
          file={selectedMediaFile}
          onClose={() => {
            setShowMediaPlayer(false);
            setSelectedMediaFile(null);
          }}
          onDownload={(file) => {
            handleDownload(file.id);
            setShowMediaPlayer(false);
            setSelectedMediaFile(null);
          }}
        />
      )}
    </div>
  );
};

export default FileList;     
