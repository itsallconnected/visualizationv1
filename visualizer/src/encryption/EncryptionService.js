import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

/**
 * Handles encryption and decryption of content
 * Manages encryption keys and secure content access
 */
class EncryptionService {
  constructor() {
    // Store decryption keys in memory only - will be lost on refresh
    this.decryptionKeys = new Map();
    
    // Store nodes that have been decrypted during this session
    this.decryptedNodes = new Set();
    
    // Track failed decryption attempts to prevent brute force
    this.failedAttempts = new Map();
    
    // Maximum allowed failed attempts before timeout
    this.maxFailedAttempts = 5;
    
    // Timeout duration in milliseconds for failed attempts
    this.failedAttemptTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Reference to required services
    this.cryptoHelpers = null;
    this.authService = null;
    this.eventBus = null;
    
    // Master encryption key for basic node information (used for viewers)
    this.viewerMasterKey = null;
    
    // Initialized flag
    this.initialized = false;
  }

  /**
   * Initialize the encryption service
   */
  async initialize() {
    if (this.initialized) return;
    
    // Get required dependencies from registry
    this.cryptoHelpers = registry.getModule('encryption.utils.CryptoHelpers');
    this.authService = registry.getModule('auth.AuthService');
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available');
    }
    
    // Subscribe to events
    this.eventBus.subscribe('node:decryption:requested', this.handleDecryptionRequest.bind(this));
    this.eventBus.subscribe('auth:signIn', this.handleUserSignIn.bind(this));
    this.eventBus.subscribe('auth:signOut', this.handleUserSignOut.bind(this));
    
    // Set up viewer key
    await this.setupViewerKey();
    
