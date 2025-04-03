// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React from 'react';
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

/**
 * Manages protection and access control for encrypted nodes
 * Handles node-specific protection rules and access control
 */
class NodeProtectionManager {
  constructor() {
    // Track encrypted nodes and their protection settings
    this.encryptedNodes = new Map();
    
    // Track temporary access grants
    this.temporaryAccess = new Map();
    
    // Track access attempts
    this.accessAttempts = new Map();
    
    // Reference to required services
    this.encryptionService = null;
    this.authService = null;
    this.eventBus = null;
    
    // Initialization flag
    this.initialized = false;
  }
  
  /**
   * Initialize the protection manager
   */
  async initialize() {
    if (this.initialized) return;
    
    // Get required services
    this.encryptionService = registry.getModule('encryption.EncryptionService');
    this.authService = registry.getModule('auth.AuthService');
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    if (!this.encryptionService) {
      throw new Error('EncryptionService not available');
    }
    
    // Ensure EncryptionService is initialized
    if (this.encryptionService.initialize && !this.encryptionService.initialized) {
      await this.encryptionService.initialize();
    }
    
    // Subscribe to events
    this.eventBus.subscribe('data:loaded', this.handleNodesLoaded.bind(this));
    this.eventBus.subscribe('data:nodeUpdated', this.handleNodeUpdated.bind(this));
    this.eventBus.subscribe('auth:signIn', this.handleUserSignIn.bind(this));
    this.eventBus.subscribe('auth:signOut', this.handleUserSignOut.bind(this));
    this.eventBus.subscribe('node:access:requested', this.handleAccessRequest.bind(this));
    
    this.initialized = true;
    console.log('NodeProtectionManager initialized');
  }
  
  /**
   * Handle data loaded event
   * @param {Object} event - Data loaded event
   */
  handleNodesLoaded(event) {
    if (!event || !event.nodes) return;
    
    // Process all loaded nodes
    event.nodes.forEach(node => {
      this.registerNodeProtection(node);
    });
    
    // Publish status update
    this.eventBus.publish('nodeProtection:status', {
      protectedNodeCount: this.encryptedNodes.size
    });
  }
  
  /**
   * Handle node updated event
   * @param {Object} event - Node updated event
   */
  handleNodeUpdated(event) {
    if (!event || !event.node) return;
    
    // Update protection info for this node
    this.registerNodeProtection(event.node);
  }
  
  /**
   * Handle user sign in event
   * @param {Object} event - Sign in event data
   */
  handleUserSignIn(event) {
    if (!event || !event.user) return;
    
    const { user } = event;
    
    // Clear temporary access
    this.temporaryAccess.clear();
    
    // Grant automatic access based on user role
    if (user.role === 'admin') {
      // Admins get automatic access to all viewer-level content
      this.grantRoleBasedAccess(user);
    }
  }
  
  /**
   * Handle user sign out event
   */
  handleUserSignOut() {
    // Clear all temporary access
    this.temporaryAccess.clear();
    
    // Clear access attempts
    this.accessAttempts.clear();
    
    // Publish protection state change
    this.eventBus.publish('nodeProtection:changed', {});
  }
  
  /**
   * Handle node access request event
   * @param {Object} event - Access request event
   */
  handleAccessRequest(event) {
    if (!event) return;
    
    const { nodeId, password, keyType = 'detail', onSuccess, onFailure } = event;
    
    // Attempt to provide access
    this.requestNodeAccess(nodeId, password, keyType)
      .then(success => {
        if (success && onSuccess) {
          onSuccess();
        } else if (!success && onFailure) {
          onFailure(new Error('Access denied'));
        }
      })
      .catch(error => {
        if (onFailure) {
          onFailure(error);
        }
      });
  }
  
  /**
   * Register a node's protection settings
   * @param {Object} node - Node data
   */
  registerNodeProtection(node) {
    if (!node || !node.id) return;
    
    // Check if the node is protected or encrypted
    if (node.encrypted || node.protected || node.access_level || 
        (node.content && node.content.encrypted)) {
      
      // Determine access level
      const accessLevel = node.access_level || 
                         (node.access_control && node.access_control.level) || 
                         'password';
      
      // Store protection info
      this.encryptedNodes.set(node.id, {
        nodeId: node.id,
        isEncrypted: node.encrypted === true || (node.content && node.content.encrypted === true),
        isProtected: node.protected === true,
        accessLevel: accessLevel,
        roles: node.allowed_roles || [],
        users: node.allowed_users || [],
        encryptionTypes: node.encryption_types || ['detail']
      });
    } else {
      // Not protected, remove if exists
      if (this.encryptedNodes.has(node.id)) {
        this.encryptedNodes.delete(node.id);
      }
    }
  }
  
