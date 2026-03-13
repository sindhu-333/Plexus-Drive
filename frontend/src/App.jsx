import React, { useState, useEffect, Suspense, lazy } from 'react';
import LandingPage from './components/LandingPage';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import PublicShareViewer from './components/PublicShareViewer';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import ResetPasswordForm from './components/ResetPasswordForm';
import EmailVerification from './components/EmailVerification';
import IPRedirectHandler from './components/IPRedirectHandler';
import api, { setToken as setApiToken } from './api';
import { Routes, Route, Navigate } from 'react-router-dom';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const tokenCookie = cookies.find(c => c.startsWith('token='));
    const storedToken = tokenCookie ? tokenCookie.split('=')[1] : null;
    if (storedToken) {
      setApiToken(storedToken);
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken) => {
    try {
      console.log('Fetching user with token:', authToken);
      const response = await api.get('/auth/me');
      console.log('User fetched successfully:', response.data);
      const userData = response.data;
      setUser(userData);
      setToken(authToken);
      
      // Apply user's theme preference
      const theme = userData.theme || 'light';
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else if (theme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (newToken, userData) => {
    setApiToken(newToken);
    setToken(newToken);
    setUser(userData);
  };

  const handleUserUpdate = async () => {
    if (token) {
      try {
        const response = await api.get('/auth/me');
        const userData = response.data;
        setUser(userData);
        
        // Apply updated theme
        const theme = userData.theme || 'light';
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else if (theme === 'auto') {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }
  };

  const handleLogout = () => {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setToken(null);
    setUser(null);
    setApiToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <IPRedirectHandler>
      <div className="min-h-screen bg-gray-100">
        <Routes>
        {/* Landing Page */}
        <Route path="/" element={token && user ? <Navigate to="/dashboard" /> : <LandingPage />} />

        {/* Auth Pages */}
        <Route
          path="/auth"
          element={token && user ? <Navigate to="/dashboard" /> : <LoginForm onLogin={handleLogin} />}
        />
        <Route
          path="/login"
          element={token && user ? <Navigate to="/dashboard" /> : <LoginForm onLogin={handleLogin} />}
        />
        <Route
          path="/signup"
          element={token && user ? <Navigate to="/dashboard" /> : <SignupForm onSignup={handleLogin} />}
        />

        {/* Email Verification - No authentication required */}
        <Route
          path="/verify-email"
          element={<EmailVerification />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            token && user ? (
              <Suspense fallback={<div className="text-xl">Loading Dashboard...</div>}>
                <Dashboard user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </Suspense>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Public Share Viewer - No authentication required */}
        <Route
          path="/share/:token"
          element={<PublicShareViewer />}
        />

        {/* Password Reset Routes - No authentication required */}
        <Route
          path="/forgot-password"
          element={token && user ? <Navigate to="/dashboard" /> : <ForgotPasswordForm />}
        />
        <Route
          path="/reset-password/:token"
          element={token && user ? <Navigate to="/dashboard" /> : <ResetPasswordForm />}
        />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </IPRedirectHandler>
  );
}

export default App;
