/**
 * ColorManager provides a centralized service for consistent color management
 * across the visualization. It handles color assignments for different node types,
 * states, and relationships.
 */
import * as THREE from 'three';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

class ColorManager {
  constructor() {
    // Default colors for node types
    this.nodeTypeColors = {
      component_group: 0x4A90E2,  // Blue
      component: 0x50C878,        // Green
      subcomponent: 0x9B59B6,     // Purple
      capability: 0xE67E22,       // Orange
      function: 0xE74C3C,         // Red
      specification: 0xF1C40F,    // Yellow
      integration: 0x16A085,      // Teal
      technique: 0x2ECC71,        // Emerald
      application: 0x3498DB,      // Light Blue
      input: 0x5499C7,            // Steel Blue
      output: 0xF39C12,           // Amber
      default: 0xCCCCCC           // Gray
    };
    
    // Colors for different node states
    this.stateColors = {
      selected: 0x00FF00,         // Bright Green
      hovered: 0xFFFF00,          // Yellow
      encrypted: 0xFF0000,        // Red
      decrypted: 0x00FF00,        // Green
      active: 0xFFFFFF,           // White
      inactive: 0x666666,         // Dark Gray
      connected: 0x00FFFF,        // Cyan
      highlighted: 0xFF00FF       // Magenta
    };
    
    // Colors for different relationship types
    this.relationshipColors = {
      contains: 0x999999,         // Gray
      implements: 0x27AE60,       // Green
      depends_on: 0xE74C3C,       // Red
      relates_to: 0x3498DB,       // Blue
      interaction: 0xF1C40F,      // Yellow
      input_to: 0x8E44AD,         // Purple
      output_from: 0xD35400,      // Orange
      default: 0xAAAAAA           // Light Gray
    };
    
    // Other color settings
    this.settings = {
      backgroundColor: 0x121212,  // Dark gray
      defaultIntensity: 1.0,
      highlightIntensity: 1.5,
      fadeIntensity: 0.3,
      colorBlending: true
    };
    
    // Color schemes
    this.colorSchemes = {
      default: {
        nodeTypeColors: { ...this.nodeTypeColors },
        stateColors: { ...this.stateColors },
        relationshipColors: { ...this.relationshipColors },
        settings: { ...this.settings }
      },
      dark: {
        nodeTypeColors: {
          component_group: 0x2C3E50,
          component: 0x27AE60,
          subcomponent: 0x8E44AD,
          capability: 0xD35400,
          function: 0xC0392B,
          specification: 0xF39C12,
          integration: 0x16A085,
          technique: 0x2ECC71,
          application: 0x2980B9,
          input: 0x34495E,
          output: 0xE67E22,
          default: 0x7F8C8D
        },
        settings: {
          backgroundColor: 0x1E1E1E
        }
      },
      light: {
        nodeTypeColors: {
          component_group: 0x3498DB,
          component: 0x2ECC71,
          subcomponent: 0x9B59B6,
          capability: 0xF39C12,
          function: 0xE74C3C,
          specification: 0xF1C40F,
          integration: 0x1ABC9C,
          technique: 0x27AE60,
          application: 0x2980B9,
          input: 0x5499C7,
          output: 0xE67E22,
          default: 0x95A5A6
        },
        settings: {
          backgroundColor: 0xF5F5F5
        }
      },
      contrast: {
        nodeTypeColors: {
          component_group: 0xFFFFFF,
          component: 0x00FF00,
          subcomponent: 0xFF00FF,
          capability: 0xFFAA00,
          function: 0xFF0000,
          specification: 0xFFFF00,
          integration: 0x00FFFF,
          technique: 0x00FF00,
          application: 0x0088FF,
          input: 0x00FFFF,
          output: 0xFFAA00,
          default: 0xCCCCCC
        },
        stateColors: {
          selected: 0xFFFFFF,
          hovered: 0xFFFF00,
          encrypted: 0xFF0000,
          inactive: 0x444444
        },
        settings: {
          backgroundColor: 0x000000,
          highlightIntensity: 2.0
        }
      }
    };
    
    // Current color scheme
    this.currentScheme = 'default';
    
    // Event listeners
    this.listeners = {};
  }
  