  /**
   * Grant role-based access to nodes
   * @param {Object} user - User object
   */
  grantRoleBasedAccess(user) {
    if (!user) return;
    
    // Automatic access based on user role
    for (const [nodeId, protection] of this.encryptedNodes.entries()) {
      if (protection.accessLevel === 'viewer' && 
          (user.role === 'admin' || user.role === 'editor')) {
        // Grant temporary access for the session
        this.grantTemporaryAccess(nodeId, 'basic');
      }
    }
  }
  
  /**
   * Check if a node is protected
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node is protected
   */
  isNodeProtected(nodeId) {
    if (!nodeId) return false;
    
    return this.encryptedNodes.has(nodeId);
  }
  
  /**
   * Check if user has access to a node
   * @param {string} nodeId - Node ID
   * @param {string} keyType - Type of key (basic, detail, full)
   * @param {Object} user - User object (optional, uses current user if not provided)
   * @returns {boolean} True if user has access
   */
  hasNodeAccess(nodeId, keyType = 'detail', user = null) {
    if (!nodeId) return false;
    
    // If not protected, always have access
    if (!this.isNodeProtected(nodeId)) return true;
    
    // Check if decryption key is available in EncryptionService
    if (this.encryptionService.isNodeDecrypted(nodeId, keyType)) {
      return true;
    }
    
    // Check if temporary access is granted
    const accessKey = `${nodeId}:${keyType}`;
    if (this.temporaryAccess.has(accessKey)) {
      const expiration = this.temporaryAccess.get(accessKey);
      if (expiration > Date.now()) {
        return true;
      } else {
        // Expired, remove it
        this.temporaryAccess.delete(accessKey);
      }
    }
    
    // Get protection settings
    const protection = this.encryptedNodes.get(nodeId);
    if (!protection) return false;
    
    // Get current user if not provided
    const currentUser = user || (this.authService ? this.authService.getCurrentUser() : null);
    
    // Check access based on level
    switch (protection.accessLevel) {
      case 'public':
        return true;
      
      case 'viewer':
        // Any authenticated user can access viewer content
        return !!currentUser;
      
      case 'editor':
        // Editors and admins can access
        return currentUser && (currentUser.role === 'editor' || currentUser.role === 'admin');
      
      case 'admin':
        // Only admins can access
        return currentUser && currentUser.role === 'admin';
      
      case 'password':
        // Needs explicit password, already checked encryptionService above
        return false;
      
      case 'role':
        // User must have one of the allowed roles
        if (!currentUser || !protection.roles || protection.roles.length === 0) {
          return false;
        }
        return currentUser.role && protection.roles.includes(currentUser.role);
      
      case 'user':
        // Specific users only
        if (!currentUser || !protection.users || protection.users.length === 0) {
          return false;
        }
        return protection.users.includes(currentUser.id);
      
      default:
        return false;
    }
  }
  
