import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiDownload, FiEye, FiLock, FiAlertCircle, FiUser, FiCalendar, FiFile, FiBarChart, FiShare2 } from 'react-icons/fi';
import api from '../api';

const PublicShareViewer = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    if (token) {
      fetchShareData();
    }
  }, [token]);

  const fetchShareData = async (sharePassword = '') => {
    try {
      setLoading(true);
      setError('');
      
      const url = `/api/shares/share/${token}${sharePassword ? `?password=${encodeURIComponent(sharePassword)}` : ''}`;
      
      // Try multiple backend URLs for better compatibility
      const backendUrls = [
        import.meta.env.VITE_BACKEND_URL,
        `http://localhost:5000`,
        `http://192.168.0.5:5000`,
        `http://10.0.0.0:5000` // This will be dynamically detected
      ].filter(Boolean);
      
      let response = null;
      let lastError = null;
      
      for (const backendUrl of backendUrls) {
        try {
          response = await fetch(`${backendUrl}${url}`);
          if (response.ok || response.status === 401) {
            break; // Success or password required (both are valid responses)
          }
        } catch (err) {
          lastError = err;
          console.warn(`Failed to connect to ${backendUrl}:`, err.message);
          continue;
        }
      }
      
      if (!response) {
        throw new Error(lastError?.message || 'Unable to connect to server');
      }
      
      const data = await response.json();

      if (response.status === 401 && data.requiresPassword) {
        setRequiresPassword(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load share');
      }

      setShareData(data);
      setRequiresPassword(false);
      
    } catch (err) {
      console.error('Share fetch error:', err);
      setError(err.message || 'Failed to load shared file');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password.trim()) {
      fetchShareData(password);
    }
  };

  const handleDownload = async () => {
    if (shareData?.share?.access_level === 'view') {
      alert('This file is shared for viewing only. Download is not permitted.');
      return;
    }

    try {
      setDownloading(true);
      
      const url = `/api/shares/share/${token}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`;
      
      // Try multiple backend URLs for better compatibility
      const backendUrls = [
        import.meta.env.VITE_BACKEND_URL,
        `http://localhost:5000`,
        `http://10.155.108.44:5000`
      ].filter(Boolean);
      
      let response = null;
      let lastError = null;
      
      for (const backendUrl of backendUrls) {
        try {
          response = await fetch(`${backendUrl}${url}`);
          if (response.ok) {
            break; // Success
          }
        } catch (err) {
          lastError = err;
          console.warn(`Failed to download from ${backendUrl}:`, err.message);
          continue;
        }
      }
      
      if (!response || !response.ok) {
        const errorData = response ? await response.json() : null;
        throw new Error(errorData?.message || lastError?.message || 'Download failed');
      }


      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = shareData?.file?.filename || 'download';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      console.error('Download error:', err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };



  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Share Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Plexus Drive
          </button>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="text-amber-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Password Protected</h2>
          <p className="text-gray-600 mb-6 text-center">This shared file requires a password to access.</p>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Access File
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return null;
  }

  const { share, file, sharedBy } = shareData;
  const canDownload = share.access_level !== 'view';
  const hasFullAccess = share.access_level === 'full';
  const isExpired = share.expires_at && new Date(share.expires_at) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Plexus Drive</h1>
              <p className="text-sm text-gray-500">Shared File</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* File Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                <FiFile size={32} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{file.filename}</h2>
                <div className="flex flex-wrap gap-4 text-blue-100">
                  <span className="flex items-center gap-1">
                    <FiFile size={16} />
                    {formatFileSize(file.filesize)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FiUser size={16} />
                    Shared by {sharedBy.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <FiEye size={16} />
                    {share.view_count} views
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* File Details */}
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Access Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 mb-3">Access Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Access Level:</span>
                    <span className="font-medium capitalize">
                      {share.access_level === 'view' ? '👁️ View Only' : 
                       share.access_level === 'download' ? '⬇️ View & Download' : 
                       share.access_level === 'full' ? '🔧 Full Access & Management' : '⬇️ View & Download'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shared:</span>
                    <span className="font-medium">{formatDate(share.created_at)}</span>
                  </div>
                  {share.expires_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires:</span>
                      <span className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatDate(share.expires_at)}
                        {isExpired && ' (Expired)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* File Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 mb-3">File Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{file.mimetype}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium">{formatFileSize(file.filesize)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 p-6">
            <div className="space-y-4">
              {/* Primary Actions */}
              <div className="flex flex-wrap gap-3">
                {canDownload && !isExpired && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <FiDownload size={16} />
                    {downloading ? 'Downloading...' : 'Download File'}
                  </button>
                )}
                
                {!canDownload && (
                  <div className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg">
                    <FiEye size={16} />
                    View Only Access
                  </div>
                )}

                {isExpired && (
                  <div className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-600 rounded-lg">
                    <FiAlertCircle size={16} />
                    Share Expired
                  </div>
                )}
              </div>

              {/* Full Access Management Actions */}
              {hasFullAccess && !isExpired && (
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">🔧 Management Actions</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowAnalytics(!showAnalytics)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <FiBarChart size={16} />
                      {showAnalytics ? 'Hide Analytics' : 'View Analytics'}
                    </button>
                    
                    <button
                      onClick={() => window.open(`mailto:?subject=Shared File: ${file.filename}&body=I'm sharing this file with you: ${window.location.href}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FiShare2 size={16} />
                      Re-share
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analytics Panel - Only for Full Access */}
          {hasFullAccess && showAnalytics && !isExpired && (
            <div className="border-t border-gray-200 bg-gray-50 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">📊 Share Analytics</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-blue-600">{share.view_count || 0}</div>
                  <div className="text-sm text-gray-600">Total Views</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-green-600">{share.download_count || 0}</div>
                  <div className="text-sm text-gray-600">Downloads</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-purple-600">{formatDate(share.created_at)}</div>
                  <div className="text-sm text-gray-600">Created On</div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">Share Information</h5>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Share Token:</strong> {token}</p>
                  <p><strong>Public URL:</strong> {window.location.href}</p>
                  <p><strong>File Size:</strong> {formatFileSize(file.filesize)}</p>
                  <p><strong>File Type:</strong> {file.mimetype}</p>
                  {share.expires_at && <p><strong>Expires:</strong> {formatDate(share.expires_at)}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500">
          <p>Powered by Plexus Drive - Secure File Sharing</p>
        </div>
      </div>
    </div>
  );
};

export default PublicShareViewer;