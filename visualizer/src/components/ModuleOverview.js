import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';

/**
 * ModuleOverview component displays all modules registered in the system
 * and provides information about their dependencies and metadata.
 * This is primarily used for development and debugging.
 */
const ModuleOverview = ({ showFilter = true }) => {
  const [modules, setModules] = useState({});
  const [dependencies, setDependencies] = useState({});
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  useEffect(() => {
    // Discover all modules
    const discoveredModules = registry.discoverModules();
    setModules(discoveredModules);
    
    // Get dependency map
    setDependencies(registry.generateDependencyMap());
  }, []);
  
  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };
  
  const handleSort = (field) => {
    if (sortBy === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, reset to ascending
      setSortBy(field);
      setSortDirection('asc');
    }
  };
  
  // Filter and sort module names
  const getFilteredAndSortedModules = () => {
    const moduleNames = Object.keys(modules);
    
    // Apply filter
    const filteredModules = filter 
      ? moduleNames.filter(name => name.toLowerCase().includes(filter.toLowerCase()))
      : moduleNames;
      
    // Apply sorting
    return filteredModules.sort((a, b) => {
      // Sort by name
      if (sortBy === 'name') {
        return sortDirection === 'asc' 
          ? a.localeCompare(b)
          : b.localeCompare(a);
      }
      
      // Sort by dependency count
      if (sortBy === 'dependencyCount') {
        const countA = (dependencies[a] || []).length;
        const countB = (dependencies[b] || []).length;
        return sortDirection === 'asc' 
          ? countA - countB
          : countB - countA;
      }
      
      // Sort by dependent count
      if (sortBy === 'dependentCount') {
        const countA = registry.findDependents(a).length;
        const countB = registry.findDependents(b).length;
        return sortDirection === 'asc' 
          ? countA - countB
          : countB - countA;
      }
      
      return 0;
    });
  };
  
  const renderDependencyInfo = (moduleName) => {
    const deps = dependencies[moduleName] || [];
    const dependents = registry.findDependents(moduleName);
    const hasCircular = registry.hasCircularDependencies(moduleName);
    
    return (
      <div className="module-dependencies">
        {hasCircular && (
          <div className="circular-warning">
            ⚠️ Has circular dependencies
          </div>
        )}
        
        {deps.length > 0 && (
          <div className="depends-on">
            <strong>Depends on ({deps.length}):</strong>
            <ul>
              {deps.map(dep => (
                <li key={dep}>
                  <code>{dep}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {dependents.length > 0 && (
          <div className="depended-by">
            <strong>Used by ({dependents.length}):</strong>
            <ul>
              {dependents.map(dep => (
                <li key={dep}>
                  <code>{dep}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {deps.length === 0 && dependents.length === 0 && (
          <div className="no-dependencies">
            No dependencies or dependents
          </div>
        )}
      </div>
    );
  };
  
  const moduleNames = getFilteredAndSortedModules();
  
  return (
    <div className="module-overview">
      <div className="module-overview-header">
        <h2>Module Registry</h2>
        <div className="module-count">
          {moduleNames.length} modules {filter ? 'matched' : 'registered'}
          {filter && ` (out of ${Object.keys(modules).length} total)`}
        </div>
        
        {showFilter && (
          <div className="module-filter">
            <input
              type="text"
              placeholder="Filter modules..."
              value={filter}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
        )}
        
        <div className="module-sort">
          <span>Sort by:</span>
          <button
            className={`sort-button ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => handleSort('name')}
          >
            Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortBy === 'dependencyCount' ? 'active' : ''}`}
            onClick={() => handleSort('dependencyCount')}
          >
            Dependencies {sortBy === 'dependencyCount' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortBy === 'dependentCount' ? 'active' : ''}`}
            onClick={() => handleSort('dependentCount')}
          >
            Dependents {sortBy === 'dependentCount' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>
      
      <div className="module-list">
        {moduleNames.length === 0 ? (
          <div className="no-modules">
            {filter ? 'No modules match the filter' : 'No modules registered yet'}
          </div>
        ) : (
          moduleNames.map(name => {
            const moduleType = name.split('.')[0]; // Get first segment of path
            
            return (
              <div key={name} className={`module-item module-type-${moduleType}`}>
                <div className="module-name">
                  <code>{name}</code>
                </div>
                {renderDependencyInfo(name)}
              </div>
            );
          })
        )}
      </div>
      
      <div className="module-legend">
        <h3>Module Types</h3>
        <ul className="legend-list">
          <li className="legend-item module-type-components">components</li>
          <li className="legend-item module-type-utils">utils</li>
          <li className="legend-item module-type-data">data</li>
          <li className="legend-item module-type-auth">auth</li>
          <li className="legend-item module-type-api">api</li>
          <li className="legend-item module-type-visualization">visualization</li>
          <li className="legend-item module-type-admin">admin</li>
        </ul>
      </div>
    </div>
  );
};

ModuleOverview.propTypes = {
  showFilter: PropTypes.bool,
};

export default registry.register(
  'components.ModuleOverview',
  ModuleOverview,
  [], // No dependencies
  {
    description: 'Development tool for inspecting registered modules',
    usage: 'Use this component for development debugging only',
  }
); 