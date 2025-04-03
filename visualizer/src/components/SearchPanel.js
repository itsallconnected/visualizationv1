import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Provides search functionality for finding nodes in the visualization
 * Displays search results and allows navigation to specific nodes
 */
const SearchPanel = ({
  isOpen = false,
  onClose = () => {},
  onNodeSelect = () => {}
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [searchFilters, setSearchFilters] = useState({
    types: [],
    spheres: []
  });
  const [availableFilters, setAvailableFilters] = useState({
    types: [],
    spheres: []
  });
  
  // Refs
  const searchInputRef = useRef(null);
  const searchTimeout = useRef(null);
  const resultsRef = useRef(null);
  
  // Get required services
  const dataService = registry.get('data.DataService');
  const visualizationManager = registry.get('visualization.VisualizationManager');
  const sphereManager = registry.get('visualization.SphereManager');
  
  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    
    // Load available filters when panel opens
    if (isOpen) {
      loadAvailableFilters();
    }
  }, [isOpen]);
  
  // Subscribe to search toggle events
  useEffect(() => {
    const handleSearchToggle = () => {
      // If panel is already open, focus the search input
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    
    EventBus.subscribe('search:toggle', handleSearchToggle);
    
    return () => {
      EventBus.unsubscribe('search:toggle', handleSearchToggle);
    };
  }, [isOpen]);
  
  // Keyboard navigation for search results
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateResults(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          navigateResults(-1);
          break;
        case 'Enter':
          if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
            selectResult(searchResults[selectedResultIndex]);
          }
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, searchResults, selectedResultIndex]);
  
  /**
   * Navigate through search results using keyboard
   * @param {number} direction - Direction to navigate (1 for down, -1 for up)
   */
  const navigateResults = (direction) => {
    if (searchResults.length === 0) return;
    
    let newIndex = selectedResultIndex + direction;
    
    // Wrap around if out of bounds
    if (newIndex < 0) {
      newIndex = searchResults.length - 1;
    } else if (newIndex >= searchResults.length) {
      newIndex = 0;
    }
    
    setSelectedResultIndex(newIndex);
    
    // Scroll selected item into view
    if (resultsRef.current && resultsRef.current.children[newIndex]) {
      resultsRef.current.children[newIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };
  
  /**
   * Load available filter options
   */
  const loadAvailableFilters = async () => {
    try {
      // Get all node types from the data service
      const types = await dataService.getNodeTypes();
      
      // Get all available spheres
      let spheres = [];
      if (sphereManager) {
        spheres = sphereManager.getAllSpheres().map(sphere => ({
          id: sphere.id,
          name: sphere.name
        }));
      }
      
      setAvailableFilters({
        types: types || [],
        spheres: spheres || []
      });
    } catch (error) {
      console.error('Error loading search filters:', error);
    }
  };
  
  /**
   * Handle search input change
   * @param {Event} event - Input change event
   */
  const handleSearchChange = (event) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    // Debounce search
    if (query.trim().length > 0) {
      setIsSearching(true);
      searchTimeout.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
      setSelectedResultIndex(-1);
    }
  };
  
  /**
   * Perform search with current query and filters
   * @param {string} query - Search query
   */
  const performSearch = async (query) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    try {
      if (dataService) {
        const filters = {
          types: searchFilters.types.length > 0 ? searchFilters.types : null,
          spheres: searchFilters.spheres.length > 0 ? searchFilters.spheres : null
        };
        
        const results = await dataService.searchNodes(query, filters);
        setSearchResults(results || []);
      } else {
        // Fallback if data service is not available
        // Search in visualization manager if available
        if (visualizationManager) {
          const results = visualizationManager.searchNodes(query);
          setSearchResults(results || []);
        } else {
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setSelectedResultIndex(-1); // Reset selection
    }
  };
  
  /**
   * Clear search and results
   */
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResultIndex(-1);
    
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  /**
   * Toggle a filter option
   * @param {string} filterType - Filter type (types or spheres)
   * @param {string} value - Filter value
   */
  const toggleFilter = (filterType, value) => {
    setSearchFilters(prevFilters => {
      const currentValues = [...prevFilters[filterType]];
      const index = currentValues.indexOf(value);
      
      if (index >= 0) {
        currentValues.splice(index, 1);
      } else {
        currentValues.push(value);
      }
      
      const newFilters = {
        ...prevFilters,
        [filterType]: currentValues
      };
      
      // Re-run search with new filters if there's a query
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      }
      
      return newFilters;
    });
  };
  
  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setSearchFilters({
      types: [],
      spheres: []
    });
    
    // Re-run search if there's a query
    if (searchQuery.trim().length > 0) {
      performSearch(searchQuery);
    }
  };
  
  /**
   * Handle result selection
   * @param {Object} result - Selected search result
   */
  const selectResult = (result) => {
    if (!result) return;
    
    // Update selected sphere if needed
    if (result.sphereId && sphereManager && result.sphereId !== sphereManager.getActiveSphereId()) {
      sphereManager.activateSphere(result.sphereId);
    }
    
    // Navigate to the node
    if (visualizationManager) {
      visualizationManager.focusNode(result.id);
    }
    
    // Emit node selection event
    EventBus.publish('node:selected', {
      nodeId: result.id,
      node: result
    });
    
    // Call custom handler if provided
    if (onNodeSelect) {
      onNodeSelect(result);
    }
    
    // Close search panel
    onClose();
  };
  
  /**
   * Render filter section
   */
  const renderFilters = () => {
    return (
      <div className="search-panel__filters">
        <div className="search-panel__filters-header">
          <h3>Filters</h3>
          {(searchFilters.types.length > 0 || searchFilters.spheres.length > 0) && (
            <button 
              className="search-panel__clear-filters-button"
              onClick={clearFilters}
            >
              Clear All
            </button>
          )}
        </div>
        
        {/* Node type filters */}
        {availableFilters.types.length > 0 && (
          <div className="search-panel__filter-group">
            <h4>Node Types</h4>
            <div className="search-panel__filter-options">
              {availableFilters.types.map(type => (
                <label key={type.id} className="search-panel__filter-option">
                  <input
                    type="checkbox"
                    checked={searchFilters.types.includes(type.id)}
                    onChange={() => toggleFilter('types', type.id)}
                  />
                  <span className="search-panel__filter-name">{type.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        
        {/* Sphere filters */}
        {availableFilters.spheres.length > 0 && (
          <div className="search-panel__filter-group">
            <h4>Spheres</h4>
            <div className="search-panel__filter-options">
              {availableFilters.spheres.map(sphere => (
                <label key={sphere.id} className="search-panel__filter-option">
                  <input
                    type="checkbox"
                    checked={searchFilters.spheres.includes(sphere.id)}
                    onChange={() => toggleFilter('spheres', sphere.id)}
                  />
                  <span className="search-panel__filter-name">{sphere.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render search results
   */
  const renderResults = () => {
    if (isSearching) {
      return (
        <div className="search-panel__searching">
          <div className="search-panel__spinner"></div>
          <p>Searching...</p>
        </div>
      );
    }
    
    if (searchResults.length === 0 && searchQuery.trim().length > 0) {
      return (
        <div className="search-panel__no-results">
          <p>No results found for "{searchQuery}"</p>
        </div>
      );
    }
    
    if (searchResults.length === 0) {
      return (
        <div className="search-panel__empty">
          <p>Enter search terms to find nodes</p>
        </div>
      );
    }
    
    return (
      <div className="search-panel__results-container">
        <div className="search-panel__results-header">
          <h3>Results ({searchResults.length})</h3>
        </div>
        <ul className="search-panel__results" ref={resultsRef}>
          {searchResults.map((result, index) => (
            <li 
              key={result.id}
              className={`search-panel__result ${index === selectedResultIndex ? 'search-panel__result--selected' : ''}`}
              onClick={() => selectResult(result)}
              onMouseEnter={() => setSelectedResultIndex(index)}
            >
              <div className="search-panel__result-type">
                {result.type}
                {result.sphereId && result.sphereName && (
                  <span className="search-panel__result-sphere">{result.sphereName}</span>
                )}
              </div>
              <div className="search-panel__result-name">{result.name}</div>
              {result.path && (
                <div className="search-panel__result-path">
                  {result.path}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  // If panel is not open, don't render anything
  if (!isOpen) {
    return null;
  }
  
  return (
    <div className="search-panel">
      <div className="search-panel__header">
        <div className="search-panel__search-bar">
          <input
            ref={searchInputRef}
            className="search-panel__input"
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={handleSearchChange}
            autoFocus
          />
          {searchQuery && (
            <button 
              className="search-panel__clear-button"
              onClick={clearSearch}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button 
          className="search-panel__close-button"
          onClick={onClose}
          title="Close search"
        >
          ✕
        </button>
      </div>
      
      <div className="search-panel__content">
        {renderFilters()}
        {renderResults()}
      </div>
      
      <div className="search-panel__footer">
        <div className="search-panel__shortcuts">
          <div className="search-panel__shortcut">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </div>
          <div className="search-panel__shortcut">
            <kbd>Enter</kbd> Select
          </div>
          <div className="search-panel__shortcut">
            <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
};

SearchPanel.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onNodeSelect: PropTypes.func
};

export default registry.register(
  'components.SearchPanel',
  SearchPanel,
  [
    'data.DataService',
    'visualization.VisualizationManager',
    'visualization.SphereManager',
    'utils.EventBus'
  ],
  {
    description: 'Provides search functionality for finding nodes',
    usage: 'Used in the main UI to search for specific nodes in the visualization'
  }
); 