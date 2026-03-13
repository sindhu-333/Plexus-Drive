import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  FiUser, 
  FiSettings, 
  FiMail, 
  FiLock, 
  FiCamera, 
  FiSave,
  FiEye,
  FiEyeOff,
  FiPhone,
  FiMapPin,
  FiCalendar,
  FiGlobe,
  FiClock,
  FiBell,
  FiTrash2,
  FiHardDrive
} from 'react-icons/fi';

const UserProfile = ({ onClose, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalProfile, setOriginalProfile] = useState({});
  const [originalSettings, setOriginalSettings] = useState({});
  
  // Profile data
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    phone: '',
    date_of_birth: '',
    location: '',
    profile_picture: ''
  });
  
  // Settings data
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    email_notifications: true
  });
  
  // Password change data
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  
  // Email change data
  const [emailChange, setEmailChange] = useState({
    newEmail: '',
    password: ''
  });
  
  // Storage stats
  const [storageStats, setStorageStats] = useState({
    storage_limit: 0,
    used_storage: 0,
    available_storage: 0,
    usage_percentage: 0,
    total_files: 0
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate profile completeness
  const getProfileCompleteness = () => {
    const fields = [
      profile.name,
      profile.bio,
      profile.phone,
      profile.date_of_birth,
      profile.location,
      profile.profile_picture
    ];
    const filledFields = fields.filter(field => field && field.trim() !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  // Check for changes
  const checkForChanges = () => {
    const profileChanged = JSON.stringify(profile) !== JSON.stringify(originalProfile);
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(profileChanged || settingsChanged);
  };

  // Profile picture upload handler
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile picture must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      setError('');
      setSaving(true);

      try {
        // Create form data for file upload
        const formData = new FormData();
        formData.append('profilePicture', file);

        const response = await api.post('/user/profile-picture', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        // Update profile with new picture URL
        setProfile(prev => ({ 
          ...prev, 
          profile_picture: `${import.meta.env.VITE_BACKEND_URL}${response.data.profile_picture}`
        }));
        
        setSuccess('Profile picture updated successfully!');
        setTimeout(() => setSuccess(''), 3000);

        // Notify parent to update user data
        if (onUserUpdate) {
          onUserUpdate();
        }

      } catch (err) {
        setError(err.response?.data?.message || 'Failed to upload profile picture');
      } finally {
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchStorageStats();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [profile, settings, originalProfile, originalSettings]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/profile');
      const userData = response.data;
      const profileData = {
        name: userData.name || '',
        email: userData.email || '',
        bio: userData.bio || '',
        phone: userData.phone || '',
        date_of_birth: userData.date_of_birth ? userData.date_of_birth.split('T')[0] : '',
        location: userData.location || '',
        profile_picture: userData.profile_picture ? `${import.meta.env.VITE_BACKEND_URL}${userData.profile_picture}` : ''
      };
      
      const settingsData = {
        theme: userData.theme || 'light',
        language: userData.language || 'en',
        timezone: userData.timezone || 'UTC',
        email_notifications: userData.email_notifications !== null ? userData.email_notifications : true
      };
      
      setProfile(profileData);
      setOriginalProfile(profileData);
      setSettings(settingsData);
      setOriginalSettings(settingsData);
      setHasChanges(false);
      
    } catch (err) {
      setError('Failed to load profile data');
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/user/storage-stats');
      setStorageStats(response.data);
    } catch (err) {
      console.error('Fetch storage stats error:', err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/user/profile', {
        name: profile.name,
        bio: profile.bio,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth || null,
        location: profile.location,
        ...settings
      });
      
      // Update original values after successful save
      setOriginalProfile({ ...profile });
      setOriginalSettings({ ...settings });
      setHasChanges(false);
      
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
      // Apply theme immediately if changed
      if (settings.theme !== originalSettings.theme) {
        if (settings.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
      setError('New passwords do not match');
      return;
    }
    
    if (passwords.new.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/user/password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      
      setSuccess('Password changed successfully!');
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    
    if (!emailChange.newEmail || !emailChange.password) {
      setError('Both new email and password are required');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/user/email', {
        newEmail: emailChange.newEmail,
        password: emailChange.password
      });
      
      setSuccess('Email changed successfully!');
      setEmailChange({ newEmail: '', password: '' });
      setTimeout(() => setSuccess(''), 3000);
      // Refresh profile to get new email
      fetchProfile();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <FiUser className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Profile</h2>
              <p className="text-sm text-gray-600">Manage your account settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row h-full max-h-[calc(90vh-100px)]">
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200">
            <nav className="p-4 space-y-2">
              {[
                { id: 'profile', label: 'Profile Info', icon: FiUser },
                { id: 'storage', label: 'Storage', icon: FiHardDrive }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                  {success}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                        <p className="text-sm text-gray-600">Complete your profile to personalize your experience</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">Profile Completeness</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                              style={{ width: `${getProfileCompleteness()}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{getProfileCompleteness()}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Profile Picture */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profile Picture
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-300 transition-colors"
                             onClick={() => document.getElementById('profilePictureInput').click()}>
                          {profile.profile_picture ? (
                            <img src={profile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <FiUser size={24} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <input
                            type="file"
                            id="profilePictureInput"
                            accept="image/*"
                            onChange={handleProfilePictureUpload}
                            className="hidden"
                            disabled={saving}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('profilePictureInput').click()}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                          >
                            {saving ? (
                              <>
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <FiCamera size={16} />
                                Change Photo
                              </>
                            )}
                          </button>
                          <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG</p>
                          {profile.profile_picture && (
                            <button
                              type="button"
                              onClick={() => setProfile(prev => ({ ...prev, profile_picture: '' }))}
                              className="mt-2 text-sm text-red-600 hover:text-red-700"
                            >
                              Remove Photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiUser size={16} className="inline mr-2" />
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiMail size={16} className="inline mr-2" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 cursor-not-allowed"
                          placeholder="Email cannot be changed here"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiPhone size={16} className="inline mr-2" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your phone number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiCalendar size={16} className="inline mr-2" />
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={profile.date_of_birth}
                          onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiMapPin size={16} className="inline mr-2" />
                          Location
                        </label>
                        <input
                          type="text"
                          value={profile.location}
                          onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your location"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bio
                        </label>
                        <textarea
                          value={profile.bio}
                          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={saving || !hasChanges}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                        hasChanges && !saving
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <FiSave size={16} />
                          {hasChanges ? 'Save Changes' : 'No Changes'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}


              {/* Storage Tab */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">
                          {formatFileSize(storageStats.used_storage)} / {formatFileSize(storageStats.storage_limit)}
                        </h4>
                        <p className="text-gray-600">{storageStats.usage_percentage}% used</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Available</p>
                        <p className="font-semibold text-green-600">
                          {formatFileSize(storageStats.available_storage)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(storageStats.usage_percentage, 100)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Total Files: {storageStats.total_files}</span>
                      <span>Storage Limit: {formatFileSize(storageStats.storage_limit)}</span>
                    </div>
                  </div>

                  {/* Storage Tips */}
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h5 className="font-semibold text-gray-900 mb-3">Storage Tips</h5>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Delete unused files to free up space</li>
                      <li>• Compress large files before uploading</li>
                      <li>• Use cloud links instead of uploading large media files</li>
                      <li>• Regularly clean up temporary and duplicate files</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;