  /**
   * Get color for a node type
   * @param {string} nodeType - Type of node
   * @returns {number} Hex color code
   */
  getNodeTypeColor(nodeType) {
    return this.nodeTypeColors[nodeType] || this.nodeTypeColors.default;
  }
  
  /**
   * Get color as THREE.js Color object
   * @param {string} nodeType - Type of node
   * @returns {THREE.Color} THREE.js color object
   */
  getNodeTypeColorAsThree(nodeType) {
    return new THREE.Color(this.getNodeTypeColor(nodeType));
  }
  
  /**
   * Get color for a node state
   * @param {string} state - Node state
   * @returns {number} Hex color code
   */
  getStateColor(state) {
    return this.stateColors[state] || this.stateColors.default;
  }
  
  /**
   * Get color for a relationship type
   * @param {string} relationType - Type of relationship
   * @returns {number} Hex color code
   */
  getRelationshipColor(relationType) {
    return this.relationshipColors[relationType] || this.relationshipColors.default;
  }
  
  /**
   * Get background color
   * @returns {number} Hex color code
   */
  getBackgroundColor() {
    return this.settings.backgroundColor;
  }
  
  /**
   * Get a blended color based on node state
   * @param {string} nodeType - Base node type
   * @param {Object} states - State object with boolean flags
   * @param {boolean} [states.selected] - Whether node is selected
   * @param {boolean} [states.hovered] - Whether node is hovered
   * @param {boolean} [states.encrypted] - Whether node is encrypted
   * @param {boolean} [states.highlighted] - Whether node is highlighted
   * @returns {THREE.Color} Blended color
   */
  getBlendedNodeColor(nodeType, states = {}) {
    const baseColor = this.getNodeTypeColorAsThree(nodeType);
    
    // If color blending is disabled, just return state colors directly
    if (!this.settings.colorBlending) {
      if (states.selected) return new THREE.Color(this.stateColors.selected);
      if (states.hovered) return new THREE.Color(this.stateColors.hovered);
      if (states.encrypted) return new THREE.Color(this.stateColors.encrypted);
      if (states.highlighted) return new THREE.Color(this.stateColors.highlighted);
      return baseColor;
    }
    
    // Start with base color
    const resultColor = baseColor.clone();
    
    // Apply state modifications
    if (states.selected) {
      const selectedColor = new THREE.Color(this.stateColors.selected);
      resultColor.lerp(selectedColor, 0.5);
    }
    
    if (states.hovered) {
      const hoveredColor = new THREE.Color(this.stateColors.hovered);
      resultColor.lerp(hoveredColor, 0.3);
    }
    
    if (states.encrypted) {
      const encryptedColor = new THREE.Color(this.stateColors.encrypted);
      resultColor.lerp(encryptedColor, 0.4);
    }
    
    if (states.highlighted) {
      const highlightedColor = new THREE.Color(this.stateColors.highlighted);
      resultColor.lerp(highlightedColor, 0.4);
    }
    
    // Apply intensity based on state
    if (states.inactive) {
      // Fade color for inactive nodes
      resultColor.multiplyScalar(this.settings.fadeIntensity);
    } else if (states.selected || states.hovered || states.highlighted) {
      // Brighten for important states
      resultColor.multiplyScalar(this.settings.highlightIntensity);
    }
    
    return resultColor;
  }
  
