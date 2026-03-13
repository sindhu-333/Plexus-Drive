import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

const AuthPage = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);

    const handleAuth = (token, user) => {
        localStorage.setItem('token', token);
        onAuthSuccess(token, user);
    };

    const toggleForm = () => {
        setIsLogin(!isLogin);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    {isLogin ? (
                        <LoginForm onLogin={handleAuth} onToggleForm={toggleForm} />
                    ) : (
                        <SignupForm onSignup={handleAuth} onToggleForm={toggleForm} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthPage;