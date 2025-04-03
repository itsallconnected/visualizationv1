/**
 * DataSynchronizer handles data synchronization between client and server,
 * providing offline capabilities, conflict resolution, and change tracking.
 */
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

class DataSynchronizer {
  constructor() {
    this.nodeRepository = null;
    this.encryptionService = null;
    this.nodeProtectionManager = null;
    this.eventBus = null;
    this.isInitialized = false;
    this.pendingChanges = new Map();
    this.syncQueue = [];
    this.conflictHandler = this.defaultConflictHandler;
    this.syncStatus = {
      lastSync: null,
      isSyncing: false,
      pendingCount: 0,
      error: null
    };
    this.listeners = [];
  }

  /**
   * Initialize the data synchronizer
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Get required dependencies
      this.nodeRepository = registry.getModule('data.NodeRepository');
      this.encryptionService = registry.getModule('encryption.EncryptionService');
      this.nodeProtectionManager = registry.getModule('encryption.NodeProtectionManager');
      this.eventBus = registry.getModule('utils.EventBus') || EventBus;
      
      if (!this.nodeRepository) {
        throw new Error('NodeRepository not found in registry');
      }
      
      // Ensure NodeRepository is initialized
      if (this.nodeRepository.initialize) {
        await this.nodeRepository.initialize();
      }
      
      // Ensure EncryptionService is initialized if available
      if (this.encryptionService && this.encryptionService.initialize) {
        await this.encryptionService.initialize();
      }
      
      // Ensure NodeProtectionManager is initialized if available
      if (this.nodeProtectionManager && this.nodeProtectionManager.initialize) {
        await this.nodeProtectionManager.initialize();
      }
      
      // Load pending changes from local storage
      this.loadPendingChanges();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup periodic sync
      this.setupPeriodicSync();
      
      this.isInitialized = true;
      console.log('DataSynchronizer initialized');
    } catch (error) {
      console.error('Failed to initialize DataSynchronizer:', error);
      throw new Error('DataSynchronizer initialization failed: ' + error.message);
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    if (!this.eventBus) return;
    
    // Listen for encryption events that might affect synchronization
    this.eventBus.subscribe('node:decrypted', this.handleNodeDecrypted.bind(this));
    this.eventBus.subscribe('node:locked', this.handleNodeLocked.bind(this));
    
    // Listen for authentication events
    this.eventBus.subscribe('auth:signIn', this.handleUserSignIn.bind(this));
    this.eventBus.subscribe('auth:signOut', this.handleUserSignOut.bind(this));
  }

  /**
   * Handle node decrypted event
   * @param {Object} event - Decryption event
   * @private
   */
  handleNodeDecrypted(event) {
    if (!event || !event.nodeId) return;
    
    // Check if we have any pending changes for this node that were waiting for decryption
    const pendingForNode = Array.from(this.pendingChanges.values())
      .filter(change => change.nodeId === event.nodeId && change.status === 'waiting_for_decryption');
    
    if (pendingForNode.length > 0) {
      console.log(`Processing ${pendingForNode.length} pending changes for decrypted node ${event.nodeId}`);
      
      // Move these changes to the sync queue
      pendingForNode.forEach(change => {
        change.status = 'pending';
        this.syncQueue.push(change.id);
      });
      
      // Save changes
      this.savePendingChanges();
      
      // Try to sync now
      if (navigator.onLine) {
        this.sync();
      }
    }
  }

  /**
   * Handle node locked event
   * @param {Object} event - Lock event
   * @private
   */
  handleNodeLocked(event) {
    if (!event || !event.nodeId) return;
    
    // Mark any pending changes for this node as needing decryption
    const pendingForNode = Array.from(this.pendingChanges.values())
      .filter(change => change.nodeId === event.nodeId);
    
    if (pendingForNode.length > 0) {
      console.log(`Marking ${pendingForNode.length} pending changes for locked node ${event.nodeId} as waiting for decryption`);
      
      // Update status
      pendingForNode.forEach(change => {
        change.status = 'waiting_for_decryption';
        this.pendingChanges.set(change.id, change);
      });
      
      // Save changes
      this.savePendingChanges();
      
      // Update sync status
      this.updateSyncStatus();
    }
  }