    this.initialized = true;
    console.log('EncryptionService initialized');
  }

  /**
   * Set up the viewer master key
   * This key is used to decrypt basic node information for viewers
   */
  async setupViewerKey() {
    // In a real app, this could be fetched from a secure configuration
    // For now, we'll use a default key that would be stored securely in production
    try {
      // Get from session storage if available
      const storedKey = sessionStorage.getItem('viewerMasterKey');
      if (storedKey) {
        this.viewerMasterKey = storedKey;
        return;
      }
      
      // Generate a new key - in production this would be retrieved from server
      const visualizerConfig = registry.getModule('config.AppSettings');
      if (visualizerConfig && visualizerConfig.encryption && visualizerConfig.encryption.viewerKey) {
        this.viewerMasterKey = visualizerConfig.encryption.viewerKey;
      } else {
        // Fallback to default key (in production, would never happen)
        this.viewerMasterKey = 'viewer-master-key-for-basic-node-access';
      }
      
      // Store in session storage
      sessionStorage.setItem('viewerMasterKey', this.viewerMasterKey);
      
    } catch (error) {
      console.error('Error setting up viewer key:', error);
      // Fallback to default key
      this.viewerMasterKey = 'viewer-master-key-for-basic-node-access';
    }
  }

  /**
   * Handle user sign in event
   * @param {Object} event - Sign in event data
   */
  handleUserSignIn(event) {
    if (!event || !event.user) return;
    
    // Clear any previous keys
    this.decryptionKeys.clear();
    this.decryptedNodes.clear();
    
    // Store user access level keys if provided
    if (event.keys) {
      if (event.keys.viewer) {
        this.viewerMasterKey = event.keys.viewer;
        sessionStorage.setItem('viewerMasterKey', this.viewerMasterKey);
      }
      
      // Other keys could be stored similarly
    }
  }

  /**
   * Handle user sign out event
   */
  handleUserSignOut() {
    // Clear all keys on sign out for security
    this.decryptionKeys.clear();
    this.decryptedNodes.clear();
    this.failedAttempts.clear();
  }

  /**
   * Encrypt content using the provided password
   * @param {string|Object} content - Content to encrypt
   * @param {string} password - Encryption password
   * @returns {Object} Encrypted content object
   */
  encryptContent(content, password) {
    if (!this.initialized) {
      this.initialize();
    }
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available for encryption');
    }
    
    return this.cryptoHelpers.encryptData(content, password);
  }

  /**
   * Decrypt content using the provided password
   * @param {Object} encryptedData - Encrypted content object
   * @param {string} password - Decryption password
   * @returns {string|Object} Decrypted content
   */
  decryptContent(encryptedData, password) {
    if (!this.initialized) {
      this.initialize();
    }
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available for decryption');
    }
    
    return this.cryptoHelpers.decryptData(encryptedData, password);
  }

  /**
   * Store a decryption key for a node
   * @param {string} nodeId - ID of the node
   * @param {string} password - Decryption password
   * @param {string} keyType - Type of key (detail, full, etc.)
   */
  storeDecryptionKey(nodeId, password, keyType = 'detail') {
    const keyId = `${nodeId}:${keyType}`;
    this.decryptionKeys.set(keyId, password);
    this.decryptedNodes.add(nodeId);
    
    // Reset failed attempts
    this.failedAttempts.delete(nodeId);
    
    // Emit event that node has been decrypted
    this.eventBus.publish('node:decrypted', { nodeId, keyType });
  }

  /**
   * Get a stored decryption key
   * @param {string} nodeId - ID of the node
   * @param {string} keyType - Type of key (detail, full, etc.)
   * @returns {string|null} Stored password or null if not found
   */
  getDecryptionKey(nodeId, keyType = 'detail') {
    const keyId = `${nodeId}:${keyType}`;
    return this.decryptionKeys.get(keyId) || null;
  }

  /**
   * Clear a stored decryption key
   * @param {string} nodeId - ID of the node
   * @param {string} keyType - Type of key (detail, full, etc.)
   */
  clearDecryptionKey(nodeId, keyType = 'detail') {
    const keyId = `${nodeId}:${keyType}`;
    this.decryptionKeys.delete(keyId);
    
    // Check if we still have any keys for this node
    for (const key of this.decryptionKeys.keys()) {
      if (key.startsWith(`${nodeId}:`)) {
        return; // Still have some keys for this node
      }
    }
    
    // No more keys, remove from decrypted nodes
    this.decryptedNodes.delete(nodeId);
    
    // Emit event that node has been locked
    this.eventBus.publish('node:locked', { nodeId });
  }

  /**
   * Check if a node has been decrypted
   * @param {string} nodeId - ID of the node
   * @param {string} keyType - Type of key (detail, full, etc.)
   * @returns {boolean} True if the node is decrypted for the given key type
   */
  isNodeDecrypted(nodeId, keyType = 'detail') {
    const keyId = `${nodeId}:${keyType}`;
    return this.decryptionKeys.has(keyId);
  }

  /**
   * Record a failed decryption attempt
   * @param {string} nodeId - ID of the node
   */
  recordFailedAttempt(nodeId) {
    const now = Date.now();
    const attempts = this.failedAttempts.get(nodeId) || { count: 0, timestamp: now };
    
    // Increment counter
    attempts.count++;
    attempts.timestamp = now;
    
    this.failedAttempts.set(nodeId, attempts);
    
    // Publish event about failed attempt
    this.eventBus.publish('node:decryption:failed', { 
      nodeId, 
      attempts: attempts.count 
    });
  }

  /**
   * Check if a node is locked due to too many failed attempts
   * @param {string} nodeId - ID of the node
   * @returns {Object|null} Lock information or null if not locked
   */
  getFailedAttemptsLock(nodeId) {
    const attempts = this.failedAttempts.get(nodeId);
    
    if (!attempts) return null;
    
    // Check if we're over the maximum attempts
    if (attempts.count >= this.maxFailedAttempts) {
      const now = Date.now();
      const lockExpires = attempts.timestamp + this.failedAttemptTimeout;
      
      // Check if lock period has expired
      if (now < lockExpires) {
        const remainingTime = Math.round((lockExpires - now) / 1000);
        return {
          locked: true,
          remainingTime,
          attempts: attempts.count
        };
      } else {
        // Lock has expired, reset attempts
        this.failedAttempts.delete(nodeId);
        return null;
      }
    }
    
    // Not locked, return attempt count
    return {
      locked: false,
      attempts: attempts.count,
      remaining: this.maxFailedAttempts - attempts.count
    };
  }

  /**
   * Handle decryption request event
   * @param {Object} event - Decryption request event
   */
  handleDecryptionRequest(event) {
    if (!event || !event.nodeId) return;
    
    const { nodeId, keyType = 'detail', onSuccess, onFailure } = event;
    
    // Check if already decrypted
    if (this.isNodeDecrypted(nodeId, keyType)) {
      if (onSuccess) onSuccess();
      return;
    }
    
    // Check if locked
    const lockInfo = this.getFailedAttemptsLock(nodeId);
    if (lockInfo && lockInfo.locked) {
      // Node is locked due to too many attempts
      this.eventBus.publish('modal:show', {
        type: 'alert',
        title: 'Decryption Locked',
        message: `Too many failed attempts. Please try again in ${Math.floor(lockInfo.remainingTime / 60)}m ${lockInfo.remainingTime % 60}s.`
      });
      
      if (onFailure) onFailure(new Error('Node is locked due to too many failed attempts'));
      return;
    }
    
    // Show decryption dialog
    this.showDecryptionDialog(nodeId, keyType, onSuccess, onFailure);
  }

  /**
   * Show decryption dialog for a node
   * @param {string} nodeId - Node ID
   * @param {string} keyType - Type of key (detail, full, etc.)
   * @param {Function} onSuccess - Success callback
   * @param {Function} onFailure - Failure callback
   */
  showDecryptionDialog(nodeId, keyType = 'detail', onSuccess, onFailure) {
    // Get modal manager
    const modalManager = registry.getModule('components.ModalManager');
    
    if (!modalManager) {
      console.error('Modal manager not available for decryption dialog');
      if (onFailure) onFailure(new Error('Modal manager not available'));
      return;
    }
    
    // Show the dialog
    modalManager.show({
      component: 'encryption.components.DecryptionDialog',
      props: {
        nodeId,
        keyType,
        onDecrypt: (password) => {
          this.storeDecryptionKey(nodeId, password, keyType);
          if (onSuccess) onSuccess(password);
        },
        onCancel: () => {
          if (onFailure) onFailure(new Error('Decryption cancelled by user'));
        }
      },
      options: {
        closeOnEsc: true,
        closeOnOutsideClick: false,
        modalClassName: 'decryption-dialog-modal'
      }
    });
  }

  /**
   * Process a node to decrypt its content if needed
   * @param {Object} node - Node object
   * @param {string} keyType - Type of decryption (basic, detail, full)
   * @returns {Object} Processed node
   */
  processNode(node, keyType = 'basic') {
    if (!node) return node;
    
    // Make a copy to avoid modifying the original
    const processedNode = { ...node };
    
    // For basic decryption (used by viewers), use master key
    if (keyType === 'basic' && this.viewerMasterKey) {
      return this.decryptBasicNodeInfo(processedNode);
    }
    
    // For detail decryption, check if we have the key
    if (keyType === 'detail' && this.isNodeDecrypted(node.id, 'detail')) {
      return this.decryptNodeDetails(processedNode);
    }
    
    // For full decryption, check if we have the key
    if (keyType === 'full' && this.isNodeDecrypted(node.id, 'full')) {
      return this.decryptFullNode(processedNode);
    }
    
    // No decryption performed
    return processedNode;
  }

  /**
   * Decrypt basic node information using the viewer master key
   * This includes node name, type, parent, and minimal description
   * @param {Object} node - Node to decrypt
   * @returns {Object} Node with basic info decrypted
   */
  decryptBasicNodeInfo(node) {
    if (!node || !node.encrypted || !this.viewerMasterKey) {
      return node;
    }
    
    try {
      // Make a deep copy
      const result = { ...node };
      
      // For basic info, if it's in a simple encrypted format, decrypt it
      if (node.encrypted_basic_info && typeof node.encrypted_basic_info === 'object') {
        const decrypted = this.cryptoHelpers.decryptData(
          node.encrypted_basic_info, 
          this.viewerMasterKey
        );
        
        if (decrypted) {
          // Apply decrypted properties
          Object.assign(result, decrypted);
          result._basic_decrypted = true;
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error decrypting basic info for node ${node.id}:`, error);
      return node;
    }
  }

  /**
   * Decrypt node details using the stored detail key
   * @param {Object} node - Node to decrypt
   * @returns {Object} Node with details decrypted
   */
  decryptNodeDetails(node) {
    if (!node || !node.id) return node;
    
    // Get the detail key
    const detailKey = this.getDecryptionKey(node.id, 'detail');
    if (!detailKey) return node;
    
    try {
      // Make a deep copy
      const result = { ...node };
      
      // Decrypt detailed content if available
      if (node.content && node.content.encrypted) {
        result.content = this.cryptoHelpers.decryptData(node.content, detailKey);
        result._detail_decrypted = true;
      }
      
      return result;
    } catch (error) {
      console.error(`Error decrypting details for node ${node.id}:`, error);
      return node;
    }
  }

  /**
   * Decrypt full node content using the stored full key
   * @param {Object} node - Node to decrypt
   * @returns {Object} Fully decrypted node
   */
  decryptFullNode(node) {
    if (!node || !node.id) return node;
    
    // Get the full key
    const fullKey = this.getDecryptionKey(node.id, 'full');
    if (!fullKey) return node;
    
    try {
      // For fully encrypted nodes, decrypt the entire object
      if (node.full_encrypted && typeof node.full_encrypted === 'object') {
        const decrypted = this.cryptoHelpers.decryptData(node.full_encrypted, fullKey);
        return {
          ...node,
          ...decrypted,
          _full_decrypted: true
        };
      }
      
      // Otherwise just decrypt what we can
      return this.decryptNodeDetails(node);
    } catch (error) {
      console.error(`Error fully decrypting node ${node.id}:`, error);
      return node;
    }
  }

  /**
   * Process multiple nodes to decrypt their content
   * @param {Array} nodes - Array of nodes
   * @param {string} keyType - Type of decryption
   * @returns {Array} Processed nodes
   */
  processNodes(nodes, keyType = 'basic') {
    if (!nodes || !Array.isArray(nodes)) return nodes;
    
    return nodes.map(node => this.processNode(node, keyType));
  }

  /**
   * Encrypt a node for secure storage
   * @param {Object} node - Node to encrypt
   * @param {Object} options - Encryption options
   * @returns {Object} Encrypted node
   */
  encryptNode(node, options = {}) {
    if (!node || !node.id) {
      throw new Error('Invalid node for encryption');
    }
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available for encryption');
    }
    
    const {
      detailPassword,
      fullPassword,
      accessLevel = 'viewer'
    } = options;
    
    try {
      // Create a copy for encryption
      const result = { ...node };
      
      // Extract basic information that will be encrypted with viewer key
      const basicInfo = {
        id: node.id,
        name: node.name,
        type: node.type,
        parent: node.parent,
        position: node.position,
        level: node.level,
        description_preview: node.description ? node.description.substring(0, 50) : null
      };
      
      // Encrypt basic info with viewer key
      if (this.viewerMasterKey) {
        result.encrypted_basic_info = this.cryptoHelpers.encryptData(
          basicInfo,
          this.viewerMasterKey
        );
      }
      
      // Encrypt detail content if password provided
      if (detailPassword && node.content) {
        result.content = this.cryptoHelpers.encryptData(
          node.content,
          detailPassword
        );
        
        // Store the key
        this.storeDecryptionKey(node.id, detailPassword, 'detail');
      }
      
      // Encrypt full node if password provided
      if (fullPassword) {
        // Deep clone excluding large encrypted parts
        const { encrypted_basic_info, content, ...rest } = node;
        result.full_encrypted = this.cryptoHelpers.encryptData(
          rest,
          fullPassword
        );
        
        // Store the key
        this.storeDecryptionKey(node.id, fullPassword, 'full');
      }
      
      // Mark as encrypted
      result.encrypted = true;
      result.access_level = accessLevel;
      result.encrypted_timestamp = new Date().toISOString();
      
      return result;
    } catch (error) {
      throw new Error(`Error encrypting node: ${error.message}`);
    }
  }

  /**
   * Encrypt a GitHub file for secure storage
   * This is a convenience method that uses CryptoHelpers
   * @param {Object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @param {string} accessLevel - Access level
   * @returns {Object} Encrypted file
   */
  encryptFileForGitHub(data, password, accessLevel = 'viewer') {
    if (!this.initialized) {
      this.initialize();
    }
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available for encryption');
    }
    
    return this.cryptoHelpers.encryptFileForGitHub(data, password, accessLevel);
  }

  /**
   * Decrypt a GitHub file
   * This is a convenience method that uses CryptoHelpers
   * @param {Object} encryptedFile - Encrypted file
   * @param {string} password - Decryption password
   * @returns {Object} Decrypted data
   */
  decryptFileFromGitHub(encryptedFile, password) {
    if (!this.initialized) {
      this.initialize();
    }
    
    if (!this.cryptoHelpers) {
      throw new Error('CryptoHelpers not available for decryption');
    }
    
    return this.cryptoHelpers.decryptFileFromGitHub(encryptedFile, password);
  }

  /**
   * Dispose of the encryption service
   * Clears all keys and unsubscribes from events
   */
  dispose() {
    // Clear all keys for security
    this.decryptionKeys.clear();
    this.decryptedNodes.clear();
    this.failedAttempts.clear();
    this.viewerMasterKey = null;
    
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('node:decryption:requested', this.handleDecryptionRequest);
      this.eventBus.unsubscribe('auth:signIn', this.handleUserSignIn);
      this.eventBus.unsubscribe('auth:signOut', this.handleUserSignOut);
    }
    
    // Reset initialization flag
    this.initialized = false;
  }
}

export default registry.register(
  'encryption.EncryptionService',
  new EncryptionService(),
  [
    'encryption.utils.CryptoHelpers',
    'auth.AuthService',
    'utils.EventBus',
    'components.ModalManager',
    'config.AppSettings'
  ],
  {
    description: 'Service for handling encryption and decryption of content',
    usage: 'Central service for working with encrypted content within the application'
  }); 