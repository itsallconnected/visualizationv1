import registry from '../ModuleRegistry';
import appSettings from '../config/app-settings';
import ErrorHandler from '../utils/ErrorHandler';

/**
 * ApiClient provides centralized access to GitHub API services with error handling,
 * request formatting, and optional caching capabilities.
 * 
 * This is a wrapper around GitHubService that provides a more generic API-like interface
 * for components that need data storage/retrieval.
 */
class ApiClient {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.pendingRequests = new Map();
    this.defaultCacheDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.gitHubService = null;
    this.eventBus = null;
  }

  /**
   * Initialize the API client
   */
  initialize() {
    this.gitHubService = registry.getModule('api.GitHubService');
    this.eventBus = registry.getModule('utils.EventBus');
    
    if (!this.gitHubService) {
      console.error('GitHubService not found in registry. ApiClient will not work properly.');
    }
    
    console.log('ApiClient initialized');
  }
  
  /**
   * Perform a REST API GET request (fetches file from GitHub)
   * 
   * @param {string} path - File path in the repository
   * @param {Object} [queryParams] - Query parameters (for filtering/pagination in memory)
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.cache] - Enable caching for this request
   * @param {number} [options.cacheDuration] - Cache duration in milliseconds
   * @returns {Promise<Object>} - Response data
   */
  async get(path, queryParams = {}, options = {}) {
    try {
      // Build cache key including query params
      const cacheKey = options.cache ? 
        this.generateCacheKey('get', path, queryParams) : null;
      
      // Return cached response if available and not expired
      if (cacheKey && this.hasValidCacheEntry(cacheKey)) {
        return this.getCachedResponse(cacheKey);
      }
      
      // Check for pending request with same parameters
      if (cacheKey && this.pendingRequests.has(cacheKey)) {
        return this.pendingRequests.get(cacheKey);
      }
      
      if (!this.gitHubService) {
        throw new Error('GitHubService not initialized');
      }
      
      // Create and store the request promise
      const requestPromise = this.executeWithRetry(async () => {
        // Fetch file from GitHub
        const data = await this.gitHubService.fetchFile(path);
        
        // Apply in-memory filtering if query params are provided
        let result = data;
        
        // Handle pagination and filtering in memory if needed
        if (queryParams && Object.keys(queryParams).length > 0 && Array.isArray(data)) {
          // Filter data based on query params
          if (queryParams.filter) {
            const filterLower = queryParams.filter.toLowerCase();
            result = data.filter(item => 
              JSON.stringify(item).toLowerCase().includes(filterLower)
            );
          }
          
          // Sort data if needed
          if (queryParams.sortBy) {
            const sortField = queryParams.sortBy;
            const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1;
            
            result.sort((a, b) => {
              const aValue = a[sortField];
              const bValue = b[sortField];
              if (aValue < bValue) return -1 * sortOrder;
              if (aValue > bValue) return 1 * sortOrder;
              return 0;
            });
          }
          
          // Pagination
          if (queryParams.page && queryParams.limit) {
            const page = parseInt(queryParams.page) || 1;
            const limit = parseInt(queryParams.limit) || 20;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            
            const paginatedData = result.slice(startIndex, endIndex);
            
            // Return paginated result with metadata
            return {
              items: paginatedData,
              total: result.length,
              page,
              totalPages: Math.ceil(result.length / limit)
            };
          }
        }
        
        return result;
      });
      
      // Store in pending requests
      if (cacheKey) {
        this.pendingRequests.set(cacheKey, requestPromise);
      }
      
      // Wait for result
      const result = await requestPromise;
      
      // Cache if needed
      if (cacheKey) {
        this.cacheResponse(cacheKey, result, options.cacheDuration);
        this.pendingRequests.delete(cacheKey);
      }
      
      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error, `GET request failed for ${path}`);
      
      // Publish error event if EventBus is available
      if (this.eventBus) {
        this.eventBus.publish('api:error', {
          operation: 'get',
          path,
          error: normalizedError
        });
      }
      
      throw normalizedError;
    }
  }
  
  /**
   * Perform a REST API POST request (creates a new file in GitHub)
   * 
   * @param {string} path - File path in the repository
   * @param {Object} data - File content
   * @param {Object} [options] - Additional options
   * @param {string} [options.commitMessage] - Commit message
   * @returns {Promise<Object>} - Response data
   */
  async post(path, data, options = {}) {
    try {
      if (!this.gitHubService) {
        throw new Error('GitHubService not initialized');
      }
      
      const commitMessage = options.commitMessage || `Create ${path}`;
      
      const result = await this.executeWithRetry(async () => {
        return this.gitHubService.saveFile(path, data, commitMessage);
      });
      
      // Clear any cached GETs for this path
      this.clearCache(`get:${path}:`);
      
      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error, `POST request failed for ${path}`);
      
      // Publish error event if EventBus is available
      if (this.eventBus) {
        this.eventBus.publish('api:error', {
          operation: 'post',
          path,
          error: normalizedError
        });
      }
      
      throw normalizedError;
    }
  }
  
  /**
   * Perform a REST API PUT request (updates an existing file in GitHub)
   * 
   * @param {string} path - File path in the repository
   * @param {Object} data - Updated file content
   * @param {Object} [options] - Additional options
   * @param {string} [options.commitMessage] - Commit message
   * @returns {Promise<Object>} - Response data
   */
  async put(path, data, options = {}) {
    try {
      if (!this.gitHubService) {
        throw new Error('GitHubService not initialized');
      }
      
      const commitMessage = options.commitMessage || `Update ${path}`;
      
      const result = await this.executeWithRetry(async () => {
        return this.gitHubService.saveFile(path, data, commitMessage);
      });
      
      // Clear any cached GETs for this path
      this.clearCache(`get:${path}:`);
      
      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error, `PUT request failed for ${path}`);
      
      // Publish error event if EventBus is available
      if (this.eventBus) {
        this.eventBus.publish('api:error', {
          operation: 'put',
          path,
          error: normalizedError
        });
      }
      
      throw normalizedError;
    }
  }
  
  /**
   * Perform a REST API DELETE request (deletes a file from GitHub)
   * 
   * @param {string} path - File path in the repository
   * @param {Object} [options] - Additional options
   * @param {string} [options.commitMessage] - Commit message
   * @returns {Promise<Object>} - Response data
   */
  async delete(path, options = {}) {
    try {
      if (!this.gitHubService) {
        throw new Error('GitHubService not initialized');
      }
      
      const commitMessage = options.commitMessage || `Delete ${path}`;
      
      const result = await this.executeWithRetry(async () => {
        return this.gitHubService.deleteFile(path, commitMessage);
      });
      
      // Clear any cached GETs for this path
      this.clearCache(`get:${path}:`);
      
      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error, `DELETE request failed for ${path}`);
      
      // Publish error event if EventBus is available
      if (this.eventBus) {
        this.eventBus.publish('api:error', {
          operation: 'delete',
          path,
          error: normalizedError
        });
      }
      
      throw normalizedError;
    }
  }

  /**
   * Execute a function with retry logic for GitHub API operations
   * 
   * @param {Function} operation - Operation function to execute
   * @param {number} [retryCount=0] - Current retry count
   * @returns {Promise<any>} - Operation result
   */
  async executeWithRetry(operation, retryCount = 0) {
    try {
      return await operation();
    } catch (error) {
      // Check if this is a rate limit error
      if (error.status === 403 && error.message.includes('rate limit') && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.warn(`Rate limit hit, retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Generate a cache key for the request
   * 
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {Object} [params] - Request parameters
   * @returns {string} - Cache key
   */
  generateCacheKey(method, path, params = {}) {
    return `${method}:${path}:${JSON.stringify(params)}`;
  }

  /**
   * Check if there's a valid cache entry for the key
   * 
   * @param {string} cacheKey - Cache key
   * @returns {boolean} - True if valid cache exists
   */
  hasValidCacheEntry(cacheKey) {
    if (!this.cache.has(cacheKey)) {
      return false;
    }

    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry > Date.now();
  }

  /**
   * Get a cached response
   * 
   * @param {string} cacheKey - Cache key
   * @returns {any} - Cached response
   */
  getCachedResponse(cacheKey) {
    return this.cache.get(cacheKey);
  }

  /**
   * Cache a response
   * 
   * @param {string} cacheKey - Cache key
   * @param {any} response - Response to cache
   * @param {number} [duration] - Cache duration in milliseconds
   */
  cacheResponse(cacheKey, response, duration) {
    this.cache.set(cacheKey, response);
    this.cacheExpiry.set(
      cacheKey, 
      Date.now() + (duration || this.defaultCacheDuration)
    );
  }

  /**
   * Clear the entire cache or caches matching a prefix
   * 
   * @param {string} [cacheKeyPrefix] - Cache key prefix to clear, or empty to clear all
   */
  clearCache(cacheKeyPrefix) {
    if (!cacheKeyPrefix) {
      this.cache.clear();
      this.cacheExpiry.clear();
      return;
    }
    
    // Delete all cache entries that start with the prefix
    for (const key of this.cache.keys()) {
      if (key.startsWith(cacheKeyPrefix)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
  
  /**
   * Normalize error response for consistent error handling
   * 
   * @param {Error} error - Original error
   * @param {string} [defaultMessage] - Default error message if none is provided
   * @returns {Error} - Normalized error
   */
  normalizeError(error, defaultMessage = 'API request failed') {
    // Create a new error with ErrorHandler to get standardized formatting
    const errorType = this.determineErrorType(error);
    const errorMessage = error.message || defaultMessage;
    const errorCode = this.extractErrorCode(error);
    
    // Create normalized error using ErrorHandler
    const normalizedError = ErrorHandler.createError(
      errorMessage,
      errorType,
      errorCode,
      {
        originalError: error,
        status: this.extractStatusCode(error)
      }
    );
    
    return normalizedError;
  }

  /**
   * Determine the error type based on the error
   * 
   * @param {Error} error - Original error
   * @returns {string} - Error type
   */
  determineErrorType(error) {
    const status = this.extractStatusCode(error);
    
    if (status >= 400 && status < 500) {
      if (status === 401 || status === 403) {
        return 'AuthorizationError';
      }
      return 'ClientError';
    } else if (status >= 500) {
      return 'ServerError';
    } else if (error.message && error.message.includes('Network')) {
      return 'NetworkError';
    }
    
    return 'ApiError';
  }

  /**
   * Extract status code from error
   * 
   * @param {Error} error - Original error
   * @returns {number|null} - Status code
   */
  extractStatusCode(error) {
    return error.status || null;
  }

  /**
   * Extract error code from error
   * 
   * @param {Error} error - Original error
   * @returns {string} - Error code
   */
  extractErrorCode(error) {
    if (error.code) {
      return error.code;
    }
    
    return this.extractStatusCode(error) || 'UNKNOWN';
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Register with ModuleRegistry
export default registry.register(
  'api.ApiClient',
  apiClient,
  ['api.GitHubService', 'utils.EventBus', 'utils.ErrorHandler'],
  {
    description: 'Centralized API access to GitHub storage with error handling and caching',
    singleton: true,
    usage: `
      // Read data (get a file from GitHub)
      const data = await ApiClient.get('data/users.json', { cache: true });
      
      // Create data (create a file in GitHub)
      await ApiClient.post('data/users/123.json', userData, { 
        commitMessage: 'Create new user' 
      });
      
      // Update data (update a file in GitHub)
      await ApiClient.put('data/users/123.json', updatedUserData, { 
        commitMessage: 'Update user information' 
      });
      
      // Delete data (delete a file from GitHub)
      await ApiClient.delete('data/users/123.json', { 
        commitMessage: 'Delete user' 
      });
    `
  }
); 