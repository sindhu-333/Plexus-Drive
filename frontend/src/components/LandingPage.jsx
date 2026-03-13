import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const images = [
  '/cld.jpg',
  '/cld4.jpg',
  '/cloud3.jpg'
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage(prev => (prev + 1) % images.length);
    }, 2000); // change every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center">
        {/* Background image + gradient overlay */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-1000"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${images[currentImage]})`,
          }}
        ></div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl sm:text-6xl font-extrabold text-white drop-shadow-lg animate-fade-in">
            Welcome to Plexus Drive
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/90 drop-shadow-md max-w-2xl mx-auto animate-fade-in delay-200">
            Securely store, manage, and share your files in one place. Experience cloud storage like never before.
          </p>
          <div className="mt-10 flex justify-center gap-6 flex-wrap">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:bg-blue-50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Floating shapes */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>

        {/* Scroll Down Button */}
        <button
          onClick={scrollToFeatures}
          className="absolute bottom-10 left-3/2 transform -translate-x-1/2 px-4 py-3 rounded-full bg-white/30 backdrop-blur-md text-white font-bold animate-bounce hover:scale-110 transition-all duration-300"
        >
          ⬇ Scroll 
        </button>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900">Why Choose Plexus Drive?</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            We provide a secure, fast, and user-friendly cloud storage solution for all your files.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Secure Storage</h3>
              <p className="text-gray-600">All your files are encrypted and stored securely in the cloud.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Easy Sharing</h3>
              <p className="text-gray-600">Share your files easily with your team or friends, anywhere.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Fast Access</h3>
              <p className="text-gray-600">Access your files anytime with our fast and reliable cloud system.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