  /**
   * Verify node password using encryption service
   * @param {string} nodeId - Node ID
   * @param {string} password - Password to verify
   * @param {string} keyType - Type of key (basic, detail, full)
   * @returns {Promise<boolean>} True if password is correct
   */
  async verifyNodePassword(nodeId, password, keyType = 'detail') {
    if (!nodeId || !password) return false;
    
    try {
      // Need the node to verify
      const nodeRepository = registry.getModule('data.NodeRepository');
      
      if (!nodeRepository) {
        throw new Error('NodeRepository not available');
      }
      
      // Get the node
      const node = await nodeRepository.getNode(nodeId);
      
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }
      
      // Determine what to decrypt based on key type
      let contentToDecrypt = null;
      
      if (keyType === 'detail' && node.content && node.content.encrypted) {
        contentToDecrypt = node.content;
      } else if (keyType === 'full' && node.full_encrypted) {
        contentToDecrypt = node.full_encrypted;
      } else if (keyType === 'basic' && node.encrypted_basic_info) {
        contentToDecrypt = node.encrypted_basic_info;
      }
      
      if (!contentToDecrypt) {
        console.warn(`No encrypted content found for ${nodeId} with key type ${keyType}`);
        return false;
      }
      
      // Try to decrypt
      this.encryptionService.decryptContent(contentToDecrypt, password);
      
      // If no error, password is correct
      return true;
    } catch (error) {
      console.warn(`Password verification failed for node ${nodeId}:`, error);
      return false;
    }
  }
  
  /**
   * Request access to a protected node
   * @param {string} nodeId - Node ID
   * @param {string} password - Password for access
   * @param {string} keyType - Type of key (basic, detail, full)
   * @returns {Promise<boolean>} True if access granted
   */
  async requestNodeAccess(nodeId, password, keyType = 'detail') {
    if (!nodeId) return false;
    
    // If node is not protected, access is granted
    if (!this.isNodeProtected(nodeId)) return true;
    
    // If already have access, return true
    if (this.hasNodeAccess(nodeId, keyType)) return true;
    
    // Check if too many failed attempts
    if (this.isTooManyAttempts(nodeId)) {
      throw new Error('Too many failed access attempts. Please try again later.');
    }
    
    try {
      // Verify password
      const isCorrect = await this.verifyNodePassword(nodeId, password, keyType);
      
      if (isCorrect) {
        // Store key in EncryptionService
        this.encryptionService.storeDecryptionKey(nodeId, password, keyType);
        
        // Grant temporary access
        this.grantTemporaryAccess(nodeId, keyType);
        
        // Reset attempts
        this.resetAccessAttempts(nodeId);
        
        // Publish event
        this.eventBus.publish('node:access:granted', { nodeId, keyType });
        
        return true;
      } else {
        this.recordFailedAttempt(nodeId);
        return false;
      }
    } catch (error) {
      this.recordFailedAttempt(nodeId);
      throw error;
    }
  }
  
  /**
   * Grant temporary access to a node
   * @param {string} nodeId - Node ID
   * @param {string} keyType - Type of key (basic, detail, full)
   * @param {number} duration - Duration in milliseconds (default 30 minutes)
   */
  grantTemporaryAccess(nodeId, keyType = 'detail', duration = 30 * 60 * 1000) {
    if (!nodeId) return;
    
    const accessKey = `${nodeId}:${keyType}`;
    const expiration = Date.now() + duration;
    this.temporaryAccess.set(accessKey, expiration);
    
    // Schedule access revocation
    setTimeout(() => {
      this.revokeTemporaryAccess(nodeId, keyType);
    }, duration);
    
    // Publish event
    this.eventBus.publish('nodeProtection:changed', { nodeId, keyType, granted: true });
  }
  
  /**
   * Revoke temporary access to a node
   * @param {string} nodeId - Node ID
   * @param {string} keyType - Type of key (basic, detail, full)
   */
  revokeTemporaryAccess(nodeId, keyType = 'detail') {
    if (!nodeId) return;
    
    const accessKey = `${nodeId}:${keyType}`;
    
    if (this.temporaryAccess.has(accessKey)) {
      this.temporaryAccess.delete(accessKey);
      
      // Publish event
      this.eventBus.publish('nodeProtection:changed', { nodeId, keyType, granted: false });
    }
  }
  
  /**
   * Record a failed access attempt
   * @param {string} nodeId - Node ID
   */
  recordFailedAttempt(nodeId) {
    if (!nodeId) return;
    
    const now = Date.now();
    const attempts = this.accessAttempts.get(nodeId) || [];
    
    // Add current timestamp and filter to keep only recent attempts (last hour)
    const recentAttempts = [...attempts, now].filter(time => now - time < 60 * 60 * 1000);
    
    this.accessAttempts.set(nodeId, recentAttempts);
    
    // Publish event
    this.eventBus.publish('node:access:failed', { 
      nodeId, 
      attemptCount: recentAttempts.length 
    });
  }
  
  /**
   * Reset access attempts for a node
   * @param {string} nodeId - Node ID
   */
  resetAccessAttempts(nodeId) {
    if (!nodeId) return;
    
    this.accessAttempts.delete(nodeId);
  }
  
  /**
   * Check if there have been too many access attempts
   * @param {string} nodeId - Node ID
   * @param {number} maxAttempts - Maximum allowed attempts (default: 5)
   * @returns {boolean} True if too many attempts
   */
  isTooManyAttempts(nodeId, maxAttempts = 5) {
    if (!nodeId) return false;
    
    const attempts = this.accessAttempts.get(nodeId) || [];
    const now = Date.now();
    
    // Count only attempts in the last hour
    const recentAttempts = attempts.filter(time => now - time < 60 * 60 * 1000);
    
    return recentAttempts.length >= maxAttempts;
  }
  
  /**
   * Get the protection information for a node
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Protection information or null if not protected
   */
  getProtectionInfo(nodeId) {
    if (!nodeId) return null;
    
    return this.encryptedNodes.get(nodeId) || null;
  }
  
  /**
   * Dispose of the protection manager
   * Cleans up resources and event listeners
   */
  dispose() {
    // Clear internal state
    this.encryptedNodes.clear();
    this.temporaryAccess.clear();
    this.accessAttempts.clear();
    
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('data:loaded', this.handleNodesLoaded);
      this.eventBus.unsubscribe('data:nodeUpdated', this.handleNodeUpdated);
      this.eventBus.unsubscribe('auth:signIn', this.handleUserSignIn);
      this.eventBus.unsubscribe('auth:signOut', this.handleUserSignOut);
      this.eventBus.unsubscribe('node:access:requested', this.handleAccessRequest);
    }
    
    this.initialized = false;
  }
}

export default registry.register(
  'encryption.NodeProtectionManager',
  new NodeProtectionManager(),
  [
    'encryption.EncryptionService',
    'auth.AuthService',
    'utils.EventBus',
    'data.NodeRepository'
  ],
  {
    description: 'Manages node-specific protection rules and access control',
    usage: 'Used to protect sensitive nodes and control access based on various criteria'
  }
);

