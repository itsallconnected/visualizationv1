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
            <div class="clickable-item ${additionalClasses}" data-node-id="${node.id}">
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
        const url = reference.url ? `<a href="${reference.url}" target="_blank">Link</a>` : '';
        
        return `
            <div class="reference-item">
                <div class="ref-header">${title}</div>
                <div class="ref-body">
                    ${authors} ${year} ${url}
                </div>
            </div>
        `;
    }

    // Main render function
    renderNodeDetails(nodeData) {
        if (!nodeData || !nodeData.type) {
            return '<div class="error-message"><h3>Error</h3><p>Invalid node data</p></div>';
        }

        // Use the appropriate display function for this node type
        const displayFunction = this.displayRegistry[nodeData.type];
        if (displayFunction) {
            return displayFunction(nodeData);
        }
        
        // Fallback for unknown node types
        return this.displayGeneric(nodeData);
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
        if (nodeData.literature && nodeData.literature.references && nodeData.literature.references.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Literature References')}
                    <div class="section-content">
            `;
            
            nodeData.literature.references.forEach(reference => {
                html += this.createLiteratureItem(reference);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Component display (e.g., democratic-alignment.json)
    displayComponent(nodeData) {
        let html = '';
        
        // Title and Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Description
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
        
        // Overview section
        if (nodeData.overview) {
            html += `<div class="detail-section">${this.createSectionHeader('Overview')}</div>`;
            
            // Purpose
            if (nodeData.overview.purpose) {
                html += `
                    <div class="detail-section">
                        ${this.createSectionHeader('Purpose')}
                        <div class="section-content">
                            <p>${nodeData.overview.purpose}</p>
                        </div>
                    </div>
                `;
            }
            
            // Key Capabilities
            if (nodeData.overview.key_capabilities && nodeData.overview.key_capabilities.length > 0) {
                html += `
                    <div class="detail-section">
                        ${this.createSectionHeader('Key Capabilities')}
                        <div class="section-content">
                `;
                
                nodeData.overview.key_capabilities.forEach((capability, index) => {
                    const subcomponents = capability.implemented_by_subcomponents || [];
                    const subcomponentLinks = subcomponents.length > 0 ? 
                        `<div class="implementation-links">
                            ${subcomponents.map((sc, idx) => 
                                `<span class="subcomponent-link" data-node-id="${sc}">${idx + 1}</span>`
                            ).join(', ')}
                        </div>` : '';
                    
                    html += `
                        <div class="capability-box">
                            <h4>${capability.name}</h4>
                            <p>${capability.description || ''}</p>
                            ${subcomponentLinks}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
            
            // Primary Functions
            if (nodeData.overview.primary_functions && nodeData.overview.primary_functions.length > 0) {
                html += `
                    <div class="detail-section">
                        ${this.createSectionHeader('Primary Functions')}
                        <div class="section-content">
                `;
                
                nodeData.overview.primary_functions.forEach((func, index) => {
                    const subcomponents = func.implemented_by_subcomponents || [];
                    const subcomponentLinks = subcomponents.length > 0 ? 
                        `<div class="implementation-links">
                            ${subcomponents.map((sc, idx) => 
                                `<span class="subcomponent-link" data-node-id="${sc}">${idx + 1}</span>`
                            ).join(', ')}
                        </div>` : '';
                    
                    html += `
                        <div class="function-box">
                            <h4>${func.name}</h4>
                            <p>${func.description || ''}</p>
                            ${subcomponentLinks}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        }
        
        // Capabilities section
        if (nodeData.capabilities && nodeData.capabilities.items && nodeData.capabilities.items.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Capabilities')}
                    <div class="section-content">
            `;
            
            nodeData.capabilities.items.forEach(capability => {
                const subcomponents = capability.implemented_by_subcomponents || [];
                const subcomponentLinks = subcomponents.length > 0 ? 
                    `<div class="implementation-links">
                        <strong>Implemented by:</strong> 
                        ${subcomponents.map((sc, idx) => 
                            `<span class="subcomponent-link" data-node-id="${sc}">${idx + 1}</span>`
                        ).join(', ')}
                    </div>` : '';
                
                const subcomponentFunctions = capability.implements_subcomponent_functions || [];
                const functionLinks = subcomponentFunctions.length > 0 ? 
                    `<div class="implementation-links">
                        <strong>Implements functions:</strong> 
                        ${subcomponentFunctions.map((func, idx) => 
                            `<span class="function-link" data-node-id="${func}">${idx + 1}</span>`
                        ).join(', ')}
                    </div>` : '';
                
                html += `
                    <div class="capability-box">
                        <h4>${capability.name}</h4>
                        <p>${capability.description || ''}</p>
                        ${subcomponentLinks}
                        ${functionLinks}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Functions section
        if (nodeData.functions && nodeData.functions.items && nodeData.functions.items.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Functions')}
                    <div class="section-content">
            `;
            
            nodeData.functions.items.forEach(func => {
                const subcomponents = func.implemented_by_subcomponents || [];
                const subcomponentLinks = subcomponents.length > 0 ? 
                    `<div class="implementation-links">
                        <strong>Implemented by:</strong> 
                        ${subcomponents.map((sc, idx) => 
                            `<span class="subcomponent-link" data-node-id="${sc}">${idx + 1}</span>`
                        ).join(', ')}
                    </div>` : '';
                
                html += `
                    <div class="function-box">
                        <h4>${func.name}</h4>
                        <p>${func.description || ''}</p>
                        ${subcomponentLinks}
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
                    ${this.createSectionHeader('Integration Approaches')}
                    <div class="section-content">
            `;
            
            nodeData.integration_approaches.forEach(approach => {
                const techniques = approach.implemented_by_techniques || [];
                const techniqueLinks = techniques.length > 0 ? 
                    `<div class="implementation-links">
                        <strong>Implemented by:</strong> 
                        ${techniques.map((tech, idx) => 
                            `<span class="technique-link" data-node-id="${tech}">${idx + 1}</span>`
                        ).join(', ')}
                    </div>` : '';
                
                html += `
                    <div class="approach-box">
                        <h4>${approach.name}</h4>
                        <p>${approach.description || ''}</p>
                        ${techniqueLinks}
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
                    ${this.createSectionHeader('Integration Considerations')}
                    <div class="section-content">
            `;
            
            nodeData.integration_considerations.forEach(consideration => {
                html += `
                    <div class="consideration-box">
                        <h4>${consideration.name}</h4>
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
        if (nodeData.metadata && nodeData.metadata.key_considerations) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Key Considerations')}
                    <div class="section-content">
            `;
            
            for (const [key, value] of Object.entries(nodeData.metadata.key_considerations)) {
                html += `
                    <div class="key-consideration">
                        <h4>${this.formatTitle(key)}:</h4>
                        <p>${value}</p>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Subcomponent display (e.g., deliberative-capacity-building.json)
    displaySubcomponent(nodeData) {
        let html = '';
        
        // Type badge
        html += `<div class="node-type-badge ${nodeData.type}">Type: ${this.formatTitle(nodeData.type)}</div>`;
        
        // Description
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
        
        // Capabilities section
        if (nodeData.capabilities && nodeData.capabilities.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Capabilities')}
                    <div class="section-content">
            `;
            
            nodeData.capabilities.forEach(capability => {
                html += `
                    <div class="capability-box clickable-item" data-node-id="${capability.id}">
                        <h4>${capability.name}</h4>
                        <p>${capability.description || ''}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Implementation Considerations section
        if (nodeData.implementation_considerations && nodeData.implementation_considerations.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Implementation Considerations')}
                    <div class="section-content">
            `;
            
            nodeData.implementation_considerations.forEach(consideration => {
                html += `
                    <div class="consideration-box">
                        <h4>${consideration.name}</h4>
                        <p>${consideration.aspect || ''}</p>
                        <ul>
                            ${consideration.considerations ? 
                              consideration.considerations.map(item => `<li>${item}</li>`).join('') : ''}
                        </ul>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Technical Specifications section
        if (nodeData.technical_specifications) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Technical Specifications')}
                    <div class="section-content">
            `;
            
            // Input Requirements
            if (nodeData.technical_specifications.input_requirements && 
                nodeData.technical_specifications.input_requirements.length > 0) {
                html += `
                    <div class="tech-specs-section">
                        <h4>Input Requirements</h4>
                        <div class="specs-items">
                `;
                
                nodeData.technical_specifications.input_requirements.forEach(input => {
                    html += `
                        <div class="specs-box">
                            <h5>${input.name}</h5>
                            <p>${input.description || ''}</p>
                            <div class="specs-details">
                                <div><strong>Format:</strong> ${input.format || ''}</div>
                                <div><strong>Constraints:</strong> ${input.constraints || ''}</div>
                            </div>
                            ${input.related_techniques ? 
                              `<div><strong>Related Techniques:</strong> ${input.related_techniques.join(', ')}</div>` : ''}
                            ${input.used_by_applications ? 
                              `<div><strong>Used by Applications:</strong> ${input.used_by_applications.join(', ')}</div>` : ''}
                            ${input.supports_functions ? 
                              `<div><strong>Supports Functions:</strong> ${input.supports_functions.join(', ')}</div>` : ''}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
            
            // Output Specifications
            if (nodeData.technical_specifications.output_specifications && 
                nodeData.technical_specifications.output_specifications.length > 0) {
                html += `
                    <div class="tech-specs-section">
                        <h4>Output Specifications</h4>
                        <div class="specs-items">
                `;
                
                nodeData.technical_specifications.output_specifications.forEach(output => {
                    html += `
                        <div class="specs-box">
                            <h5>${output.name}</h5>
                            <p>${output.description || ''}</p>
                            <div class="specs-details">
                                <div><strong>Format:</strong> ${output.format || ''}</div>
                                <div><strong>Usage:</strong> ${output.usage || ''}</div>
                            </div>
                            ${output.produced_by_techniques ? 
                              `<div><strong>Produced by Techniques:</strong> ${output.produced_by_techniques.join(', ')}</div>` : ''}
                            ${output.produced_by_applications ? 
                              `<div><strong>Produced by Applications:</strong> ${output.produced_by_applications.join(', ')}</div>` : ''}
                            ${output.fulfills_functions ? 
                              `<div><strong>Fulfills Functions:</strong> ${output.fulfills_functions.join(', ')}</div>` : ''}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
            
            // Performance Characteristics
            if (nodeData.technical_specifications.performance_characteristics) {
                const perfChars = nodeData.technical_specifications.performance_characteristics;
                html += `
                    <div class="tech-specs-section">
                        <h4>Performance Characteristics</h4>
                        <div class="performance-chars">
                            ${perfChars.throughput ? `<div><strong>Throughput:</strong> ${perfChars.throughput}</div>` : ''}
                            ${perfChars.latency ? `<div><strong>Latency:</strong> ${perfChars.latency}</div>` : ''}
                            ${perfChars.scalability ? `<div><strong>Scalability:</strong> ${perfChars.scalability}</div>` : ''}
                            ${perfChars.resource_utilization ? `<div><strong>Resource Utilization:</strong> ${perfChars.resource_utilization}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Literature section
        if (nodeData.literature && nodeData.literature.references && nodeData.literature.references.length > 0) {
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Literature')}
                    <div class="section-content">
            `;
            
            nodeData.literature.references.forEach(reference => {
                html += this.createLiteratureItem(reference);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Capability display
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
            `;
            
            nodeData.implements_component_capabilities.forEach(capability => {
                html += `
                    <div class="clickable-item" data-node-id="${capability}">
                        ${capability}
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
                    ${this.createSectionHeader('Functions')}
                    <div class="section-content">
            `;
            
            nodeData.functions.forEach(func => {
                html += `
                    <div class="function-box clickable-item" data-node-id="${func.id}">
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
        
        // Literature section
        if (nodeData.supported_by_literature && nodeData.supported_by_literature.length > 0) {
            // Get parent node to find literature references
            // This is somewhat complex as we need to look up literature from the parent subcomponent
            html += `
                <div class="detail-section">
                    ${this.createSectionHeader('Literature')}
                    <div class="section-content">
            `;
            
            nodeData.supported_by_literature.forEach(literatureId => {
                html += `
                    <div class="reference-item">
                        <div class="ref-header">${literatureId}</div>
                        <div class="ref-body">
                            <em>Literature reference from parent subcomponent</em>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Function display
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
            `;
            
            nodeData.implements_component_functions.forEach(func => {
                html += `
                    <div class="clickable-item" data-node-id="${func}">
                        ${func}
                    </div>
                `;
            });
            
            html += `
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
                    <div class="specification-box clickable-item" data-node-id="${spec.id}">
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
                    ${this.createSectionHeader('Requirements')}
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
                    ${this.createSectionHeader('Integration')}
                    <div class="section-content">
                        <div class="clickable-item" data-node-id="${nodeData.integration.id}">
                            <h4>${nodeData.integration.name}</h4>
                            <p>${nodeData.integration.description || ''}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
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
                    ${this.createSectionHeader('Techniques')}
                    <div class="section-content">
            `;
            
            nodeData.techniques.forEach(technique => {
                html += `
                    <div class="technique-box clickable-item" data-node-id="${technique.id}">
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
                    <div class="io-box clickable-item" data-node-id="${input.id || `input-${index}`}">
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
                    <div class="io-box clickable-item" data-node-id="${output.id || `output-${index}`}">
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
        
        return html;
    }
}

// Create a singleton instance of the renderer
const nodeDetailsRenderer = new NodeDetailsRenderer(); 