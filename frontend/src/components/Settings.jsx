import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  FiSettings, 
  FiGlobe, 
  FiClock,
  FiSave,
  FiX,
  FiMoon,
  FiSun,
  FiMonitor
} from 'react-icons/fi';

const Settings = ({ onClose, onUserUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Settings data
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC'
  });

  const [originalSettings, setOriginalSettings] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  // Apply theme immediately when changed
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (settings.theme === 'auto') {
      // Auto theme based on system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/user/profile');
      const userData = response.data;
      
      const settingsData = {
        theme: userData.theme || 'light',
        language: userData.language || 'en',
        timezone: userData.timezone || 'UTC'
      };
      
      setSettings(settingsData);
      setOriginalSettings({ ...settingsData });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to load settings');
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError('');
      
      await api.put('/user/profile', settings);

      setSuccess('Settings updated successfully!');
      setOriginalSettings({ ...settings });
      
      // Update user object with new settings (including theme)
      if (onUserUpdate) {
        onUserUpdate(settings);
      }
      
      // Force refresh user data to get updated theme
      try {
        const userResponse = await api.get('/auth/me');
        if (onUserUpdate) {
          onUserUpdate(userResponse.data);
        }
      } catch (refreshError) {
        console.error('Failed to refresh user data:', refreshError);
      }
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Settings update error:', error);
      setError(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiSettings size={24} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX size={24} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-8">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-800">{success}</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Appearance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: FiSun },
                  { value: 'dark', label: 'Dark', icon: FiMoon },
                  { value: 'auto', label: 'Auto', icon: FiMonitor }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSettings({ ...settings, theme: value })}
                    className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 ${
                      settings.theme === value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={24} className={settings.theme === value ? 'text-blue-600' : 'text-gray-600'} />
                    <span className={`text-sm font-medium ${settings.theme === value ? 'text-blue-600' : 'text-gray-600'}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Localization */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Localization</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiGlobe size={16} className="inline mr-2" />
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiClock size={16} className="inline mr-2" />
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                </select>
              </div>
            </div>
          </div>



          {/* Save Button */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiSave size={20} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;