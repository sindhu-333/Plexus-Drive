const os = require('os');

// Get current network IP dynamically
const getCurrentNetworkIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
};

const getSecureFrontendUrl = (req) => {
  // Production: Always use configured URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 'https://yourdomain.com';
  }
  
  // Development: Check for email-specific URL first  
  if (process.env.EMAIL_FRONTEND_URL) {
    return process.env.EMAIL_FRONTEND_URL;
  }
  
  // Check for ngrok tunnel URL (for cross-network access)
  if (process.env.NGROK_FRONTEND_URL) {
    console.log('🌐 Using ngrok tunnel for cross-network access:', process.env.NGROK_FRONTEND_URL);
    return process.env.NGROK_FRONTEND_URL;
  }
  
  // For email links, ALWAYS use network IP to ensure cross-device compatibility
  // Even if accessed from localhost, emails should use network IP for mobile access
  const currentIP = getCurrentNetworkIP();
  if (currentIP !== 'localhost') {
    console.log(`🌐 Using network IP for cross-device email access: ${currentIP}`);
    return `http://${currentIP}:3000`;
  }
  
  // Try to get from request headers only as fallback
  if (req && req.headers) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;
    
    // If we have origin from request, use it (but adjust port to 3000 for frontend)
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      try {
        const url = new URL(origin);
        return `${url.protocol}//${url.hostname}:3000`;
      } catch (e) {
        console.log('Error parsing origin:', e.message);
      }
    }
    
    // If we have referer, extract the base URL (avoid localhost)
    if (referer && !referer.includes('localhost') && !referer.includes('127.0.0.1')) {
      try {
        const url = new URL(referer);
        return `${url.protocol}//${url.hostname}:3000`;
      } catch (e) {
        console.log('Error parsing referer:', e.message);
      }
    }
    
    // If we have host header, use it only if not localhost (change port from 5000 to 3000)
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const hostname = host.split(':')[0]; // Remove port if present
      return `${protocol}://${hostname}:3000`;
    }
  }
  
  // Final fallback to localhost if network IP detection failed
  console.log(`🌐 Falling back to localhost for email links`);
  return `http://localhost:3000`;
};

const getSecureBackendUrl = (req) => {
  // Production: Always use configured URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://api.yourdomain.com';
  }
  
  // Development: Check for backend-specific URL
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  
  // Check for ngrok backend URL (for cross-network access)
  if (process.env.NGROK_BACKEND_URL) {
    console.log('🌐 Using ngrok tunnel for backend:', process.env.NGROK_BACKEND_URL);
    return process.env.NGROK_BACKEND_URL;
  }
  
  // For emails, use network IP to ensure cross-device compatibility
  const currentIP = getCurrentNetworkIP();
  if (currentIP !== 'localhost') {
    return `http://${currentIP}:5000`;
  }
  
  // Try to get from request headers
  if (req && req.headers) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;
    
    // If we have origin from request, use it
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      try {
        const url = new URL(origin);
        return `${url.protocol}//${url.hostname}:5000`;
      } catch (e) {
        console.log('Error parsing origin for backend:', e.message);
      }
    }
    
    // Use host header if available
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const hostname = host.split(':')[0];
      return `${protocol}://${hostname}:5000`;
    }
  }
  
  // Fallback to localhost
  return `http://localhost:5000`;
};

module.exports = { getSecureFrontendUrl, getSecureBackendUrl, getCurrentNetworkIP };