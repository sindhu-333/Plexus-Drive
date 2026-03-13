import React, { useState, useEffect } from 'react';
import api from '../api';
import LoadingSkeleton from './LoadingSkeleton';
import { 
  FiUsers, 
  FiGrid, 
  FiList,
  FiRefreshCw,
  FiCalendar,
  FiFile,
  FiShare2,
  FiDownload,
  FiEye,
  FiClock,
  FiMail,
  FiUser
} from 'react-icons/fi';

const SharedWithMe = ({ viewMode, onViewModeChange, user }) => {
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [mySharedFiles, setMySharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('shared-with-me'); // 'shared-with-me' or 'my-shares'

  useEffect(() => {
    fetchAllSharedFiles();
  }, []);

  const fetchAllSharedFiles = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      // Fetch files shared with me
      const sharedWithMeResponse = await api.get('/shares/shared-with-me?limit=50');
      console.log('Shared with me data:', sharedWithMeResponse.data.files);
      setSharedWithMe(sharedWithMeResponse.data.files || []);

      // Fetch files I have shared
      try {
        const mySharesResponse = await api.get('/shares/my-shares?limit=50');
        console.log('My shares data:', mySharesResponse.data.files);
        setMySharedFiles(mySharesResponse.data.files || []);
      } catch (mySharesError) {
        console.log('My shares endpoint error:', mySharesError);
        setMySharedFiles([]);
      }
      
    } catch (error) {
      console.error('Error fetching shared files:', error);
      setError('Failed to load shared files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAllSharedFiles(true);
  };

  const getCurrentFiles = () => {
    const files = activeTab === 'shared-with-me' ? sharedWithMe : mySharedFiles;
    console.log(`Getting files for tab ${activeTab}:`, files);
    return files;
  };

  const getCurrentCount = () => {
    return activeTab === 'shared-with-me' ? sharedWithMe.length : mySharedFiles.length;
  };

  const handleTabChange = (newTab) => {
    console.log(`Switching from ${activeTab} to ${newTab}`);
    setActiveTab(newTab);
    // Optional: Could re-fetch data when switching tabs for fresh data
    // fetchAllSharedFiles(true);
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

  const getAccessLevelColor = (accessLevel) => {
    switch (accessLevel) {
      case 'view': return 'bg-blue-100 text-blue-700';
      case 'download': return 'bg-green-100 text-green-700';
      case 'full': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getShareTypeColor = (shareType) => {
    switch (shareType) {
      case 'public': return 'bg-orange-100 text-orange-700';
      case 'email': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <FiUsers size={32} className="text-purple-600" />
            Shared With Me
          </h1>
          <p className="text-gray-600">Files that others have shared with you</p>
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
              <FiUsers size={32} className="text-purple-600" />
              File Sharing
            </h1>
            <p className="text-gray-600">
              {activeTab === 'shared-with-me' 
                ? 'Files that others have shared with you' 
                : 'Files you have shared with others'
              }
            </p>
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
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FiGrid size={16} />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FiList size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => handleTabChange('shared-with-me')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all ${
              activeTab === 'shared-with-me'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiDownload size={16} />
            Shared With Me ({sharedWithMe.length})
          </button>
          <button
            onClick={() => handleTabChange('my-shares')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all ${
              activeTab === 'my-shares'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiShare2 size={16} />
            My Shares ({mySharedFiles.length})
          </button>
        </div>

        {/* Stats */}
        {getCurrentFiles().length > 0 && (
          <div className="bg-purple-50 rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiFile className="text-purple-600" size={20} />
              <span className="text-purple-900 font-medium">
                {getCurrentCount()} {activeTab === 'shared-with-me' ? 'files shared with you' : 'files you shared'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FiCalendar className="text-purple-600" size={20} />
              <span className="text-purple-900">
                Latest: {formatDate(getCurrentFiles()[0]?.shared_at)}
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
              <FiUsers size={24} />
            </div>
            <div>
              <h3 className="text-red-900 font-semibold">Error loading shared files</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => fetchSharedFiles()}
                className="mt-2 text-red-600 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && getCurrentFiles().length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-6">
            {activeTab === 'shared-with-me' ? (
              <FiDownload size={32} className="text-purple-400" />
            ) : (
              <FiShare2 size={32} className="text-purple-400" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {activeTab === 'shared-with-me' ? 'No files shared with you' : 'No files shared by you'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {activeTab === 'shared-with-me' 
              ? 'When others share files with your email address, they will appear here.'
              : 'Files you share with others will appear here. Start sharing to see your shared files.'
            }
          </p>
        </div>
      )}

      {/* Files Display */}
      {!loading && !error && getCurrentFiles().length > 0 && (
        <div key={activeTab}>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {getCurrentFiles().map(file => (
                <div
                  key={file.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-200"
                >
                  {/* File Icon */}
                  <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                    <span className="text-2xl">{getFileIcon(file.filename)}</span>
                  </div>
                  
                  {/* File Info */}
                  <div className="text-center">
                    <h3 className="font-medium text-gray-900 text-sm truncate mb-2" title={file.filename}>
                      {file.filename}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">
                      {formatFileSize(file.filesize)}
                    </p>
                    
                    {/* Share Info */}
                    <div className="space-y-1 mb-3">
                      {activeTab === 'shared-with-me' ? (
                        <div className="flex items-center justify-center gap-2">
                          <FiUser size={12} className="text-purple-500" />
                          <span className="text-xs text-purple-600 font-medium">
                            {file.shared_by_username}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <FiMail size={12} className="text-purple-500" />
                          <span className="text-xs text-purple-600 font-medium">
                            {file.shared_with_email}
                          </span>
                        </div>
                      )}
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(file.access_level)}`}>
                        <FiShare2 size={10} />
                        {file.access_level} access
                      </div>
                      {activeTab === 'my-shares' && (
                        <div className="flex justify-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">👁️ {file.view_count || 0}</span>
                          <span className="text-xs text-gray-500">⬇️ {file.download_count || 0}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-400">
                      Shared {formatDate(file.shared_at)}
                    </p>
                    
                    {file.expires_at && (
                      <p className="text-xs text-orange-600 mt-1">
                        Expires {formatDate(file.expires_at)}
                      </p>
                    )}
                    
                    {file.message && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                        "{file.message}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {getCurrentFiles().map(file => (
                  <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* File Icon */}
                      <div className="text-2xl">
                        {getFileIcon(file.filename)}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 truncate">
                            {file.filename}
                          </h3>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(file.access_level)}`}>
                              {file.access_level}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getShareTypeColor(file.share_type)}`}>
                              {file.share_type}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{formatFileSize(file.filesize)}</span>
                          <span>•</span>
                          {activeTab === 'shared-with-me' ? (
                            <div className="flex items-center gap-1">
                              <FiUser size={12} />
                              <span>Shared by {file.shared_by_username}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <FiMail size={12} />
                              <span>Shared with {file.shared_with_email}</span>
                            </div>
                          )}
                          <span>•</span>
                          <span>{formatDate(file.shared_at)}</span>
                          {activeTab === 'my-shares' && (
                            <>
                              <span>•</span>
                              <span>👁️ {file.view_count || 0} views</span>
                              <span>•</span>
                              <span>⬇️ {file.download_count || 0} downloads</span>
                            </>
                          )}
                          {file.expires_at && (
                            <>
                              <span>•</span>
                              <span className="text-orange-600">Expires {formatDate(file.expires_at)}</span>
                            </>
                          )}
                        </div>
                        
                        {file.message && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                            <FiMail size={14} className="inline mr-1" />
                            "{file.message}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SharedWithMe;