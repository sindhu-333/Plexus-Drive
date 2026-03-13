import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck, FiX } from 'react-icons/fi';
import api from '../api';

const SignupForm = ({ onSignup, onToggleForm }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [emailSent, setEmailSent] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [registrationComplete, setRegistrationComplete] = useState(false);
    
    // Password strength checker
    const getPasswordStrength = (password) => {
        if (!password) return { score: 0, requirements: [] };
        
        const requirements = [
            { met: password.length >= 8, text: 'At least 8 characters' },
            { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
            { met: /[a-z]/.test(password), text: 'One lowercase letter' },
            { met: /\d/.test(password), text: 'One number' },
            { met: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'One special character' }
        ];
        
        const score = requirements.filter(req => req.met).length;
        return { score, requirements };
    };
    
    // Resend verification email
    const handleResendVerification = async () => {
        if (!formData.email) return;
        
        try {
            setResendingEmail(true);
            await api.post('/auth/resend-verification', { email: formData.email });
            setErrors({
                success: 'Verification email sent again! Please check your inbox and spam folder.'
            });
        } catch (error) {
            setErrors({
                general: error.response?.data?.message || 'Failed to resend verification email'
            });
        } finally {
            setResendingEmail(false);
        }
    };
    
    // Clear form data
    const handleClearForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            confirmPassword: ''
        });
        setErrors({});
        setEmailSent(false);
        setRegistrationComplete(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear specific error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Full name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters long';
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else {
            // Enhanced password validation
            const passwordRequirements = [];
            if (formData.password.length < 8) {
                passwordRequirements.push('at least 8 characters');
            }
            if (!/[A-Z]/.test(formData.password)) {
                passwordRequirements.push('one uppercase letter');
            }
            if (!/[a-z]/.test(formData.password)) {
                passwordRequirements.push('one lowercase letter');
            }
            if (!/\d/.test(formData.password)) {
                passwordRequirements.push('one number');
            }
            if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
                passwordRequirements.push('one special character');
            }
            
            if (passwordRequirements.length > 0) {
                newErrors.password = `Password must contain ${passwordRequirements.join(', ')}`;
            }
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await api.post('/auth/register', {
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password
            });
            
            // Set email sent state instead of auto-login
            setEmailSent(true);
            setRegistrationComplete(true);
            setErrors({
                success: `Registration successful! Please check your email (${formData.email}) to verify your account before logging in.`
            });
        } catch (err) {
            if (err.response?.data?.errors) {
                // Handle validation errors from backend
                const backendErrors = {};
                err.response.data.errors.forEach(error => {
                    backendErrors[error.field] = error.message;
                });
                setErrors(backendErrors);
            } else {
                setErrors({ 
                    general: err.response?.data?.message || 'Registration failed. Please try again.' 
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
    const passwordStrength = getPasswordStrength(formData.password);
    const passwordValid = passwordStrength.score === 5; // All 5 requirements met

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiUser size={32} className="text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
                        <p className="text-gray-600">
                            Join Plexus Drive and start sharing files securely
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Full Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${
                                        errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter your full name"
                                    required
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${
                                        errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${
                                        errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Create a password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                                </button>
                            </div>
                            {/* Password Requirements */}
                            {formData.password && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Password Requirements:</div>
                                    {getPasswordStrength(formData.password).requirements.map((req, index) => (
                                        <div key={index} className={`flex items-center text-sm ${req.met ? 'text-green-600' : 'text-red-500'}`}>
                                            {req.met ? <FiCheck size={14} className="mr-2" /> : <FiX size={14} className="mr-2" />}
                                            {req.text}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${
                                        errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Confirm your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                                </button>
                            </div>
                            {formData.confirmPassword && (
                                <div className="mt-2 flex items-center gap-2">
                                    {passwordsMatch ? (
                                        <FiCheck className="text-green-500" size={16} />
                                    ) : (
                                        <FiX className="text-red-500" size={16} />
                                    )}
                                    <span className={`text-sm ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                                    </span>
                                </div>
                            )}
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                            )}
                        </div>

                        {/* General Error */}
                        {errors.general && !errors.success && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-sm">{errors.general}</p>
                            </div>
                        )}
                        
                        {/* Success Message */}
                        {errors.success && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <FiCheck className="text-green-500 mt-0.5" size={20} />
                                    <div className="flex-1">
                                        <p className="text-green-700 font-medium">Registration Successful!</p>
                                        <p className="text-green-600 text-sm mt-1">{errors.success}</p>
                                        {emailSent && (
                                            <div className="mt-3 text-sm text-green-600">
                                                <p>📧 <strong>Important:</strong> Check your email inbox and spam folder</p>
                                                <p>🔒 You must verify your email before you can login</p>
                                                <p>📱 The verification link will expire in 24 hours</p>
                                                
                                                {/* Action Buttons */}
                                                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={handleResendVerification}
                                                        disabled={resendingEmail}
                                                        className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        {resendingEmail ? (
                                                            <>
                                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Sending...
                                                            </>
                                                        ) : (
                                                            '📧 Resend Verification Email'
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleClearForm}
                                                        className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                                    >
                                                        🆕 Register Another Account
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !passwordValid || !passwordsMatch || !formData.name || !formData.email || registrationComplete}
                            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                        >
                            {isLoading ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Creating Account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Navigation */}
                    <div className="mt-6 text-center space-y-4">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            {onToggleForm ? (
                                <button
                                    onClick={onToggleForm}
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Sign in
                                </button>
                            ) : (
                                <Link to="/auth" className="text-blue-600 hover:text-blue-700 font-medium">
                                    Sign in
                                </Link>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignupForm;