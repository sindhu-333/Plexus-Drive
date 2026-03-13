import React, { useState, useEffect } from 'react';
import { FiX, FiLink, FiMail, FiEye, FiDownload, FiUsers, FiCopy, FiCheck, FiCalendar, FiLock, FiShare2, FiAlertCircle } from 'react-icons/fi';

const ShareModal = ({ file, isOpen, onClose, onShareCreated }) => {
  const [step, setStep] = useState(1); // 1: Type Selection, 2: Configuration, 3: Success
  const [shareType, setShareType] = useState('public'); // 'public' or 'email'
  const [shareData, setShareData] = useState({
    accessLevel: 'view',
    expiresIn: '7d',
    passwordProtected: false,
    password: '',
    emails: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [createdShare, setCreatedShare] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isInSuccessMode, setIsInSuccessMode] = useState(false);
  const [successPageLocked, setSuccessPageLocked] = useState(false);

  // Debug step changes and prevent unwanted changes
  useEffect(() => {
    console.log('📊 Step changed to:', step);
    
    // If success page is locked and step tries to change away from 3, prevent it
    if (successPageLocked && step !== 3) {
      console.log('🚫 Preventing step change - success page is locked at step 3');
      setStep(3);
    }
  }, [step, successPageLocked]);

  // Debug modal open/close (removed problematic auto-reset)
  useEffect(() => {
    console.log('🚪 Modal isOpen changed to:', isOpen);
    console.log('🎯 isInSuccessMode:', isInSuccessMode);
    console.log('� Current step:', step);
  }, [isOpen, isInSuccessMode, step]);

  const accessLevels = {
    view: { label: 'View Only', description: 'Can view and preview the file', icon: FiEye },
    download: { label: 'Download', description: 'Can view and download the file', icon: FiDownload },
    full: { label: 'Full Access', description: 'Can view, download, and manage', icon: FiUsers }
  };

  const expirationOptions = {
    '1d': '1 Day',
    '7d': '1 Week', 
    '30d': '1 Month',
    'never': 'Never'
  };

  const handleNext = () => {
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleCreateShare = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      console.log('🔗 Creating share for file:', file.id, 'Share type:', shareType);
      
      // Import api from the correct location
      const api = (await import('../api')).default;
      
      const sharePayload = {
        shareType,
        accessLevel: shareData.accessLevel,
        expiresIn: shareData.expiresIn,
        passwordProtected: shareData.passwordProtected,
        password: shareData.password,
        emails: shareData.emails,
        message: shareData.message
      };

      console.log('📤 Sending share request:', sharePayload);
      const response = await api.post(`/shares/files/${file.id}/share`, sharePayload);
      console.log('✅ Share response:', response.data);
      
      if (shareType === 'email') {
        // Handle email share response with enhanced feedback
        const emailCount = shareData.emails.split(',').filter(e => e.trim()).length;
        
        // Check for email sending results
        if (response.data.emailResults) {
          const successCount = response.data.successCount || 0;
          const failedCount = response.data.failedCount || 0;
          
          if (failedCount > 0) {
            const warningMsg = `⚠️ Partial Success:\n\n✅ ${successCount} email${successCount !== 1 ? 's' : ''} sent successfully\n❌ ${failedCount} email${failedCount !== 1 ? 's' : ''} failed to send\n\nShare links are still valid and can be shared manually.`;
            alert(warningMsg);
            setError(`Warning: ${failedCount} email${failedCount > 1 ? 's' : ''} failed to send. Share links are still valid.`);
            setSuccessMessage(`Email invitations sent successfully to ${successCount} recipient${successCount > 1 ? 's' : ''}!`);
          } else {
            const successMsg = `✅ Email invitations sent successfully to ${successCount} recipient${successCount !== 1 ? 's' : ''}!`;
            alert(successMsg);
            setSuccessMessage(successMsg);
          }
        } else if (response.data.emailError) {
          const errorMsg = `⚠️ Share Created but Email Failed:\n\nShare links have been created successfully, but emails could not be sent.\n\nYou can manually share the links with recipients.`;
          alert(errorMsg);
          setError('Share created but emails could not be sent. You can share the links manually.');
          setSuccessMessage('Share links created successfully!');
        } else {
          const successMsg = `✅ Email invitations sent successfully to ${emailCount} recipient${emailCount > 1 ? 's' : ''}!\n\nNote: Running in demo mode - emails are logged in backend console but not actually delivered to prevent spam during development.`;
          console.log('📝 Setting success message:', successMsg);
          
          // Show alert dialog that user must acknowledge
          alert(successMsg);
        }
        
        const createdShareData = {
          ...response.data.shares?.[0],
          type: shareType,
          accessLevel: shareData.accessLevel,
          emailCount: emailCount,
          message: response.data.message,
          emailResults: response.data.emailResults,
          successCount: response.data.successCount,
          failedCount: response.data.failedCount
        };
        
        setCreatedShare(createdShareData);
      } else {
        // Handle public link response
        const shareUrl = response.data.share?.shareUrl || `${window.location.origin}/share/${response.data.share?.share_token}`;
        
        const createdShareData = {
          ...response.data.share,
          url: shareUrl,
          type: shareType,
          accessLevel: shareData.accessLevel,
          expiresAt: response.data.share?.expires_at ? new Date(response.data.share.expires_at) : null,
          createdAt: new Date(response.data.share?.created_at || Date.now())
        };
        
        console.log('📝 Public link created:', shareUrl);
        console.log('📝 Created share data:', createdShareData);
        
        setCreatedShare(createdShareData);
        
        // Show alert with the actual link
        alert(`✅ Share link created successfully!\n\nLink: ${shareUrl}\n\nYou can also copy it from the next screen.`);
      }
      
      // Only move to step 3 after user acknowledges the alert
      console.log('📝 Moving to step 3...');
      console.log('🔒 Locking success page to prevent auto-close');
      setIsInSuccessMode(true);
      setSuccessPageLocked(true);
      setStep(3);
      
      // Disable callback temporarily to prevent interference
      console.log('⚠️ Callback disabled to prevent success page interference');
      // setTimeout(() => {
      //   onShareCreated?.(response.data);
      // }, 100);
      
    } catch (error) {
      console.error('❌ Share creation failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create share. Please try again.';
      setError(errorMessage);
      
      // Show user-friendly error messages
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        setError('Unable to connect to server. Please check your connection and try again.');
      } else if (error.response?.status === 404) {
        setError('File not found. Please refresh the page and try again.');
      } else if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const resetModal = () => {
    if (successPageLocked) {
      console.log('� Reset blocked - success page is locked');
      return;
    }
    
    console.log('�🔄 Resetting modal state');
    setStep(1);
    setShareType('public');
    setShareData({
      accessLevel: 'view',
      expiresIn: '7d',
      passwordProtected: false,
      password: '',
      emails: '',
      message: ''
    });
    setCreatedShare(null);
    setCopied(false);
    setError('');
    setSuccessMessage('');
    setIsInSuccessMode(false);
    setSuccessPageLocked(false);
  };

  const handleSuccessClose = () => {
    console.log('🎯 Explicitly closing from success page');
    console.log('🔓 Unlocking success page for reset');
    setSuccessPageLocked(false);
    resetModal();
    onClose();
  };

  const handleClose = () => {
    if (successPageLocked) {
      console.log('🚫 Close blocked - success page is locked. Use Done button.');
      return;
    }
    
    console.log('🚪 Modal being closed by handleClose');
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal if clicking on backdrop (but respect lock)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl lg:max-w-3xl max-h-[85vh] flex flex-col transform transition-all duration-200 scale-100 mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 lg:p-8 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FiShare2 className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">Share File</h3>
              <p className="text-sm text-gray-500 truncate max-w-md">{file?.filename}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Step 1: Share Type Selection */}
        {step === 1 && (
          <div className="p-6 lg:p-8 space-y-6">
            <h4 className="font-medium text-gray-900 mb-4">How would you like to share?</h4>
            
            {/* Public Link Option */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                shareType === 'public' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setShareType('public')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={shareType === 'public'}
                  onChange={() => setShareType('public')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FiLink className="text-blue-500" size={16} />
                    <span className="font-medium text-gray-900">Public Link</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Anyone with the link can access this file
                  </p>
                </div>
              </div>
            </div>

            {/* Email Invitation Option */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                shareType === 'email' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setShareType('email')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={shareType === 'email'}
                  onChange={() => setShareType('email')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FiMail className="text-green-500" size={16} />
                    <span className="font-medium text-gray-900">Email Invitation</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Share with specific people via email
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div className="p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Step 2 of 3</span>
              <span>•</span>
              <span className="capitalize">{shareType} Share</span>
            </div>

            {shareType === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses
                </label>
                <textarea
                  value={shareData.emails}
                  onChange={(e) => setShareData(prev => ({ ...prev, emails: e.target.value }))}
                  placeholder="Enter email addresses separated by commas"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            )}

            {/* Configuration Grid - Two Columns on Larger Screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Access Level */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Access Level
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(accessLevels).map(([key, level]) => (
                    <div
                      key={key}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        shareData.accessLevel === key 
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setShareData(prev => ({ ...prev, accessLevel: key }))}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={shareData.accessLevel === key}
                          onChange={() => setShareData(prev => ({ ...prev, accessLevel: key }))}
                          className="text-blue-500"
                        />
                        <level.icon className="text-gray-500" size={18} />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{level.label}</div>
                          <div className="text-sm text-gray-600">{level.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="inline mr-1" size={14} />
                  Expiration
                </label>
                <select
                  value={shareData.expiresIn}
                  onChange={(e) => setShareData(prev => ({ ...prev, expiresIn: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(expirationOptions).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password Protection */}
            {shareType === 'public' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="password-protection"
                    checked={shareData.passwordProtected}
                    onChange={(e) => setShareData(prev => ({ 
                      ...prev, 
                      passwordProtected: e.target.checked,
                      password: e.target.checked ? prev.password : ''
                    }))}
                    className="rounded"
                  />
                  <label htmlFor="password-protection" className="text-sm font-medium text-gray-700">
                    <FiLock className="inline mr-1" size={14} />
                    Password Protection
                  </label>
                </div>
                
                {shareData.passwordProtected && (
                  <input
                    type="password"
                    value={shareData.password}
                    onChange={(e) => setShareData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            )}

            {/* Message for Email */}
            {shareType === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={shareData.message}
                  onChange={(e) => setShareData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Add a personal message..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            )}

            {/* Success Message Display */}
            {successMessage && (
              <div className="p-3 bg-green-100 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FiCheck />
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-100 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <FiAlertCircle />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateShare}
                disabled={loading || (shareType === 'email' && !shareData.emails.trim())}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Creating...
                  </>
                ) : (
                  shareType === 'public' ? 'Create Link' : 'Send Invites'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="p-6 lg:p-8 space-y-6">
            {/* Success Page Lock Indicator */}
            {successPageLocked && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <span className="text-lg">🔒</span>
                  <span className="font-semibold">Success Page Protected</span>
                </div>
                <p className="text-xs text-blue-600 text-center mt-1">
                  This page won't auto-close. Use the "Done" button when finished.
                </p>
              </div>
            )}
            
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FiCheck className="text-green-600" size={24} />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {shareType === 'public' ? 'Share Link Created!' : 'Email Invites Sent!'}
              </h4>
              <p className="text-sm text-gray-600">
                {shareType === 'public' 
                  ? 'Your file is now accessible via the secure link below'
                  : (() => {
                      if (createdShare?.emailResults) {
                        const success = createdShare.successCount || 0;
                        const failed = createdShare.failedCount || 0;
                        if (failed > 0) {
                          return `${success} email${success !== 1 ? 's' : ''} sent successfully. ${failed} failed to send but share links are still valid.`;
                        }
                        return `Email invitations sent successfully to ${success} recipient${success !== 1 ? 's' : ''}`;
                      }
                      return createdShare?.emailCount 
                        ? `Email invitations have been sent to ${createdShare.emailCount} recipient${createdShare.emailCount > 1 ? 's' : ''}`
                        : 'Email invitations have been sent successfully';
                    })()
                }
              </p>
            </div>

            {shareType === 'public' && createdShare?.url && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-300 shadow-lg">
                {/* Prominent Success Alert */}
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <FiCheck className="text-green-600" size={20} />
                    <span className="font-bold text-lg">🎉 Public Share Link Created!</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">Anyone with this link can access your file.</p>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <FiLink className="text-blue-600" size={20} />
                  <span className="font-bold text-gray-900 text-lg">Your Secure Share Link</span>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={createdShare.url}
                    readOnly
                    className="flex-1 p-4 bg-white border-2 border-blue-300 rounded-lg text-sm font-mono font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => copyToClipboard(createdShare.url)}
                    className={`px-6 py-4 rounded-lg transition-all duration-200 font-bold text-sm ${
                      copied 
                        ? 'bg-green-500 text-white shadow-xl border-2 border-green-400' 
                        : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-xl border-2 border-blue-400'
                    }`}
                    title={copied ? 'Copied!' : 'Copy link'}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
                

                
                <p className="text-xs text-blue-700 bg-blue-100 p-3 rounded-lg border border-blue-200">
                  🔒 This link is secure and will expire {shareData.expiresIn === 'never' ? 'never' : `in ${expirationOptions[shareData.expiresIn]?.toLowerCase()}`}
                </p>
              </div>
            )}

            {shareType === 'email' && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                {/* Prominent Success Alert */}
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <FiCheck className="text-green-600" size={20} />
                    <span className="font-semibold">✅ Email invitations sent successfully!</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">📧 Note: In demo mode, emails are logged but not actually delivered to prevent spam during development.</p>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FiMail className="text-green-600" size={16} />
                  <span className="font-semibold text-gray-900">Email Invitations</span>
                </div>
                <div className="text-sm text-green-700">
                  <p className="mb-2">📧 Invitations sent to:</p>
                  <div className="bg-white p-2 rounded border border-green-300">
                    {shareData.emails.split(',').map((email, index) => (
                      <div key={index} className="text-gray-700 py-1">
                        • {email.trim()}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-600 mt-2 bg-green-100 p-2 rounded">
                    📬 Recipients will receive an email with access instructions
                  </p>
                </div>
              </div>
            )}

            {/* Share Analytics */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Access Level:</span>
                  <span className="capitalize font-medium">{accessLevels[shareData.accessLevel].label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expires:</span>
                  <span className="font-medium">
                    {createdShare.expiresAt ? createdShare.expiresAt.toLocaleDateString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-medium">Just now</span>
                </div>
                {shareData.passwordProtected && (
                  <div className="flex justify-between">
                    <span>Protection:</span>
                    <span className="font-medium text-green-600">Password Protected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSuccessClose}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;