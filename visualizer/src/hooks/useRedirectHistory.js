/**
 * Redirect History Hook
 * 
 * Custom hook that tracks redirect history and provides utilities for
 * secure and controlled redirects between routes, with protection
 * against redirect loops and validation of redirect targets.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import registry from '../ModuleRegistry';

const MAX_REDIRECT_CHAIN = 5; // Maximum allowed redirect chain length
const REDIRECT_HISTORY_KEY = 'redirect_history';
const ALLOWED_DOMAINS = ['localhost', window.location.hostname]; // Allowed domains for external redirects

/**
 * Hook for managing redirect history and safe redirects
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.persistHistory=true] - Whether to persist history in sessionStorage
 * @param {number} [options.maxChainLength=5] - Maximum allowed redirect chain length
 * @param {Function} [options.onRedirectLoop] - Callback when a redirect loop is detected
 * @returns {Object} Redirect history methods and state
 */
const useRedirectHistory = (options = {}) => {
  const {
    persistHistory = true,
    maxChainLength = MAX_REDIRECT_CHAIN,
    onRedirectLoop = null,
  } = options;
  
  const navigate = useNavigate();
  const location = useLocation();
  const [redirectHistory, setRedirectHistory] = useState([]);
  const [redirectLoop, setRedirectLoop] = useState(false);
  const eventBus = registry.getModule('utils.EventBus');
  
  // Initialize history from storage on mount
  useEffect(() => {
    if (persistHistory) {
      try {
        const storedHistory = sessionStorage.getItem(REDIRECT_HISTORY_KEY);
        if (storedHistory) {
          setRedirectHistory(JSON.parse(storedHistory));
        }
      } catch (error) {
        console.error('Error loading redirect history:', error);
      }
    }
  }, [persistHistory]);
  
  // Add the current location to history when it changes
  useEffect(() => {
    // Don't track the same path twice in a row
    if (redirectHistory.length > 0 && redirectHistory[0].pathname === location.pathname) {
      return;
    }
    
    // Create new history entry
    const updatedHistory = [
      {
        pathname: location.pathname,
        search: location.search,
        timestamp: Date.now(),
      },
      ...redirectHistory,
    ].slice(0, 20); // Keep last 20 entries max
    
    setRedirectHistory(updatedHistory);
    
    // Persist in storage if enabled
    if (persistHistory) {
      try {
        sessionStorage.setItem(REDIRECT_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch (error) {
        console.error('Error saving redirect history:', error);
      }
    }
    
    // Check for redirect loops
    const recentEntries = updatedHistory.slice(0, maxChainLength);
    const pathCounts = recentEntries.reduce((counts, entry) => {
      const path = entry.pathname;
      counts[path] = (counts[path] || 0) + 1;
      return counts;
    }, {});
    
    // If any path appears more than twice in the recent history, it's a loop
    const hasLoop = Object.values(pathCounts).some(count => count > 2);
    
    if (hasLoop) {
      setRedirectLoop(true);
      
      // Publish event
      if (eventBus) {
        eventBus.publish('navigation:redirectLoop', {
          history: recentEntries,
          currentPath: location.pathname,
        });
      }
      
      // Call callback if provided
      if (onRedirectLoop) {
        onRedirectLoop(recentEntries);
      }
    } else {
      setRedirectLoop(false);
    }
  }, [location, redirectHistory, persistHistory, maxChainLength, onRedirectLoop, eventBus]);
  
  /**
   * Validate if a redirect URL is safe
   * @param {string} url - URL to validate
   * @returns {boolean} Whether the URL is safe to redirect to
   */
  const isValidRedirectTarget = useCallback((url) => {
    // Allow relative URLs
    if (url.startsWith('/')) {
      return true;
    }
    
    try {
      // Parse URL to check domain
      const urlObj = new URL(url);
      // Check if domain is in allowed list
      return ALLOWED_DOMAINS.includes(urlObj.hostname);
    } catch (error) {
      // Invalid URL format
      return false;
    }
  }, []);
  
  /**
   * Safely redirect to a URL with validation
   * @param {string} to - URL to redirect to
   * @param {Object} options - Redirect options
   * @param {boolean} [options.replace=false] - Whether to replace the current history entry
   * @param {Object} [options.state={}] - State to pass to the new location
   * @returns {boolean} Whether the redirect was successful
   */
  const safeRedirect = useCallback((to, options = {}) => {
    const { replace = false, state = {} } = options;
    
    // Validate the redirect target
    if (!isValidRedirectTarget(to)) {
      console.error(`Invalid redirect target: ${to}`);
      
      // Publish event
      if (eventBus) {
        eventBus.publish('navigation:invalidRedirect', {
          target: to,
          reason: 'invalid_target',
        });
      }
      
      return false;
    }
    
    // Check for redirect chain length
    if (redirectHistory.length >= maxChainLength) {
      console.warn(`Redirect chain too long (${redirectHistory.length} redirects)`);
      
      // Publish event
      if (eventBus) {
        eventBus.publish('navigation:redirectChainTooLong', {
          history: redirectHistory,
          target: to,
        });
      }
      
      return false;
    }
    
    // Check for redirect loop
    if (redirectLoop) {
      console.error('Redirect loop detected, stopping navigation');
      
      return false;
    }
    
    // Perform the navigation
    navigate(to, { replace, state });
    return true;
  }, [navigate, redirectHistory, redirectLoop, isValidRedirectTarget, maxChainLength, eventBus]);
  
  /**
   * Get the previous location in history
   * @returns {Object|null} Previous location or null if none
   */
  const getPreviousLocation = useCallback(() => {
    return redirectHistory.length > 1 ? redirectHistory[1] : null;
  }, [redirectHistory]);
  
  /**
   * Clear the redirect history
   */
  const clearHistory = useCallback(() => {
    setRedirectHistory([]);
    if (persistHistory) {
      sessionStorage.removeItem(REDIRECT_HISTORY_KEY);
    }
  }, [persistHistory]);
  
  /**
   * Get the full path for the previous location
   * @returns {string|null} Previous location path or null if none
   */
  const getPreviousPath = useCallback(() => {
    const prev = getPreviousLocation();
    if (!prev) return null;
    
    const { pathname, search } = prev;
    return `${pathname}${search || ''}`;
  }, [getPreviousLocation]);
  
  /**
   * Navigate back to the previous location
   * @param {Object} options - Navigation options
   * @param {boolean} [options.replace=false] - Whether to replace the current history entry
   * @param {Object} [options.state={}] - State to pass to the new location
   * @returns {boolean} Whether the navigation was successful
   */
  const goBack = useCallback((options = {}) => {
    const prevPath = getPreviousPath();
    if (!prevPath) return false;
    
    return safeRedirect(prevPath, options);
  }, [getPreviousPath, safeRedirect]);
  
  return {
    redirectHistory,
    redirectLoop,
    safeRedirect,
    isValidRedirectTarget,
    getPreviousLocation,
    getPreviousPath,
    goBack,
    clearHistory,
  };
};

// Register with ModuleRegistry
registry.register(
  'hooks.useRedirectHistory',
  useRedirectHistory,
  ['react-router-dom', 'utils.EventBus'],
  {
    description: 'Hook for managing redirect history and safe redirects',
    usage: `
      const { 
        safeRedirect, 
        getPreviousPath, 
        goBack 
      } = useRedirectHistory();
      
      // Safely redirect to a path
      safeRedirect('/dashboard');
      
      // Go back to previous location
      goBack();
    `
  }
);

export default useRedirectHistory; 