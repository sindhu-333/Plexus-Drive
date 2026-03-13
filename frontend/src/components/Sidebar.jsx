import React, { useState, useEffect } from 'react';
import FolderTree from './FolderTree';
import api from '../api';
import { 
  FiHome, 
  FiUpload, 
  FiFolder, 
  FiStar, 
  FiTrash2, 
  FiShare2, 
  FiUsers, 
  FiSettings, 
  FiLogOut,
  FiHardDrive,
  FiClock,
  FiImage,
  FiFileText,
  FiFile,
  FiVideo,
  FiMusic
} from 'react-icons/fi';

const sidebarItems = [
  { 
    key: 'Dashboard', 
    icon: FiHome, 
    label: 'Dashboard',
    color: 'text-blue-600',
    hoverColor: 'hover:bg-blue-50' 
  },
  { 
    key: 'Files', 
    icon: FiFolder, 
    label: 'My Files',
    color: 'text-gray-600',
    hoverColor: 'hover:bg-gray-50' 
  },
  { 
    key: 'Recent', 
    icon: FiClock, 
    label: 'Recent',
    color: 'text-orange-600',
    hoverColor: 'hover:bg-orange-50' 
  },
  { 
    key: 'Starred', 
    icon: FiStar, 
    label: 'Starred',
    color: 'text-yellow-600',
    hoverColor: 'hover:bg-yellow-50' 
  },
  { 
    key: 'Shared', 
    icon: FiShare2, 
    label: 'Shared with me',
    color: 'text-green-600',
    hoverColor: 'hover:bg-green-50' 
  },
];

const Sidebar = ({ 
  activePage, 
  setActivePage, 
  onLogout, 
  isCollapsed = false, 
  onToggle,
  currentFolderId,
  onFolderSelect,
  folderRefresh,
  onFolderDelete,
  totalStorage = 0,
  maxStorage = 2 * 1024 * 1024 * 1024,
  storageUsedPercentage = 0,
  formatFileSize
}) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({
    images: 0,
    documents: 0,
    videos: 0,
    audio: 0,
    others: 0
  });

  // Dynamic quickAccessItems based on actual counts
  const quickAccessItems = [
    { 
      key: 'Images', 
      icon: FiImage, 
      label: 'Images',
      count: `${categoryCounts.images} files`
    },
    { 
      key: 'Documents', 
      icon: FiFileText, 
      label: 'Documents',
      count: `${categoryCounts.documents} files`
    },
    { 
      key: 'Videos', 
      icon: FiVideo, 
      label: 'Videos',
      count: `${categoryCounts.videos} files`
    },
    { 
      key: 'Audio', 
      icon: FiMusic, 
      label: 'Audio',
      count: `${categoryCounts.audio} files`
    },
    { 
      key: 'Others', 
      icon: FiFile, 
      label: 'Other files',
      count: `${categoryCounts.others} files`
    },
  ];

  // Fetch category counts
  const fetchCategoryCounts = async () => {
    try {
      const response = await api.get('/files/category-counts');
      setCategoryCounts(response.data);
    } catch (error) {
      console.error('Error fetching category counts:', error);
    }
  };

  // Fetch counts on component mount
  useEffect(() => {
    fetchCategoryCounts();
  }, []);

  return (
    <div className={`fixed top-0 left-0 h-screen bg-white shadow-xl border-r border-gray-200 transition-all duration-300 z-40 hidden md:block ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Plexus Drive</h2>
              <p className="text-xs text-gray-500">Cloud Storage</p>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            
            return (
              <div
                key={item.key}
                onClick={() => setActivePage(item.key)}
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-sm border border-blue-100'
                    : `text-gray-700 ${item.hoverColor} hover:shadow-sm`
                }`}
              >
                <Icon 
                  size={20} 
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-blue-600' : item.color
                  }`} 
                />
                {!isCollapsed && (
                  <span className={`font-medium transition-colors ${
                    isActive ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {item.label}
                  </span>
                )}
                
                {/* Tooltip for collapsed mode */}
                {isCollapsed && hoveredItem === item.key && (
                  <div className="absolute left-16 bg-gray-800 text-white px-2 py-1 rounded-md text-sm whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick Access Section */}
          {!isCollapsed && (
            <>
              <div className="pt-6 pb-2">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Quick Access
                </h3>
              </div>
              
              {quickAccessItems.map((item) => {
                const Icon = item.icon;
                
                return (
                  <div
                    key={item.key}
                    onClick={() => setActivePage(item.key)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-gray-500" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-500">
                      {item.count}
                    </span>
                  </div>
                );
              })}

              {/* Folders Section */}
              <div className="pt-6 pb-2">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Folders
                </h3>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                <FolderTree
                  onFolderSelect={(folderId, folderName) => {
                    onFolderSelect?.(folderId, folderName);
                    setActivePage('Files'); // Switch to Files page when selecting a folder
                  }}
                  selectedFolderId={currentFolderId}
                  refreshTrigger={folderRefresh}
                  onFolderDelete={onFolderDelete}
                />
              </div>
            </>
          )}
        </nav>

        {/* Storage Info */}
        {!isCollapsed && (
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiHardDrive size={16} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Storage</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: `${Math.min(storageUsedPercentage, 100)}%` }}></div>
              </div>
              <p className="text-xs text-gray-600">
                {formatFileSize ? formatFileSize(totalStorage) : '0 B'} of {formatFileSize ? formatFileSize(maxStorage) : '2 GB'} used
              </p>
            </div>
          </div>
        )}

        {/* Logout Section */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div
            onClick={onLogout}
            onMouseEnter={() => setHoveredItem('logout')}
            onMouseLeave={() => setHoveredItem(null)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-700 transition-all duration-200 cursor-pointer group"
          >
            <FiLogOut size={20} className="flex-shrink-0 text-gray-500 group-hover:text-red-600" />
            {!isCollapsed && (
              <span className="font-medium text-gray-700 group-hover:text-red-700">
                Sign Out
              </span>
            )}
            
            {/* Tooltip for collapsed mode */}
            {isCollapsed && hoveredItem === 'logout' && (
              <div className="absolute left-16 bg-gray-800 text-white px-2 py-1 rounded-md text-sm whitespace-nowrap z-50 shadow-lg">
                Sign Out
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