  /**
   * Get color for a link based on its relationship type and state
   * @param {string} relationType - Type of relationship
   * @param {Object} states - State object with boolean flags
   * @param {boolean} [states.selected] - Whether link is selected
   * @param {boolean} [states.hovered] - Whether link is hovered
   * @param {boolean} [states.active] - Whether link is active
   * @param {boolean} [states.highlighted] - Whether link is highlighted
   * @returns {THREE.Color} Link color
   */
  getLinkColor(relationType, states = {}) {
    const baseColor = new THREE.Color(this.getRelationshipColor(relationType));
    
    // If color blending is disabled, just return state colors directly
    if (!this.settings.colorBlending) {
      if (states.selected) return new THREE.Color(this.stateColors.selected);
      if (states.hovered) return new THREE.Color(this.stateColors.hovered);
      if (states.highlighted) return new THREE.Color(this.stateColors.highlighted);
      return baseColor;
    }
    
    // Start with base color
    const resultColor = baseColor.clone();
    
    // Apply state modifications
    if (states.selected) {
      const selectedColor = new THREE.Color(this.stateColors.selected);
      resultColor.lerp(selectedColor, 0.6);
    }
    
    if (states.hovered) {
      const hoveredColor = new THREE.Color(this.stateColors.hovered);
      resultColor.lerp(hoveredColor, 0.4);
    }
    
    if (states.highlighted) {
      const highlightedColor = new THREE.Color(this.stateColors.highlighted);
      resultColor.lerp(highlightedColor, 0.5);
    }
    
    // Apply intensity based on state
    if (states.inactive) {
      // Fade color for inactive links
      resultColor.multiplyScalar(this.settings.fadeIntensity);
    } else if (states.active || states.selected || states.hovered) {
      // Brighten for important states
      resultColor.multiplyScalar(this.settings.highlightIntensity);
    }
    
    return resultColor;
  }
  
  /**
   * Generate color map for all node types
   * @returns {Object} Map of node types to colors
   */
  getNodeTypeColorMap() {
    return { ...this.nodeTypeColors };
  }
  
  /**
   * Generate CSS color string
   * @param {number} hexColor - Hex color code
   * @returns {string} CSS color string
   */
  toCssColor(hexColor) {
    return `#${hexColor.toString(16).padStart(6, '0')}`;
  }
  
  /**
   * Get color as CSS color string
   * @param {string} nodeType - Type of node
   * @returns {string} CSS color string
   */
  getNodeTypeColorAsCss(nodeType) {
    return this.toCssColor(this.getNodeTypeColor(nodeType));
  }
  
  /**
   * Switch to a different color scheme
   * @param {string} schemeName - Name of the scheme to use
   * @returns {boolean} Whether the switch was successful
   */
  setColorScheme(schemeName) {
    if (!this.colorSchemes[schemeName]) {
      return false;
    }
    
    const scheme = this.colorSchemes[schemeName];
    
    // Apply scheme settings
    if (scheme.nodeTypeColors) {
      this.nodeTypeColors = {
        ...this.nodeTypeColors,
        ...scheme.nodeTypeColors
      };
    }
    
    if (scheme.stateColors) {
      this.stateColors = {
        ...this.stateColors,
        ...scheme.stateColors
      };
    }
    
    if (scheme.relationshipColors) {
      this.relationshipColors = {
        ...this.relationshipColors,
        ...scheme.relationshipColors
      };
    }
    
    if (scheme.settings) {
      this.settings = {
        ...this.settings,
        ...scheme.settings
      };
    }
    
    this.currentScheme = schemeName;
    
    // Trigger color scheme changed event
    this.triggerEvent('colorSchemeChanged', {
      schemeName,
      scheme: this.colorSchemes[schemeName]
    });
    
    // Notify through event bus
    const eventBus = registry.getModule('utils.EventBus');
    if (eventBus) {
      eventBus.publish('visualization:colorSchemeChanged', {
        schemeName,
        backgroundColor: this.settings.backgroundColor
      });
    }
    
    return true;
  }
  
  /**
   * Add a custom color scheme
   * @param {string} schemeName - Name for the new scheme
   * @param {Object} schemeData - Color scheme data
   * @returns {boolean} Whether the scheme was added successfully
   */
  addColorScheme(schemeName, schemeData) {
    if (this.colorSchemes[schemeName] || !schemeData) {
      return false;
    }
    
    this.colorSchemes[schemeName] = {
      nodeTypeColors: { ...(schemeData.nodeTypeColors || {}) },
      stateColors: { ...(schemeData.stateColors || {}) },
      relationshipColors: { ...(schemeData.relationshipColors || {}) },
      settings: { ...(schemeData.settings || {}) }
    };
    
    // Trigger scheme added event
    this.triggerEvent('colorSchemeAdded', {
      schemeName,
      scheme: this.colorSchemes[schemeName]
    });
    
    return true;
  }
  