  /**
   * Handle user sign in event
   * @param {Object} event - Sign in event
   * @private
   */
  handleUserSignIn(event) {
    // Try to sync after user signs in
    if (navigator.onLine) {
      this.sync();
    }
  }

  /**
   * Handle user sign out event
   * @param {Object} event - Sign out event
   * @private
   */
  handleUserSignOut(event) {
    // Clear sensitive information
    // We keep pending changes but mark encrypted ones as needing decryption
    const pendingEncrypted = Array.from(this.pendingChanges.values())
      .filter(change => change.isEncrypted);
    
    if (pendingEncrypted.length > 0) {
      pendingEncrypted.forEach(change => {
        change.status = 'waiting_for_decryption';
        this.pendingChanges.set(change.id, change);
      });
      
      // Save changes
      this.savePendingChanges();
      
      // Update sync status
      this.updateSyncStatus();
    }
  }

  /**
   * Set up periodic sync with the server
   * @private
   */
  setupPeriodicSync() {
    // Check for network status changes
    window.addEventListener('online', () => this.sync());
    
    // Attempt to sync every 5 minutes if online
    setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Track a change that needs to be synchronized
   * @param {string} nodeId - ID of the changed node
   * @param {string} operation - Operation type (create, update, delete)
   * @param {Object} data - Change data
   */
  trackChange(nodeId, operation, data) {
    if (!this.isInitialized) {
      this.initialize().then(() => this.trackChange(nodeId, operation, data));
      return;
    }
    
    const timestamp = Date.now();
    const changeId = `${nodeId}-${timestamp}`;
    
    // Check if the node is encrypted
    const isEncrypted = data && (data.encrypted === true || 
                              (data.content && data.content.encrypted === true));
    
    // Check if we have decryption access if the node is encrypted
    let waitForDecryption = false;
    
    if (isEncrypted && this.nodeProtectionManager) {
      // For encrypted nodes, we need to check if we have access
      const hasAccess = this.nodeProtectionManager.hasNodeAccess(nodeId, 'detail');
      
      if (!hasAccess) {
        waitForDecryption = true;
      }
    }
    
    // Store the change
    this.pendingChanges.set(changeId, {
      id: changeId,
      nodeId,
      operation,
      data,
      originalData: data ? { ...data } : null, // Store original for conflict resolution
      timestamp,
      attempts: 0,
      isEncrypted,
      status: waitForDecryption ? 'waiting_for_decryption' : 'pending'
    });
    
    // Add to sync queue if not waiting for decryption
    if (!waitForDecryption) {
      this.syncQueue.push(changeId);
    }
    
    // Update status
    this.updateSyncStatus();
    
    // Save to persistent storage
    this.savePendingChanges();
    
    // Attempt to sync if online
    if (navigator.onLine && !waitForDecryption) {
      this.sync();
    } else if (waitForDecryption) {
      // Notify that we need decryption
      this.eventBus.publish('data:change:needsDecryption', {
        nodeId,
        changeId
      });
    }
  }

  /**
   * Update sync status and notify listeners
   * @private
   */
  updateSyncStatus() {
    // Count different types of pending changes
    const pending = Array.from(this.pendingChanges.values());
    const pendingCount = pending.length;
    const waitingForDecryption = pending.filter(c => c.status === 'waiting_for_decryption').length;
    const failed = pending.filter(c => c.status === 'failed').length;
    const conflict = pending.filter(c => c.status === 'conflict').length;
    
    // Update status
    this.syncStatus = {
      ...this.syncStatus,
      pendingCount,
      waitingForDecryption,
      failed,
      conflict
    };
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Synchronize pending changes with the server
   * @param {boolean} [force=false] - Force synchronization even for failed changes
   * @returns {Promise<boolean>} Sync success
   */
  async sync(force = false) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Skip if already syncing
    if (this.syncStatus.isSyncing) {
      return false;
    }
    
    // Skip if offline
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      this.syncStatus.isSyncing = true;
      this.notifyListeners();
      
      // Get changes from the sync queue
      const changeIds = [...this.syncQueue];
      this.syncQueue = [];
      
      // Process each change in the queue
      for (const changeId of changeIds) {
        const change = this.pendingChanges.get(changeId);
        
        if (!change) continue;
        
        // Skip changes waiting for decryption
        if (change.status === 'waiting_for_decryption') {
          continue;
        }
        
        // Skip failed changes unless forced
        if (!force && change.status === 'failed' && change.attempts >= 3) {
          continue;
        }
        
        try {
          // Increment attempt count
          change.attempts++;
          
          // Process encrypted changes
          let dataToSync = change.data;
          
          if (change.isEncrypted && this.encryptionService) {
            // For encrypted content, ensure we have decryption access
            if (!this.nodeProtectionManager || 
                !this.nodeProtectionManager.hasNodeAccess(change.nodeId, 'detail')) {
              // Mark as waiting for decryption and continue with next change
              change.status = 'waiting_for_decryption';
              this.pendingChanges.set(changeId, change);
              
              // Request decryption
              this.eventBus.publish('node:decryption:requested', {
                nodeId: change.nodeId,
                keyType: 'detail',
                onSuccess: () => {
                  // Move back to pending
                  change.status = 'pending';
                  this.syncQueue.push(changeId);
                  this.savePendingChanges();
                  this.updateSyncStatus();
                }
              });
              
              continue;
            }
            
            // Process with encryption service
            try {
              // Get data ready for sync - ensure content is properly encrypted
              dataToSync = await this.prepareEncryptedDataForSync(change);
            } catch (err) {
              console.error(`Error preparing encrypted data for sync:`, err);
              change.status = 'waiting_for_decryption';
              this.pendingChanges.set(changeId, change);
              continue;
            }
          }
          
          // Perform the operation
          switch (change.operation) {
            case 'create':
              await this.nodeRepository.createNode(dataToSync);
              break;
            case 'update':
              await this.nodeRepository.updateNode(dataToSync);
              break;
            case 'delete':
              await this.nodeRepository.deleteNode(change.nodeId);
              break;
          }
          
          // Success - remove from pending changes
          this.pendingChanges.delete(changeId);
          
          // Publish success event
          this.eventBus.publish('data:change:synced', {
            nodeId: change.nodeId,
            operation: change.operation
          });
          
        } catch (error) {
          console.error(`Error syncing change ${changeId}:`, error);
          
          // Check if it's a conflict
          if (error.name === 'ConflictError') {
            const resolved = await this.handleConflict(change, error.serverData);
            if (resolved) {
              // Conflict resolved - remove from pending changes
              this.pendingChanges.delete(changeId);
            } else {
              // Mark as having a conflict
              change.status = 'conflict';
              change.error = 'Conflict with server data';
              this.pendingChanges.set(changeId, change);
            }
          } else if (error.message && error.message.includes('decryption')) {
            // Decryption error - mark as waiting for decryption
            change.status = 'waiting_for_decryption';
            change.error = error.message;
            this.pendingChanges.set(changeId, change);
            
            // Request decryption
            this.eventBus.publish('node:decryption:requested', {
              nodeId: change.nodeId,
              keyType: 'detail'
            });
          } else {
            // Other error - mark as failed
            change.status = 'failed';
            change.error = error.message;
            this.pendingChanges.set(changeId, change);
            
            // If still under max attempts, add back to queue for retry
            if (change.attempts < 3) {
              this.syncQueue.push(changeId);
            }
          }
        }
      }
      
      // Update status
      this.syncStatus.lastSync = new Date();
      this.updateSyncStatus();
      
      // Save pending changes
      this.savePendingChanges();
      
      return true;
    } catch (error) {
      console.error('Error during synchronization:', error);
      
      // Update status with error
      this.syncStatus.error = error.message;
      this.notifyListeners();
      
      return false;
    } finally {
      // Update status and notify
      this.syncStatus.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Prepare encrypted data for synchronization
   * @param {Object} change - Change object
   * @returns {Promise<Object>} Prepared data
   * @private
   */
  async prepareEncryptedDataForSync(change) {
    if (!change || !change.data) {
      throw new Error('Invalid change data');
    }
    
    if (!change.isEncrypted || !this.encryptionService) {
      return change.data;
    }
    
    // Get the node
    const node = await this.nodeRepository.getNode(change.nodeId);
    
    if (!node) {
      throw new Error(`Node ${change.nodeId} not found`);
    }
    
    const result = { ...change.data };
    
    // Handle encrypted content
    if (result.content && typeof result.content === 'object') {
      // If content is already properly encrypted, leave it
      if (result.content.encrypted && result.content.salt && result.content.iv) {
        // Already encrypted in proper format
      } else {
        // Need to encrypt or re-encrypt content
        const key = this.encryptionService.getDecryptionKey(change.nodeId, 'detail');
        
        if (!key) {
          throw new Error('Decryption key not available for re-encryption');
        }
        
        // Re-encrypt the content
        result.content = this.encryptionService.encryptContent(result.content, key);
      }
    }
    
    return result;
  }

  /**
   * Handle a synchronization conflict
   * @param {Object} change - The local change
   * @param {Object} serverData - The current server data
   * @returns {Promise<boolean>} Whether the conflict was resolved
   * @private
   */
  async handleConflict(change, serverData) {
    // Try to auto-resolve simple conflicts
    if (change.operation === 'update') {
      // Get the original data that the change was based on
      const original = change.originalData;
      
      // If we have original data, we can attempt three-way merge
      if (original) {
        let merged;
        
        if (change.isEncrypted && this.encryptionService) {
          // For encrypted content, we need to decrypt first
          try {
            // Get decryption key
            const key = this.encryptionService.getDecryptionKey(change.nodeId, 'detail');
            
            if (!key) {
              // Can't decrypt, cannot auto-resolve
              return false;
            }
            
            // Decrypt all three versions
            const decryptedOriginal = this.decryptForMerge(original, key);
            const decryptedLocal = this.decryptForMerge(change.data, key);
            const decryptedServer = this.decryptForMerge(serverData, key);
            
            // Merge decrypted data
            const mergedDecrypted = this.mergeChanges(decryptedOriginal, decryptedLocal, decryptedServer);
            
            if (mergedDecrypted) {
              // Re-encrypt merged data
              merged = this.reencryptAfterMerge(mergedDecrypted, key, serverData);
            }
          } catch (error) {
            console.error('Error merging encrypted data:', error);
            return false;
          }
        } else {
          // For non-encrypted content, merge directly
          merged = this.mergeChanges(original, change.data, serverData);
        }
        
        if (merged) {
          try {
            // Try to save the merged version
            await this.nodeRepository.updateNode(merged);
            return true;
          } catch (e) {
            console.error('Error saving merged changes:', e);
            // If saving fails, fall back to conflict handler
          }
        }
      }
    }
    
    // Use the conflict handler for manual resolution
    return this.conflictHandler(change, serverData);
  }

  /**
   * Decrypt node data for merging
   * @param {Object} data - Encrypted node data
   * @param {string} key - Decryption key
   * @returns {Object} Decrypted data
   * @private
   */
  decryptForMerge(data, key) {
    if (!data) return {};
    
    const result = { ...data };
    
    // Decrypt content if encrypted
    if (data.content && data.content.encrypted) {
      try {
        result.content = this.encryptionService.decryptContent(data.content, key);
      } catch (error) {
        console.warn('Could not decrypt content for merge:', error);
        // Keep original content
      }
    }
    
    return result;
  }

  /**
   * Re-encrypt data after merging
   * @param {Object} mergedData - Merged decrypted data
   * @param {string} key - Encryption key
   * @param {Object} templateData - Template data for encryption settings
   * @returns {Object} Re-encrypted data
   * @private
   */
  reencryptAfterMerge(mergedData, key, templateData) {
    if (!mergedData) return {};
    
    const result = { ...mergedData };
    
    // Re-encrypt content
    if (mergedData.content && templateData.content && templateData.content.encrypted) {
      try {
        result.content = this.encryptionService.encryptContent(mergedData.content, key);
      } catch (error) {
        console.error('Error re-encrypting content after merge:', error);
        // Use template's encrypted content as fallback
        result.content = templateData.content;
      }
    }
    
    return result;
  }

  /**
   * Simple three-way merge of changes
   * @param {Object} original - Original data both changes are based on
   * @param {Object} local - Local changes
   * @param {Object} server - Server changes
   * @returns {Object|null} Merged data or null if cannot merge
   * @private
   */
  mergeChanges(original, local, server) {
    // Create a new object for the merge result
    const result = { ...server };
    
    // For each property in the local changes
    for (const [key, localValue] of Object.entries(local)) {
      const originalValue = original[key];
      const serverValue = server[key];
      
      // Skip if it's the ID
      if (key === 'id') continue;
      
      // If server hasn't changed this property, use local value
      if (JSON.stringify(originalValue) === JSON.stringify(serverValue)) {
        result[key] = localValue;
        continue;
      }
      
      // If both made the same change, no conflict
      if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
        continue;
      }
      
      // For arrays, we can try to merge them
      if (Array.isArray(localValue) && Array.isArray(serverValue)) {
        // For simple arrays, merge unique values
        const merged = [...new Set([...serverValue, ...localValue])];
        result[key] = merged;
      } else if (
        typeof localValue === 'object' && 
        localValue !== null && 
        typeof serverValue === 'object' && 
        serverValue !== null &&
        typeof originalValue === 'object' &&
        originalValue !== null
      ) {
        // For nested objects, recursive merge
        result[key] = this.mergeChanges(originalValue, localValue, serverValue);
      } else {
        // For primitive values with conflicts, prefer server (safest option)
        // This could be customized based on specific field importance
      }
    }
    
    return result;
  }

  /**
   * Default conflict handler implementation
   * @param {Object} change - Local change
   * @param {Object} serverData - Current server data
   * @returns {Promise<boolean>} Whether conflict was resolved
   * @private
   */
  async defaultConflictHandler(change, serverData) {
    console.warn('Data conflict detected:', {
      localChange: change,
      serverData: serverData
    });
    
    // Publish conflict event for UI handling
    this.eventBus.publish('data:conflict', {
      nodeId: change.nodeId,
      changeId: change.id,
      local: change.data,
      server: serverData
    });
    
    // By default, unresolved
    return false;
  }

  /**
   * Set a custom conflict handler
   * @param {Function} handler - Custom conflict handler function
   */
  setConflictHandler(handler) {
    if (typeof handler === 'function') {
      this.conflictHandler = handler;
    }
  }

  /**
   * Resolve a conflict
   * @param {string} changeId - ID of the change with conflict
   * @param {string} resolution - Resolution type ('local', 'server', 'merged')
   * @param {Object} [mergedData] - Merged data if resolution is 'merged'
   * @returns {Promise<boolean>} Success indicator
   */
  async resolveConflict(changeId, resolution, mergedData = null) {
    const change = this.pendingChanges.get(changeId);
    
    if (!change || change.status !== 'conflict') {
      return false;
    }
    
    try {
      switch (resolution) {
        case 'local':
          // Apply local changes
          await this.nodeRepository.updateNode(change.data);
          break;
          
        case 'server':
          // Accept server version (do nothing, already on server)
          break;
          
        case 'merged':
          // Apply merged data
          if (!mergedData) {
            throw new Error('Merged data required for merged resolution');
          }
          await this.nodeRepository.updateNode(mergedData);
          break;
          
        default:
          throw new Error(`Unknown resolution type: ${resolution}`);
      }
      
      // Remove from pending changes
      this.pendingChanges.delete(changeId);
      
      // Save changes
      this.savePendingChanges();
      
      // Update status
      this.updateSyncStatus();
      
      return true;
    } catch (error) {
      console.error(`Error resolving conflict for change ${changeId}:`, error);
      
      // Mark as failed
      change.status = 'failed';
      change.error = `Resolution failed: ${error.message}`;
      this.pendingChanges.set(changeId, change);
      
      // Save changes
      this.savePendingChanges();
      
      // Update status
      this.updateSyncStatus();
      
      return false;
    }
  }

  /**
   * Add a listener for sync status changes
   * @param {Function} listener - Status change listener
   * @returns {Function} Unsubscribe function
   */
  addListener(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of status changes
   * @private
   */
  notifyListeners() {
    const status = { ...this.syncStatus };
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    });
  }

