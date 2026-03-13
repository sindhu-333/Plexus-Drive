import { useEffect } from 'react';

// Component to handle automatic IP redirection for old email links
const IPRedirectHandler = ({ children }) => {
  const isPrivateIPv4 = (hostname) => {
    return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d{1,3}\.\d{1,3}$/.test(hostname);
  };

  useEffect(() => {
    const handleIPRedirect = async () => {
      const currentHostname = window.location.hostname;
      const currentPort = window.location.port;
      const protocol = window.location.protocol;
      const pathname = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      const portPart = currentPort ? `:${currentPort}` : '';
      const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

      // Never run redirect logic on production builds (Netlify/Vercel/etc).
      if (import.meta.env.PROD) {
        return;
      }
      
      // Skip localhost and non-private hostnames.
      if (isLocalhost || !isPrivateIPv4(currentHostname)) {
        return;
      }
      
      try {
        // Try to detect the current IP by making a request to the backend health endpoint
        const response = await fetch('/api/auth/health', { cache: 'no-store' });
        const backendIP = response.url.match(/\/\/([^:]+)/)?.[1];
        
        if (backendIP && isPrivateIPv4(backendIP) && backendIP !== currentHostname) {
          // Current URL has old IP, redirect to new IP
          const newUrl = `${protocol}//${backendIP}${portPart}${pathname}${search}${hash}`;
          
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
            if (isPrivateIPv4(apiIP) && apiIP !== currentHostname) {
              const newUrl = `${protocol}//${apiIP}${portPart}${pathname}${search}${hash}`;
              
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