  /**
   * Update color settings
   * @param {Object} newSettings - New settings to apply
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    // Trigger settings updated event
    this.triggerEvent('settingsUpdated', this.settings);
  }
  
  /**
   * Update specific node type color
   * @param {string} nodeType - Type of node
   * @param {number} color - Hex color code
   */
  setNodeTypeColor(nodeType, color) {
    this.nodeTypeColors[nodeType] = color;
    
    // Trigger node type color updated event
    this.triggerEvent('nodeTypeColorUpdated', {
      nodeType,
      color
    });
  }
  
  /**
   * Update specific state color
   * @param {string} state - State name
   * @param {number} color - Hex color code
   */
  setStateColor(state, color) {
    this.stateColors[state] = color;
    
    // Trigger state color updated event
    this.triggerEvent('stateColorUpdated', {
      state,
      color
    });
  }
  
  /**
   * Update specific relationship color
   * @param {string} relationType - Relationship type
   * @param {number} color - Hex color code
   */
  setRelationshipColor(relationType, color) {
    this.relationshipColors[relationType] = color;
    
    // Trigger relationship color updated event
    this.triggerEvent('relationshipColorUpdated', {
      relationType,
      color
    });
  }
  
  /**
   * Get the current color scheme name
   * @returns {string} Scheme name
   */
  getCurrentSchemeName() {
    return this.currentScheme;
  }
  
  /**
   * Get the current color scheme
   * @returns {Object} Color scheme
   */
  getCurrentScheme() {
    return {
      nodeTypeColors: { ...this.nodeTypeColors },
      stateColors: { ...this.stateColors },
      relationshipColors: { ...this.relationshipColors },
      settings: { ...this.settings }
    };
  }
  
  /**
   * Get list of available color schemes
   * @returns {Array<string>} Scheme names
   */
  getAvailableSchemes() {
    return Object.keys(this.colorSchemes);
  }
  
  /**
   * Generate a color scale for data visualization
   * @param {number} steps - Number of color steps
   * @param {string} startColor - Start color (hex or CSS color string)
   * @param {string} endColor - End color (hex or CSS color string)
   * @returns {Array<string>} Array of color strings
   */
  generateColorScale(steps, startColor = '#0000FF', endColor = '#FF0000') {
    const scale = [];
    const start = new THREE.Color(startColor);
    const end = new THREE.Color(endColor);
    
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color = new THREE.Color().copy(start).lerp(end, t);
      scale.push(`#${color.getHexString()}`);
    }
    
    return scale;
  }
  
  /**
   * Generate a color from a numeric value using a gradient
   * @param {number} value - Value between 0 and 1
   * @param {string} lowColor - Color for low values
   * @param {string} midColor - Color for medium values
   * @param {string} highColor - Color for high values
   * @returns {string} CSS color string
   */
  getColorFromValue(value, lowColor = '#0000FF', midColor = '#00FF00', highColor = '#FF0000') {
    const clampedValue = Math.max(0, Math.min(1, value));
    let resultColor;
    
    if (clampedValue < 0.5) {
      // Blend between low and mid color
      const t = clampedValue * 2; // Scale 0-0.5 to 0-1
      const low = new THREE.Color(lowColor);
      const mid = new THREE.Color(midColor);
      resultColor = new THREE.Color().copy(low).lerp(mid, t);
    } else {
      // Blend between mid and high color
      const t = (clampedValue - 0.5) * 2; // Scale 0.5-1 to 0-1
      const mid = new THREE.Color(midColor);
      const high = new THREE.Color(highColor);
      resultColor = new THREE.Color().copy(mid).lerp(high, t);
    }
    
    return `#${resultColor.getHexString()}`;
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler function
   */
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
  }
  
  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler function to remove
   */
  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  /**
   * Trigger an event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  triggerEvent(event, data) {
    if (!this.listeners[event]) return;
    
    for (const callback of this.listeners[event]) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ColorManager ${event} event handler:`, error);
      }
    }
  }
}

// Create singleton instance
const colorManager = new ColorManager();

// Register with ModuleRegistry
export default registry.register(
  'visualization.ColorManager',
  colorManager,
  ['utils.EventBus'],
  {
    description: 'Manages color assignments for visualization components',
    singleton: true
  }
); 