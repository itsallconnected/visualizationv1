/**
 * LinkRenderer handles the creation, rendering, and management of 
 * visual connections (links) between nodes in the 3D visualization.
 */
import * as THREE from 'three';
import registry from '../ModuleRegistry';

class LinkRenderer {
  constructor() {
    this.scene = null;
    this.colorManager = null;
    this.linkObjects = new Map();
    this.links = [];
    
    this.selectedLink = null;
    this.hoveredLink = null;
    
    this.isInitialized = false;
    
    // Link appearance settings
    this.settings = {
      defaultWidth: 1.0,
      highlightedWidth: 2.0,
      selectedColor: 0x00FF00,     // Green
      hoveredColor: 0xFFFF00,      // Yellow
      defaultOpacity: 0.6,
      fadeOpacity: 0.2,
      curveAmount: 0.1,            // Amount of curvature for curved links
      useCurvedLinks: false,
      useArrows: true,
      arrowSize: 3.0,
      arrowPosition: 0.9,          // Position along link (0-1)
      animationSpeed: 0.0,         // 0 = no animation
      animatedLinks: false,
      linkWidthByType: {
        contains: 1.0,
        implements: 1.5,
        depends_on: 1.5,
        relates_to: 1.0,
        integration: 1.2,
        default: 1.0
      },
      linkLineStyles: {
        contains: false,           // Solid
        implements: true,          // Dashed
        depends_on: true,          // Dashed
        relates_to: true,          // Dashed
        default: false             // Solid
      },
      linkDashSize: 2.0,
      linkDashGapSize: 1.0
    };
    
    // Reusable geometries
    this.geometries = {
      line: null,
      arrow: null
    };
  }
  
  /**
   * Initialize the link renderer
   * @param {THREE.Scene} scene - THREE.js scene
   * @param {Object} colorManager - Color manager service
   * @param {Object} visualizationManager - Visualization manager
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(scene, colorManager, visualizationManager) {
    if (this.isInitialized) return true;
    
    try {
      this.scene = scene;
      
      // Use provided color manager or get from registry
      this.colorManager = colorManager || 
        registry.getModule('visualization.ColorManager');
      
      // Store reference to visualization manager
      this.visualizationManager = visualizationManager || 
        registry.getModule('visualization.VisualizationManager');
      
      if (!this.colorManager) {
        console.warn('ColorManager not found, using default colors');
      }
      
      if (!this.visualizationManager) {
        console.warn('VisualizationManager not found, using default styling');
      }
      
      // Create reusable geometries
      this.createReusableGeometries();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize LinkRenderer:', error);
      return false;
    }
  }
  
  /**
   * Create reusable geometries
   * @private
   */
  createReusableGeometries() {
    // Arrow geometry
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0);
    arrowShape.lineTo(-1, -2);
    arrowShape.lineTo(1, -2);
    arrowShape.lineTo(0, 0);
    
    const extrudeSettings = {
      steps: 1,
      depth: 0.5,
      bevelEnabled: false
    };
    
