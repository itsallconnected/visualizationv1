/**
 * Registry Validator
 * 
 * This utility verifies that all required modules are properly registered
 * and their dependencies are available. It helps identify configuration and
 * integration issues before they cause runtime errors.
 */

import registry from '../ModuleRegistry';

// Required modules for various application features
const REQUIRED_MODULES = {
  // Core infrastructure
  core: [
    'utils.EventBus',
    'utils.ErrorHandler',
  ],
  
  // Authentication
  auth: [
    'auth.GitHubAuthService',
    'auth.AuthContext',
    'auth.ProtectedComponent'
  ],
  
  // Data layer
  data: [
    'api.GitHubService',
    'data.DataService',
    'data.NodeRepository',
    'data.GraphDataGenerator'
  ],
  
  // UI components
  ui: [
    'components.AppLayout',
    'components.Sidebar',
    'components.VisualizationContainer',
    'components.ModuleOverview'
  ],
  
  // Visualization
  visualization: [
    'visualization.VisualizationManager',
    'visualization.SceneManager',
    'visualization.NodeRenderer',
    'visualization.LinkRenderer'
  ]
};

/**
 * Validate that required modules are registered
 * @param {Array} categories - Categories to validate (defaults to all)
 * @returns {Object} Validation results
 */
export function validateRegistry(categories = Object.keys(REQUIRED_MODULES)) {
  const results = {
    success: true,
    missing: [],
    available: [],
    missingDependencies: {}
  };
  
  // Discover all modules
  registry.discoverModules();
  
  // Check required modules by category
  categories.forEach(category => {
    const modules = REQUIRED_MODULES[category] || [];
    
    modules.forEach(moduleName => {
      const module = registry.getModule(moduleName);
      
      if (module) {
        results.available.push(moduleName);
        
        // Check dependencies
        const dependencies = registry.getDependencies(moduleName) || [];
        const missingDeps = dependencies.filter(dep => !registry.getModule(dep));
        
        if (missingDeps.length > 0) {
          results.success = false;
          results.missingDependencies[moduleName] = missingDeps;
        }
      } else {
        results.success = false;
        results.missing.push(moduleName);
      }
    });
  });
  
  return results;
}

/**
 * Format validation results as a string report
 * @param {Object} results - Validation results
 * @returns {string} Formatted report
 */
export function formatValidationReport(results) {
  let report = '=== REGISTRY VALIDATION REPORT ===\n\n';
  
  if (results.success) {
    report += '✅ All required modules are available and dependencies are satisfied.\n\n';
  } else {
    report += '❌ There are issues with the module registry.\n\n';
  }
  
  // Report available modules
  report += `Available Modules (${results.available.length}):\n`;
  results.available.forEach(mod => {
    report += `  ✅ ${mod}\n`;
  });
  
  // Report missing modules
  if (results.missing.length > 0) {
    report += `\nMissing Modules (${results.missing.length}):\n`;
    results.missing.forEach(mod => {
      report += `  ❌ ${mod}\n`;
    });
  }
  
  // Report missing dependencies
  const modulesWithMissingDeps = Object.keys(results.missingDependencies);
  if (modulesWithMissingDeps.length > 0) {
    report += '\nModules with Missing Dependencies:\n';
    
    modulesWithMissingDeps.forEach(mod => {
      const missingDeps = results.missingDependencies[mod];
      report += `  ❌ ${mod} is missing dependencies: ${missingDeps.join(', ')}\n`;
    });
  }
  
  report += '\n=== END OF REPORT ===';
  
  return report;
}

/**
 * Run validation and log the report
 * @param {Array} categories - Categories to validate (defaults to all)
 */
export function runValidation(categories) {
  const results = validateRegistry(categories);
  const report = formatValidationReport(results);
  
  console.log(report);
  return results.success;
}

// If this file is executed directly, run the validation
if (typeof window !== 'undefined' && window.location.search.includes('validate=true')) {
  runValidation();
}

export default {
  validateRegistry,
  formatValidationReport,
  runValidation
}; 