  /**
   * Get the current synchronization status
   * @returns {Object} Sync status
   */
  getStatus() {
    return { ...this.syncStatus };
  }

  /**
   * Save pending changes to local storage
   * @private
   */
  savePendingChanges() {
    try {
      // Convert Map to Array for serialization
      const changes = Array.from(this.pendingChanges.entries()).map(([id, change]) => {
        // For encrypted changes, don't serialize potentially sensitive data
        if (change.isEncrypted) {
          // Only keep metadata and strip out potentially sensitive content
          return {
            ...change,
            data: {
              id: change.data.id,
              type: change.data.type,
              encrypted: true,
              _serialized: true
            },
            originalData: null
          };
        }
        return change;
      });
      
      const serialized = JSON.stringify(changes);
      localStorage.setItem('pendingChanges', serialized);
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (e) {
      console.error('Failed to save pending changes:', e);
    }
  }

  /**
   * Load pending changes from local storage
   * @private
   */
  loadPendingChanges() {
    try {
      // Load changes
      const serialized = localStorage.getItem('pendingChanges');
      if (serialized) {
        const changes = JSON.parse(serialized);
        
        // Process changes and rebuild Map
        this.pendingChanges = new Map();
        
        changes.forEach(change => {
          // For serialized encrypted changes, mark as waiting for decryption
          if (change.isEncrypted && change.data && change.data._serialized) {
            change.status = 'waiting_for_decryption';
          }
          
          this.pendingChanges.set(change.id, change);
        });
      }
      
      // Load sync queue
      const queueStr = localStorage.getItem('syncQueue');
      if (queueStr) {
        this.syncQueue = JSON.parse(queueStr);
      }
      
      // Update status
      this.updateSyncStatus();
    } catch (e) {
      console.error('Failed to load pending changes:', e);
      // Reset on error
      this.pendingChanges = new Map();
      this.syncQueue = [];
      this.updateSyncStatus();
    }
  }

  /**
   * Clear all pending changes
   */
  clearPendingChanges() {
    this.pendingChanges.clear();
    this.syncQueue = [];
    this.savePendingChanges();
    this.updateSyncStatus();
  }

  /**
   * Dispose of the synchronizer
   * Cleans up resources and event listeners
   */
  dispose() {
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('node:decrypted', this.handleNodeDecrypted);
      this.eventBus.unsubscribe('node:locked', this.handleNodeLocked);
      this.eventBus.unsubscribe('auth:signIn', this.handleUserSignIn);
      this.eventBus.unsubscribe('auth:signOut', this.handleUserSignOut);
    }
    
    // Clear listeners
    this.listeners = [];
    
    // Set as not initialized
    this.isInitialized = false;
  }
}

export default registry.register(
  'data.DataSynchronizer',
  new DataSynchronizer(),
  [
    'data.NodeRepository',
    'encryption.EncryptionService',
    'encryption.NodeProtectionManager',
    'utils.EventBus'
  ],
  {
    description: 'Handles data synchronization and conflict resolution',
    usage: 'Used to synchronize data between client and server, with support for offline operation'
  }
);

