class RefreshManager {
  constructor() {
    this.lastActivity = Date.now();
    this.pendingRequests = 0;
    this.hasUpdates = false;
    this.updateCheckers = [];
    this.isChecking = false;
    this.checkInterval = null;
    
    // Initialize activity tracking
    this.initActivityTracking();
    
    // Initialize network request tracking
    this.initNetworkTracking();
  }

  initActivityTracking() {
    const updateActivity = () => {
      this.lastActivity = Date.now();
    };

    // Track various user interactions
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);
    document.addEventListener('click', updateActivity);
    document.addEventListener('scroll', updateActivity);
    document.addEventListener('touchstart', updateActivity);
    document.addEventListener('touchmove', updateActivity);
  }

  initNetworkTracking() {
    // Track fetch requests
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      this.pendingRequests++;
      return originalFetch(...args).finally(() => {
        this.pendingRequests--;
      });
    };

    // Track XMLHttpRequests
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(...args) {
      this._refreshManager = true;
      return originalOpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._refreshManager) {
        window.refreshManager.pendingRequests++;
        this.addEventListener('loadend', () => {
          window.refreshManager.pendingRequests--;
        });
      }
      return originalSend.apply(this, args);
    };
  }

  shouldSkipRefresh() {
    // Skip if user recently interacted (last 3 seconds)
    const recentActivity = (Date.now() - this.lastActivity) < 3000;
    
    // Skip if any modal/overlay is open
    const modalSelectors = [
      '.modal',
      '.dropdown-menu',
      '[role="dialog"]',
      '[data-headlessui-state="open"]',
      '.fixed.inset-0', // Tailwind modal pattern
      '.absolute.z-50', // Common overlay pattern
    ];
    const modalOpen = modalSelectors.some(selector => 
      document.querySelector(selector)
    );
    
    // Skip if network requests pending
    const networkBusy = this.pendingRequests > 0;
    
    // Skip if page is hidden (user switched tabs)
    const pageHidden = document.hidden;
    
    // Skip if already checking for updates
    const alreadyChecking = this.isChecking;

    return recentActivity || modalOpen || networkBusy || pageHidden || alreadyChecking;
  }

  async checkForUpdates() {
    if (this.shouldSkipRefresh()) {
      return false;
    }

    this.isChecking = true;
    
    try {
      const response = await fetch('/api/files/check-updates', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if there are any updates available
        const hasNewUpdates = data.hasUpdates || 
                             data.newAnalysis || 
                             data.statusChanges || 
                             data.newShares;
        
        if (hasNewUpdates && !this.hasUpdates) {
          this.hasUpdates = true;
          this.notifyUpdateAvailable(data);
        }
        
        return hasNewUpdates;
      }
    } catch (error) {
      console.log('Update check failed:', error.message);
    } finally {
      this.isChecking = false;
    }
    
    return false;
  }

  notifyUpdateAvailable(updateData) {
    // Notify all registered update checkers
    this.updateCheckers.forEach(callback => {
      try {
        callback(updateData);
      } catch (error) {
        console.log('Update checker callback failed:', error);
      }
    });
  }

  async applyUpdates() {
    if (this.shouldSkipRefresh()) {
      // Show message that updates will be applied when safe
      this.notifyUpdateAvailable({ 
        message: 'Updates will be applied when current action is complete' 
      });
      return false;
    }

    this.hasUpdates = false;
    
    // Notify all registered update checkers to refresh their data
    this.updateCheckers.forEach(callback => {
      try {
        callback({ refresh: true });
      } catch (error) {
        console.log('Refresh callback failed:', error);
      }
    });

    return true;
  }

  startPeriodicChecking(intervalMs = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    // Also check when page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.checkForUpdates(), 1000);
      }
    });
  }

  stopPeriodicChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  registerUpdateChecker(callback) {
    this.updateCheckers.push(callback);
    
    // Return unregister function
    return () => {
      const index = this.updateCheckers.indexOf(callback);
      if (index > -1) {
        this.updateCheckers.splice(index, 1);
      }
    };
  }

  // Manual refresh (always allowed)
  async forceRefresh() {
    this.hasUpdates = false;
    this.updateCheckers.forEach(callback => {
      try {
        callback({ refresh: true, force: true });
      } catch (error) {
        console.log('Force refresh callback failed:', error);
      }
    });
  }

  // Get current status
  getStatus() {
    return {
      hasUpdates: this.hasUpdates,
      canRefresh: !this.shouldSkipRefresh(),
      isChecking: this.isChecking,
      lastActivity: this.lastActivity,
      pendingRequests: this.pendingRequests
    };
  }
}

// Create global instance
const refreshManager = new RefreshManager();
window.refreshManager = refreshManager; // For debugging

export default refreshManager;