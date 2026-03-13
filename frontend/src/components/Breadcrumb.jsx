import React from 'react';
import { FiChevronRight, FiHome, FiTrash2 } from 'react-icons/fi';

const Breadcrumb = ({ currentPath, onNavigate, onDeleteFolder }) => {
  if (!currentPath || currentPath.length === 0) {
    return (
      <div className="flex items-center text-sm text-gray-600 mb-4">
        <FiHome className="w-4 h-4 mr-2" />
        <span>All Files</span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-sm text-gray-600 mb-4 overflow-x-auto">
      <button
        onClick={() => onNavigate(null, 'All Files')}
        className="flex items-center hover:text-blue-600 whitespace-nowrap"
      >
        <FiHome className="w-4 h-4 mr-1" />
        All Files
      </button>
      
      {currentPath.map((folder, index) => (
        <div key={folder.id} className="flex items-center whitespace-nowrap">
          <FiChevronRight className="w-4 h-4 mx-2 text-gray-400" />
          <button
            onClick={() => onNavigate(folder.id, folder.name)}
            className={`hover:text-blue-600 ${
              index === currentPath.length - 1 ? 'text-gray-900 font-medium' : ''
            }`}
          >
            {folder.name}
          </button>
          {/* Show delete button only for the current (last) folder */}
          {index === currentPath.length - 1 && onDeleteFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder.id, folder.name);
              }}
              className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title={`Delete folder "${folder.name}"`}
            >
              <FiTrash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default Breadcrumb;