    this.geometries.arrow = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    this.geometries.arrow.scale(this.settings.arrowSize, this.settings.arrowSize, this.settings.arrowSize);
  }
  
  /**
   * Set links to render
   * @param {Array} links - Array of link objects
   * @returns {Promise<boolean>} Success status
   */
  async setLinks(links) {
    if (!this.isInitialized) {
      console.error('LinkRenderer not initialized');
      return false;
    }
    
    try {
      // Store links
      this.links = [...links];
      
      // Clear existing link objects
      this.clearLinkObjects();
      
      // Create new link objects
      links.forEach(link => {
        this.createLinkObject(link);
      });
      
      return true;
    } catch (error) {
      console.error('Error setting links:', error);
      return false;
    }
  }
  
  /**
   * Update existing links
   * @param {Array} links - Updated link objects
   * @returns {Promise<boolean>} Success status
   */
  async updateLinks(links) {
    if (!this.isInitialized) {
      console.error('LinkRenderer not initialized');
      return false;
    }
    
    try {
      // Update link reference
      this.links = [...links];
      
      // Update each link
      links.forEach(link => {
        const linkObject = this.linkObjects.get(link.id);
        
        if (linkObject) {
          // Update existing link
          this.updateLinkObject(link, linkObject);
        } else {
          // Create new link if it doesn't exist
          this.createLinkObject(link);
        }
      });
      
      // Remove links that no longer exist
      const currentIds = new Set(links.map(link => link.id));
      const objectIds = Array.from(this.linkObjects.keys());
      
      objectIds.forEach(id => {
        if (!currentIds.has(id)) {
          this.removeLinkObject(id);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error updating links:', error);
      return false;
    }
  }
  
  /**
   * Create a visual object for a link
   * @param {Object} link - Link data
   * @private
   */
  createLinkObject(link) {
    if (!link || !link.id || !link.source || !link.target) return null;
    
    const linkType = link.type || 'default';
    const isVisible = link.visible !== false;
    
    // Get color for link
    const color = this.getLinkColor(linkType);
    
    // Get line width based on link type
    const width = this.settings.linkWidthByType[linkType] || this.settings.linkWidthByType.default;
    
    // Determine if link should be dashed
    const isDashed = this.settings.linkLineStyles[linkType] || this.settings.linkLineStyles.default;
    
    // Create material
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: isVisible ? this.settings.defaultOpacity : this.settings.fadeOpacity,
      linewidth: width // Note: linewidth > 1 only works in WebGL2
    });
    
    let line;
    
    if (isDashed) {
      // Use LineSegments for dashed lines
      const dashMaterial = new THREE.LineDashedMaterial({
        color: color,
        transparent: true,
        opacity: isVisible ? this.settings.defaultOpacity : this.settings.fadeOpacity,
        dashSize: this.settings.linkDashSize,
        gapSize: this.settings.linkDashGapSize,
        linewidth: width // Note: linewidth > 1 only works in WebGL2
      });
      
      // For dashed lines, we'll create the geometry in updateLinkPosition
      const dashGeometry = new THREE.BufferGeometry();
      line = new THREE.LineSegments(dashGeometry, dashMaterial);
    } else {
      // Use Line for regular lines
      const lineGeometry = new THREE.BufferGeometry();
      line = new THREE.Line(lineGeometry, material);
    }
    
    line.userData = { 
      linkId: link.id,
      type: linkType,
      sourceId: typeof link.source === 'object' ? link.source.id : link.source,
      targetId: typeof link.target === 'object' ? link.target.id : link.target
    };
    
    line.visible = isVisible;
    
    // Create arrow if enabled
    let arrow = null;
    if (this.settings.useArrows) {
      arrow = this.createLinkArrow(color, isVisible);
    }
    
    // Create link object
    const linkObject = {
      line,
      arrow,
      type: linkType,
      selected: false,
      hovered: false,
      visible: isVisible,
      dashGeometry: isDashed
    };
    
    // Position will be updated when node positions are available
    // Add to scene
    this.scene.add(line);
    if (arrow) {
      this.scene.add(arrow);
    }
    
    // Store in map
    this.linkObjects.set(link.id, linkObject);
    
    return linkObject;
  }
  
  /**
   * Create an arrow for a link
   * @param {number} color - Arrow color
   * @param {boolean} isVisible - Visibility flag
   * @returns {THREE.Mesh} Arrow mesh
   * @private
   */
  createLinkArrow(color, isVisible) {
    // Create arrow mesh
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: isVisible ? this.settings.defaultOpacity : this.settings.fadeOpacity
    });
    
    const arrow = new THREE.Mesh(this.geometries.arrow, arrowMaterial);
    arrow.visible = isVisible;
    
    return arrow;
  }
  
  /**
   * Update an existing link object
   * @param {Object} link - Updated link data
   * @param {Object} linkObject - Existing link object
   * @private
   */
  updateLinkObject(link, linkObject) {
    if (!link || !linkObject) return;
    
    const { line, arrow } = linkObject;
    const isVisible = link.visible !== false;
    
    // Update visibility
    if (linkObject.visible !== isVisible) {
      line.visible = isVisible;
      line.material.opacity = isVisible ? this.settings.defaultOpacity : this.settings.fadeOpacity;
      
      if (arrow) {
        arrow.visible = isVisible;
        arrow.material.opacity = isVisible ? this.settings.defaultOpacity : this.settings.fadeOpacity;
      }
      
      linkObject.visible = isVisible;
    }
    
    // Update type if changed
    if (linkObject.type !== link.type) {
      const color = this.getLinkColor(link.type);
      line.material.color.set(color);
      if (arrow) {
        arrow.material.color.set(color);
      }
      linkObject.type = link.type;
      
      // Update line width
      const width = this.settings.linkWidthByType[link.type] || this.settings.linkWidthByType.default;
      line.material.linewidth = width;
      
      // Update dashed status if needed
      const shouldBeDashed = this.settings.linkLineStyles[link.type] || this.settings.linkLineStyles.default;
      if (shouldBeDashed !== linkObject.dashGeometry) {
        // Need to recreate the link with the correct geometry type
        this.removeLinkObject(link.id);
        this.createLinkObject(link);
      }
    }
    
    // Update source/target if changed
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    
    if (line.userData.sourceId !== sourceId || line.userData.targetId !== targetId) {
      line.userData.sourceId = sourceId;
      line.userData.targetId = targetId;
    }
  }
  
  /**
   * Update link positions based on connected nodes
   * @param {Object} nodeObjectMap - Map of node IDs to their visual objects
   */
  updateLinkPositions(nodeObjectMap) {
    this.linkObjects.forEach((linkObject, linkId) => {
      const { line, arrow } = linkObject;
      const sourceId = line.userData.sourceId;
      const targetId = line.userData.targetId;
      
      const sourceNodeObject = nodeObjectMap.get(sourceId);
      const targetNodeObject = nodeObjectMap.get(targetId);
      
      if (!sourceNodeObject || !targetNodeObject) {
        // Cannot update position if either node is missing
        // Make the link invisible 
        line.visible = false;
        if (arrow) arrow.visible = false;
        return;
      }
      
      // Get node positions
      const sourcePos = sourceNodeObject.mesh.position.clone();
      const targetPos = targetNodeObject.mesh.position.clone();
      
      // Calculate points for the link
      let points;
      if (this.settings.useCurvedLinks) {
        points = this.calculateCurvedLinkPoints(sourcePos, targetPos);
      } else {
        points = [sourcePos, targetPos];
      }
      
      // Update link geometry
      if (linkObject.dashGeometry) {
        // Update dashed line
        const dashGeometry = new THREE.BufferGeometry().setFromPoints(points);
        line.geometry.dispose();
        line.geometry = dashGeometry;
        line.computeLineDistances(); // Required for dashed lines
      } else {
        // Update regular line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        line.geometry.dispose();
        line.geometry = lineGeometry;
      }
      
      // Update arrow position if present
      if (arrow) {
        const position = this.calculateArrowPosition(points, this.settings.arrowPosition);
        const direction = this.calculateArrowDirection(points, this.settings.arrowPosition);
        
        arrow.position.copy(position);
        arrow.lookAt(position.clone().add(direction));
        arrow.rotateX(Math.PI / 2); // Adjust arrow orientation
      }
      
      // If the link should be visible based on the nodes' visibility
      const shouldBeVisible = sourceNodeObject.mesh.visible && targetNodeObject.mesh.visible && linkObject.visible;
      
      // Update visibility
      line.visible = shouldBeVisible;
      if (arrow) arrow.visible = shouldBeVisible;
    });
  }
  
  /**
   * Calculate points for a curved link
   * @param {THREE.Vector3} source - Source position
   * @param {THREE.Vector3} target - Target position
   * @returns {Array<THREE.Vector3>} Array of points along the curve
   * @private
   */
  calculateCurvedLinkPoints(source, target) {
    // Calculate a midpoint for the curve
    const midPoint = new THREE.Vector3().addVectors(source, target).multiplyScalar(0.5);
    
    // Add some offset to create a curve
    const direction = new THREE.Vector3().subVectors(target, source);
    const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
    const distance = source.distanceTo(target);
    
    // Adjust midpoint by perpendicular vector
    midPoint.add(perpendicular.multiplyScalar(distance * this.settings.curveAmount));
    
    // Create a quadratic bezier curve
    const curve = new THREE.QuadraticBezierCurve3(source, midPoint, target);
    
    // Sample points along the curve
    const points = curve.getPoints(20); // 20 segments
    
    return points;
  }
  
  /**
   * Calculate position for an arrow along a link
   * @param {Array<THREE.Vector3>} points - Array of points defining the link
   * @param {number} position - Position along the link (0-1)
   * @returns {THREE.Vector3} Position for the arrow
   * @private
   */
  calculateArrowPosition(points, position) {
    if (points.length === 2) {
      // Straight line
      const direction = new THREE.Vector3().subVectors(points[1], points[0]);
      return points[0].clone().add(direction.multiplyScalar(position));
    } else {
      // Curved line - find the point at the given position
      const totalLength = this.calculateLinkLength(points);
      let currentLength = 0;
      let targetLength = totalLength * position;
      
      for (let i = 1; i < points.length; i++) {
        const segmentLength = points[i].distanceTo(points[i-1]);
        
        if (currentLength + segmentLength >= targetLength) {
          // This segment contains the target point
          const remainingLength = targetLength - currentLength;
          const segmentPosition = remainingLength / segmentLength;
          
          return new THREE.Vector3().lerpVectors(
            points[i-1],
            points[i],
            segmentPosition
          );
        }
        
        currentLength += segmentLength;
      }
      
      // Fallback to the end point
      return points[points.length - 1].clone();
    }
  }
  
  /**
   * Calculate direction for an arrow along a link
   * @param {Array<THREE.Vector3>} points - Array of points defining the link
   * @param {number} position - Position along the link (0-1)
   * @returns {THREE.Vector3} Direction for the arrow
   * @private
   */
  calculateArrowDirection(points, position) {
    if (points.length === 2) {
      // Straight line
      return new THREE.Vector3().subVectors(points[1], points[0]).normalize();
    } else {
      // Curved line - find the tangent at the given position
      const totalLength = this.calculateLinkLength(points);
      let currentLength = 0;
      let targetLength = totalLength * position;
      
      for (let i = 1; i < points.length; i++) {
        const segmentLength = points[i].distanceTo(points[i-1]);
        
        if (currentLength + segmentLength >= targetLength) {
          // This segment contains the target point
          return new THREE.Vector3().subVectors(points[i], points[i-1]).normalize();
        }
        
        currentLength += segmentLength;
      }
      
      // Fallback to the last segment direction
      const lastIndex = points.length - 1;
      return new THREE.Vector3().subVectors(
        points[lastIndex],
        points[lastIndex - 1]
      ).normalize();
    }
  }
  
  /**
   * Calculate length of a link defined by points
   * @param {Array<THREE.Vector3>} points - Array of points
   * @returns {number} Total length
   * @private
   */
  calculateLinkLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += points[i].distanceTo(points[i-1]);
    }
    return length;
  }
  
  /**
   * Remove a link object
   * @param {string} linkId - ID of link to remove
   * @private
   */
  removeLinkObject(linkId) {
    const linkObject = this.linkObjects.get(linkId);
    if (!linkObject) return;
    
    // Remove from scene
    this.scene.remove(linkObject.line);
    if (linkObject.arrow) {
      this.scene.remove(linkObject.arrow);
    }
    
    // Dispose resources
    if (linkObject.line.geometry) linkObject.line.geometry.dispose();
    if (linkObject.line.material) linkObject.line.material.dispose();
    
    if (linkObject.arrow) {
      if (linkObject.arrow.material) linkObject.arrow.material.dispose();
    }
    
    // Remove from map
    this.linkObjects.delete(linkId);
  }
  
  /**
   * Clear all link objects
   * @private
   */
  clearLinkObjects() {
    // Remove all link objects from scene and dispose resources
    this.linkObjects.forEach((linkObject, linkId) => {
      this.removeLinkObject(linkId);
    });
    
    this.linkObjects.clear();
  }
  
  /**
   * Get color for a link type
   * @param {string} linkType - Type of link
   * @returns {number} Hex color
   * @private
   */
  getLinkColor(linkType) {
    // Use visualization manager if available
    if (this.visualizationManager) {
      const colorString = this.visualizationManager.getRelationshipColor(linkType);
      // Convert from CSS color string to hex number if needed
      if (typeof colorString === 'string' && colorString.startsWith('#')) {
        return parseInt(colorString.substring(1), 16);
      }
      return colorString;
    }
    
    // Fallback to color manager
    if (this.colorManager) {
      return this.colorManager.getRelationshipColor(linkType);
    } else {
      // Default colors if no managers available
      const defaultColors = {
        contains: 0x999999,        // Gray
        implements: 0x27AE60,      // Green
        depends_on: 0xE74C3C,      // Red
        relates_to: 0x3498DB,      // Blue
        integration: 0xF1C40F,     // Yellow
        default: 0xAAAAAA         // Light Gray
      };
      
      return defaultColors[linkType] || defaultColors.default;
    }
  }
  
  /**
   * Set selected link
   * @param {string} linkId - ID of selected link
   */
  setSelectedLink(linkId) {
    // Deselect current selection
    if (this.selectedLink) {
      const prevSelected = this.linkObjects.get(this.selectedLink);
      if (prevSelected) {
        prevSelected.selected = false;
        this.updateLinkObjectState(prevSelected);
      }
    }
    
    // Update selected link
    this.selectedLink = linkId;
    
    // Select new link
    if (linkId) {
      const linkObject = this.linkObjects.get(linkId);
      if (linkObject) {
        linkObject.selected = true;
        this.updateLinkObjectState(linkObject);
      }
    }
  }
  
  /**
   * Set hovered link
   * @param {string} linkId - ID of hovered link
   */
  setHoveredLink(linkId) {
    // Remove hover from current
    if (this.hoveredLink) {
      const prevHovered = this.linkObjects.get(this.hoveredLink);
      if (prevHovered) {
        prevHovered.hovered = false;
        this.updateLinkObjectState(prevHovered);
      }
    }
    
    // Update hovered link
    this.hoveredLink = linkId;
    
    // Apply hover to new link
    if (linkId) {
      const linkObject = this.linkObjects.get(linkId);
      if (linkObject) {
        linkObject.hovered = true;
        this.updateLinkObjectState(linkObject);
      }
    }
  }
  
  /**
   * Update link appearance based on state
   * @param {Object} linkObject - Link object to update
   * @private
   */
  updateLinkObjectState(linkObject) {
    if (!linkObject || !linkObject.line) return;
    
    const { line, arrow, selected, hovered, type } = linkObject;
    
    // Get base color for link type
    let color = this.getLinkColor(type);
    
    // Update material based on state
    if (selected) {
      // Selected state
      line.material.color.set(this.settings.selectedColor);
      line.material.linewidth = this.settings.highlightedWidth;
      line.material.opacity = this.settings.defaultOpacity * 1.5;
      
      if (arrow) {
        arrow.material.color.set(this.settings.selectedColor);
        arrow.material.opacity = this.settings.defaultOpacity * 1.5;
      }
    } else if (hovered) {
      // Hovered state
      line.material.color.set(this.settings.hoveredColor);
      line.material.linewidth = this.settings.highlightedWidth;
      line.material.opacity = this.settings.defaultOpacity * 1.2;
      
      if (arrow) {
        arrow.material.color.set(this.settings.hoveredColor);
        arrow.material.opacity = this.settings.defaultOpacity * 1.2;
      }
    } else {
      // Normal state
      line.material.color.set(color);
      line.material.linewidth = this.settings.linkWidthByType[type] || this.settings.linkWidthByType.default;
      line.material.opacity = this.settings.defaultOpacity;
      
      if (arrow) {
        arrow.material.color.set(color);
        arrow.material.opacity = this.settings.defaultOpacity;
      }
    }
  }
  
  /**
   * Update method called each frame
   * @param {number} delta - Time since last update in seconds
   */
  update(delta) {
    // Animate links if enabled
    if (this.settings.animatedLinks && this.settings.animationSpeed > 0) {
      this.animateLinks(delta);
    }
  }
  
  /**
   * Animate links (e.g., moving dashes)
   * @param {number} delta - Time since last update in seconds
   * @private
   */
  animateLinks(delta) {
    this.linkObjects.forEach(linkObject => {
      if (linkObject.dashGeometry && linkObject.line.material.dashOffset !== undefined) {
        // Animate dash pattern
        linkObject.line.material.dashOffset -= this.settings.animationSpeed * delta;
      }
    });
  }
  
  /**
   * Get all links
   * @returns {Array} Array of link objects
   */
  getLinks() {
    return [...this.links];
  }
  
  /**
   * Get link by ID
   * @param {string} linkId - Link ID
   * @returns {Object} Link data
   */
  getLinkById(linkId) {
    return this.links.find(link => link.id === linkId);
  }
  
  /**
   * Get link object by ID
   * @param {string} linkId - Link ID
   * @returns {Object} Link object
   */
  getLinkObjectById(linkId) {
    return this.linkObjects.get(linkId);
  }
  
  /**
   * Update rendering settings
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    const significantChanges = [
      'useCurvedLinks',
      'useArrows',
      'arrowSize',
      'linkLineStyles'
    ];
    
    // Check if any significant changes require recreating links
    const needsRecreation = significantChanges.some(prop => 
      newSettings[prop] !== undefined && newSettings[prop] !== this.settings[prop]
    );
    
    // Apply new settings
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    if (needsRecreation) {
      // Recreate all links
      this.setLinks(this.links);
    } else {
      // Update existing links with new settings
      this.linkObjects.forEach(linkObject => {
        this.updateLinkObjectState(linkObject);
      });
    }
  }
  
  /**
   * Highlight links
   * @param {Array<string>} linkIds - Array of link IDs to highlight
   * @param {boolean} exclusive - Only highlight specified links
   */
  highlightLinks(linkIds, exclusive = false) {
    const linksToHighlight = new Set(linkIds);
    
    this.linkObjects.forEach((linkObject, id) => {
      if (linksToHighlight.has(id)) {
        // Highlight this link
        linkObject.line.material.color.set(this.settings.hoveredColor);
        linkObject.line.material.linewidth = this.settings.highlightedWidth;
        linkObject.line.material.opacity = this.settings.defaultOpacity * 1.2;
        
        if (linkObject.arrow) {
          linkObject.arrow.material.color.set(this.settings.hoveredColor);
          linkObject.arrow.material.opacity = this.settings.defaultOpacity * 1.2;
        }
      } else if (exclusive) {
        // Fade other links
        linkObject.line.material.opacity = this.settings.fadeOpacity;
        
        if (linkObject.arrow) {
          linkObject.arrow.material.opacity = this.settings.fadeOpacity;
        }
      } else {
        // Reset to normal
        this.updateLinkObjectState(linkObject);
      }
    });
  }
  
  /**
   * Reset all link highlighting
   */
  resetHighlighting() {
    this.highlightLinks([]);
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this.clearLinkObjects();
    
    // Dispose of reusable geometries
    Object.values(this.geometries).forEach(geometry => {
      if (geometry) geometry.dispose();
    });
    
    // Clear references
    this.scene = null;
    this.colorManager = null;
    this.links = [];
    this.selectedLink = null;
    this.hoveredLink = null;
    this.isInitialized = false;
  }
}

export default registry.register(
  'visualization.LinkRenderer',
  new LinkRenderer(),
  ['visualization.ColorManager', 'visualization.SceneManager', 'visualization.VisualizationManager'],
  {
    description: 'Creates and manages visual representations of links between nodes',
    singleton: true
  }
);
