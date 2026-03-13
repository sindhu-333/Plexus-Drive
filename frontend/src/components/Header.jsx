import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiUser, 
  FiSettings, 
  FiLogOut, 
  FiMenu,
  FiGrid,
  FiList,
  FiPlus,
  FiFolderPlus,
  FiRefreshCw
} from 'react-icons/fi';
import Settings from './Settings';
import AccountSettings from './AccountSettings';
import refreshManager from '../utils/refreshManager';
import api from '../api';

const Header = ({ 
  user, 
  searchTerm, 
  onSearchChange, 
  onLogout, 
  viewMode, 
  onViewModeChange,
  onToggleSidebar,
  currentPage = 'Dashboard',
  onNavigate,
  onProfileClick,
  onNewFolder,
  onUserUpdate,
  onGlobalSearch,
  onRefresh
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);



  // Setup refresh manager
  useEffect(() => {
    const handleUpdateAvailable = (updateData) => {
      if (updateData.refresh) {
        // This is a refresh command, not an update notification
        if (onRefresh) {
          setIsRefreshing(true);
          onRefresh().finally(() => {
            setIsRefreshing(false);
          });
        }
      } else {
        // This is an update notification
        setHasUpdates(true);
        setUpdateInfo(updateData);
      }
    };

    // Register for update notifications
    const unregister = refreshManager.registerUpdateChecker(handleUpdateAvailable);

    // Start periodic checking
    refreshManager.startPeriodicChecking(30000); // Check every 30 seconds

    return () => {
      unregister();
      refreshManager.stopPeriodicChecking();
    };
  }, [onRefresh]);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    
    try {
      const success = await refreshManager.applyUpdates();
      if (success) {
        setHasUpdates(false);
        setUpdateInfo(null);
      }
    } catch (error) {
      console.error('Error applying updates:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    setHasUpdates(false);
    setUpdateInfo(null);
    
    try {
      await refreshManager.forceRefresh();
    } catch (error) {
      console.error('Error forcing refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle */}
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
          >
            <FiMenu size={20} className="text-gray-600" />
          </button>

          {/* Logo & Brand - Remove duplicate text */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-800 text-lg">Plexus Drive</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Cloud Storage Platform</p>
            </div>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-2xl mx-8 hidden md:block">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search all your files... (Click for advanced search)"
              value={searchTerm}
              onChange={onSearchChange}
              onClick={onGlobalSearch}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm cursor-pointer hover:bg-gray-100"
              readOnly
            />
          </div>
        </div>

        {/* Mobile Search Button */}
        <button 
          onClick={onGlobalSearch}
          className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
        >
          <FiSearch size={18} className="text-gray-600" />
        </button>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Quick Actions - Show only on files page */}
          {currentPage === 'Files' && (
            <div className="flex items-center gap-2 mr-4">
              {/* Upload Button */}
              <button 
                onClick={() => onNavigate?.('Upload')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <FiPlus size={16} />
                <span className="hidden sm:inline">Upload</span>
              </button>

              {/* New Folder Button */}
              <button 
                onClick={onNewFolder}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <FiFolderPlus size={16} />
                <span className="hidden sm:inline">New Folder</span>
              </button>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <FiGrid size={16} />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <FiList size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="relative">
            <button 
              onClick={hasUpdates ? handleRefreshClick : handleForceRefresh}
              disabled={isRefreshing}
              className={`p-2.5 rounded-lg transition-all relative ${
                hasUpdates 
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                  : 'hover:bg-gray-100 text-gray-600'
              } ${isRefreshing ? 'animate-spin' : ''}`}
              title={hasUpdates ? 'Updates available - Click to refresh' : 'Refresh files'}
            >
              <FiRefreshCw size={18} />
              {hasUpdates && (
                <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  !
                </span>
              )}
            </button>
            
            {/* Update notification tooltip */}
            {hasUpdates && updateInfo && (
              <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                {updateInfo.message || 'Updates available'}
                <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800"></div>
              </div>
            )}
          </div>



          {/* Settings */}
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiSettings size={18} className="text-gray-600" />
          </button>

          {/* Profile Dropdown */}
          <div className="flex items-center gap-3 ml-2 pl-3 border-l border-gray-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
            </div>
            <div className="relative group">
              <button className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium hover:shadow-md transition-all overflow-hidden">
                {user?.profile_picture ? (
                  <>
                    <img 
                      src={user.profile_picture.startsWith('http') ? user.profile_picture : `${import.meta.env.VITE_BACKEND_URL}${user.profile_picture}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                    <span className="hidden">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </>
                ) : (
                  <span>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-3 border-b border-gray-100">
                  <p className="font-medium text-gray-800">{user?.name || 'User'}</p>
                  <p className="text-sm text-gray-500">{user?.email || 'user@example.com'}</p>
                </div>
                <div className="p-2">
                  <button 
                    onClick={onProfileClick}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <FiUser size={16} />
                    Profile Settings
                  </button>
                  <button 
                    onClick={() => setShowAccountSettings(true)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <FiSettings size={16} />
                    Account Settings
                  </button>
                  <hr className="my-2 border-gray-100" />
                  <button 
                    onClick={onLogout}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <FiLogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden mt-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search all your files..."
            onClick={onGlobalSearch}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm cursor-pointer hover:bg-gray-100"
            readOnly
          />
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          onUserUpdate={onUserUpdate}
        />
      )}
      
      {showAccountSettings && (
        <AccountSettings 
          onClose={() => setShowAccountSettings(false)} 
          onUserUpdate={onUserUpdate}
        />
      )}
    </header>
  );
};

export default Header;