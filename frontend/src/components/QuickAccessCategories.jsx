import React, { useState, useEffect } from 'react';
import api from '../api';
import LoadingSkeleton from './LoadingSkeleton';
import FileGrid from './FileGrid';
import FileList from './FileList';
import { 
  FiImage, 
  FiFileText, 
  FiVideo,
  FiMusic,
  FiArchive,
  FiGrid, 
  FiList,
  FiRefreshCw,
  FiCalendar,
  FiFile,
  FiBarChart2
} from 'react-icons/fi';

const QuickAccessCategories = ({ category, viewMode, onViewModeChange, user }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [downloadingFile, setDownloadingFile] = useState(null);

  // Category configurations
  const categoryConfig = {
    images: {
      title: 'Images',
      icon: FiImage,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    documents: {
      title: 'Documents',
      icon: FiFileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    videos: {
      title: 'Videos',
      icon: FiVideo,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    audio: {
      title: 'Audio Files',
      icon: FiMusic,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    },
    others: {
      title: 'Other Files',
      icon: FiArchive,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    }
  };

  const config = categoryConfig[category] || categoryConfig.documents;

  useEffect(() => {
    fetchCategoryFiles();
  }, [category]);

  const fetchCategoryFiles = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      const response = await api.get(`/files/category/${category}?limit=100`);
      setFiles(response.data.files);
    } catch (error) {
      console.error(`Error fetching ${category} files:`, error);
      setError(`Failed to load ${category} files`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchCategoryFiles(true);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename, mimetype) => {
    // For images, show preview if possible, otherwise use generic icon
    if (mimetype && mimetype.startsWith('image/')) {
      return '🖼️';
    }
    
    const ext = filename.toLowerCase().split('.').pop();
    
    if (['pdf'].includes(ext)) {
      return '📄';
    }
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return '📝';
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return '📊';
    }
    if (['xls', 'xlsx'].includes(ext)) {
      return '📊';
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return '🎬';
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
      return '🎵';
    }
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
      return '📦';
    }
    return '📁';
  };

  const IconComponent = config.icon;

  // File action handlers
  const handleFileSelect = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleFileDownload = async (file) => {
    try {
      setDownloadingFile(file.id);
      const response = await api.get(`/files/download/${file.id}`, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleFilePreview = (file) => {
    // Open file preview (you can implement preview modal here)
    window.open(`${import.meta.env.VITE_API_URL}/files/preview/${file.id}`, '_blank');
  };

  const handleFileDelete = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await api.delete(`/files/${fileId}`);
        fetchCategoryFiles(true); // Refresh the list
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleFileFavorite = async (fileId, isFavorite) => {
    try {
      if (isFavorite) {
        await api.post(`/files/${fileId}/favorite`);
      } else {
        await api.delete(`/files/${fileId}/favorite`);
      }
      fetchCategoryFiles(true); // Refresh the list
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3`}>
            <IconComponent size={32} className={config.color} />
            {config.title}
          </h1>
          <p className="text-gray-600">Your {config.title.toLowerCase()} collection</p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <IconComponent size={32} className={config.color} />
              {config.title}
            </h1>
            <p className="text-gray-600">Your {config.title.toLowerCase()} collection</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Stats */}
        {files.length > 0 && (
          <div className={`${config.bgColor} ${config.borderColor} border rounded-xl p-4 flex items-center gap-4`}>
            <div className="flex items-center gap-2">
              <FiFile className={config.color} size={20} />
              <span className={`${config.color} font-medium`}>{files.length} {config.title.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className={config.color} size={20} />
              <span className={config.color}>
                Total size: {files.reduce((sum, file) => sum + (parseInt(file.filesize) || 0), 0) > 0 
                  ? formatFileSize(files.reduce((sum, file) => sum + (parseInt(file.filesize) || 0), 0))
                  : '0 Bytes'
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-red-600">
              <IconComponent size={24} />
            </div>
            <div>
              <h3 className="text-red-900 font-semibold">Error loading {config.title.toLowerCase()}</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => fetchCategoryFiles()}
                className="mt-2 text-red-600 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && files.length === 0 && (
        <div className="text-center py-16">
          <div className={`mx-auto w-24 h-24 ${config.bgColor} rounded-full flex items-center justify-center mb-6`}>
            <IconComponent size={32} className={`${config.color} opacity-60`} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No {config.title.toLowerCase()} found</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Upload some {config.title.toLowerCase()} to see them organized here.
          </p>
        </div>
      )}

      {/* Files Display */}
      {!loading && !error && files.length > 0 && (
        <div>
          {viewMode === 'grid' ? (
            <FileGrid 
              files={files}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onFileDownload={handleFileDownload}
              onFilePreview={handleFilePreview}
              onFileDelete={handleFileDelete}
              onFileFavorite={handleFileFavorite}
              downloadingFile={downloadingFile}
              layout="grid"
              isLoading={loading}
            />
          ) : (
            <FileList
              files={files}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onFileDownload={handleFileDownload}
              onFilePreview={handleFilePreview}
              onFileDelete={handleFileDelete}
              onFileFavorite={handleFileFavorite}
              downloadingFile={downloadingFile}
              layout="list"
              isLoading={loading}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default QuickAccessCategories;