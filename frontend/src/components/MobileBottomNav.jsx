import React from 'react';
import { 
  FiHome, 
  FiFolder, 
  FiStar, 
  FiUpload,
  FiSearch,
  FiMenu
} from 'react-icons/fi';

const MobileBottomNav = ({ 
  activePage, 
  onNavigate, 
  onGlobalSearch,
  onToggleSidebar,
  onUpload 
}) => {
  const navItems = [
    {
      key: 'Dashboard',
      icon: FiHome,
      label: 'Home',
      onClick: () => onNavigate('Dashboard')
    },
    {
      key: 'Files',
      icon: FiFolder,
      label: 'Files',
      onClick: () => onNavigate('Files')
    },
    {
      key: 'Search',
      icon: FiSearch,
      label: 'Search',
      onClick: onGlobalSearch
    },
    {
      key: 'Upload',
      icon: FiUpload,
      label: 'Upload',
      onClick: onUpload,
      special: true
    },
    {
      key: 'Menu',
      icon: FiMenu,
      label: 'Menu',
      onClick: onToggleSidebar
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = activePage === item.key;
          const Icon = item.icon;
          
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] ${
                item.special
                  ? 'bg-blue-600 text-white shadow-lg scale-110 -mt-2'
                  : isActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon 
                size={item.special ? 20 : 18} 
                className={item.special ? 'mb-1' : 'mb-1'}
              />
              <span className={`text-xs font-medium ${item.special ? '' : 'truncate'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Safe area for phones with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white"></div>
    </div>
  );
};

export default MobileBottomNav;