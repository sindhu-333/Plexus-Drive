const { getCurrentNetworkIP } = require('../utils/urlHelper');

// Middleware to handle requests from old IPs and redirect to current IP
const handleIPRedirect = (req, res, next) => {
  // Disable in production — Render's internal IPs must never be exposed externally
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  // Get current network IP
  const currentIP = getCurrentNetworkIP();
  const requestHost = req.get('host');
  
  // If request is coming from a different IP than current network IP
  if (requestHost && !requestHost.includes('localhost') && !requestHost.includes('127.0.0.1')) {
    const requestIP = requestHost.split(':')[0];
    
    // If the request IP is different from current network IP
    if (requestIP !== currentIP && currentIP !== 'localhost') {
      const currentPort = requestHost.split(':')[1] || (req.secure ? '443' : '80');
      const protocol = req.secure ? 'https' : 'http';
      const newUrl = `${protocol}://${currentIP}:${currentPort}${req.originalUrl}`;
      
      console.log(`🔄 Redirecting from old IP ${requestIP} to current IP ${currentIP}`);
      return res.redirect(301, newUrl);
    }
  }
  
  next();
};

module.exports = { handleIPRedirect };