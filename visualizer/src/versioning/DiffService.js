/**
 * DiffService
 * 
 * Service for calculating and displaying differences between content versions.
 * Supports different comparison modes and visualization styles.
 */

import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

class DiffService {
  constructor() {
    this.versionManager = null;
    this.diffCache = new Map();
    this.isInitialized = false;
    
    // Supported diff formats
    this.diffFormats = {
      JSON: 'json',
      TEXT: 'text',
      HTML: 'html'
    };
    
    // Default options for diff calculation
    this.defaultOptions = {
      format: this.diffFormats.JSON,
      ignoreCase: false,
      ignoreWhitespace: true,
      contextLines: 3,
      maxChanges: 1000,
      timeout: 5000, // ms
    };
  }
  
  /**
   * Initialize the diff service
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Get required dependencies
      this.versionManager = registry.getModule('versioning.VersionManager');
      
      if (!this.versionManager) {
        console.error('Failed to initialize DiffService: VersionManager not found');
        return false;
      }
      
      // Subscribe to events
      EventBus.subscribe('version:created', this.clearCacheForContent.bind(this));
      EventBus.subscribe('version:reverted', this.clearCacheForContent.bind(this));
      
      this.isInitialized = true;
      
      EventBus.publish('diff:service:initialized', {
        success: true
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize DiffService:', error);
      
      EventBus.publish('diff:service:initialized', {
        success: false,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Calculate differences between two version contents
   * @param {Object|string} contentA - First content version
   * @param {Object|string} contentB - Second content version
   * @param {Object} [options={}] - Comparison options
   * @returns {Object} Diff result object
   */
  calculateDiff(contentA, contentB, options = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const format = mergedOptions.format || this.diffFormats.JSON;
    
    // Handle different content types
    if (format === this.diffFormats.JSON) {
      return this.calculateJsonDiff(contentA, contentB, mergedOptions);
    } else if (format === this.diffFormats.TEXT) {
      return this.calculateTextDiff(contentA, contentB, mergedOptions);
    } else if (format === this.diffFormats.HTML) {
      return this.calculateHtmlDiff(contentA, contentB, mergedOptions);
    } else {
      throw new Error(`Unsupported diff format: ${format}`);
    }
  }
  
