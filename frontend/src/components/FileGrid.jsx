import React, { useState } from 'react';
import { 
  FiFile, 
  FiImage, 
  FiFileText, 
  FiVideo, 
  FiMusic, 
  FiArchive,
  FiMoreVertical,
  FiDownload,
  FiShare2,
  FiTrash2,
  FiStar,
  FiEye,
  FiFolder
} from 'react-icons/fi';
import FileActionsDropdown from './FileActionsDropdown';
import MediaPlayer from './MediaPlayer';

const FileGrid = ({ 
  files = [], 
  viewMode = 'grid', 
  onFileSelect, 
  selectedFiles = [],
  onFileDownload,
  onFilePreview,
  onFileDelete,
  downloadingFile = null,
  onContentAnalysis,
  onShareRequest,
  onFileFavorite,
  onMoveToFolder,
  onRemoveFromFolder,
  currentFolderId = null,
  showLastAccessed = false,
  formatLastAccessed
}) => {
  const [showMediaPlayer, setShowMediaPlayer] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);

  // Check if file is video or audio
  const isMediaFile = (mimetype) => {
    return mimetype.startsWith('video/') || mimetype.startsWith('audio/');
  };

  // Handle file preview with media player for video/audio
  const handleFilePreview = (file) => {
    console.log(`🖱️ Preview requested for file:`, {
      id: file.id,
      filename: file.filename,
      mimetype: file.mimetype,
      filesize: file.filesize
    });
    
    if (isMediaFile(file.mimetype)) {
      // Validate file has required properties
      if (!file.id || !file.filename || !file.mimetype) {
        console.error('❌ Invalid file object for media preview:', file);
        alert('Error: Invalid file data. Cannot preview this file.');
        return;
      }
      
      setSelectedMediaFile(file);
      setShowMediaPlayer(true);
    } else {
      // Use default preview for other files
      onFilePreview?.(file);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
      return { icon: FiImage, color: 'text-green-600', bg: 'bg-green-100' };
    }
    if (['pdf'].includes(ext)) {
      return { icon: FiFileText, color: 'text-red-600', bg: 'bg-red-100' };
    }
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return { icon: FiFileText, color: 'text-blue-600', bg: 'bg-blue-100' };
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return { icon: FiFileText, color: 'text-orange-600', bg: 'bg-orange-100' };
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return { icon: FiVideo, color: 'text-purple-600', bg: 'bg-purple-100' };
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
      return { icon: FiMusic, color: 'text-indigo-600', bg: 'bg-indigo-100' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return { icon: FiArchive, color: 'text-yellow-600', bg: 'bg-yellow-100' };
    }
    
    return { icon: FiFile, color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <FiFile size={64} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-400 mb-2">No files found</h3>
        <p className="text-sm text-gray-400">Upload your first file to get started</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className={`grid ${showLastAccessed ? 'grid-cols-13' : 'grid-cols-12'} gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700`}>
          <div className="col-span-1"></div>
          <div className={showLastAccessed ? 'col-span-4' : 'col-span-5'}>Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          {showLastAccessed && <div className="col-span-2">Last Accessed</div>}
          <div className="col-span-2">Actions</div>
        </div>

        {/* Files */}
        <div className="divide-y divide-gray-100">
          {files.map((file) => {
            const { icon: Icon, color, bg } = getFileIcon(file.filename);
            const isSelected = selectedFiles.includes(file.id);

            return (
              <div
                key={file.id}
                data-file-id={file.id}
                className={`grid ${showLastAccessed ? 'grid-cols-13' : 'grid-cols-12'} gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => onFileSelect?.(file.id)}
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onFileSelect?.(file.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Name with Icon */}
                <div className={`${showLastAccessed ? 'col-span-4' : 'col-span-5'} flex items-center gap-3`}>
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.filename.split('.').pop()?.toUpperCase()} file
                    </p>
                  </div>
                </div>

                {/* Size */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-gray-600">
                    {formatFileSize(file.filesize)}
                  </span>
                </div>

                {/* Modified */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-gray-600">
                    {formatDate(file.created_at)}
                  </span>
                </div>

                {/* Last Accessed */}
                {showLastAccessed && (
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-600">
                      {file.last_accessed_at ? formatLastAccessed(file.last_accessed_at) : 'Never'}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileFavorite?.(file.id, !file.is_favorite);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      file.is_favorite 
                        ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                    }`}
                    title={file.is_favorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <FiStar size={16} className={file.is_favorite ? 'fill-current' : ''} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilePreview(file);
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Preview file"
                  >
                    <FiEye size={16} className="text-gray-500" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDownload?.(file);
                    }}
                    disabled={downloadingFile === file.id}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Download file"
                  >
                    <FiDownload size={16} className={downloadingFile === file.id ? "text-blue-500" : "text-gray-500"} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDelete?.(file.id);
                    }}
                    className="p-2 hover:bg-red-200 rounded-lg transition-colors"
                    title="Delete file"
                  >
                    <FiTrash2 size={16} className="text-gray-500 hover:text-red-600" />
                  </button>
                  <FileActionsDropdown
                    file={file}
                    onContentAnalysis={onContentAnalysis}
                    onShareRequest={onShareRequest}
                    onMoveToFolder={onMoveToFolder}
                    onRemoveFromFolder={onRemoveFromFolder}
                    isInFolder={currentFolderId !== null}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {/* Files */}
      {files.map((file) => {
        const { icon: Icon, color, bg } = getFileIcon(file.filename);
        const isSelected = selectedFiles.includes(file.id);

        return (
          <div
            key={file.id}
            data-file-id={file.id}
            className={`group relative bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:z-[100] cursor-pointer ${
              isSelected 
                ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300'
            } ${file.id === window.highlightedFileId ? 'search-highlight animate-pulse' : ''}`}
            onClick={() => onFileSelect?.(file.id)}
          >
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onFileSelect?.(file.id);
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            {/* Favorite Star */}
            <div className="absolute top-3 right-12 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileFavorite?.(file.id, !file.is_favorite);
                }}
                className={`p-2 rounded-full transition-all duration-200 ${
                  file.is_favorite 
                    ? 'text-yellow-500 bg-yellow-50 shadow-md scale-100' 
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 opacity-0 group-hover:opacity-100 hover:scale-110'
                }`}
                title={file.is_favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <FiStar 
                  size={16} 
                  className={file.is_favorite ? 'fill-current' : ''} 
                />
              </button>
            </div>

            {/* Actions Menu */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-[9999]">
              <div className="bg-white rounded-full shadow-md">
                <FileActionsDropdown 
                  file={file}
                  onContentAnalysis={onContentAnalysis}
                  onShareRequest={onShareRequest}
                  onMoveToFolder={onMoveToFolder}
                  onRemoveFromFolder={onRemoveFromFolder}
                  isInFolder={currentFolderId !== null}
                />
              </div>
            </div>

            {/* File Content */}
            <div className="p-4">
              {/* File Icon */}
              <div className="flex justify-center mb-4">
                <div className={`p-4 rounded-2xl ${bg}`}>
                  <Icon size={32} className={color} />
                </div>
              </div>

              {/* File Info */}
              <div className="text-center space-y-1">
                <h3 className="text-sm font-medium text-gray-900 truncate" title={file.filename}>
                  {file.filename}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(file.filesize)}</span>
                  <span>{formatDate(file.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Hover Actions */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-b-xl p-3">
              <div className="flex justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileFavorite?.(file.id, !file.is_favorite);
                  }}
                  className={`p-2 backdrop-blur-sm rounded-lg transition-colors ${
                    file.is_favorite 
                      ? 'bg-yellow-500/30 hover:bg-yellow-500/40' 
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title={file.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <FiStar size={16} className={file.is_favorite ? 'text-yellow-300 fill-current' : 'text-white'} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFilePreview(file);
                  }}
                  className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                  title="Preview file"
                >
                  <FiEye size={16} className="text-white" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileDownload?.(file);
                  }}
                  disabled={downloadingFile === file.id}
                  className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                  title="Download file"
                >
                  <FiDownload size={16} className={downloadingFile === file.id ? "text-blue-300" : "text-white"} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileDelete?.(file.id);
                  }}
                  className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-red-500/30 transition-colors"
                  title="Delete file"
                >
                  <FiTrash2 size={16} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    
    {/* Media Player Modal */}
    {showMediaPlayer && selectedMediaFile && (
      <MediaPlayer
        file={selectedMediaFile}
        onClose={() => {
          setShowMediaPlayer(false);
          setSelectedMediaFile(null);
        }}
        onDownload={(file) => {
          onFileDownload?.(file);
          setShowMediaPlayer(false);
          setSelectedMediaFile(null);
        }}
      />
    )}
    </>
  );
};

export default FileGrid;