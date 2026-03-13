import React, { useState, useEffect } from 'react';
import { 
  FiX, 
  FiTrash2, 
  FiClock, 
  FiHardDrive, 
  FiAlertTriangle,
  FiCheck,
  FiFile,
  FiFolder
} from 'react-icons/fi';
import api from '../api';

const DuplicateManagerModal = ({ isOpen, onClose, onDuplicatesDeleted }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
    }
  }, [isOpen]);

  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/files/duplicates');
      setDuplicates(response.data.duplicateGroups);
      setStats({
        totalGroups: response.data.totalGroups,
        totalDuplicateFiles: response.data.totalDuplicateFiles,
        totalWastedSpace: response.data.totalWastedSpace,
        totalWastedSpaceMB: response.data.totalWastedSpaceMB
      });
    } catch (error) {
      console.error('Error fetching duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanDuplicates = async (groupIndex, keepFileId = null, action = 'keep_oldest') => {
    try {
      setProcessing(true);
      const response = await api.post('/files/duplicates/clean', {
        groupIndex,
        keepFileId,
        action
      });

      // Remove the cleaned group from the list
      setDuplicates(prev => prev.filter((_, index) => index !== groupIndex));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalGroups: prev.totalGroups - 1,
        totalDuplicateFiles: prev.totalDuplicateFiles - response.data.deletedCount,
        totalWastedSpace: prev.totalWastedSpace - response.data.spaceSaved,
        totalWastedSpaceMB: prev.totalWastedSpaceMB - response.data.spaceSavedMB
      }));

      if (onDuplicatesDeleted) {
        onDuplicatesDeleted(response.data);
      }

    } catch (error) {
      console.error('Error cleaning duplicates:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <FiAlertTriangle className="text-orange-600" size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Duplicate File Manager</h2>
              <p className="text-sm text-gray-500">Find and remove duplicate files to free up space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Stats Summary */}
        {!loading && stats.totalGroups > 0 && (
          <div className="p-6 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.totalGroups}</div>
                <div className="text-sm text-gray-600">Duplicate Groups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.totalDuplicateFiles}</div>
                <div className="text-sm text-gray-600">Extra Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.totalWastedSpaceMB} MB</div>
                <div className="text-sm text-gray-600">Wasted Space</div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Scanning for duplicates...</span>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center p-12">
              <FiCheck size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Duplicates Found!</h3>
              <p className="text-gray-500">Your files are well organized with no duplicates detected.</p>
            </div>
          ) : (
            <div className="p-6">
              {duplicates.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-8 bg-gray-50 rounded-xl p-6">
                  {/* Group Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FiFile className="text-gray-500" size={20} />
                      <div>
                        <h3 className="font-medium text-gray-900">{group.filename}</h3>
                        <p className="text-sm text-gray-500">
                          {group.duplicate_count} copies • {formatFileSize(group.filesize)} each • 
                          {formatFileSize(group.wasted_space)} wasted
                        </p>
                      </div>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cleanDuplicates(groupIndex, null, 'keep_oldest')}
                        disabled={processing}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        Keep Oldest
                      </button>
                      <button
                        onClick={() => cleanDuplicates(groupIndex, null, 'keep_newest')}
                        disabled={processing}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        Keep Newest
                      </button>
                    </div>
                  </div>

                  {/* File List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.files.map((file, fileIndex) => (
                      <div key={file.id} className="bg-white rounded-lg p-4 border">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <FiClock size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-500">{formatDate(file.created_at)}</span>
                            </div>
                            {file.folder_id && (
                              <div className="flex items-center gap-1 mt-1">
                                <FiFolder size={12} className="text-gray-400" />
                                <span className="text-xs text-gray-500">In folder</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Individual Actions */}
                          <div className="flex flex-col gap-1 ml-2">
                            <button
                              onClick={() => cleanDuplicates(groupIndex, file.id, 'delete_others')}
                              disabled={processing}
                              className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                              title="Keep this file, delete others"
                            >
                              <FiCheck size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.filesize)} • {file.mimetype}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && duplicates.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                💡 <strong>Tip:</strong> "Keep Oldest" preserves your original files, "Keep Newest" keeps the latest versions.
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateManagerModal;
