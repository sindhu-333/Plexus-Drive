import React, { useEffect, useState } from 'react';
import api, { setToken } from '../api';
import UploadFile from './UploadFile';
import Sidebar from './Sidebar';
import Header from './Header';
import FileList from './FileList';
import FileGrid from './FileGrid';
import StatsCard from './StatsCard';
import LoadingSkeleton from './LoadingSkeleton';
import AnalysisResultsModal from './AnalysisResultsModal';
import ShareModal from './ShareModal';
import UserProfile from './UserProfile';
import CreateFolderModal from './CreateFolderModal';
import MoveToFolderModal from './MoveToFolderModal';
import FolderTree from './FolderTree';
import Breadcrumb from './Breadcrumb';
import RecentFiles from './RecentFiles';
import SharedWithMe from './SharedWithMe';
import QuickAccessCategories from './QuickAccessCategories';
import GlobalSearch from './GlobalSearch';
import DuplicateManagerModal from './DuplicateManagerModal';
import MobileBottomNav from './MobileBottomNav';
import AIAssistant from './AIAssistant';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { 
  FiFile, 
  FiHardDrive, 
  FiActivity, 
  FiUpload, 
  FiTrash2, 
  FiFolder,
  FiUsers,
  FiTrendingUp,
  FiImage,
  FiFileText,
  FiVideo,
  FiMusic,
  FiArchive,
  FiStar,
  FiShare2,
  FiClock
} from 'react-icons/fi';

ChartJS.register(ArcElement, Tooltip, Legend);

// Starred Files Page Component
const StarredFilesPage = ({ 
  files, 
  viewMode, 
  onFileSelect, 
  selectedFiles, 
  onFileDownload, 
  onFilePreview, 
  onFileDelete, 
  onFileFavorite, 
  downloadingFile, 
  onContentAnalysis, 
  onShareRequest,
  onMoveToFolder,
  onRemoveFromFolder,
  loading 
}) => {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
            <FiStar size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Starred Files</h1>
            <p className="text-gray-600">Files you've marked as favorites</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span>{files.length} starred files</span>
          <span>•</span>
          <span>
            {files.reduce((sum, file) => sum + (parseInt(file.filesize) || 0), 0) > 0 
              ? `${(files.reduce((sum, file) => sum + (parseInt(file.filesize) || 0), 0) / (1024 * 1024)).toFixed(1)} MB total`
              : '0 MB total'
            }
          </span>
        </div>
      </div>

      {/* Files Grid */}
      {loading ? (
        <LoadingSkeleton type={viewMode} count={8} />
      ) : files.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiStar size={32} className="text-yellow-500" />
          </div>
          <h3 className="text-xl font-medium text-gray-600 mb-2">No starred files</h3>
          <p className="text-gray-500 mb-6">Star files to quickly access them later</p>
          <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-blue-700">
              <FiStar size={16} className="inline mr-2" />
              Tip: Click the star icon on any file to add it to your favorites
            </p>
          </div>
        </div>
      ) : (
        <FileGrid
          files={files}
          viewMode={viewMode}
          onFileSelect={onFileSelect}
          selectedFiles={selectedFiles}
          onFileDownload={onFileDownload}
          onFilePreview={onFilePreview}
          onFileDelete={onFileDelete}
          onFileFavorite={onFileFavorite}
          downloadingFile={downloadingFile}
          onContentAnalysis={onContentAnalysis}
          onShareRequest={onShareRequest}
          onMoveToFolder={onMoveToFolder}
          onRemoveFromFolder={onRemoveFromFolder}
          currentFolderId={null}
        />
      )}
    </div>
  );
};

