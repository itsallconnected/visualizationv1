import registry from '../../ModuleRegistry';

/**
 * OAuth Utilities
 * 
 * This module provides utility functions for OAuth authentication workflows.
 * It includes helpers for URL parsing, cryptographic operations, and token handling.
 */

/**
 * Parse OAuth callback parameters from URL
 * 
 * @param {string} url - URL to parse (defaults to current location)
 * @returns {Object} Parsed OAuth parameters
 */
export const parseOAuthCallbackParams = (url = window.location.href) => {
  try {
    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);
    
    return {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
      hasAuthCode: !!params.get('code'),
      hasError: !!params.get('error')
    };
  } catch (error) {
    console.error('Error parsing OAuth callback URL:', error);
    return {
      code: null,
      state: null,
      error: 'invalid_url',
      errorDescription: 'Failed to parse URL',
      hasAuthCode: false,
      hasError: true
    };
  }
};

/**
 * Generate a random state parameter for OAuth flows
 * 
 * @param {number} length - Length of the state string
 * @returns {string} Random state string
 */
export const generateRandomState = (length = 32) => {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Generate a cryptographically secure random code verifier for PKCE
 * 
 * @param {number} length - Length of the verifier (default 48 bytes)
 * @returns {string} Code verifier
 */
export const generateCodeVerifier = (length = 48) => {
  // Generate random bytes
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  
  // Convert to base64 and make URL safe
  return base64UrlEncode(array);
};

/**
 * Generate a code challenge from code verifier for PKCE
 * 
 * @param {string} codeVerifier - Code verifier string
 * @returns {Promise<string>} Code challenge
 */
export const generateCodeChallenge = async (codeVerifier) => {
  // SHA-256 hash the code verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64 URL-safe string
  return base64UrlEncode(new Uint8Array(hashBuffer));
};

/**
 * Base64 URL-safe encode a byte array
 * 
 * @param {Uint8Array} buffer - Byte array to encode
 * @returns {string} Base64 URL-safe encoded string
 */
export const base64UrlEncode = (buffer) => {
  // Convert the buffer to a base64 string
  let base64 = btoa(String.fromCharCode.apply(null, buffer));
  
  // Make base64 URL-safe: replace '+' with '-', '/' with '_', and remove '='
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Extract token information from OAuth token response
 * 
 * @param {Object} tokenData - Token response from OAuth provider
 * @returns {Object} Normalized token information
 */
export const extractTokenInfo = (tokenData) => {
  if (!tokenData) return null;
  
  return {
    accessToken: tokenData.access_token,
    tokenType: tokenData.token_type || 'bearer',
    scope: tokenData.scope ? tokenData.scope.split(' ') : [],
    refreshToken: tokenData.refresh_token || null,
    expiresIn: tokenData.expires_in ? parseInt(tokenData.expires_in, 10) : null,
    expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null,
    idToken: tokenData.id_token || null
  };
};

/**
 * Check if a token is expired
 * 
 * @param {Object} tokenInfo - Token information with expiresAt
 * @param {number} bufferSeconds - Buffer time in seconds (default 300s/5min)
 * @returns {boolean} Whether the token is expired or will expire soon
 */
export const isTokenExpired = (tokenInfo, bufferSeconds = 300) => {
  if (!tokenInfo || !tokenInfo.expiresAt) return true;
  
  const expiryTime = tokenInfo.expiresAt;
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;
  
  return now > expiryTime - bufferMs;
};

/**
 * Create OAuth authorization URL
 * 
 * @param {Object} options - URL configuration options
 * @param {string} options.authorizeEndpoint - OAuth provider's authorization endpoint
 * @param {string} options.clientId - OAuth client ID
 * @param {string} options.redirectUri - Redirect URI after authorization
 * @param {string|Array<string>} options.scope - OAuth scopes to request
 * @param {string} options.state - State parameter for CSRF protection
 * @param {string} options.codeChallenge - PKCE code challenge
 * @param {string} options.responseType - OAuth response type (default: 'code')
 * @returns {string} Authorization URL
 */
export const createAuthorizationUrl = (options) => {
  const {
    authorizeEndpoint,
    clientId,
    redirectUri,
    scope,
    state,
    codeChallenge,
    responseType = 'code'
  } = options;
  
  if (!authorizeEndpoint || !clientId || !redirectUri) {
    throw new Error('Missing required OAuth parameters');
  }
  
  // Build URL
  const url = new URL(authorizeEndpoint);
  const params = new URLSearchParams();
  
  // Required parameters
  params.append('client_id', clientId);
  params.append('redirect_uri', redirectUri);
  params.append('response_type', responseType);
  
  // Optional parameters
  if (scope) {
    const scopeString = Array.isArray(scope) ? scope.join(' ') : scope;
    params.append('scope', scopeString);
  }
  
  if (state) {
    params.append('state', state);
  }
  
  // PKCE parameters
  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }
  
  url.search = params.toString();
  return url.toString();
};

// Register with ModuleRegistry
registry.register(
  'utils.auth.OAuthUtils',
  {
    parseOAuthCallbackParams,
    generateRandomState,
    generateCodeVerifier,
    generateCodeChallenge,
    base64UrlEncode,
    extractTokenInfo,
    isTokenExpired,
    createAuthorizationUrl
  },
  [],
  {
    description: 'Utility functions for OAuth authentication workflows',
    provides: ['oauthUtils']
  }
);

export default {
  parseOAuthCallbackParams,
  generateRandomState,
  generateCodeVerifier,
  generateCodeChallenge,
  base64UrlEncode,
  extractTokenInfo,
  isTokenExpired,
  createAuthorizationUrl
}; 