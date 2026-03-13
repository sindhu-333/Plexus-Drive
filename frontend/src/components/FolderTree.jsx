import React, { useState, useEffect } from 'react';
import { FiChevronRight, FiChevronDown, FiFolder, FiTrash2 } from 'react-icons/fi';
import api from '../api';

const FolderTreeItem = ({ folder, level = 0, onFolderSelect, selectedFolderId, expandedFolders, onToggleExpand, onFolderDelete }) => {
  const [subfolders, setSubfolders] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.has_children || subfolders.length > 0;

  const loadSubfolders = async () => {
    if (loading || subfolders.length > 0) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/folders?parent_id=${folder.id}`);
      setSubfolders(response.data);
    } catch (error) {
      console.error('Error loading subfolders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (hasChildren) {
      onToggleExpand(folder.id);
      if (!isExpanded && subfolders.length === 0) {
        loadSubfolders();
      }
    }
  };

  const handleSelect = () => {
    onFolderSelect(folder.id, folder.name);
  };

  return (
    <div>
      <div 
        className={`group flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer rounded ${
          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={handleToggle} className="mr-1 p-0.5 hover:bg-gray-200 rounded">
            {isExpanded ? (
              <FiChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <FiChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 mr-1"></div>
        )}
        
        <div onClick={handleSelect} className="flex items-center flex-1 min-w-0">
          <FiFolder className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-700 truncate">{folder.name}</span>
        </div>
        
        {/* Delete Button (show on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFolderDelete?.(folder.id, folder.name);
            }}
            className="p-1 hover:bg-red-200 rounded transition-colors"
            title="Delete folder"
          >
            <FiTrash2 className="w-3 h-3 text-red-500" />
          </button>
        </div>
        
        {loading && (
          <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400 ml-2"></div>
        )}
      </div>
      
      {isExpanded && subfolders.length > 0 && (
        <div>
          {subfolders.map(subfolder => (
            <FolderTreeItem
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              onFolderSelect={onFolderSelect}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              onFolderDelete={onFolderDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({ onFolderSelect, selectedFolderId, refreshTrigger, onFolderDelete }) => {
  const [rootFolders, setRootFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const loadRootFolders = async () => {
    try {
      const response = await api.get('/folders?parent_id=null');
      setRootFolders(response.data);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRootFolders();
  }, [refreshTrigger]);

  const handleToggleExpand = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleRootSelect = () => {
    onFolderSelect(null, 'All Files');
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* Root/All Files */}
      <div 
        className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer rounded mb-2 ${
          selectedFolderId === null ? 'bg-blue-50 border-l-2 border-blue-500' : ''
        }`}
        onClick={handleRootSelect}
      >
        <FiFolder className="w-4 h-4 text-blue-600 mr-2" />
        <span className="text-sm text-gray-700 font-medium">All Files</span>
      </div>
      
      {/* Folder Tree */}
      {rootFolders.map(folder => (
        <FolderTreeItem
          key={folder.id}
          folder={folder}
          onFolderSelect={onFolderSelect}
          selectedFolderId={selectedFolderId}
          expandedFolders={expandedFolders}
          onToggleExpand={handleToggleExpand}
          onFolderDelete={onFolderDelete}
        />
      ))}
      
      {rootFolders.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FiFolder className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No folders yet</p>
          <p className="text-xs text-gray-400">Create your first folder to get started</p>
        </div>
      )}
    </div>
  );
};

export default FolderTree;