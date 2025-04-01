// Node Details Renderer
// This script handles specialized rendering of node details in the details panel

class NodeDetailsRenderer {
    constructor() {
        // Node display registry - maps node types to display functions
        this.displayRegistry = {
            'component_group': this.displayComponentGroup.bind(this),
            'component': this.displayComponent.bind(this),
            'subcomponent': this.displaySubcomponent.bind(this),
            'capability': this.displayCapability.bind(this),
            'function': this.displayFunction.bind(this),
            'specification': this.displaySpecification.bind(this),
            'integration': this.displayIntegration.bind(this),
            'technique': this.displayTechnique.bind(this),
            'application': this.displayApplication.bind(this),
            'input': this.displayInput.bind(this),
            'output': this.displayOutput.bind(this)
        };
    }

    // Helper function to capitalize phrases (e.g., "component_group" -> "Component Group")
    formatTitle(text) {
        if (!text) return '';
        return text.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Helper to create a section header
    createSectionHeader(title) {
        return `
            <div class="section-header">
                <h3>${title}</h3>
            </div>
        `;
    }

    // Helper to create a clickable item for a node
    createClickableNode(node, additionalClasses = '') {
        const nodeType = node.type || '';
        const description = node.description || '';
        const truncatedDesc = description.length > 150 ? 
            `${description.substring(0, 150)}...` : description;

        return `
            <div class="clickable-item ${additionalClasses}" data-node-id="${node.id}" data-expand="true">
                <div class="node-type-badge ${nodeType}">${this.formatTitle(nodeType)}</div>
                <strong>${node.name}</strong>
                ${description ? `<div class="item-description">${truncatedDesc}</div>` : ''}
            </div>
        `;
    }

    // Helper to create a literature reference item
    createLiteratureItem(reference) {
        if (!reference) return '';
        
        const title = reference.title || '';
        const authors = reference.authors ? 
            (Array.isArray(reference.authors) ? reference.authors.join(', ') : reference.authors) : '';
        const year = reference.year ? `(${reference.year})` : '';
        const venue = reference.venue ? `<div>${reference.venue}</div>` : '';
        const url = reference.url || '';
        
        // If there's a URL, make the entire reference clickable
        const referenceStart = url ? `<div class="reference-item clickable" onclick="window.open('${url}', '_blank')">` : `<div class="reference-item">`;
        
        return `
            ${referenceStart}
                <div class="ref-header">${title}</div>
                <div class="ref-body">
                    ${authors} ${year}
                    ${venue}
                </div>
            </div>
        `;
    }

    // Main render function
    renderNodeDetails(nodeData) {
        if (!nodeData) {
            console.error("No node data provided to renderNodeDetails");
            return '<div class="error-message"><h3>Error</h3><p>No node data provided</p></div>';
        }

        try {
            // Check for error messages in the node data
            if (nodeData.error) {
                return `<div class="error-message"><h3>Error</h3><p>${nodeData.error}</p></div>`;
            }

            // Ensure the node has a type
            if (!nodeData.type) {
                console.error("Node data has no type", nodeData);
                nodeData.type = "unknown";
            }

            // Use the appropriate display function for this node type
            const displayFunction = this.displayRegistry[nodeData.type];
            if (displayFunction) {
                return displayFunction(nodeData);
            }
            
            // Fallback for unknown node types
            console.warn(`No display function for node type: ${nodeData.type}`, nodeData);
            return this.displayGeneric(nodeData);
        } catch (error) {
            console.error("Error rendering node details:", error, nodeData);
            return `<div class="error-message">
                <h3>Error</h3>
                <p>Failed to render node details: ${error.message}</p>
                <pre>${error.stack}</pre>
            </div>`;
        }
    }

    // Generic display for any node type
    displayGeneric(nodeData) {
        let html = '';
        
        // Add node type badge
        html += `<div class="node-type-badge ${nodeData.type}">${this.formatTitle(nodeData.type)}</div>`;
        
        // Add description
        if (nodeData.description) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Description')}
                    <div class="section-content">
                        <p>${nodeData.description}</p>
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Component Group display (ai-alignment.json)
    displayComponentGroup(nodeData) {
        let html = '';
        
        // Add type badge - "Component Group" instead of "component_group"
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Description section
        if (nodeData.description) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Description')}
                    <div class="section-content">
                        <p>${nodeData.description}</p>
                    </div>
                </div>
            `;
        }
        
        // Purpose section (from overview.purpose)
        if (nodeData.overview && nodeData.overview.purpose) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Purpose')}
                    <div class="section-content">
                        <p>${nodeData.overview.purpose}</p>
                    </div>
                </div>
            `;
        }
        
        // Architectural Significance section
        if (nodeData.overview && nodeData.overview.architectural_significance) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Architectural Significance')}
                    <div class="section-content">
                        <p>${nodeData.overview.architectural_significance}</p>
                    </div>
                </div>
            `;
        }
        
        // Key Principles section
        if (nodeData.overview && nodeData.overview.key_principles && nodeData.overview.key_principles.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Key Principles')}
                    <div class="section-content">
                        <div class="principles-container">
            `;
            
            nodeData.overview.key_principles.forEach(principle => {
                html += `<div class="principle-item">${principle}</div>`;
            });
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Components section
        if (nodeData.components && nodeData.components.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Components')}
                    <div class="section-content">
            `;
            
            nodeData.components.forEach(component => {
                html += `
                    <div class="component-box clickable-item" data-node-id="${component.id}">
                        <h4>${component.name}</h4>
                        <p>${component.description || ''}</p>
                        ${component.purpose ? `<div class="component-purpose"><strong>Purpose:</strong> ${component.purpose}</div>` : ''}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Component display - include proper clickable capability boxes for subcomponents to reference
    displayComponent(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Description section
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>Description</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Purpose section (without Overview header)
        if (nodeData.purpose) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Purpose</h3>
                    </div>
                    <div class="section-content">
                        <p>${nodeData.purpose}</p>
                    </div>
                </div>
            `;
        }
        
        // Key Capabilities section - make sure each capability has its own ID for linking
        if (nodeData.key_capabilities && nodeData.key_capabilities.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Key Capabilities</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.key_capabilities.forEach(capability => {
                // Create a capability ID by combining component ID and capability name
                const capabilityId = `${nodeData.id}.${capability.name.replace(/\s+/g, '-').toLowerCase()}`;
                
                let implementedByHtml = '';
                
                if (capability.implemented_by_subcomponents && capability.implemented_by_subcomponents.length > 0) {
                    implementedByHtml = '<div class="implementation-links">Implemented by: ';
                    
                    capability.implemented_by_subcomponents.forEach((subcompId, index) => {
                        implementedByHtml += `<span class="subcomponent-link clickable-item" data-node-id="${subcompId}" data-expand="true">${index + 1}</span>`;
                    });
                    
                    implementedByHtml += '</div>';
                }
                
                html += `
                    <div class="capability-box" id="capability-${capabilityId}">
                        <h4>${capability.name}</h4>
                        <p>${capability.description || ''}</p>
                        ${implementedByHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Primary Functions section
        if (nodeData.primary_functions && nodeData.primary_functions.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Primary Functions</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.primary_functions.forEach(func => {
                // Create a function ID by combining component ID and function name
                const functionId = `${nodeData.id}.${func.name.replace(/\s+/g, '-').toLowerCase()}`;
                
                let implementedByHtml = '';
                
                if (func.implemented_by_subcomponents && func.implemented_by_subcomponents.length > 0) {
                    implementedByHtml = '<div class="implementation-links">Implemented by: ';
                    
                    func.implemented_by_subcomponents.forEach((subcompId, index) => {
                        implementedByHtml += `<span class="subcomponent-link clickable-item" data-node-id="${subcompId}" data-expand="true">${index + 1}</span>`;
                    });
                    
                    implementedByHtml += '</div>';
                }
                
                html += `
                    <div class="function-box" id="function-${functionId}">
                        <h4>${func.name}</h4>
                        <p>${func.description || ''}</p>
                        ${implementedByHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Subcomponents section
        if (nodeData.subcomponents && nodeData.subcomponents.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Subcomponents</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.subcomponents.forEach(subcomp => {
                html += `
                    <div class="subcomponent-box clickable-item" data-node-id="${subcomp.id}" data-expand="true">
                        <h4>${subcomp.name}</h4>
                        <p>${subcomp.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Capabilities section
        if (nodeData.capabilities && nodeData.capabilities.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Capabilities</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.capabilities.forEach(capability => {
                // Implementation by subcomponents links
                let implementedByHtml = '';
                if (capability.implemented_by_subcomponents && capability.implemented_by_subcomponents.length > 0) {
                    implementedByHtml = '<div class="implementation-links">Implemented by: ';
                    
                    capability.implemented_by_subcomponents.forEach((subcompId, index) => {
                        implementedByHtml += `<span class="subcomponent-link clickable-item" data-node-id="${subcompId}" data-expand="true">${index + 1}</span>`;
                    });
                    
                    implementedByHtml += '</div>';
                }
                
                html += `
                    <div class="capability-box">
                        <h4>${capability.name}</h4>
                        <p>${capability.description || ''}</p>
                        ${implementedByHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Functions section
        if (nodeData.functions && nodeData.functions.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Functions</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.functions.forEach(func => {
                // Implementation links
                let implementedByHtml = '';
                if (func.implemented_by_subcomponents && func.implemented_by_subcomponents.length > 0) {
                    implementedByHtml = '<div class="implementation-links">Implemented by: ';
                    
                    func.implemented_by_subcomponents.forEach((subcompId, index) => {
                        implementedByHtml += `<span class="subcomponent-link clickable-item" data-node-id="${subcompId}" data-expand="true">${index + 1}</span>`;
                    });
                    
                    implementedByHtml += '</div>';
                }
                
                html += `
                    <div class="function-box">
                        <h4>${func.name}</h4>
                        <p>${func.description || ''}</p>
                        ${implementedByHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Integration Approaches section
        if (nodeData.integration_approaches && nodeData.integration_approaches.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Integration Approaches</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.integration_approaches.forEach(approach => {
                html += `
                    <div class="approach-box">
                        <h4>${approach.name}</h4>
                        <p>${approach.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Integration Considerations section
        if (nodeData.integration_considerations && nodeData.integration_considerations.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Integration Considerations</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.integration_considerations.forEach(consideration => {
                html += `
                    <div class="consideration-box">
                        <h4>${consideration.title || 'Consideration'}</h4>
                        <p>${consideration.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Key Considerations section
        if (nodeData.key_considerations && nodeData.key_considerations.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Key Considerations</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.key_considerations.forEach(consideration => {
                html += `
                    <div class="key-consideration">
                        <h4>${consideration.title || 'Consideration'}</h4>
                        <p>${consideration.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Subcomponent display - fix references to component capabilities
    displaySubcomponent(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>Description</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Capabilities section (if available)
        if (nodeData.capabilities && nodeData.capabilities.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Capabilities</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.capabilities.forEach(capability => {
                // Create implementation links if available
                let implementsHtml = '';
                
                if (capability.implements_component_capabilities && capability.implements_component_capabilities.length > 0) {
                    implementsHtml = '<div class="implementation-links">Implements: ';
                    
                    capability.implements_component_capabilities.forEach((capabilityId, index) => {
                        // Extract the capability name from the ID for better display
                        const parts = capabilityId.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1]
                            : capabilityId;
                        
                        implementsHtml += `
                            <div class="capability-tag clickable-item" data-node-id="${capabilityId}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    
                    implementsHtml += '</div>';
                }
                
                html += `
                    <div class="capability-box">
                        <h4>${capability.name}</h4>
                        <p>${capability.description || ''}</p>
                        ${implementsHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Functions section (if available)
        if (nodeData.functions && nodeData.functions.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Functions</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.functions.forEach(func => {
                // Create implementation links if available
                let implementsHtml = '';
                
                if (func.implements_component_functions && func.implements_component_functions.length > 0) {
                    implementsHtml = '<div class="implementation-links">Implements: ';
                    
                    func.implements_component_functions.forEach((funcId, index) => {
                        // Extract the function name from the ID for better display
                        const parts = funcId.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1]
                            : funcId;
                        
                        implementsHtml += `
                            <div class="function-tag clickable-item" data-node-id="${funcId}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    
                    implementsHtml += '</div>';
                }
                
                html += `
                    <div class="function-box">
                        <h4>${func.name}</h4>
                        <p>${func.description || ''}</p>
                        ${implementsHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Implementation Considerations section (if available)
        if (nodeData.implementation_considerations && nodeData.implementation_considerations.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Implementation Considerations</h3>
                    </div>
                    <div class="section-content">
            `;
            
            // Group considerations by aspect
            const aspectGroups = {};
            
            nodeData.implementation_considerations.forEach(consideration => {
                // Handle different data formats
                if (typeof consideration === 'object') {
                    const aspect = consideration.aspect || 'General';
                    
                    if (!aspectGroups[aspect]) {
                        aspectGroups[aspect] = [];
                    }
                    
                    aspectGroups[aspect].push(consideration);
                } else {
                    // Simple string considerations get added to a "General" group
                    if (!aspectGroups['General']) {
                        aspectGroups['General'] = [];
                    }
                    
                    aspectGroups['General'].push(consideration);
                }
            });
            
            // Display each aspect group
            Object.entries(aspectGroups).forEach(([aspect, considerations]) => {
                html += `
                    <div class="aspect-group">
                        <h4>${aspect}</h4>
                        <div class="aspect-content">
                `;
                
                considerations.forEach(consideration => {
                    if (typeof consideration === 'object') {
                        // If it has considerations array, display as bulleted list
                        if (consideration.considerations && Array.isArray(consideration.considerations)) {
                            html += `
                                <div class="consideration-detail">
                                    <h5>${consideration.name || ''}</h5>
                                    <ul>
                                        ${consideration.considerations.map(item => `<li>${item}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                        } else if (consideration.description) {
                            // Otherwise display the description
                            html += `
                                <div class="consideration-box">
                                    <h5>${consideration.name || ''}</h5>
                                    <p>${consideration.description}</p>
                                </div>
                            `;
                        }
                    } else {
                        // Simple string format
                        html += `
                            <div class="consideration-box">
                                <p>${consideration}</p>
                            </div>
                        `;
                    }
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Technical Specifications section (if available)
        if (nodeData.technical_specifications) {
            html += this.displayTechnicalSpecifications(nodeData);
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Display Technical Specifications section with performance characteristics
    displayTechnicalSpecifications(nodeData) {
        if (!nodeData.technical_specifications) return '';
        
        let html = `
            <div class="detail-section">
                <div class="section-header">
                    <h3>Technical Specifications</h3>
                </div>
                <div class="section-content">
        `;
        
        // Input Requirements
        if (nodeData.technical_specifications.input_requirements) {
            html += this.renderInputRequirements(nodeData.technical_specifications.input_requirements);
        }
        
        // Output Specifications
        if (nodeData.technical_specifications.output_specifications) {
            html += this.renderOutputSpecifications(nodeData.technical_specifications.output_specifications);
        }
        
        // Performance Characteristics
        if (nodeData.technical_specifications.performance_characteristics) {
            html += this.renderPerformanceCharacteristics(nodeData.technical_specifications.performance_characteristics);
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Render Input Requirements
    renderInputRequirements(inputRequirements) {
        let html = `
            <div class="detail-section subsection">
                <div class="section-header">
                    <h4>Input Requirements</h4>
                </div>
                <div class="section-content">
        `;
        
        if (Array.isArray(inputRequirements)) {
            // If it's an array of input requirements
            inputRequirements.forEach(input => {
                html += `
                    <div class="specs-box">
                        <h5>${input.name}</h5>
                        <p>${input.description || ''}</p>
                        
                        ${input.format ? 
                            `<div class="specs-detail"><strong>Format:</strong> ${input.format}</div>` : ''}
                            
                        ${input.constraints ? 
                            `<div class="specs-detail"><strong>Constraints:</strong> ${input.constraints}</div>` : ''}
                `;
                
                // Related Techniques
                if (input.related_techniques && input.related_techniques.length > 0) {
                    html += `<div class="specs-detail"><strong>Related Techniques:</strong></div>`;
                    html += `<div class="technique-links-container">`;
                    input.related_techniques.forEach(tech => {
                        // Get the technique name from the ID by extracting the last part after the dot
                        const parts = tech.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : tech;
                        
                        html += `
                            <div class="technique-tag clickable-item" data-node-id="${tech}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                // Used by Applications
                if (input.used_by_applications && input.used_by_applications.length > 0) {
                    html += `<div class="specs-detail"><strong>Used by Applications:</strong></div>`;
                    html += `<div class="application-links-container">`;
                    input.used_by_applications.forEach(app => {
                        // Get the application name from the ID by extracting the last part after the dot
                        const parts = app.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : app;
                        
                        html += `
                            <div class="application-tag clickable-item" data-node-id="${app}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                // Supports Functions
                if (input.supports_functions && input.supports_functions.length > 0) {
                    html += `<div class="specs-detail"><strong>Supports Functions:</strong></div>`;
                    html += `<div class="function-links-container">`;
                    input.supports_functions.forEach(func => {
                        // Get the function name from the ID by extracting the last part after the dot
                        const parts = func.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : func;
                        
                        html += `
                            <div class="function-tag clickable-item" data-node-id="${func}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                html += `</div>`;
            });
        } else {
            // For a single input requirement object
            html += `<p>No detailed input requirements specified.</p>`;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Render Output Specifications
    renderOutputSpecifications(outputSpecs) {
        let html = `
            <div class="detail-section subsection">
                <div class="section-header">
                    <h4>Output Specifications</h4>
                </div>
                <div class="section-content">
        `;
        
        if (Array.isArray(outputSpecs)) {
            outputSpecs.forEach(output => {
                html += `
                    <div class="specs-box">
                        <h5>${output.name}</h5>
                        <p>${output.description || ''}</p>
                        
                        ${output.format ? 
                            `<div class="specs-detail"><strong>Format:</strong> ${output.format}</div>` : ''}
                            
                        ${output.usage ? 
                            `<div class="specs-detail"><strong>Usage:</strong> ${output.usage}</div>` : ''}
                `;
                
                // Produced by techniques
                if (output.produced_by_techniques && output.produced_by_techniques.length > 0) {
                    html += `<div class="specs-detail"><strong>Produced by Techniques:</strong></div>`;
                    html += `<div class="technique-links-container">`;
                    output.produced_by_techniques.forEach(tech => {
                        // Get the technique name from the ID by extracting the last part after the dot
                        const parts = tech.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : tech;
                        
                        html += `
                            <div class="technique-tag clickable-item" data-node-id="${tech}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                // Produced by applications
                if (output.produced_by_applications && output.produced_by_applications.length > 0) {
                    html += `<div class="specs-detail"><strong>Produced by Applications:</strong></div>`;
                    html += `<div class="application-links-container">`;
                    output.produced_by_applications.forEach(app => {
                        // Get the application name from the ID by extracting the last part after the dot
                        const parts = app.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : app;
                        
                        html += `
                            <div class="application-tag clickable-item" data-node-id="${app}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                // Fulfills functions
                if (output.fulfills_functions && output.fulfills_functions.length > 0) {
                    html += `<div class="specs-detail"><strong>Fulfills Functions:</strong></div>`;
                    html += `<div class="function-links-container">`;
                    output.fulfills_functions.forEach(func => {
                        // Get the function name from the ID by extracting the last part after the dot
                        const parts = func.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1] 
                            : func;
                        
                        html += `
                            <div class="function-tag clickable-item" data-node-id="${func}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                html += `</div>`;
            });
        } else {
            html += `<p>No detailed output specifications provided.</p>`;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Render Performance Characteristics
    renderPerformanceCharacteristics(performanceChars) {
        let html = `
            <div class="detail-section subsection">
                <div class="section-header">
                    <h4>Performance Characteristics</h4>
                </div>
                <div class="section-content">
        `;
        
        if (typeof performanceChars === 'object' && performanceChars !== null) {
            const characteristics = Object.entries(performanceChars).filter(([key]) => key !== 'related_considerations');
            
            if (characteristics.length > 0) {
                characteristics.forEach(([key, value]) => {
                    html += `
                        <div class="performance-char-item">
                            <span class="performance-char-name">${this.formatTitle(key)}:</span>
                            <span class="performance-char-value">${value}</span>
                        </div>
                    `;
                });
            } else {
                html += `<p>No performance characteristics specified.</p>`;
            }
        } else {
            html += `<p>No performance characteristics specified.</p>`;
        }
        
        // Check for related considerations - ensure they're marked as clickable
        if (performanceChars && performanceChars.related_considerations) {
            html += `
                <div class="performance-char-related">
                    <div class="related-title">Related Considerations:</div>
                    <div class="consideration-links-container">
            `;
            
            if (Array.isArray(performanceChars.related_considerations)) {
                performanceChars.related_considerations.forEach(consideration => {
                    // Get the consideration name from the ID by extracting the last part after the dot
                    const parts = consideration.split('.');
                    const displayName = parts.length > 1 
                        ? parts[parts.length - 1]
                        : consideration;
                    
                    html += `
                        <div class="consideration-tag clickable-item" data-node-id="${consideration}" data-expand="true">
                            ${this.formatTitle(displayName)}
                        </div>
                    `;
                });
            } else if (typeof performanceChars.related_considerations === 'string') {
                // Handle single consideration
                const parts = performanceChars.related_considerations.split('.');
                const displayName = parts.length > 1 
                    ? parts[parts.length - 1]
                    : performanceChars.related_considerations;
                
                html += `
                    <div class="consideration-tag clickable-item" data-node-id="${performanceChars.related_considerations}" data-expand="true">
                        ${this.formatTitle(displayName)}
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    // Capability display - update to use names instead of IDs
    displayCapability(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Implements Component Capabilities
        if (nodeData.implements_component_capabilities && nodeData.implements_component_capabilities.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Implements Component Capabilities')}
                    <div class="section-content">
                        <div class="technique-links-container">
            `;
            
            nodeData.implements_component_capabilities.forEach(capId => {
                // Extract the capability name from the ID
                const parts = capId.split('.');
                const displayName = parts.length > 1 
                    ? parts[parts.length - 1]
                    : capId;
                
                html += `
                    <div class="capability-tag clickable-item" data-node-id="${capId}" data-expand="true">
                        ${this.formatTitle(displayName)}
                    </div>
                `;
            });
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Functions section
        if (nodeData.functions && nodeData.functions.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Functions')}
                    <div class="section-content">
            `;
            
            nodeData.functions.forEach(func => {
                html += `
                    <div class="function-box clickable-item" data-node-id="${func.id}" data-expand="true">
                        <h4>${func.name}</h4>
                        <p>${func.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature section (using the new common method)
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Function display - update to use names instead of IDs
    displayFunction(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Implements Component Functions
        if (nodeData.implements_component_functions && nodeData.implements_component_functions.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Implements Component Functions')}
                    <div class="section-content">
                        <div class="function-links-container">
            `;
            
            nodeData.implements_component_functions.forEach(funcId => {
                // Extract the function name from the ID
                const parts = funcId.split('.');
                const displayName = parts.length > 1 
                    ? parts[parts.length - 1]
                    : funcId;
                
                html += `
                    <div class="function-tag clickable-item" data-node-id="${funcId}" data-expand="true">
                        ${this.formatTitle(displayName)}
                    </div>
                `;
            });
            
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Specifications section
        if (nodeData.specifications && nodeData.specifications.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Specifications')}
                    <div class="section-content">
            `;
            
            nodeData.specifications.forEach(spec => {
                html += `
                    <div class="specification-box clickable-item" data-node-id="${spec.id}" data-expand="true">
                        <h4>${spec.name}</h4>
                        <p>${spec.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Specification display
    displaySpecification(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Requirements
        if (nodeData.requirements && nodeData.requirements.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Requirements</h3>
                    </div>
                    <div class="section-content">
                        <ul class="requirements-list">
            `;
            
            nodeData.requirements.forEach(req => {
                html += `<li>${req}</li>`;
            });
            
            html += `
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // Integration
        if (nodeData.integration) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Integration</h3>
                    </div>
                    <div class="section-content">
                        <div class="clickable-item" data-node-id="${nodeData.integration.id}" data-expand="true">
                            <h4>${nodeData.integration.name}</h4>
                            <p>${nodeData.integration.description || ''}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Integration display
    displayIntegration(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Techniques
        if (nodeData.techniques && nodeData.techniques.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Techniques</h3>
                    </div>
                    <div class="section-content">
            `;
            
            nodeData.techniques.forEach(technique => {
                html += `
                    <div class="technique-box clickable-item" data-node-id="${technique.id}" data-expand="true">
                        <h4>${technique.name}</h4>
                        <p>${technique.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Application display
    displayApplication(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Inputs
        if (nodeData.inputs && nodeData.inputs.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Inputs')}
                    <div class="section-content">
            `;
            
            nodeData.inputs.forEach((input, index) => {
                html += `
                    <div class="io-box">
                        <h4>${input.name}</h4>
                        <p>${input.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Outputs
        if (nodeData.outputs && nodeData.outputs.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Outputs')}
                    <div class="section-content">
            `;
            
            nodeData.outputs.forEach((output, index) => {
                html += `
                    <div class="io-box">
                        <h4>${output.name}</h4>
                        <p>${output.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Input display
    displayInput(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type || 'input'}">Type: ${this.formatTitle(nodeData.type || 'input')}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Data Type
        if (nodeData.data_type) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Data Type')}
                    <div class="section-content">
                        <p>${this.formatTitle(nodeData.data_type)}</p>
                    </div>
                </div>
            `;
        }
        
        // Constraints
        if (nodeData.constraints) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Constraints')}
                    <div class="section-content">
                        <p>${nodeData.constraints}</p>
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Output display
    displayOutput(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type || 'output'}">Type: ${this.formatTitle(nodeData.type || 'output')}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Data Type
        if (nodeData.data_type) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Data Type')}
                    <div class="section-content">
                        <p>${this.formatTitle(nodeData.data_type)}</p>
                    </div>
                </div>
            `;
        }
        
        // Interpretation
        if (nodeData.interpretation) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Interpretation')}
                    <div class="section-content">
                        <p>${nodeData.interpretation}</p>
                    </div>
                </div>
            `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Display requirements section with improved formatting - use names instead of IDs
    displayRequirementSection(title, data) {
        if (!data) return '';
        
        let html = `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${title}</h3>
                </div>
                <div class="section-content">
        `;
        
        // Check if data is an array or an object
        if (Array.isArray(data)) {
            // If it's an array, iterate through each item
            data.forEach(item => {
                html += `
                    <div class="specs-box">
                        <h5>${item.name}</h5>
                        <p>${item.description || ''}</p>
                `;
                
                // Format fields
                if (item.format) {
                    html += `<div class="specs-detail"><strong>Format:</strong> ${item.format}</div>`;
                }
                
                // Constraints fields
                if (item.constraints) {
                    html += `<div class="specs-detail"><strong>Constraints:</strong> ${item.constraints}</div>`;
                }
                
                // Related Techniques with proper format
                if (item.related_techniques && item.related_techniques.length > 0) {
                    html += `<div class="specs-detail"><strong>Related Techniques:</strong>`;
                    
                    item.related_techniques.forEach((tech, index) => {
                        // Extract the technique name from the ID
                        const parts = tech.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1]
                            : tech;
                        
                        html += `
                            <span class="technique-tag clickable-item" data-node-id="${tech}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </span>${index < item.related_techniques.length - 1 ? ' ' : ''}
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                // Used by Applications
                if (item.used_by_applications && item.used_by_applications.length > 0) {
                    html += `<div class="specs-detail"><strong>Used by Applications:</strong>`;
                    
                    item.used_by_applications.forEach((app, index) => {
                        // Extract the application name from the ID
                        const parts = app.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1]
                            : app;
                        
                        html += `
                            <span class="application-tag clickable-item" data-node-id="${app}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </span>${index < item.used_by_applications.length - 1 ? ' ' : ''}
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                // Supports Functions
                if (item.supports_functions && item.supports_functions.length > 0) {
                    html += `<div class="specs-detail"><strong>Supports Functions:</strong>`;
                    
                    item.supports_functions.forEach((func, index) => {
                        // Extract the function name from the ID
                        const parts = func.split('.');
                        const displayName = parts.length > 1 
                            ? parts[parts.length - 1]
                            : func;
                        
                        html += `
                            <span class="function-tag clickable-item" data-node-id="${func}" data-expand="true">
                                ${this.formatTitle(displayName)}
                            </span>${index < item.supports_functions.length - 1 ? ' ' : ''}
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                html += `</div>`;
            });
        } else {
            // If it's a single object, display its properties
            // Format: field (if available)
            if (data.format) {
                html += `
                    <div class="requirement-item">
                        <div class="requirement-title">Format:</div>
                        <div class="requirement-value">${data.format}</div>
                    </div>
                `;
            }
            
            // Constraints: field (if available)
            if (data.constraints) {
                html += `
                    <div class="requirement-item">
                        <div class="requirement-title">Constraints:</div>
                        <div class="requirement-value">${data.constraints}</div>
                    </div>
                `;
            }
            
            // Related Techniques: field (if available) as clickable links
            if (data.related_techniques && data.related_techniques.length > 0) {
                html += `<div class="requirement-item">
                    <div class="requirement-title">Related Techniques:</div>
                    <div class="requirement-value technique-links">`;
                
                // Format each technique as a proper clickable link with name format
                data.related_techniques.forEach(technique => {
                    // Extract the technique name from the ID
                    const parts = technique.split('.');
                    const displayName = parts.length > 1 
                        ? parts[parts.length - 1]
                        : technique;
                    
                    html += `
                        <div class="clickable-item technique-tag" data-node-id="${technique}" data-expand="true">
                            ${this.formatTitle(displayName)}
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
            
            // Used by Applications: field (if available) as clickable links
            if (data.used_by_applications && data.used_by_applications.length > 0) {
                html += `<div class="requirement-item">
                    <div class="requirement-title">Used by Applications:</div>
                    <div class="requirement-value application-links">`;
                
                // Format each application as a proper clickable link with name format
                data.used_by_applications.forEach(application => {
                    // Extract the application name from the ID
                    const parts = application.split('.');
                    const displayName = parts.length > 1 
                        ? parts[parts.length - 1]
                        : application;
                    
                    html += `
                        <div class="clickable-item application-tag" data-node-id="${application}" data-expand="true">
                            ${this.formatTitle(displayName)}
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
            
            // Supports Functions: field (if available) as clickable links
            if (data.supports_functions && data.supports_functions.length > 0) {
                html += `<div class="requirement-item">
                    <div class="requirement-title">Supports Functions:</div>
                    <div class="requirement-value function-links">`;
                
                // Format each function as a proper clickable link with name format
                data.supports_functions.forEach(func => {
                    // Extract the function name from the ID
                    const parts = func.split('.');
                    const displayName = parts.length > 1 
                        ? parts[parts.length - 1]
                        : func;
                    
                    html += `
                        <div class="clickable-item function-tag" data-node-id="${func}" data-expand="true">
                            ${this.formatTitle(displayName)}
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    // Display for Technique node - update to use names instead of IDs
    displayTechnique(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Name and description
        html += `
            <div class="detail-section">
                <div class="section-header">
                    <h3>${nodeData.name}</h3>
                </div>
                <div class="section-content">
                    <p>${nodeData.description || ''}</p>
                </div>
            </div>
        `;
        
        // Implementation Details
        if (nodeData.implementation_details) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Implementation Details</h3>
                    </div>
                    <div class="section-content">
                        <p>${nodeData.implementation_details}</p>
                    </div>
                </div>
            `;
        }
        
        // Applications using this technique
        if (nodeData.used_by_applications && nodeData.used_by_applications.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="section-header">
                        <h3>Used By Applications</h3>
                    </div>
                    <div class="section-content">
                        <div class="application-links-container">
            `;
            
            nodeData.used_by_applications.forEach(applicationId => {
                // Extract application name from ID
                const parts = applicationId.split('.');
                const displayName = parts.length > 1 
                    ? parts[parts.length - 1]
                    : applicationId;
                
                html += `
                    <div class="application-tag clickable-item" data-node-id="${applicationId}" data-expand="true">
                        ${this.formatTitle(displayName)}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            </div>
        `;
        }
        
        // Literature References
        html += this.renderLiteratureSection(nodeData);
        
        return html;
    }

    // Helper method to generate literature section for any node type
    renderLiteratureSection(nodeData) {
        let html = '';
        let references = [];
        
        // Check for different literature formats based on node type
        if (nodeData.literature && nodeData.literature.references && nodeData.literature.references.length > 0) {
            // Component group and other nodes with full literature object
            references = nodeData.literature.references;
        } else if (nodeData.literature && Array.isArray(nodeData.literature)) {
            // Some nodes might have literature as direct array
            references = nodeData.literature;
        } else if (nodeData.bibliography && Array.isArray(nodeData.bibliography)) {
            // Some nodes might use bibliography instead of literature
            references = nodeData.bibliography;
        } else if (nodeData.bibliography && nodeData.bibliography.references && Array.isArray(nodeData.bibliography.references)) {
            // Nested bibliography.references format
            references = nodeData.bibliography.references;
        } else if (nodeData.citation_keys && Array.isArray(nodeData.citation_keys)) {
            // Some nodes use citation_keys
            references = nodeData.citation_keys.map(key => ({
                id: key,
                title: this.formatCitationKey(key),
                isReferenceId: true
            }));
        } else if (nodeData.supported_by_literature && nodeData.supported_by_literature.length > 0) {
            // Capability nodes with supported_by_literature array
            references = nodeData.supported_by_literature.map(litId => {
                // For string references, create a simple object
                if (typeof litId === 'string') {
                    return { 
                        id: litId, 
                        title: this.formatCitationKey(litId),
                        isReferenceId: true  // Flag to indicate this is just an ID
                    };
                }
                return litId;
            });
        } else if (nodeData.literature_references && nodeData.literature_references.length > 0) {
            // Nodes with literature_references array
            references = nodeData.literature_references.map(ref => {
                if (typeof ref === 'string') {
                    return { 
                        id: ref, 
                        title: this.formatCitationKey(ref),
                        isReferenceId: true
                    };
                }
                return ref;
            });
        } else if (nodeData.references && Array.isArray(nodeData.references)) {
            // Some nodes might simply use "references"
            references = nodeData.references;
        }
        
        // If we found references, create the section
        if (references && references.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Literature References')}
                    <div class="section-content">
            `;
            
            references.forEach(reference => {
                // Check if this is a full reference object or just an ID
                if (typeof reference === 'object' && reference !== null) {
                    if (reference.isReferenceId) {
                        // This is a simple reference ID - show it with a note
                        html += `
                            <div class="reference-item">
                                <div class="ref-header">${reference.title}</div>
                                <div class="ref-body">
                                    <em>Reference ID</em>
                                </div>
                            </div>
                        `;
                    } else {
                        // This is a complete reference object
                        html += this.createLiteratureItem(reference);
                    }
                } else if (typeof reference === 'string') {
                    // Simple string reference
                    html += `
                        <div class="reference-item">
                            <div class="ref-header">${this.formatCitationKey(reference)}</div>
                            <div class="ref-body">
                                <em>Reference ID</em>
                            </div>
                        </div>
                    `;
                }
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    // Helper to make citation keys more readable
    formatCitationKey(key) {
        if (!key) return '';
        
        // If it looks like "Author2023", split into "Author (2023)"
        const match = key.match(/^([A-Za-z]+)(\d{4})([a-z])?$/);
        if (match) {
            const [_, author, year, suffix] = match;
            return `${author} (${year}${suffix || ''})`;
        }
        
        // If it's "author_year" format
        const underscoreMatch = key.match(/^([A-Za-z]+)_(\d{4})([a-z])?$/);
        if (underscoreMatch) {
            const [_, author, year, suffix] = underscoreMatch;
            return `${author} (${year}${suffix || ''})`;
        }
        
        // If it has dots or underscores, replace with spaces and capitalize words
        if (key.includes('.') || key.includes('_')) {
            return key.replace(/[._]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
        
        // Otherwise just return the key
        return key;
    }

    // Setup click events for clickable items in the details panel - improve for better compatibility
    setupClickableItems(container) {
        // Find all clickable items
        const clickableItems = container.querySelectorAll('.clickable-item, .subcomponent-link, .function-link, .technique-link, .consideration-tag');
        
        // Add click handler to each
        clickableItems.forEach(item => {
            // Skip if it already has a click handler
            if (item.__clickHandlerAdded) return;
            
            // Add click handler
            item.addEventListener('click', () => {
                const nodeId = item.dataset.nodeId;
                if (!nodeId) {
                    console.warn('Clickable item has no nodeId', item);
                    return;
                }
                
                console.log(`Clicking on clickable item ${nodeId}`);
                
                // Always force expand the node when clicked in details panel
                const shouldExpand = item.dataset.expand === "true";
                
                // Find node in the graph data
                if (window.visualization?.graphData?.nodes) {
                    const nodeData = window.visualization.graphData.nodes.find(n => n.id === nodeId);
                    if (nodeData) {
                        console.log(`Found node ${nodeData.name} (${nodeData.id}) with expand=${shouldExpand}`);
                        
                        // If we should expand and node is not already expanded, expand it
                        if (shouldExpand && !window.visualization.expandedNodes.has(nodeId)) {
                            console.log(`Expanding node ${nodeData.id}`);
                            window.visualization.expandedNodes.add(nodeId);
                            
                            try {
                                // If node has a parent, ensure parent is expanded too
                                window.visualization.ensureNodeVisible(nodeData);
                                
                                // Update the visualization with new expanded nodes
                                const visibleNodes = window.visualization.getVisibleNodes();
                                window.visualization.positionNodes(visibleNodes);
                                window.visualization.createNodeObjects(visibleNodes);
                                window.visualization.createLinkObjects(window.visualization.getVisibleLinks(visibleNodes));
                                window.visualization.setupNodeAnimations(visibleNodes);
                            } catch (error) {
                                console.error('Error expanding node:', error);
                            }
                        }
                        
                        // Navigate to this node
                        try {
                            window.visualization.selectNode(nodeData);
                        } catch (error) {
                            console.error('Error selecting node:', error);
                            // Fall back to fetch and display node details directly
                            window.visualization.fetchNodeDetails(nodeId)
                                .then(data => {
                                    if (data) {
                                        window.visualization.displayNodeDetails(data);
                                    }
                                })
                                .catch(err => console.error('Failed to fetch node details:', err));
                        }
                    } else {
                        console.warn(`Node with ID ${nodeId} not found in graph data, attempting direct API call`);
                        // Try to fetch node details directly
                        window.visualization.fetchNodeDetails(nodeId)
                            .then(data => {
                                if (data) {
                                    window.visualization.displayNodeDetails(data);
                                }
                            })
                            .catch(err => console.error('Failed to fetch node details:', err));
                    }
                } else {
                    console.warn("Graph data not accessible through window.visualization");
                }
            });
            
            // Mark this item as having a click handler
            item.__clickHandlerAdded = true;
        });
    }
}

// Create a singleton instance of the renderer
const nodeDetailsRenderer = new NodeDetailsRenderer(); 