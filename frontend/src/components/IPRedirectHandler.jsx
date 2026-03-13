import { useEffect } from 'react';

// Component to handle automatic IP redirection for old email links
const IPRedirectHandler = ({ children }) => {
  useEffect(() => {
    const handleIPRedirect = async () => {
      const currentHost = window.location.host;
      const currentHostname = window.location.hostname;
      
      // Skip redirect for localhost
      if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
        return;
      }
      
      try {
        // Try to detect the current IP by making a request to the backend health endpoint
        const response = await fetch('/api/auth/health');
        const backendIP = response.url.match(/\/\/([^:]+)/)?.[1];
        
        if (backendIP && backendIP !== currentHostname) {
          // Current URL has old IP, redirect to new IP
          const currentPort = window.location.port || '3000';
          const protocol = window.location.protocol;
          const pathname = window.location.pathname;
          const search = window.location.search;
          const hash = window.location.hash;
          
          const newUrl = `${protocol}//${backendIP}:${currentPort}${pathname}${search}${hash}`;
          
          console.log(`🔄 Redirecting from old IP ${currentHostname} to current IP ${backendIP}`);
          window.location.replace(newUrl);
          return;
        }
      } catch (error) {
        console.warn('Could not detect current backend IP for redirect:', error);
        
        // Fallback: try to get IP from API_URL environment variable
        try {
          const apiUrl = import.meta.env.VITE_API_URL;
          if (apiUrl) {
            const apiIP = new URL(apiUrl).hostname;
            if (apiIP !== currentHostname) {
              const currentPort = window.location.port || '3000';
              const protocol = window.location.protocol;
              const pathname = window.location.pathname;
              const search = window.location.search;
              const hash = window.location.hash;
              
              const newUrl = `${protocol}//${apiIP}:${currentPort}${pathname}${search}${hash}`;
              
              console.log(`🔄 Redirecting from old IP ${currentHostname} to API IP ${apiIP}`);
              window.location.replace(newUrl);
              return;
            }
          }
        } catch (fallbackError) {
          console.warn('Fallback IP detection also failed:', fallbackError);
        }
      }
    };
    
    // Only run redirect check once on component mount
    handleIPRedirect();
  }, []);

  return children;
};

export default IPRedirectHandler;