const Dashboard = ({ user = { name: 'Guest', email: 'user@example.com' }, token, onLogout, onUserUpdate }) => {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [filesToMove, setFilesToMove] = useState([]);
  const [folderRefresh, setFolderRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activePage, setActivePage] = useState('Dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [isConverted, setIsConverted] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisFile, setAnalysisFile] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFile, setShareFile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState('light');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);

  // ✅ Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // ✅ Load user theme preference
  useEffect(() => {
    if (user?.theme) {
      setTheme(user.theme);
    }
  }, [user]);

  // ✅ Fetch once on load
  useEffect(() => {
    if (token) {
      setToken(token);
      fetchFiles(currentFolderId);
      fetchFolders(currentFolderId);
      fetchAnalyticsData();
    }
  }, [token, currentFolderId]);

  const fetchFiles = async (folderId = null) => {
    try {
      setError('');
      setLoading(true);
      console.log('Fetching files for folder:', folderId);
      
      const url = folderId ? `/files/list?folder_id=${folderId}` : '/files/list';
      const res = await api.get(url);
      console.log('Files fetched successfully:', res.data);
      setFiles(res.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.response?.data?.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async (parentId = null) => {
    try {
      const url = parentId ? `/folders?parent_id=${parentId}` : '/folders?parent_id=null';
      const res = await api.get(url);
      console.log('Folders fetched successfully:', res.data);
      setFolders(res.data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  // Refresh function for the refresh manager
  const handleRefresh = async () => {
    try {
      setError('');
      
      // Refresh based on current page
      if (activePage === 'Files' || activePage === 'Dashboard') {
        await fetchFiles(currentFolderId);
        await fetchFolders(currentFolderId);
      }
      
      if (activePage === 'Dashboard') {
        await fetchAnalyticsData();
        // Note: recentActivities is computed from files data, no separate fetch needed
      }
      
      setLastUpdate(new Date());
      console.log('Refresh completed successfully');
      
    } catch (err) {
      console.error('Error during refresh:', err);
      setError(err.response?.data?.message || 'Failed to refresh data');
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const res = await api.get('/files/analysis/stats');
      console.log('Analytics data fetched:', res.data);
      setAnalyticsData(res.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      // Keep using hardcoded data as fallback
    }
  };

  const toggleSelectFile = (id) => {
    setSelectedFiles(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  // Bulk operations using existing backend endpoints
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.length} selected files?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await api.post('/files/deleteMany', { ids: selectedFiles });
      setSelectedFiles([]);
      await fetchFiles(); // Refresh the file list
      setError('');
    } catch (err) {
      console.error('Error deleting files:', err);
      setError(err.response?.data?.message || 'Failed to delete selected files');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      setLoading(true);
      const response = await api.post('/files/downloadMany', 
        { ids: selectedFiles }, 
        { responseType: 'blob' }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selected-files-${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setError('');
    } catch (err) {
      console.error('Error downloading files:', err);
      setError(err.response?.data?.message || 'Failed to download selected files');
    } finally {
      setLoading(false);
    }
  };

  // Individual file operations
  const handleFileDownload = async (file) => {
    try {
      setDownloadingFile(file.id);
      setError('');
      const response = await api.get(`/files/download/${file.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setError('');
    } catch (err) {
      console.error('Error downloading file:', err);
      setError(err.response?.data?.message || 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleFilePreview = async (file) => {
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      const officeTypes = [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // xlsx
      ];

      let response, blob;

      if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
        response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
        blob = response.data;
        setPreviewType(file.mimetype === "application/pdf" ? "pdf" : "image");
        setIsConverted(false);

      } else if (file.mimetype.startsWith("text/") || ["application/json", "application/xml", "text/plain"].includes(file.mimetype)) {
        response = await api.get(`/files/preview/${file.id}`, { responseType: "text" });
        setPreviewType("text");
        setPreviewContent(response.data);
        setIsConverted(false);

      } else if (officeTypes.includes(file.mimetype)) {
        // Convert Office file to PDF using existing backend endpoint
        response = await api.get(`/files/convert/${file.id}`, { responseType: "blob" });
        blob = response.data;
        setPreviewType("pdf");
        setIsConverted(true);

      } else if (file.mimetype.startsWith("video/")) {
        response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
        blob = response.data;
        setPreviewType("video");
        setIsConverted(false);

      } else if (file.mimetype.startsWith("audio/")) {
        response = await api.get(`/files/preview/${file.id}`, { responseType: "blob" });
        blob = response.data;
        setPreviewType("audio");
        setIsConverted(false);

      } else {
        // Fallback: try converting to PDF
        response = await api.get(`/files/convert/${file.id}`, { responseType: "blob" });
        blob = response.data;
        setPreviewType("pdf");
        setIsConverted(true);
      }

      if (blob) setPreviewUrl(URL.createObjectURL(blob));
      setPreviewFile(file);
      setShowPreview(true);
      setError('');

    } catch (err) {
      console.error("Preview error:", err);
      setPreviewType("unsupported");
      setShowPreview(true);
      setIsConverted(false);
      setError(err.response?.data?.message || 'Failed to preview file');
    }
  };

  // Individual file delete
  const handleFileDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      setLoading(true);
      await api.delete(`/files/${fileId}`);
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
      await fetchFiles(currentFolderId); // Refresh the file list
      setError('');
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(err.response?.data?.message || 'Failed to delete file');
    } finally {
      setLoading(false);
    }
  };

  // Folder operations
  const handleFolderCreated = (folder) => {
    setFolders(prev => [...prev, folder]);
    setFolderRefresh(prev => prev + 1);
  };

  const handleFolderOpen = async (folderId, folderName) => {
    // Update current path
    if (folderId === null) {
      setCurrentPath([]);
      setCurrentFolderId(null);
    } else {
      // Build path by finding folder
      const newPathItem = { id: folderId, name: folderName };
      setCurrentPath(prev => [...prev, newPathItem]);
      setCurrentFolderId(folderId);
    }
  };

  const handleFolderDelete = async (folderId, folderName) => {
    const confirmMessage = `Are you sure you want to delete the folder "${folderName}" and all its contents?\n\nThis will permanently delete:\n- All files in this folder\n- All subfolders and their contents\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setLoading(true);
      // Use force=true to delete folder with all contents
      await api.delete(`/folders/${folderId}?force=true`);
      
      // Update folder state
      setFolders(prev => prev.filter(folder => folder.id !== folderId));
      setFolderRefresh(prev => prev + 1);
      
      // If we're currently in the deleted folder, navigate to root
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
        setCurrentPath([]);
      }
      
      // Refresh files in case we deleted the current folder
      fetchFiles(currentFolderId === folderId ? null : currentFolderId);
      
      setError('');
    } catch (err) {
      console.error('Error deleting folder:', err);
      if (err.response?.status === 409) {
        const errorData = err.response.data;
        const message = `Cannot delete folder: ${errorData.error}\n\nContains:\n- ${errorData.file_count || 0} files\n- ${errorData.subfolder_count || 0} subfolders`;
        alert(message);
      } else {
        setError(err.response?.data?.message || 'Failed to delete folder');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBreadcrumbNavigate = (folderId, folderName) => {
    if (folderId === null) {
      setCurrentPath([]);
      setCurrentFolderId(null);
    } else {
      // Find the index in current path and slice to that point
      const index = currentPath.findIndex(item => item.id === folderId);
      if (index !== -1) {
        setCurrentPath(prev => prev.slice(0, index + 1));
        setCurrentFolderId(folderId);
      }
    }
  };

  // Handle content analysis and sharing from FileGrid
  const handleContentAnalysis = (file) => {
    console.log('🔍 Content analysis requested for file:', file?.filename || 'NO FILE');
    setAnalysisFile(file);
    setShowAnalysisModal(true);
  };

  const handleShareRequest = (file) => {
    console.log('🔗 Share request for file:', file?.filename || 'NO FILE');
    setShareFile(file);
    setShowShareModal(true);
  };

  // Move to folder handlers
  const handleMoveToFolder = (file) => {
    console.log('📁 Move to folder request for file:', file?.filename);
    setFilesToMove([file.id]);
    setShowMoveToFolderModal(true);
  };

  const handleBulkMoveToFolder = () => {
    if (selectedFiles.length === 0) return;
    console.log('📁 Bulk move request for files:', selectedFiles);
    setFilesToMove(selectedFiles);
    setShowMoveToFolderModal(true);
  };

  const handleMoveComplete = (targetFolderId, targetFolderName) => {
    console.log('✅ Files moved to:', targetFolderName);
    // Clear selections and refresh
    setSelectedFiles([]);
    fetchFiles(currentFolderId);
    setFilesToMove([]);
  };

  // Remove from folder handler (move file back to root)
  const handleRemoveFromFolder = async (file) => {
    try {
      console.log('📤 Removing file from folder:', file?.filename);
      
      const response = await fetch(`${api.defaults.baseURL}/files/${file.id}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          folder_id: null // null means move to root directory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to remove file from folder');
      }

      console.log('✅ File removed from folder successfully');
      
      // Refresh the current view
      fetchFiles(currentFolderId);
    } catch (error) {
      console.error('❌ Error removing file from folder:', error);
      alert('Failed to remove file from folder. Please try again.');
    }
  };

  const handleFileFavorite = async (fileId, isFavorite) => {
    try {
      const method = isFavorite ? 'POST' : 'DELETE';
      const response = await fetch(`${api.defaults.baseURL}/files/${fileId}/favorite`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local file state
        setFiles(prevFiles => 
          prevFiles.map(file => 
            file.id === parseInt(fileId) 
              ? { ...file, is_favorite: isFavorite }
              : file
          )
        );
        
        // Show success message
        console.log(isFavorite ? '⭐ File added to favorites' : '☆ File removed from favorites');
      } else {
        console.error('Failed to update favorite status');
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const filteredFiles = files.filter(f =>
    f.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Analytics calculations
  const totalFiles = files.length;
  const totalStorage = files.reduce((sum, file) => sum + (parseInt(file.filesize) || 0), 0);
  const maxStorage = 2 * 1024 * 1024 * 1024; // 2GB limit
  const storageUsedPercentage = totalStorage > 0 ? (totalStorage / maxStorage) * 100 : 0;

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${size.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  };

  // Calculate file type statistics
  const getFileTypeStats = () => {
    const stats = {
      pdfs: 0,
      documents: 0,
      presentations: 0,
      images: 0,
      videos: 0,
      others: 0
    };

    files.forEach(file => {
      const ext = file.filename.toLowerCase().split('.').pop();
      if (ext === 'pdf') stats.pdfs++;
      else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) stats.documents++;
      else if (['ppt', 'pptx'].includes(ext)) stats.presentations++;
      else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) stats.images++;
      else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) stats.videos++;
      else stats.others++;
    });

    return stats;
  };

  const fileTypeStats = getFileTypeStats();

  // Chart data
  const chartData = {
    labels: ['PDFs', 'Documents', 'Presentations', 'Images', 'Videos', 'Others'],
    datasets: [
      {
        data: [
          fileTypeStats.pdfs,
          fileTypeStats.documents,
          fileTypeStats.presentations,
          fileTypeStats.images,
          fileTypeStats.videos,
          fileTypeStats.others
        ],
        backgroundColor: [
          '#EF4444', // Red for PDFs
          '#3B82F6', // Blue for Documents
          '#F59E0B', // Orange for Presentations
          '#10B981', // Green for Images
          '#8B5CF6', // Purple for Videos
          '#6B7280'  // Gray for Others
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      }
    },
    cutout: '60%'
  };

  // Get recent activities (last 15 days)
  const getRecentActivities = () => {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    return files
      .filter(file => new Date(file.created_at) >= fifteenDaysAgo)
      .map(file => ({
        id: file.id,
        type: 'upload',
        filename: file.filename,
        timestamp: file.created_at,
        size: file.filesize
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10); // Show last 10 activities
  };

  const recentActivitiesData = getRecentActivities();

  // Enhanced chart data with better colors and styling
  const enhancedChartData = {
    ...chartData,
    datasets: [{
      ...chartData.datasets[0],
      backgroundColor: [
        '#EF4444', // Red for PDFs
        '#3B82F6', // Blue for Documents
        '#F59E0B', // Orange for Presentations
        '#10B981', // Green for Images
        '#8B5CF6', // Purple for Videos
        '#6B7280'  // Gray for Others
      ],
      borderWidth: 0,
      hoverOffset: 8
    }]
  };

  const enhancedChartOptions = {
    ...chartOptions,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            weight: 500
          },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const backgroundColor = dataset.backgroundColor[i];
                
                return {
                  text: `${label} (${value})`,
                  fillStyle: backgroundColor,
                  strokeStyle: backgroundColor,
                  lineWidth: 0,
                  pointStyle: 'circle',
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      }
    },
    cutout: '65%',
    responsive: true,
    maintainAspectRatio: false
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Sidebar */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={onLogout}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentFolderId={currentFolderId}
        onFolderSelect={handleFolderOpen}
        folderRefresh={folderRefresh}
        onFolderDelete={handleFolderDelete}
        totalStorage={totalStorage}
        maxStorage={maxStorage}
        storageUsedPercentage={storageUsedPercentage}
        formatFileSize={formatFileSize}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ml-0 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {/* Header */}
        <Header 
          user={user}
          searchTerm={searchTerm}
          onSearchChange={(e) => {
            setSearchTerm(e.target.value);
            // Reset selection when searching
            if (e.target.value !== searchTerm) {
              setSelectedFiles([]);
            }
          }}
          onLogout={onLogout}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onToggleSidebar={() => {
            // On mobile, show mobile menu overlay
            // On desktop, toggle sidebar collapsed state
            const isMobile = window.innerWidth < 768; // md breakpoint
            if (isMobile) {
              setShowMobileMenu(!showMobileMenu);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
          currentPage={activePage}
          onNavigate={setActivePage}
          onProfileClick={() => setShowProfile(true)}
          onNewFolder={() => setShowCreateFolderModal(true)}
          onUserUpdate={onUserUpdate}
          onGlobalSearch={() => setShowGlobalSearch(true)}
          onRefresh={handleRefresh}
        />

        {/* Page Content */}
        <main className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <FiActivity size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="font-medium">Error loading data</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
              <button
                onClick={fetchFiles}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {/* Dashboard Content */}
          {activePage === 'Dashboard' && (
            <>
              {loading ? (
                <LoadingSkeleton type="dashboard" />
              ) : (
                <div className="space-y-8">
                  {/* Welcome Section */}
                  <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
                      <div className="w-full h-full bg-white rounded-full transform translate-x-16 -translate-y-16"></div>
                    </div>
                    <div className="relative">
                      <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name}!</h1>
                      <p className="text-blue-100 mb-6">Here's what's happening with your files today</p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setActivePage('Upload')}
                          className="px-6 py-3 bg-white text-blue-600 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                          <FiUpload size={18} />
                          Upload Files
                        </button>
                        <button 
                          onClick={() => setActivePage('Files')}
                          className="px-6 py-3 border-2 border-white text-white rounded-xl font-medium hover:bg-white hover:text-blue-600 transition-colors flex items-center gap-2"
                        >
                          <FiFolder size={18} />
                          Browse Files
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <StatsCard
                      icon={FiFile}
                      title="Total Files"
                      value={totalFiles.toString()}
                      subtitle={totalFiles === 1 ? 'file' : 'files'}
                      change={analyticsData ? null : 12}
                      gradient="from-blue-500 to-blue-600"
                      onClick={() => setActivePage('Files')}
                    />
                    
                    <StatsCard
                      icon={FiHardDrive}
                      title="Storage Used"
                      value={formatFileSize(totalStorage)}
                      subtitle={`of ${formatFileSize(maxStorage)}`}
                      change={analyticsData ? null : -3}
                      changeType="negative"
                      gradient="from-purple-500 to-purple-600"
                    />
                    
                    <StatsCard
                      icon={FiActivity}
                      title="AI Analyzed"
                      value={analyticsData ? analyticsData.analyzed_files.toString() : '0'}
                      subtitle={analyticsData ? `of ${analyticsData.total_files} files` : 'files analyzed'}
                      change={analyticsData ? null : 25}
                      gradient="from-green-500 to-green-600"
                      onClick={() => setActivePage('Files')}
                    />
                    
                    <StatsCard
                      icon={FiTrendingUp}
                      title="Processing"
                      value={analyticsData ? (analyticsData.processing + analyticsData.pending).toString() : recentActivitiesData.length.toString()}
                      subtitle={analyticsData ? 'files in queue' : 'recent activities'}
                      change={analyticsData ? null : 8}
                      gradient="from-orange-500 to-orange-600"
                    />
                    
                    <StatsCard
                      icon={FiTrash2}
                      title="Manage Duplicates"
                      value="Clean"
                      subtitle="Free up space"
                      gradient="from-red-500 to-pink-600"
                      onClick={() => setShowDuplicateManager(true)}
                      actionCard={true}
                    />
                  </div>

                  {/* Charts and Analytics */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Storage Overview */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Storage Analytics</h3>
                          <p className="text-gray-500">Your storage usage overview</p>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                          <FiHardDrive size={24} className="text-white" />
                        </div>
                      </div>

                      {/* Storage Progress */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Storage Usage</span>
                          <span className="text-sm text-gray-500">{storageUsedPercentage.toFixed(1)}% used</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div 
                            className={`h-4 rounded-full transition-all duration-1000 ${
                              storageUsedPercentage > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                              storageUsedPercentage > 70 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                              'bg-gradient-to-r from-blue-500 to-purple-600'
                            }`}
                            style={{ width: `${Math.min(Math.max(storageUsedPercentage, 2), 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mt-2">
                          <span>{formatFileSize(totalStorage)} used</span>
                          <span>{formatFileSize(maxStorage - totalStorage)} available</span>
                        </div>
                      </div>

                      {/* File Type Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-red-50 rounded-xl">
                          <FiFileText className="w-8 h-8 text-red-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-red-600">{fileTypeStats.pdfs}</p>
                          <p className="text-sm text-gray-600">PDFs</p>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-xl">
                          <FiFileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-blue-600">{fileTypeStats.documents}</p>
                          <p className="text-sm text-gray-600">Documents</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-xl">
                          <FiImage className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-green-600">{fileTypeStats.images}</p>
                          <p className="text-sm text-gray-600">Images</p>
                        </div>
                      </div>
                    </div>

                    {/* File Type Distribution Chart */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">File Types</h3>
                          <p className="text-gray-500">Distribution</p>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                          <FiActivity size={20} className="text-white" />
                        </div>
                      </div>
                      
                      <div className="h-64">
                        {totalFiles > 0 ? (
                          <Doughnut data={enhancedChartData} options={enhancedChartOptions} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                              <FiFile size={48} className="mx-auto mb-3 text-gray-300" />
                              <p className="font-medium">No files yet</p>
                              <p className="text-sm">Upload files to see distribution</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">Recent Activities</h3>
                        <p className="text-gray-500">Your latest file activities</p>
                      </div>
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        Last 15 days
                      </span>
                    </div>
                    
                    {recentActivitiesData.length > 0 ? (
                      <div className="space-y-3">
                        {recentActivitiesData.slice(0, 5).map(activity => (
                          <div key={`${activity.type}-${activity.id}-${activity.timestamp}`} 
                               className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all duration-200 group">
                            <div className={`p-3 rounded-xl ${activity.type === 'upload' ? 'bg-green-100 group-hover:bg-green-200' : 'bg-red-100 group-hover:bg-red-200'} transition-colors`}>
                              {activity.type === 'upload' ? (
                                <FiUpload className="text-green-600" size={18} />
                              ) : (
                                <FiTrash2 className="text-red-600" size={18} />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-800">
                                  {activity.type === 'upload' ? 'Uploaded' : 'Deleted'}
                                </span>
                                <span className="text-gray-600 truncate font-medium">
                                  {activity.filename}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <FiFile size={12} />
                                  {formatFileSize(activity.size)}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <FiClock size={12} />
                                  {new Date(activity.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {recentActivitiesData.length > 5 && (
                          <div className="text-center pt-4">
                            <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium">
                              View all {recentActivitiesData.length} activities
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FiActivity size={32} className="text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-600 mb-2">No recent activities</h4>
                        <p className="text-gray-500 mb-4">Start uploading files to see your activity here</p>
                        <button 
                          onClick={() => setActivePage('Upload')}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Upload Your First File
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Upload Page */}
          {activePage === 'Upload' && (
            <div className="max-w-4xl mx-auto">
              <UploadFile 
                onUpload={() => fetchFiles(currentFolderId)} 
                currentFolderId={currentFolderId}
              />
            </div>
          )}

          {/* Files Page */}
          {activePage === 'Files' && (
            <>
              {/* Files Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">My Files</h2>
                  <p className="text-gray-500">
                    {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} 
                    {searchTerm && ` matching "${searchTerm}"`}
                  </p>
                </div>
                
                {/* Bulk Actions */}
                {selectedFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {selectedFiles.length} selected
                    </span>
                    <button 
                      onClick={handleBulkDelete}
                      disabled={loading}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {loading ? 'Deleting...' : 'Delete Selected'}
                    </button>
                    <button 
                      onClick={handleBulkDownload}
                      disabled={loading}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {loading ? 'Downloading...' : 'Download Selected'}
                    </button>
                    <button
                      onClick={handleBulkMoveToFolder}
                      disabled={loading}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      Move Selected
                    </button>
                  </div>
                )}
              </div>

              {/* Files Content */}
              {loading ? (
                <LoadingSkeleton type={viewMode} count={12} />
              ) : (
                <>
                  {/* Breadcrumb Navigation */}
                  <Breadcrumb 
                    currentPath={currentPath}
                    onNavigate={handleBreadcrumbNavigate}
                    onDeleteFolder={handleFolderDelete}
                  />
                  
                  <FileGrid
                    files={filteredFiles}
                    viewMode={viewMode}
                    onFileSelect={toggleSelectFile}
                    selectedFiles={selectedFiles}
                    onFileDownload={handleFileDownload}
                    onFilePreview={handleFilePreview}
                    onFileDelete={handleFileDelete}
                    downloadingFile={downloadingFile}
                    onContentAnalysis={handleContentAnalysis}
                    onShareRequest={handleShareRequest}
                    onFileFavorite={handleFileFavorite}
                    onMoveToFolder={handleMoveToFolder}
                    onRemoveFromFolder={handleRemoveFromFolder}
                    currentFolderId={currentFolderId}
                  />
                </>
              )}
            </>
          )}

          {/* Starred/Favorites Page */}
          {activePage === 'Starred' && (
            <StarredFilesPage 
              files={filteredFiles.filter(file => file.is_favorite)}
              viewMode={viewMode}
              onFileSelect={toggleSelectFile}
              selectedFiles={selectedFiles}
              onFileDownload={handleFileDownload}
              onFilePreview={handleFilePreview}
              onFileDelete={handleFileDelete}
              onFileFavorite={handleFileFavorite}
              downloadingFile={downloadingFile}
              onContentAnalysis={handleContentAnalysis}
              onShareRequest={handleShareRequest}
              onMoveToFolder={handleMoveToFolder}
              onRemoveFromFolder={handleRemoveFromFolder}
              loading={loading}
            />
          )}

          {/* Recent Files */}
          {activePage === 'Recent' && (
            <RecentFiles 
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {/* Shared With Me */}
          {activePage === 'Shared' && (
            <SharedWithMe 
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {/* Quick Access Categories */}
          {activePage === 'Images' && (
            <QuickAccessCategories 
              category="images"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {activePage === 'Documents' && (
            <QuickAccessCategories 
              category="documents"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {activePage === 'Videos' && (
            <QuickAccessCategories 
              category="videos"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {activePage === 'Audio' && (
            <QuickAccessCategories 
              category="audio"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {activePage === 'Others' && (
            <QuickAccessCategories 
              category="others"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              user={user}
            />
          )}

          {/* Other Pages */}
          {[].includes(activePage) && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {activePage === 'Others' && <FiFile size={32} className="text-gray-400" />}
              </div>
              <h3 className="text-xl font-medium text-gray-600 mb-2">{activePage}</h3>
              <p className="text-gray-500 mb-4">This feature is coming soon!</p>
              <button 
                onClick={() => setActivePage('Dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {/* File Preview Modal */}
      {showPreview && previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h3 className="font-semibold text-lg">{previewFile.filename}</h3>
                {isConverted && <p className="text-sm text-blue-600">Converted to PDF for preview</p>}
              </div>
              <button 
                onClick={() => {
                  setShowPreview(false);
                  setPreviewFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-auto">
              {previewType === 'image' && <img src={previewUrl} alt={previewFile.filename} className="max-w-full h-auto mx-auto" />}
              {previewType === 'pdf' && <iframe src={previewUrl} className="w-full h-96 border-none rounded-lg" title={previewFile.filename} />}
              {previewType === 'text' && <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded-lg max-h-80 overflow-auto">{previewContent}</pre>}
              {previewType === 'video' && <video src={previewUrl} controls className="w-full h-full"/>}
              {previewType === 'audio' && <audio src={previewUrl} controls className="w-full"/>}
              {previewType === 'unsupported' && <p className="text-gray-700">Preview not available. Please download to view.</p>}
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Results Modal */}
      <AnalysisResultsModal
        file={analysisFile}
        isOpen={showAnalysisModal}
        onClose={() => {
          setShowAnalysisModal(false);
          setAnalysisFile(null);
        }}
      />

      {/* Share Modal */}
      <ShareModal
        file={shareFile}
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareFile(null);
        }}
        onShareCreated={(file, shareData) => {
          console.log('🔗 File shared:', file?.filename, 'Share data:', shareData);
          setShowShareModal(false);
          setShareFile(null);
          fetchFiles(); // Refresh to update share status
        }}
      />

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden">
          <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300">
            {/* Mobile Sidebar Content */}
            <div className="flex flex-col h-full">
              {/* Logo Section */}
              <div className="flex items-center justify-between px-4 py-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-lg">Plexus Drive</h2>
                    <p className="text-xs text-gray-500">Cloud Storage</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                {[
                  { key: 'Dashboard', icon: '🏠', label: 'Dashboard', color: 'text-blue-600' },
                  { key: 'Files', icon: '📁', label: 'My Files', color: 'text-gray-600' },
                  { key: 'Recent', icon: '🕒', label: 'Recent', color: 'text-orange-600' },
                  { key: 'Starred', icon: '⭐', label: 'Starred', color: 'text-yellow-600' },
                  { key: 'Shared', icon: '👥', label: 'Shared with me', color: 'text-green-600' },
                ].map((item) => {
                  const isActive = activePage === item.key;
                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        setActivePage(item.key);
                        setShowMobileMenu(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-sm border border-blue-100'
                          : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                      }`}
                    >
                      <span className={`text-xl ${isActive ? 'text-blue-600' : item.color}`}>
                        {item.icon}
                      </span>
                      <span className={`font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </nav>

              {/* Storage Info */}
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💾</span>
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

              {/* Logout Section */}
              <div className="px-3 py-3 border-t border-gray-100">
                <div
                  onClick={() => {
                    onLogout();
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-700 transition-all duration-200 cursor-pointer group"
                >
                  <span className="text-xl">🚪</span>
                  <span className="font-medium text-gray-700 group-hover:text-red-700">Sign Out</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Overlay - Click to close */}
          <div 
            className="absolute inset-0 -z-10"
            onClick={() => setShowMobileMenu(false)}
          />
        </div>
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onFolderCreated={handleFolderCreated}
        currentFolderId={currentFolderId}
      />

      {/* Move To Folder Modal */}
      <MoveToFolderModal
        isOpen={showMoveToFolderModal}
        onClose={() => setShowMoveToFolderModal(false)}
        onMoveComplete={handleMoveComplete}
        selectedFiles={filesToMove}
        currentFolderId={currentFolderId}
      />

      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile 
          onClose={() => setShowProfile(false)}
          onUserUpdate={onUserUpdate}
        />
      )}

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onResultClick={async (file) => {
          console.log('Search result clicked:', file);
          setShowGlobalSearch(false);
          
          // Navigate to files page if not already there
          if (activePage !== 'Files') {
            setActivePage('Files');
          }
          
          try {
            // If the file is in a folder, navigate to that folder first
            if (file.folder_id) {
              console.log('Navigating to folder:', file.folder_id);
              
              // Build the path to this folder
              const buildFolderPath = async (folderId) => {
                const path = [];
                let currentId = folderId;
                
                while (currentId) {
                  try {
                    const response = await api.get(`/folders/${currentId}`);
                    const folder = response.data;
                    path.unshift(folder);
                    currentId = folder.parent_id;
                  } catch (error) {
                    console.error('Error fetching folder:', error);
                    break;
                  }
                }
                
                return path;
              };
              
              const folderPath = await buildFolderPath(file.folder_id);
              setCurrentPath(folderPath);
              setCurrentFolderId(file.folder_id);
              
              // Fetch files in that folder
              await fetchFiles(file.folder_id);
              await fetchFolders(file.folder_id);
              
            } else {
              // File is in root, navigate to root
              setCurrentFolderId(null);
              setCurrentPath([]);
              await fetchFiles(null);
              await fetchFolders(null);
            }
            
            // Highlight the specific file
            setSelectedFiles([file.id]);
            
            // Small delay to ensure the file list is rendered, then scroll to it
            setTimeout(() => {
              const fileElement = document.querySelector(`[data-file-id="${file.id}"]`);
              if (fileElement) {
                fileElement.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
                
                // Add a temporary highlight effect
                fileElement.classList.add('search-highlight');
                setTimeout(() => {
                  fileElement.classList.remove('search-highlight');
                }, 3000);
              }
            }, 500);
            
          } catch (error) {
            console.error('Error navigating to file:', error);
            setError('Failed to navigate to file location');
          }
        }}
      />

      {/* Duplicate Manager Modal */}
      <DuplicateManagerModal
        isOpen={showDuplicateManager}
        onClose={() => setShowDuplicateManager(false)}
        onDuplicatesDeleted={(result) => {
          console.log('Duplicates deleted:', result);
          // Refresh the file list after duplicates are deleted
          fetchFiles(currentFolderId);
          // Show success message
          setError(''); // Clear any existing errors
          // Could add a success notification here
        }}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activePage={activePage}
        onNavigate={setActivePage}
        onGlobalSearch={() => setShowGlobalSearch(true)}
        onToggleSidebar={() => {
          // On mobile, show mobile menu overlay
          // On desktop, toggle sidebar collapsed state
          const isMobile = window.innerWidth < 768; // md breakpoint
          if (isMobile) {
            setShowMobileMenu(!showMobileMenu);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }}
        onUpload={() => setActivePage('Upload')}
      />

      {/* AI Assistant */}
      <AIAssistant 
        files={files}
        user={user}
      />
    </div>
  );
};

export default Dashboard;
