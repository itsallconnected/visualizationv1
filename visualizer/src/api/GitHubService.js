import APP_SETTINGS from '../config/app-settings';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Service for interacting with GitHub as a data store
 * Uses GitHub API to fetch and store data directly in the repository
 */
class GitHubService {
  constructor() {
    this.settings = APP_SETTINGS;
    this.baseUrl = APP_SETTINGS.app.githubApiUrl;
    this.repo = APP_SETTINGS.app.githubRepo;
    this.branch = APP_SETTINGS.app.githubBranch;
    this.accessToken = null;
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
    this.rateLimitTotal = null;
    this.rateLimitThreshold = 20; // Start throttling when fewer than 20 requests remain
    this.pendingRequests = [];
    this.isThrottling = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Base delay in milliseconds
    this.eventBus = null;
    this.tokenKey = 'github_auth_token';
    this.fileCache = new Map(); // Cache for recently fetched files
    this.fileCacheExpiry = new Map(); // Cache expiry times
    this.fileCacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the service with an access token (if available)
   * @param {string} token - GitHub access token
   */
  initialize(token) {
    try {
      this.eventBus = registry.getModule('utils.EventBus') || EventBus;
      
      if (token) {
        this.accessToken = token;
      } else {
        // Try to get token from local storage
        const storedToken = localStorage.getItem(this.tokenKey);
        if (storedToken) {
          this.accessToken = storedToken;
        }
      }
      
      if (!this.repo) {
        console.warn('GitHub repository not configured. Set APP_SETTINGS.app.githubRepo');
      }
      
      if (!this.branch) {
        console.warn('GitHub branch not configured. Set APP_SETTINGS.app.githubBranch');
      }
      
      console.log('GitHub service initialized', this.accessToken ? 'with token' : 'without token');
      
      // Validate the repo is formatted correctly
      if (this.repo && !this.repo.includes('/')) {
        console.error('Invalid GitHub repository format. Should be "owner/repo"');
      }
      
      // Start pending request processor if needed
      this._processPendingRequestsInterval = setInterval(() => {
        if (this.pendingRequests.length > 0) {
          this.processPendingRequests();
        }
      }, 10000);
      
      return true;
    } catch (error) {
      console.error('Error initializing GitHub service:', error);
      return false;
    }
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  cleanup() {
    if (this._processPendingRequestsInterval) {
      clearInterval(this._processPendingRequestsInterval);
      this._processPendingRequestsInterval = null;
    }
    
    // Clear caches
    this.fileCache.clear();
    this.fileCacheExpiry.clear();
  }

  /**
   * Set GitHub access token for authenticated requests
   * @param {string} token - GitHub access token
   */
  setAccessToken(token) {
    this.accessToken = token;
    
    // Publish token change event
    if (this.eventBus) {
      this.eventBus.publish('github:tokenChanged', {
        hasToken: !!token
      });
    }
  }

  /**
   * Create request headers with authorization if token is available
   * @returns {Object} Headers object
   */
  getHeaders() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `token ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Check and update rate limit information from response headers
   * @param {Response} response - Fetch API response
   */
  updateRateLimits(response) {
    if (!response || !response.headers) {
      return;
    }
    
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const total = response.headers.get('X-RateLimit-Limit');
    
    // Only update if we have values
    if (remaining !== null) this.rateLimitRemaining = remaining;
    if (reset !== null) this.rateLimitReset = reset;
    if (total !== null) this.rateLimitTotal = total;
      
    // Determine if we need to start throttling
    if (this.rateLimitRemaining && parseInt(this.rateLimitRemaining) < this.rateLimitThreshold) {
      const remaining = parseInt(this.rateLimitRemaining);
      const resetTime = parseInt(this.rateLimitReset) * 1000; // Convert to milliseconds
      const resetDate = new Date(resetTime);
      const now = Date.now();
      const timeToReset = Math.max(0, resetTime - now);
      
      if (remaining < 5) {
        console.warn(`GitHub API rate limit critical: ${remaining} requests remaining. Resetting at ${resetDate.toLocaleTimeString()}`);
        this.isThrottling = true;
        this.eventBus.publish('api:rateLimitCritical', {
          remaining,
          resetTime: resetDate,
          timeToReset
        });
      } else {
        console.warn(`GitHub API rate limit low: ${remaining} requests remaining. Resetting at ${resetDate.toLocaleTimeString()}`);
        this.eventBus.publish('api:rateLimitLow', {
          remaining,
          resetTime: resetDate,
          timeToReset
        });
      }
    } else if (this.isThrottling && this.rateLimitRemaining && parseInt(this.rateLimitRemaining) > this.rateLimitThreshold) {
      // Reset throttling if we're back above the threshold
      this.isThrottling = false;
      this.eventBus.publish('api:rateLimitNormal', {
        remaining: parseInt(this.rateLimitRemaining)
      });
    }
  }

  /**
   * Execute a request with retry logic and rate limit awareness
   * @param {string} url - API URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async executeRequest(url, options, retryCount = 0) {
    // If we're already throttling, queue the request
    if (this.isThrottling && retryCount === 0) {
      console.log(`API is throttling, queueing request to ${url}`);
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.push({
          url,
          options,
          resolve,
          reject,
          timestamp: Date.now()
        });
        
        // Start the request processor if it's not already running
        if (this.pendingRequests.length === 1) {
          this.processPendingRequests();
        }
      });
    }
    
    try {
      const response = await fetch(url, options);
      this.updateRateLimits(response);
      
      if (!response.ok) {
        if (response.status === 403 && this.rateLimitRemaining === '0' && retryCount < this.maxRetries) {
          // Hit rate limit, calculate delay and retry
          const resetTime = parseInt(this.rateLimitReset) * 1000;
          const now = Date.now();
          const timeToReset = Math.max(0, resetTime - now);
          
          // If reset is coming soon, wait for it; otherwise, use exponential backoff
          const delay = timeToReset < 60000 ? 
            timeToReset + 1000 : // Wait for reset plus a small buffer
            Math.min(60000, this.retryDelay * Math.pow(2, retryCount)); // Exponential backoff, max 1 minute
          
          console.warn(`Rate limit exceeded, retrying after ${delay}ms (retry ${retryCount + 1}/${this.maxRetries})`);
          
          // Notify about retry
          this.eventBus.publish('api:retrying', {
            url,
            retryCount: retryCount + 1,
            delay,
            reason: 'Rate limit exceeded'
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeRequest(url, options, retryCount + 1);
        }
        
        // For other server errors, implement a simpler retry
        if (response.status >= 500 && response.status < 600 && retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.warn(`Server error ${response.status}, retrying after ${delay}ms (retry ${retryCount + 1}/${this.maxRetries})`);
          
          this.eventBus.publish('api:retrying', {
            url,
            retryCount: retryCount + 1,
            delay,
            reason: `Server error (${response.status})`
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeRequest(url, options, retryCount + 1);
        }
        
        // Handle authentication errors
        if (response.status === 401) {
          console.error('GitHub API authentication failed - token may be invalid or expired');
          this.eventBus.publish('github:authError', {
            status: response.status,
            message: 'Authentication failed - token may be invalid or expired'
          });
        }
      }
      
      return response;
    } catch (error) {
      // For network errors, retry with backoff
      if ((error.name === 'TypeError' || error.name === 'NetworkError') && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`Network error, retrying after ${delay}ms (retry ${retryCount + 1}/${this.maxRetries})`);
        
        this.eventBus.publish('api:retrying', {
          url,
          retryCount: retryCount + 1,
          delay,
          reason: 'Network error'
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest(url, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Process any pending requests in the queue
   */
  async processPendingRequests() {
    // If no more pending requests or no longer throttling, stop processing
    if (this.pendingRequests.length === 0) {
      return;
    }
    
    // Check if we should still be throttling
    if (this.rateLimitReset) {
      const resetTime = parseInt(this.rateLimitReset) * 1000;
      const now = Date.now();
      
      if (now >= resetTime) {
        // Rate limit should be reset, stop throttling
        this.isThrottling = false;
        console.log('Rate limit should be reset, processing pending requests');
      }
    }
    
    if (!this.isThrottling) {
      // Process all pending requests
      const requests = [...this.pendingRequests];
      this.pendingRequests = [];
      
      console.log(`Processing ${requests.length} pending API requests`);
      
      for (const request of requests) {
        try {
          const response = await this.executeRequest(request.url, request.options);
          request.resolve(response);
        } catch (error) {
          request.reject(error);
        }
      }
    } else {
      // Still throttling, check if we've waited long enough for the next request
      const oldestRequest = this.pendingRequests[0];
      const timeSinceRequest = Date.now() - oldestRequest.timestamp;
      
      if (timeSinceRequest > 10000) { // Wait at least 10 seconds between requests when throttling
        const request = this.pendingRequests.shift();
        
        try {
          console.log('Processing throttled request after delay');
          const response = await this.executeRequest(request.url, request.options);
          request.resolve(response);
        } catch (error) {
          request.reject(error);
        }
        
        // Schedule the next request
        setTimeout(() => this.processPendingRequests(), 10000);
      } else {
        // Not waited long enough, check again soon
        setTimeout(() => this.processPendingRequests(), 1000);
      }
    }
  }

  /**
   * Handle API response errors
   * @param {Response} response - Fetch API response
   * @returns {Promise<Response>} Response if OK, otherwise throws an error
   */
  async handleResponse(response) {
    if (!response.ok) {
      let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      let errorData = null;
      
      try {
        errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = `GitHub API error: ${errorData.message}`;
        }
      } catch (e) {
        // Unable to parse error JSON
      }
      
      if (response.status === 403 && this.rateLimitRemaining === '0') {
        const resetDate = new Date(parseInt(this.rateLimitReset) * 1000);
        errorMessage = `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`;
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.response = response;
      error.data = errorData;
      
      // Handle authentication errors
      if (response.status === 401) {
        this.eventBus.publish('github:authError', {
          status: response.status,
          message: errorMessage
        });
      }
      
      // Publish general error event
      this.eventBus.publish('api:error', {
        status: response.status,
        message: errorMessage,
        url: response.url,
        data: errorData
      });
      
      throw error;
    }
    
    return response;
  }

  /**
   * Fetch a file from the GitHub repository
   * @param {string} path - File path in the repository
   * @param {Object} [options] - Options for the fetch
   * @param {boolean} [options.cache=true] - Whether to use cache
   * @param {boolean} [options.forceFresh=false] - Force fresh fetch
   * @returns {Promise<Object>} The file content
   */
  async fetchFile(path, options = {}) {
    const useCache = options.cache !== false;
    const forceFresh = options.forceFresh === true;
    
    // Check cache first if enabled and not forcing a fresh fetch
    if (useCache && !forceFresh) {
      const cacheKey = `file:${path}`;
      if (this.fileCache.has(cacheKey)) {
        const expiry = this.fileCacheExpiry.get(cacheKey) || 0;
        if (expiry > Date.now()) {
          return this.fileCache.get(cacheKey);
        }
      }
    }

    try {
      if (!this.repo) {
        throw new Error('GitHub repository not configured');
      }
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath);
      const url = `${this.baseUrl}/repos/${this.repo}/contents/${encodedPath}?ref=${this.branch}`;
      
      const response = await this.executeRequest(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const processedResponse = await this.handleResponse(response);
      const data = await processedResponse.json();
      
      // Check if we received a directory listing
      if (Array.isArray(data)) {
        throw new Error(`Path '${path}' is a directory, not a file`);
      }
      
      // File content is base64 encoded
      let content;
      try {
        // Decode base64 content, handling possible URL-safe encoding
        content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
      } catch (e) {
        console.error('Error decoding base64 content:', e);
        throw new Error(`Failed to decode content of file '${path}'`);
      }
      
      let result;
      try {
        result = JSON.parse(content);
      } catch (e) {
        // If it's not JSON, return as text
        result = content;
      }
      
      // Store in cache if caching is enabled
      if (useCache) {
        const cacheKey = `file:${path}`;
        this.fileCache.set(cacheKey, result);
        this.fileCacheExpiry.set(cacheKey, Date.now() + this.fileCacheDuration);
      }
      
      return result;
    } catch (error) {
      console.error(`Error fetching file ${path}:`, error);
      
      // Return null for missing files instead of throwing
      if (error.status === 404) {
        console.warn(`File not found: ${path}`);
        return null;
      }
      
      // Publish specific error event
      this.eventBus.publish('api:fileError', {
        path,
        operation: 'fetch',
        error
      });
      
      throw error;
    }
  }

  /**
   * Save a file to the GitHub repository
   * @param {string} path - File path in the repository
   * @param {Object|string} content - File content to save
   * @param {string} message - Commit message
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.clearCache=true] - Whether to clear cache for this file
   * @returns {Promise<Object>} Result of the operation
   */
  async saveFile(path, content, message, options = {}) {
    const clearCache = options.clearCache !== false;
    
    if (!this.accessToken) {
      const error = new Error('GitHub authentication token required to save files');
      this.eventBus.publish('api:unauthorized', {
        operation: 'saveFile',
        path,
        message: error.message
      });
      throw error;
    }

    try {
      if (!this.repo) {
        throw new Error('GitHub repository not configured');
      }
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath);
      const url = `${this.baseUrl}/repos/${this.repo}/contents/${encodedPath}`;
      
      // Get current file SHA if it exists
      let sha = null;
      try {
        const existingResponse = await this.executeRequest(`${url}?ref=${this.branch}`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        
        if (existingResponse.ok) {
          const data = await existingResponse.json();
          sha = data.sha;
        }
      } catch (e) {
        // File doesn't exist yet, that's fine
        console.log(`Creating new file: ${path}`);
      }
      
      // Convert content to string with proper encoding
      let contentStr;
      if (typeof content === 'object') {
        try {
          contentStr = JSON.stringify(content, null, 2);
        } catch (e) {
          throw new Error(`Failed to stringify content for file '${path}': ${e.message}`);
        }
      } else {
        contentStr = String(content);
      }
      
      // Base64 encode the content with proper UTF-8 handling
      let encodedContent;
      try {
        // Handle UTF-8 encoding properly
        const utf8Content = unescape(encodeURIComponent(contentStr));
        encodedContent = btoa(utf8Content);
      } catch (e) {
        throw new Error(`Failed to encode content for file '${path}': ${e.message}`);
      }
      
      // Prepare request body
      const body = {
        message: message || `Update ${path}`,
        content: encodedContent,
        branch: this.branch,
      };
      
      // Add SHA if updating existing file
      if (sha) {
        body.sha = sha;
      }
      
      // Make the request
      const response = await this.executeRequest(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      
      const processedResponse = await this.handleResponse(response);
      const result = await processedResponse.json();
      
      // Clear cache for this file if needed
      if (clearCache) {
        const cacheKey = `file:${path}`;
        this.fileCache.delete(cacheKey);
        this.fileCacheExpiry.delete(cacheKey);
      }
      
      // Publish success event
      this.eventBus.publish('api:fileSaved', {
        path,
        isUpdate: !!sha,
        commitSha: result.commit?.sha
      });
      
      return result;
    } catch (error) {
      console.error(`Error saving file ${path}:`, error);
      
      // Publish specific error event
      this.eventBus.publish('api:fileError', {
        path,
        operation: 'save',
        error
      });
      
      throw error;
    }
  }

  /**
   * Delete a file from the GitHub repository
   * @param {string} path - File path in the repository
   * @param {string} message - Commit message
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.clearCache=true] - Whether to clear cache for this file
   * @returns {Promise<Object>} Result of the operation
   */
  async deleteFile(path, message, options = {}) {
    const clearCache = options.clearCache !== false;
    
    if (!this.accessToken) {
      const error = new Error('GitHub authentication token required to delete files');
      this.eventBus.publish('api:unauthorized', {
        operation: 'deleteFile',
        path,
        message: error.message
      });
      throw error;
    }

    try {
      if (!this.repo) {
        throw new Error('GitHub repository not configured');
      }
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath);
      const url = `${this.baseUrl}/repos/${this.repo}/contents/${encodedPath}`;
      
      // Get current file SHA (required for deletion)
      let sha = null;
      try {
        const existingResponse = await this.executeRequest(`${url}?ref=${this.branch}`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        
        if (existingResponse.ok) {
          const data = await existingResponse.json();
          sha = data.sha;
        } else {
          // File doesn't exist, can't delete
          throw new Error(`File '${path}' doesn't exist, cannot delete`);
        }
      } catch (e) {
        if (e.status === 404) {
          console.warn(`File not found: ${path}, skipping deletion`);
          return { deleted: false, message: 'File not found' };
        }
        throw e;
      }
      
