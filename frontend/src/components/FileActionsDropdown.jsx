import React, { useState, useRef, useEffect } from 'react';
import { FiMoreVertical, FiCpu, FiShare2, FiUsers, FiFolder, FiArrowLeft } from 'react-icons/fi';

const FileActionsDropdown = ({ 
  file, 
  onContentAnalysis,
  onShareRequest,
  onMoveToFolder,
  onRemoveFromFolder,
  isInFolder = false
}) => {
  console.log('🎛️ FileActionsDropdown props:', { file: file?.filename, onContentAnalysis: typeof onContentAnalysis });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAction = (action, event) => {
    event.stopPropagation();
    setIsOpen(false);
    
    switch (action) {
      case 'analysis':
        console.log('🔍 Analysis button clicked for file:', file.filename, 'Status:', file.analysis_status);
        onContentAnalysis(file);
        break;
      case 'share':
        console.log('🔗 Share button clicked for file:', file.filename);
        onShareRequest?.(file);
        break;
      case 'move':
        console.log('📁 Move to folder button clicked for file:', file.filename);
        onMoveToFolder?.(file);
        break;
      case 'remove':
        console.log('🔙 Remove from folder button clicked for file:', file.filename);
        onRemoveFromFolder?.(file);
        break;
      default:
        console.log(`Action ${action} not implemented yet`);
    }
  };

  const getAnalysisStatus = () => {
    const status = file.analysis_status;
    switch (status) {
      case 'completed':
        return { text: 'View Analysis', disabled: false, icon: FiCpu };
      case 'processing':
        return { text: 'Analyzing...', disabled: true, icon: FiCpu };
      case 'pending':
        return { text: 'Analysis Queued', disabled: true, icon: FiCpu };
      case 'failed':
        return { text: 'Analysis Failed', disabled: false, icon: FiCpu };
      default:
        return { text: 'Content Analysis', disabled: false, icon: FiCpu };
    }
  };

  const analysisStatus = getAnalysisStatus();

  return (
    <div className="relative z-[100]" ref={dropdownRef}>
      {/* Three-dot menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          console.log('🔘 Three-dot button clicked, isOpen:', isOpen);
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="File actions"
      >
        <FiMoreVertical size={16} className="text-gray-600" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-2xl border border-gray-200 z-[9999] overflow-visible">
          {console.log('🎯 Dropdown is rendering, isOpen:', isOpen)}
          <div className="py-1">
            {/* Content Analysis */}
            <button
              onClick={(e) => {
                console.log('🎯 BUTTON CLICKED!', e);
                handleAction('analysis', e);
              }}
              disabled={analysisStatus.disabled}
              className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                analysisStatus.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'
              }`}
            >
              {React.createElement(analysisStatus.icon, { size: 16 })}
              <span className="text-sm font-medium">{analysisStatus.text}</span>
              {file.analysis_status === 'completed' && (
                <span className="ml-auto text-xs text-green-600 font-medium">✓</span>
              )}
              {file.analysis_status === 'processing' && (
                <span className="ml-auto">
                  <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Share Option */}
            <button
              onClick={(e) => handleAction('share', e)}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <FiShare2 size={16} />
              <span className="text-sm font-medium">Share File</span>
              {file.is_shared && (
                <div className="ml-auto flex items-center gap-1 text-xs text-blue-600">
                  <FiUsers size={12} />
                  <span>Shared</span>
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Move to Folder Option */}
            <button
              onClick={(e) => handleAction('move', e)}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <FiFolder size={16} />
              <span className="text-sm font-medium">Move to Folder</span>
            </button>

            {/* Remove from Folder Option (only when in a folder) */}
            {isInFolder && (
              <button
                onClick={(e) => handleAction('remove', e)}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700"
              >
                <FiArrowLeft size={16} />
                <span className="text-sm font-medium">Remove from Folder</span>
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default FileActionsDropdown;