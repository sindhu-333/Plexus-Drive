import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiCheck, FiX, FiMail, FiRefreshCw, FiArrowLeft } from 'react-icons/fi';
import api from '../api';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
      setMessage('No verification token found in URL. You can use manual verification below if you have a token from your email.');
      setShowManualEntry(true); // Show manual entry by default when no token
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/auth/verify-email?token=${token}`);
      setStatus('success');
      setMessage(response.data.message);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Email verified successfully! You can now log in.' }
        });
      }, 3000);
      
    } catch (error) {
      setStatus('error');
      if (error.response?.status === 400) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes('expired')) {
          setStatus('expired');
        }
        setMessage(errorMessage);
      } else {
        setMessage('Email verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;

    try {
      setLoading(true);
      await api.post('/auth/resend-verification', { email: resendEmail });
      setMessage('Verification email sent successfully! Please check your inbox.');
      setResendEmail('');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerification = async (e) => {
    e.preventDefault();
    if (!manualToken) return;

    try {
      setLoading(true);
      const response = await api.get(`/auth/verify-email?token=${manualToken}`);
      setStatus('success');
      setMessage(response.data.message);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Email verified successfully! You can now log in.' }
        });
      }, 3000);
      
    } catch (error) {
      setStatus('error');
      if (error.response?.status === 400) {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes('expired')) {
          setStatus('expired');
        }
        setMessage(errorMessage);
      } else {
        setMessage('Email verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <FiCheck size={48} className="text-green-500" />;
      case 'error':
      case 'expired':
        return <FiX size={48} className="text-red-500" />;
      default:
        return <FiRefreshCw size={48} className="text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'green';
      case 'error':
      case 'expired':
        return 'red';
      default:
        return 'blue';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              {getStatusIcon()}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
              {status === 'expired' && 'Link Expired'}
              {status === 'verifying' && 'Verifying Email...'}
            </h2>
          </div>

          {/* Status Message */}
          <div className={`p-4 rounded-lg mb-6 bg-${getStatusColor()}-50 border border-${getStatusColor()}-200`}>
            <p className={`text-${getStatusColor()}-700 text-center`}>
              {message}
            </p>
          </div>

          {/* Success Actions */}
          {status === 'success' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  🎉 Your account is now active! Redirecting to login in 3 seconds...
                </p>
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Login Now
                </Link>
              </div>
            </div>
          )}

          {/* Error/Expired Actions */}
          {(status === 'error' || status === 'expired') && (
            <div className="space-y-4">
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  <FiMail className="inline mr-2" />
                  Resend Verification Email
                </h3>
                <form onSubmit={handleResendVerification} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || !resendEmail}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <FiRefreshCw className="animate-spin -ml-1 mr-3 h-4 w-4" />
                        Sending...
                      </>
                    ) : (
                      'Resend Verification Email'
                    )}
                  </button>
                </form>
              </div>

              {/* Manual Token Verification - Cross-Network Solution */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="text-sm font-medium text-gray-900 mb-3 flex items-center justify-between w-full"
                >
                  🌐 Manual Verification (Cross-Network)
                  <span className="text-xs text-gray-500">
                    {showManualEntry ? '▲' : '▼'}
                  </span>
                </button>
                
                {showManualEntry && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      If you're on a different network, copy the verification token from your email and paste it below:
                    </p>
                    <form onSubmit={handleManualVerification} className="space-y-3">
                      <input
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Paste your verification token here"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                        required
                      />
                      <button
                        type="submit"
                        disabled={loading || !manualToken}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <FiRefreshCw className="animate-spin -ml-1 mr-3 h-4 w-4" />
                            Verifying...
                          </>
                        ) : (
                          'Verify Manually'
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-500 flex items-center justify-center"
            >
              <FiArrowLeft className="mr-1" size={16} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;