      // Prepare request body
      const body = {
        message: message || `Delete ${path}`,
        sha,
        branch: this.branch,
      };
      
      // Make the request
      const response = await this.executeRequest(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      
      const processedResponse = await this.handleResponse(response);
      const result = await processedResponse.json();
      
      // Clear cache for this file if needed
      if (clearCache) {
        const cacheKey = `file:${path}`;
        this.fileCache.delete(cacheKey);
        this.fileCacheExpiry.delete(cacheKey);
      }
      
      // Publish success event
      this.eventBus.publish('api:fileDeleted', {
        path,
        commitSha: result.commit?.sha
      });
      
      return { ...result, deleted: true };
    } catch (error) {
      console.error(`Error deleting file ${path}:`, error);
      
      // Publish specific error event
      this.eventBus.publish('api:fileError', {
        path,
        operation: 'delete',
        error
      });
      
      throw error;
    }
  }

  /**
   * Clear file cache for a specific file or all files
   * @param {string} [path] - File path to clear, or undefined to clear all
   */
  clearFileCache(path) {
    if (path) {
      const cacheKey = `file:${path}`;
      this.fileCache.delete(cacheKey);
      this.fileCacheExpiry.delete(cacheKey);
      console.log(`Cleared cache for file: ${path}`);
    } else {
      this.fileCache.clear();
      this.fileCacheExpiry.clear();
      console.log('Cleared entire file cache');
    }
  }

  /**
   * Fetch components data
   * @returns {Promise<Array>} Components data
   */
  async fetchComponents() {
    const path = APP_SETTINGS.dataPaths.components;
    return this.fetchFile(path);
  }

  /**
   * Fetch subcomponents data
   * @returns {Promise<Array>} Subcomponents data
   */
  async fetchSubcomponents() {
    const path = APP_SETTINGS.dataPaths.subcomponents;
    return this.fetchFile(path);
  }

  /**
   * Fetch spheres data
   * @returns {Promise<Array>} Spheres configuration
   */
  async fetchSpheres() {
    const path = APP_SETTINGS.dataPaths.spheres;
    return this.fetchFile(path);
  }

  /**
   * Fetch user profile
   * @param {string} username - GitHub username
   * @returns {Promise<Object>} User profile data
   */
  async fetchUserProfile(username) {
    const path = `${APP_SETTINGS.dataPaths.users}/${username}.json`;
    return this.fetchFile(path);
  }

  /**
   * Update user profile
   * @param {string} username - GitHub username
   * @param {Object} profileData - Profile data to save
   * @returns {Promise<Object>} Result of the operation
   */
  async updateUserProfile(username, profileData) {
    const path = `${APP_SETTINGS.dataPaths.users}/${username}.json`;
    return this.saveFile(path, profileData, `Update user profile for ${username}`);
  }

  /**
   * Get commit history for a file
   * @param {string} path - File path in the repository
   * @returns {Promise<Array>} Commit history
   */
  async getFileHistory(path) {
    try {
      if (!this.repo) {
        throw new Error('GitHub repository not configured');
      }
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath);
      const url = `${this.baseUrl}/repos/${this.repo}/commits?path=${encodedPath}&sha=${this.branch}`;
      
      const response = await this.executeRequest(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const processedResponse = await this.handleResponse(response);
      const commits = await processedResponse.json();
      
      // Format the commits
      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date
        },
        url: commit.html_url
      }));
    } catch (error) {
      console.error(`Error getting file history for ${path}:`, error);
      
      if (error.status === 404) {
        return []; // Return empty history for non-existent files
      }
      
      throw error;
    }
  }

  /**
   * Get file content at a specific commit
   * @param {string} path - File path in the repository
   * @param {string} commitSha - Commit SHA
   * @returns {Promise<Object>} File content at the commit
   */
  async getFileAtCommit(path, commitSha) {
    try {
      if (!this.repo) {
        throw new Error('GitHub repository not configured');
      }
      
      // Remove leading slash if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath);
      const url = `${this.baseUrl}/repos/${this.repo}/contents/${encodedPath}?ref=${commitSha}`;
      
      const response = await this.executeRequest(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const processedResponse = await this.handleResponse(response);
      const data = await processedResponse.json();
      
      // File content is base64 encoded
      let content;
      try {
        // Decode base64 content, handling possible URL-safe encoding
        content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
      } catch (e) {
        console.error('Error decoding base64 content:', e);
        throw new Error(`Failed to decode content of file '${path}' at commit ${commitSha}`);
      }
      
      let result;
      try {
        result = JSON.parse(content);
      } catch (e) {
        // If it's not JSON, return as text
        result = content;
      }
      
      return {
        content: result,
        sha: data.sha,
        commitSha: commitSha
      };
    } catch (error) {
      console.error(`Error getting file at commit ${commitSha} for ${path}:`, error);
      
      if (error.status === 404) {
        return null; // File didn't exist at that commit
      }
      
      throw error;
    }
  }

  /**
   * Get diff between two commits for a file
   * @param {string} path - File path in the repository
   * @param {string} baseSha - Base commit SHA
   * @param {string} compareSha - Compare commit SHA
   * @returns {Promise<Object>} Diff information
   */
  async getDiff(path, baseSha, compareSha) {
    try {
      // Get the file at both commits
      const baseFile = await this.getFileAtCommit(path, baseSha);
      const compareFile = await this.getFileAtCommit(path, compareSha);
      
      // Handle cases where file might not exist in one of the commits
      if (!baseFile && !compareFile) {
        throw new Error(`File '${path}' doesn't exist in either commit`);
      }
      
      const baseContent = baseFile ? baseFile.content : null;
      const compareContent = compareFile ? compareFile.content : null;
      
      // Simple diff implementation - just compare the contents
      // In a real app, you might want to use a proper diff library
      if (!baseContent) {
        return {
          path,
          changes: [{
            type: 'added',
            content: compareContent
          }],
          baseCommit: baseSha,
          compareCommit: compareSha
        };
      }
      
      if (!compareContent) {
        return {
          path,
          changes: [{
            type: 'deleted',
            content: baseContent
          }],
          baseCommit: baseSha,
          compareCommit: compareSha
        };
      }
      
      // For now, just determine if there's a change
      const hasChanged = JSON.stringify(baseContent) !== JSON.stringify(compareContent);
      
      return {
        path,
        changes: hasChanged ? [{
          type: 'modified',
          oldContent: baseContent,
          newContent: compareContent
        }] : [],
        baseCommit: baseSha,
        compareCommit: compareSha,
        hasChanged
      };
    } catch (error) {
      console.error(`Error getting diff for ${path} between ${baseSha} and ${compareSha}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const githubService = new GitHubService();

// Register with ModuleRegistry
export default registry.register(
  'api.GitHubService',
  githubService,
  ['utils.EventBus'],
  {
    description: 'Service for interacting with GitHub as a data store',
    singleton: true
  }
); 