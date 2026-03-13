import React, { useState, useEffect } from 'react';
import api from '../api';
import LoadingSkeleton from './LoadingSkeleton';
import FileGrid from './FileGrid';
import FileList from './FileList';
import { 
  FiClock, 
  FiGrid, 
  FiList,
  FiRefreshCw,
  FiCalendar,
  FiFile
} from 'react-icons/fi';

const RecentFiles = ({ viewMode, onViewModeChange, user }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRecentFiles();
  }, []);

  const fetchRecentFiles = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      const response = await api.get('/files/recent?limit=50');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching recent files:', error);
      setError('Failed to load recent files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchRecentFiles(true);
  };

  const formatLastAccessed = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <FiClock size={32} className="text-blue-600" />
            Recent Files
          </h1>
          <p className="text-gray-600">Files you've accessed recently</p>
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
              <FiClock size={32} className="text-blue-600" />
              Recent Files
            </h1>
            <p className="text-gray-600">Files you've accessed recently</p>
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
            
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FiGrid size={16} />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FiList size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats */}
        {files.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiFile className="text-blue-600" size={20} />
              <span className="text-blue-900 font-medium">{files.length} recent files</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-blue-600" size={20} />
              <span className="text-blue-900">
                Last accessed: {formatLastAccessed(files[0]?.last_accessed_at)}
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
              <FiClock size={24} />
            </div>
            <div>
              <h3 className="text-red-900 font-semibold">Error loading recent files</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => fetchRecentFiles()}
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
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <FiClock size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No recent files</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Files you access will appear here. Start by uploading or accessing some files to see your recent activity.
          </p>
        </div>
      )}

      {/* Files Display */}
      {!loading && !error && files.length > 0 && (
        <div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {files.map(file => {
                const getFileIcon = (filename) => {
                  const ext = filename.toLowerCase().split('.').pop();
                  
                  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
                    return { icon: '🖼️', color: 'text-green-600', bg: 'bg-green-100' };
                  }
                  if (['pdf'].includes(ext)) {
                    return { icon: '📄', color: 'text-red-600', bg: 'bg-red-100' };
                  }
                  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
                    return { icon: '📝', color: 'text-blue-600', bg: 'bg-blue-100' };
                  }
                  if (['ppt', 'pptx'].includes(ext)) {
                    return { icon: '📊', color: 'text-orange-600', bg: 'bg-orange-100' };
                  }
                  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
                    return { icon: '🎬', color: 'text-purple-600', bg: 'bg-purple-100' };
                  }
                  if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
                    return { icon: '🎵', color: 'text-pink-600', bg: 'bg-pink-100' };
                  }
                  if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
                    return { icon: '📦', color: 'text-yellow-600', bg: 'bg-yellow-100' };
                  }
                  return { icon: '📁', color: 'text-gray-600', bg: 'bg-gray-100' };
                };

                const formatFileSize = (bytes) => {
                  if (bytes === 0) return '0 Bytes';
                  const k = 1024;
                  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                };

                const { icon, color, bg } = getFileIcon(file.filename);

                return (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-200"
                  >
                    {/* File Icon */}
                    <div className={`w-16 h-16 ${bg} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                      <span className="text-2xl">{icon}</span>
                    </div>
                    
                    {/* File Info */}
                    <div className="text-center">
                      <h3 className="font-medium text-gray-900 text-sm truncate mb-1" title={file.filename}>
                        {file.filename}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        {formatFileSize(file.filesize)}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        {formatLastAccessed(file.last_accessed_at)}
                      </p>
                      {file.folder_name && (
                        <p className="text-xs text-gray-400 mt-1">
                          📁 {file.folder_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {files.map(file => {
                  const getFileIcon = (filename) => {
                    const ext = filename.toLowerCase().split('.').pop();
                    
                    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
                      return '🖼️';
                    }
                    if (['pdf'].includes(ext)) {
                      return '📄';
                    }
                    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
                      return '📝';
                    }
                    if (['ppt', 'pptx'].includes(ext)) {
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

                  const formatFileSize = (bytes) => {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                  };

                  return (
                    <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* File Icon */}
                        <div className="text-2xl">
                          {getFileIcon(file.filename)}
                        </div>
                        
                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {file.filename}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>{formatFileSize(file.filesize)}</span>
                            <span>•</span>
                            <span>{formatLastAccessed(file.last_accessed_at)}</span>
                            {file.folder_name && (
                              <>
                                <span>•</span>
                                <span>📁 {file.folder_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentFiles;