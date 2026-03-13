import React, { useState, useEffect } from 'react';
import { FiX, FiFolder, FiMove, FiCheck } from 'react-icons/fi';
import api from '../api';

const MoveToFolderModal = ({ 
  isOpen, 
  onClose, 
  onMoveComplete, 
  selectedFiles = [], 
  currentFolderId = null 
}) => {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState('Root / All Files');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      setSelectedFolderId(null);
      setSelectedFolderName('Root / All Files');
      setError('');
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const response = await api.get('/folders?parent_id=null');
      setFolders(response.data);
    } catch (error) {
      console.error('Error loading folders:', error);
      setError('Failed to load folders');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleFolderSelect = (folderId, folderName) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
  };

  const handleMove = async () => {
    if (selectedFiles.length === 0) return;

    setIsLoading(true);
    setError('');

    try {
      // Move each file
      for (const fileId of selectedFiles) {
        await api.put(`/files/${fileId}/move`, {
          folder_id: selectedFolderId
        });
      }

      onMoveComplete(selectedFolderId, selectedFolderName);
      onClose();
    } catch (error) {
      console.error('Error moving files:', error);
      setError(error.response?.data?.message || 'Failed to move files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const fileCount = selectedFiles.length;
  const isMultiple = fileCount > 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FiMove className="w-5 h-5 mr-2 text-blue-600" />
            Move {isMultiple ? `${fileCount} Files` : 'File'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Select a destination folder for {isMultiple ? `${fileCount} files` : 'the file'}:
          </p>

          {/* Current selection */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-900">
              Moving to: {selectedFolderName}
            </p>
          </div>

          {/* Root/All Files option */}
          <button
            onClick={() => handleFolderSelect(null, 'Root / All Files')}
            className={`w-full p-3 text-left rounded-lg border-2 transition-colors mb-2 ${
              selectedFolderId === null
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
            disabled={currentFolderId === null}
          >
            <div className="flex items-center">
              <FiFolder className="w-4 h-4 mr-3 text-blue-600" />
              <span className="font-medium">Root / All Files</span>
              {selectedFolderId === null && (
                <FiCheck className="w-4 h-4 ml-auto text-blue-600" />
              )}
            </div>
            {currentFolderId === null && (
              <p className="text-xs text-gray-500 mt-1 ml-7">Already in root folder</p>
            )}
          </button>

          {/* Folder list */}
          {loadingFolders ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderSelect(folder.id, folder.name)}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                    selectedFolderId === folder.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                  disabled={currentFolderId === folder.id}
                >
                  <div className="flex items-center">
                    <FiFolder className="w-4 h-4 mr-3 text-blue-600" />
                    <span className="font-medium">{folder.name}</span>
                    {selectedFolderId === folder.id && (
                      <FiCheck className="w-4 h-4 ml-auto text-blue-600" />
                    )}
                  </div>
                  {currentFolderId === folder.id && (
                    <p className="text-xs text-gray-500 mt-1 ml-7">Currently in this folder</p>
                  )}
                </button>
              ))}
              
              {folders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FiFolder className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No folders available</p>
                  <p className="text-xs text-gray-400">Create a folder first</p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={isLoading || selectedFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Moving...
              </>
            ) : (
              <>
                <FiMove className="w-4 h-4 mr-2" />
                Move {isMultiple ? 'Files' : 'File'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveToFolderModal;