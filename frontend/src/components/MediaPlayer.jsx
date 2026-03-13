import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { 
  FiPlay, 
  FiPause, 
  FiVolume2, 
  FiVolumeX, 
  FiMaximize, 
  FiDownload,
  FiX,
  FiSkipBack,
  FiSkipForward
} from 'react-icons/fi';

const MediaPlayer = ({ file, onClose, onDownload }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);

  // Validate file object
  if (!file || !file.id || !file.filename) {
    console.error('❌ Invalid file object passed to MediaPlayer:', file);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h3 className="text-lg font-bold text-red-600 mb-4">Error</h3>
          <p className="text-gray-700 mb-4">Invalid file data. Cannot open media player.</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  
  const mediaRef = useRef(null);
  const containerRef = useRef(null);
  
  const isVideo = file.mimetype.startsWith('video/');
  const isAudio = file.mimetype.startsWith('audio/');
  
  // Load media with authentication
  useEffect(() => {
    const loadMedia = async () => {
      try {
        console.log(`🎵 Loading media file:`, {
          id: file.id,
          filename: file.filename,
          mimetype: file.mimetype,
          filesize: file.filesize,
          user_id: file.user_id
        });
        
        setLoading(true);
        setError(null);
        
        // For small files, use blob URL. For large files, use direct streaming
        const isLargeFile = file.filesize > 50 * 1024 * 1024; // 50MB threshold
        
        if (isLargeFile) {
          // Use direct URL for large files (with authentication handled by cookies)
          const directUrl = `${import.meta.env.VITE_API_URL}/files/preview/${file.id}`;
          console.log('Using direct URL for large file:', directUrl);
          
          // Pre-flight check for large files using api object for proper auth
          try {
            const testResponse = await api.head(`/files/preview/${file.id}`);
            console.log('✅ Pre-flight check passed for direct URL');
            setMediaUrl(directUrl);
          } catch (preflightError) {
            console.error('❌ Pre-flight check failed:', preflightError);
            if (preflightError.response?.status === 401) {
              throw new Error(`Authentication failed. Please refresh the page and log in again.`);
            } else if (preflightError.response?.status === 404) {
              throw new Error(`File not found. It may have been deleted or moved.`);
            } else {
              throw new Error(`File access check failed: ${preflightError.message}`);
            }
          }
        } else {
          // Fetch as blob for smaller files using api object for proper auth
          const response = await api.get(`/files/preview/${file.id}`, {
            responseType: 'blob',
            headers: {
              'Accept': file.mimetype
            }
          });
          
          const blob = response.data;
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created blob URL for small file:', blobUrl, 'Size:', blob.size);
          setMediaUrl(blobUrl);
        }
        
      } catch (err) {
        console.error('Failed to load media:', err);
        
        // Try fallback with download endpoint
        console.log('Trying fallback with download endpoint...');
        try {
          await api.head(`/files/download/${file.id}`);
          console.log('✅ Download endpoint accessible, using as fallback');
          const downloadUrl = `${import.meta.env.VITE_API_URL}/files/download/${file.id}`;
          setMediaUrl(downloadUrl);
          setError(`Preview failed: ${err.message}. Using download stream as fallback.`);
        } catch (fallbackError) {
          console.error('❌ All fallback attempts failed:', fallbackError);
          let errorMsg = `Failed to load media: ${err.message}`;
          
          if (fallbackError.response?.status === 401) {
            errorMsg += '. Authentication failed - please refresh the page and log in again.';
          } else if (fallbackError.response?.status === 404) {
            errorMsg += '. File not found - it may have been deleted.';
          } else {
            errorMsg += `. Fallback also failed: ${fallbackError.message}`;
          }
          
          setError(errorMsg);
          setLoading(false);
        }
      }
    };
    
    loadMedia();
    
    // Cleanup blob URL on unmount
    return () => {
      if (mediaUrl && mediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [file.id, file.mimetype, file.filesize]);
  
  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  // Handle seek
  const handleSeek = (e) => {
    const progress = parseFloat(e.target.value);
    const newTime = (progress / 100) * duration;
    if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };
  
  // Skip forward/backward
  const skip = (seconds) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Media event handlers
  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      setLoading(false);
    }
  };
  
  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };
  
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => setIsPlaying(false);
  
  const handleError = (e) => {
    console.error('Media playback error:', e);
    console.error('Media element error details:', {
      error: e.target?.error,
      code: e.target?.error?.code,
      message: e.target?.error?.message,
      networkState: e.target?.networkState,
      readyState: e.target?.readyState,
      src: e.target?.src
    });
    
    // Get more specific error information
    let errorMessage = 'Failed to load media file.';
    let debugInfo = '';
    
    if (e.target && e.target.error) {
      switch (e.target.error.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = 'Media loading was aborted.';
          debugInfo = 'The user aborted the loading process.';
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = 'Network error occurred while loading media.';
          debugInfo = 'Check your internet connection or server availability.';
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage = 'Media format is not supported or file is corrupted.';
          debugInfo = 'The file may be corrupted or in an unsupported format.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage = 'Media format is not supported by your browser.';
          debugInfo = 'Try a different browser or convert the file to a supported format.';
          break;
        default:
          errorMessage = `Unknown media error (code: ${e.target.error.code}).`;
          debugInfo = 'An unexpected error occurred during playback.';
      }
    }
    
    // Add network state info for debugging
    if (e.target) {
      const networkStates = {
        0: 'NETWORK_EMPTY - no data yet',
        1: 'NETWORK_IDLE - data loading complete', 
        2: 'NETWORK_LOADING - currently loading',
        3: 'NETWORK_NO_SOURCE - no source set'
      };
      debugInfo += ` | Network: ${networkStates[e.target.networkState] || e.target.networkState}`;
    }
    
    console.error(`❌ Media Error: ${errorMessage} - ${debugInfo}`);
    setError(`${errorMessage} ${debugInfo}`);
    setLoading(false);
  };
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          if (isVideo) toggleFullscreen();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, currentTime, duration, isVideo]);
  
  // Calculate progress percentage
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  
  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}
    >
      <div className={`bg-white rounded-lg overflow-hidden shadow-2xl ${isFullscreen ? 'w-full h-full rounded-none' : 'max-w-4xl w-full max-h-[90vh]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              {isVideo ? '🎥' : '🎵'}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{file.filename}</h3>
              <p className="text-sm text-gray-500">
                {isVideo ? 'Video' : 'Audio'} • {(file.filesize / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownload(file)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Download"
            >
              <FiDownload size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Close"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        
        {/* Media Player */}
        <div className="relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading media...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-white text-center p-8 max-w-md">
                <FiX size={48} className="mx-auto mb-4 text-red-400" />
                <p className="text-lg mb-2 font-semibold">Playback Error</p>
                <p className="text-sm text-gray-300 mb-4">{error}</p>
                
                <div className="space-y-2 text-xs text-gray-400 mb-6">
                  <p><strong>Troubleshooting:</strong></p>
                  <p>• Check if the file still exists</p>
                  <p>• Try refreshing the page</p>
                  <p>• Download the file instead</p>
                  <p>• Try a different browser</p>
                </div>
                
                <div className="flex space-x-2 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      console.log('🔄 Retrying media load...');
                      setError(null);
                      setLoading(true);
                      // Trigger reload by clearing and setting mediaUrl
                      setMediaUrl(null);
                      setTimeout(() => {
                        const directUrl = `${import.meta.env.VITE_API_URL}/files/preview/${file.id}`;
                        setMediaUrl(directUrl);
                      }, 100);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                  >
                    Retry
                  </button>
                  <button
                    onClick={async () => {
                      console.log('🧪 Testing URL access...');
                      try {
                        const response = await api.head(`/files/preview/${file.id}`);
                        console.log('🧪 URL test result:', response.status, response.statusText);
                        alert(`URL Test: Success! File is accessible.`);
                      } catch (testErr) {
                        console.error('🧪 URL test failed:', testErr);
                        let errorMsg = 'URL Test Failed: ';
                        if (testErr.response?.status === 401) {
                          errorMsg += 'Authentication required - please refresh and log in';
                        } else if (testErr.response?.status === 404) {
                          errorMsg += 'File not found';
                        } else {
                          errorMsg += testErr.message;
                        }
                        alert(errorMsg);
                      }
                    }}
                    className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                  >
                    Test URL
                  </button>
                  <button
                    onClick={() => {
                      const testUrl = `${import.meta.env.VITE_API_URL}/files/preview/${file.id}`;
                      window.open(testUrl, '_blank');
                    }}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                  >
                    Open URL
                  </button>
                  <button
                    onClick={() => onDownload(file)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {mediaUrl && isVideo ? (
            <video
              ref={mediaRef}
              src={mediaUrl}
              className={`w-full ${isFullscreen ? 'h-screen' : 'max-h-96'} bg-black`}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onError={handleError}
              preload="metadata"
              crossOrigin="use-credentials"
            />
          ) : mediaUrl && isAudio ? (
            <div className="flex items-center justify-center h-64 bg-gradient-to-br from-blue-600 to-purple-700">
              <audio
                ref={mediaRef}
                src={mediaUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onError={handleError}
                preload="metadata"
                crossOrigin="use-credentials"
              />
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <span className="text-4xl">🎵</span>
                </div>
                <h4 className="text-xl font-medium mb-2">{file.filename}</h4>
                <p className="text-blue-100">Audio Player</p>
              </div>
            </div>
          ) : null}
        </div>
        
        {/* Controls */}
        <div className="p-4 bg-gray-50">
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${progressPercent}%, #E5E7EB ${progressPercent}%, #E5E7EB 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => skip(-10)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Skip back 10s"
              >
                <FiSkipBack size={20} />
              </button>
              
              <button
                onClick={togglePlayPause}
                disabled={loading || error}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
              </button>
              
              <button
                onClick={() => skip(10)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Skip forward 10s"
              >
                <FiSkipForward size={20} />
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Volume Control */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              {/* Fullscreen for videos */}
              {isVideo && (
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Fullscreen"
                >
                  <FiMaximize size={18} />
                </button>
              )}
            </div>
          </div>
          
          {/* Debug info in development */}
          {import.meta.env.DEV && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer font-semibold mb-2">Debug Info (Dev Mode)</summary>
                <div className="space-y-1 font-mono bg-gray-50 p-2 rounded">
                  <div><strong>File ID:</strong> {file.id}</div>
                  <div><strong>Filename:</strong> {file.filename}</div>
                  <div><strong>MIME Type:</strong> {file.mimetype}</div>
                  <div><strong>File Size:</strong> {(file.filesize / (1024 * 1024)).toFixed(2)} MB</div>
                  <div><strong>Media URL:</strong> {mediaUrl || 'Not set'}</div>
                  <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
                  <div><strong>Error:</strong> {error || 'None'}</div>
                  <div><strong>Duration:</strong> {duration ? formatTime(duration) : 'Unknown'}</div>
                </div>
              </details>
            </div>
          )}
          
          {/* Keyboard shortcuts help */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              <strong>Keyboard shortcuts:</strong> Space (play/pause), ← → (skip 10s), M (mute), F (fullscreen)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;