  /**
   * Compare two versions by their IDs
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @param {Object} [options={}] - Comparison options
   * @returns {Promise<Object>} Comparison result
   */
  async compareVersions(versionId1, versionId2, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Sort IDs for consistent caching
    const [firstId, secondId] = [versionId1, versionId2].sort();
    const optionsHash = this.hashOptions(options);
    const cacheKey = `${firstId}:${secondId}:${optionsHash}`;
    
    if (!options.forceRefresh && this.diffCache.has(cacheKey)) {
      return this.diffCache.get(cacheKey);
    }
    
    try {
      // Get versions from version manager
      const version1 = await this.versionManager.getVersion(versionId1);
      const version2 = await this.versionManager.getVersion(versionId2);
      
      if (!version1 || !version2) {
        throw new Error(`One or both versions not found: ${versionId1}, ${versionId2}`);
      }
      
      // Calculate diff
      const diff = this.calculateDiff(version1.content, version2.content, options);
      
      // Create comparison result
      const comparison = {
        versionA: {
          id: version1.id,
          createdAt: version1.createdAt,
          createdBy: version1.createdBy,
          commitMessage: version1.commitMessage,
        },
        versionB: {
          id: version2.id,
          createdAt: version2.createdAt,
          createdBy: version2.createdBy,
          commitMessage: version2.commitMessage,
        },
        contentType: version1.contentType,
        contentId: version1.contentId,
        diff,
        summary: this.generateDiffSummary(diff),
        timestamp: Date.now()
      };
      
      // Cache result
      this.diffCache.set(cacheKey, comparison);
      
      return comparison;
    } catch (error) {
      console.error(`Failed to compare versions ${versionId1} and ${versionId2}:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate diff between JSON objects
   * @param {Object} objA - First object
   * @param {Object} objB - Second object
   * @param {Object} options - Comparison options
   * @returns {Object} Diff result
   * @private
   */
  calculateJsonDiff(objA, objB, options) {
    // Ensure objects are in JSON format
    const jsonA = typeof objA === 'string' ? JSON.parse(objA) : objA;
    const jsonB = typeof objB === 'string' ? JSON.parse(objB) : objB;
    
    // Initialize diff result
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
      type: 'json'
    };
    
    // Process the objects recursively
    this.jsonDiffProcessor('', jsonA, jsonB, diff, options);
    
    // Count total changes
    diff.changeCount = diff.added.length + diff.removed.length + diff.modified.length;
    
    // Apply max changes limit
    if (diff.changeCount > options.maxChanges) {
      diff.truncated = true;
      diff.totalChanges = diff.changeCount;
      
      // Truncate change arrays
      const limit = Math.floor(options.maxChanges / 3);
      diff.added = diff.added.slice(0, limit);
      diff.removed = diff.removed.slice(0, limit);
      diff.modified = diff.modified.slice(0, limit);
    }
    
    return diff;
  }
  
  /**
   * Recursive JSON diff processor
   * @param {string} path - Current object path
   * @param {*} valueA - Value from first object
   * @param {*} valueB - Value from second object
   * @param {Object} diff - Diff result to update
   * @param {Object} options - Comparison options
   * @private
   */
  jsonDiffProcessor(path, valueA, valueB, diff, options) {
    // If both values are undefined or null, they're equal
    if (valueA === undefined && valueB === undefined) return;
    if (valueA === null && valueB === null) {
      diff.unchanged.push({ path, value: null });
      return;
    }
    
    // Handle one side being undefined or null
    if (valueA === undefined || valueA === null) {
      diff.added.push({ path, value: valueB });
      return;
    }
    
    if (valueB === undefined || valueB === null) {
      diff.removed.push({ path, value: valueA });
      return;
    }
    
    // If types are different, it's a modification
    const typeA = typeof valueA;
    const typeB = typeof valueB;
    
    if (typeA !== typeB) {
      diff.modified.push({
        path,
        oldValue: valueA,
        newValue: valueB
      });
      return;
    }
    
    // Handle arrays
    if (Array.isArray(valueA) && Array.isArray(valueB)) {
      this.processArrayDiff(path, valueA, valueB, diff, options);
      return;
    }
    
    // Handle objects
    if (typeA === 'object') {
      this.processObjectDiff(path, valueA, valueB, diff, options);
      return;
    }
    
    // Handle primitives
    if (this.compareValues(valueA, valueB, options)) {
      diff.unchanged.push({ path, value: valueA });
    } else {
      diff.modified.push({
        path,
        oldValue: valueA,
        newValue: valueB
      });
    }
  }
  
  /**
   * Process diff between objects
   * @param {string} path - Current object path
   * @param {Object} objA - First object
   * @param {Object} objB - Second object
   * @param {Object} diff - Diff result to update
   * @param {Object} options - Comparison options
   * @private
   */
  processObjectDiff(path, objA, objB, diff, options) {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    
    // Find keys in A but not in B (removed)
    keysA.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) {
        const keyPath = path ? `${path}.${key}` : key;
        diff.removed.push({ path: keyPath, value: objA[key] });
      }
    });
    
    // Find keys in B but not in A (added)
    keysB.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(objA, key)) {
        const keyPath = path ? `${path}.${key}` : key;
        diff.added.push({ path: keyPath, value: objB[key] });
      }
    });
    
    // Check keys in both objects (possibly modified)
    keysA.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(objB, key)) {
        const keyPath = path ? `${path}.${key}` : key;
        this.jsonDiffProcessor(keyPath, objA[key], objB[key], diff, options);
      }
    });
  }
  
  /**
   * Process diff between arrays
   * @param {string} path - Current object path
   * @param {Array} arrA - First array
   * @param {Array} arrB - Second array
   * @param {Object} diff - Diff result to update
   * @param {Object} options - Comparison options
   * @private
   */
  processArrayDiff(path, arrA, arrB, diff, options) {
    // Simple array comparison
    if (arrA.length !== arrB.length) {
      diff.modified.push({
        path,
        oldValue: arrA,
        newValue: arrB
      });
      return;
    }
    
    // Check each element
    let modified = false;
    for (let i = 0; i < arrA.length; i++) {
      const itemPath = `${path}[${i}]`;
      this.jsonDiffProcessor(itemPath, arrA[i], arrB[i], diff, options);
      
      // Check if this element was modified
      const modifiedItem = diff.modified.find(item => item.path === itemPath);
      if (modifiedItem) {
        modified = true;
      }
    }
    
    // If not modified at element level, mark whole array as unchanged
    if (!modified && arrA.length > 0) {
      diff.unchanged.push({ path, value: arrA });
    }
  }
  
  /**
   * Calculate diff between text strings
   * @param {string} textA - First text
   * @param {string} textB - Second text
   * @param {Object} options - Comparison options
   * @returns {Object} Diff result
   * @private
   */
  calculateTextDiff(textA, textB, options) {
    // Convert to strings if necessary
    const stringA = typeof textA === 'string' ? textA : JSON.stringify(textA, null, 2);
    const stringB = typeof textB === 'string' ? textB : JSON.stringify(textB, null, 2);
    
    // Split into lines
    const linesA = stringA.split('\n');
    const linesB = stringB.split('\n');
    
    // Initialize diff result
    const diff = {
      hunks: [],
      type: 'text',
      lineCount: Math.max(linesA.length, linesB.length),
      changeCount: 0
    };
    
    // Simple line-by-line comparison
    let currentHunk = null;
    let lineNumberA = 0;
    let lineNumberB = 0;
    let changeCount = 0;
    
    // Compare line by line
    while (lineNumberA < linesA.length || lineNumberB < linesB.length) {
      const lineA = lineNumberA < linesA.length ? linesA[lineNumberA] : null;
      const lineB = lineNumberB < linesB.length ? linesB[lineNumberB] : null;
      
      // Compare lines
      if (lineA === null) {
        // Line added in B
        this.addToHunk(diff, currentHunk, lineNumberA, lineNumberB, null, lineB, 'added');
        currentHunk = diff.hunks[diff.hunks.length - 1];
        lineNumberB++;
        changeCount++;
      } else if (lineB === null) {
        // Line removed from A
        this.addToHunk(diff, currentHunk, lineNumberA, lineNumberB, lineA, null, 'removed');
        currentHunk = diff.hunks[diff.hunks.length - 1];
        lineNumberA++;
        changeCount++;
      } else if (this.compareValues(lineA, lineB, options)) {
        // Lines are the same
        if (currentHunk && currentHunk.changes.length < options.contextLines * 2) {
          // Add to current hunk as context
          currentHunk.changes.push({
            type: 'context',
            lineA: lineNumberA,
            lineB: lineNumberB,
            content: lineA
          });
          currentHunk.endLineA = lineNumberA;
          currentHunk.endLineB = lineNumberB;
        } else if (currentHunk) {
          // Close current hunk
          currentHunk = null;
        }
        
        lineNumberA++;
        lineNumberB++;
      } else {
        // Lines are different
        this.addToHunk(diff, currentHunk, lineNumberA, lineNumberB, lineA, lineB, 'modified');
        currentHunk = diff.hunks[diff.hunks.length - 1];
        lineNumberA++;
        lineNumberB++;
        changeCount++;
      }
      
      // Check if we've hit the max changes limit
      if (changeCount > options.maxChanges) {
        diff.truncated = true;
        diff.totalChanges = Math.max(linesA.length, linesB.length);
        break;
      }
    }
    
    // Update change count
    diff.changeCount = changeCount;
    
    return diff;
  }
  
  /**
   * Add a change to a diff hunk
   * @param {Object} diff - Diff result
   * @param {Object|null} currentHunk - Current hunk or null
   * @param {number} lineA - Line number in first file
   * @param {number} lineB - Line number in second file
   * @param {string|null} contentA - Content from first file
   * @param {string|null} contentB - Content from second file
   * @param {string} type - Change type ('added', 'removed', 'modified')
   * @private
   */
  addToHunk(diff, currentHunk, lineA, lineB, contentA, contentB, type) {
    if (!currentHunk) {
      // Start a new hunk
      currentHunk = {
        startLineA: Math.max(0, lineA - 3),
        startLineB: Math.max(0, lineB - 3),
        endLineA: lineA,
        endLineB: lineB,
        changes: []
      };
      
      diff.hunks.push(currentHunk);
    }
    
    // Add the change
    currentHunk.changes.push({
      type,
      lineA,
      lineB,
      contentA,
      contentB
    });
    
    // Update hunk bounds
    currentHunk.endLineA = lineA;
    currentHunk.endLineB = lineB;
  }
  
  /**
   * Calculate HTML diff (rich text)
   * @param {string} htmlA - First HTML content
   * @param {string} htmlB - Second HTML content
   * @param {Object} options - Comparison options
   * @returns {Object} Diff result with HTML markers
   * @private
   */
  calculateHtmlDiff(htmlA, htmlB, options) {
    // First calculate text diff
    const textDiff = this.calculateTextDiff(htmlA, htmlB, options);
    
    // Convert to HTML format
    const htmlDiff = {
      ...textDiff,
      type: 'html',
      markedHtml: this.generateMarkedHtml(textDiff)
    };
    
    return htmlDiff;
  }
  
  /**
   * Generate HTML with diff markers
   * @param {Object} textDiff - Text diff result
   * @returns {string} HTML with diff markers
   * @private
   */
  generateMarkedHtml(textDiff) {
    let result = '';
    
    textDiff.hunks.forEach(hunk => {
      // Add hunk header
      result += `<div class="diff-hunk">`;
      result += `<div class="diff-hunk-header">@@ -${hunk.startLineA},${hunk.endLineA - hunk.startLineA + 1} +${hunk.startLineB},${hunk.endLineB - hunk.startLineB + 1} @@</div>`;
      
      // Add changes
      hunk.changes.forEach(change => {
        if (change.type === 'context') {
          result += `<div class="diff-line diff-context"><span class="diff-line-num">${change.lineA}</span><span class="diff-line-num">${change.lineB}</span><span class="diff-line-content">${this.escapeHtml(change.content)}</span></div>`;
        } else if (change.type === 'added') {
          result += `<div class="diff-line diff-added"><span class="diff-line-num"></span><span class="diff-line-num">${change.lineB}</span><span class="diff-line-content">+ ${this.escapeHtml(change.contentB)}</span></div>`;
        } else if (change.type === 'removed') {
          result += `<div class="diff-line diff-removed"><span class="diff-line-num">${change.lineA}</span><span class="diff-line-num"></span><span class="diff-line-content">- ${this.escapeHtml(change.contentA)}</span></div>`;
        } else if (change.type === 'modified') {
          result += `<div class="diff-line diff-removed"><span class="diff-line-num">${change.lineA}</span><span class="diff-line-num"></span><span class="diff-line-content">- ${this.escapeHtml(change.contentA)}</span></div>`;
          result += `<div class="diff-line diff-added"><span class="diff-line-num"></span><span class="diff-line-num">${change.lineB}</span><span class="diff-line-content">+ ${this.escapeHtml(change.contentB)}</span></div>`;
        }
      });
      
      result += `</div>`;
    });
    
    return result;
  }
  
  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Compare values with options
   * @param {*} valueA - First value
   * @param {*} valueB - Second value
   * @param {Object} options - Comparison options
   * @returns {boolean} True if values are equal
   * @private
   */
  compareValues(valueA, valueB, options) {
    if (valueA === valueB) return true;
    
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      let a = valueA;
      let b = valueB;
      
      // Apply comparison options
      if (options.ignoreCase) {
        a = a.toLowerCase();
        b = b.toLowerCase();
      }
      
      if (options.ignoreWhitespace) {
        a = a.trim().replace(/\s+/g, ' ');
        b = b.trim().replace(/\s+/g, ' ');
      }
      
      return a === b;
    }
    
    return false;
  }
  
  /**
   * Generate a summary of diff changes
   * @param {Object} diff - Diff result
   * @returns {Object} Summary object
   * @private
   */
  generateDiffSummary(diff) {
    const summary = {
      addedCount: 0,
      removedCount: 0,
      modifiedCount: 0
    };
    
    if (diff.type === 'json') {
      summary.addedCount = diff.added.length;
      summary.removedCount = diff.removed.length;
      summary.modifiedCount = diff.modified.length;
    } else if (diff.type === 'text' || diff.type === 'html') {
      diff.hunks.forEach(hunk => {
        hunk.changes.forEach(change => {
          if (change.type === 'added') summary.addedCount++;
          else if (change.type === 'removed') summary.removedCount++;
          else if (change.type === 'modified') summary.modifiedCount++;
        });
      });
    }
    
    summary.totalChanges = summary.addedCount + summary.removedCount + summary.modifiedCount;
    summary.hasChanges = summary.totalChanges > 0;
    
    return summary;
  }
  
  /**
   * Clear cache for a specific content when versions change
   * @param {Object} data - Event data
   * @private
   */
  clearCacheForContent(data) {
    if (!data || !data.contentType || !data.contentId) {
      return;
    }
    
    // Clear all cache entries related to this content
    const contentKey = `${data.contentType}:${data.contentId}`;
    
    for (const key of this.diffCache.keys()) {
      if (key.includes(contentKey)) {
        this.diffCache.delete(key);
      }
    }
  }
  
  /**
   * Generate a simple hash of options object for cache keys
   * @param {Object} options - Options object
   * @returns {string} Hash string
   * @private
   */
  hashOptions(options) {
    // Create a simple string representation
    const stringified = JSON.stringify(options);
    let hash = 0;
    
    for (let i = 0; i < stringified.length; i++) {
      const char = stringified.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16);
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    if (!this.isInitialized) return;
    
    // Unsubscribe from events
    EventBus.unsubscribe('version:created', this.clearCacheForContent.bind(this));
    EventBus.unsubscribe('version:reverted', this.clearCacheForContent.bind(this));
    
    // Clear cache
    this.diffCache.clear();
    
    this.isInitialized = false;
  }
}

const diffService = new DiffService();

// Export and register the module
export default registry.register(
  'versioning.DiffService',
  diffService,
  ['versioning.VersionManager', 'utils.EventBus'],
  {
    description: 'Service for calculating and displaying differences between content versions',
    usage: `
      // Initialize diff service
      await DiffService.initialize();
      
      // Compare two versions
      const comparison = await DiffService.compareVersions('version-123', 'version-456');
      
      // Calculate direct diff between contents
      const diff = DiffService.calculateDiff(contentA, contentB, { format: 'json' });
      
      // Calculate text diff with specific options
      const textDiff = DiffService.calculateDiff(textA, textB, { 
        format: 'text',
        ignoreWhitespace: true,
        contextLines: 5
      });
      
      // Generate HTML diff for display
      const htmlDiff = DiffService.calculateDiff(contentA, contentB, { format: 'html' });
    `
  }
);

