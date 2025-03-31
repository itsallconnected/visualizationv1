from flask import Flask, render_template, jsonify, request
import json
import os
import glob
import logging
import node_details_helper

class AIAlignmentVisualizer:
    def __init__(self):
        self.app = Flask(__name__, static_url_path='/static', static_folder='static')
        self.setup_logging()
        self.setup_paths()
        self.setup_routes()
        
    def setup_logging(self):
        if not os.path.exists('logs'):
            os.mkdir('logs')
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        handler.setLevel(logging.DEBUG)
        self.app.logger.addHandler(handler)
        self.app.logger.setLevel(logging.DEBUG)
        self.app.logger.info('AI Alignment Visualization startup')
        
    def setup_paths(self):
        self.APP_DIR = os.path.abspath(os.path.dirname(__file__))
        self.PARENT_DIR = os.path.abspath(os.path.join(self.APP_DIR, ".."))
        self.COMPONENTS_DIR = os.path.normpath(os.path.join(self.PARENT_DIR, "components"))
        self.SUBCOMPONENTS_DIR = os.path.normpath(os.path.join(self.PARENT_DIR, "subcomponents"))
        self.ROOT_JSON_FILE = os.path.normpath(os.path.join(self.PARENT_DIR, "ai-alignment.json"))
        
    def setup_routes(self):
        self.app.route('/')(self.index)
        self.app.route('/api/graph')(self.graph)
        self.app.route('/api/hierarchy-path/<node_id>')(self.hierarchy_path)
        self.app.route('/api/health')(self.health_check)
        self.app.route('/api/root')(self.root_details)
        self.app.route('/api/details/<node_id>')(self.node_details)
        
    def run(self, host='0.0.0.0', port=3000, debug=True):
        self.app.run(host=host, port=port, debug=debug)
        
    def index(self):
        return render_template('index.html')
        
    def graph(self):
        try:
            graph_data = self.build_graph_data()
            self.app.logger.info(f"Returning graph with {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
            return jsonify(graph_data)
        except Exception as e:
            self.app.logger.error(f"Error generating graph data: {str(e)}")
            return jsonify({"error": str(e), "nodes": [], "links": []}), 500
            
    def node_details(self, node_id):
        try:
            self.app.logger.info(f"Getting details for node: {node_id}")
            result, status_code = node_details_helper.get_node_details(node_id)
            if status_code == 200:
                return jsonify(result)
            else:
                return jsonify(result), status_code
        except Exception as e:
            error_msg = f"Error getting node details for {node_id}: {str(e)}"
            self.app.logger.error(error_msg)
            return jsonify({
                "error": error_msg,
                "id": node_id,
                "name": "Error Loading Node",
                "description": "Could not load node details",
                "type": "error"
            }), 500

    def hierarchy_path(self, node_id):
        """Returns the path from root to the specified node."""
        graph_data = self.build_graph_data()
        
        # Find the node
        target_node = None
        for node in graph_data["nodes"]:
            if node["id"] == node_id:
                target_node = node
                break
        
        if not target_node:
            return jsonify({"error": "Node not found"}), 404
        
        # Build the path
        path = [{"id": target_node["id"], "name": target_node["name"], "type": target_node["type"]}]
        
        # Traverse up the hierarchy
        current_node = target_node
        while "parent" in current_node:
            parent_id = current_node["parent"]
            parent_node = None
            
            for node in graph_data["nodes"]:
                if node["id"] == parent_id:
                    parent_node = node
                    break
            
            if parent_node:
                path.insert(0, {"id": parent_node["id"], "name": parent_node["name"], "type": parent_node["type"]})
                current_node = parent_node
            else:
                break
        
        return jsonify({"path": path})

    def health_check(self):
        """Check the health of the application and JSON file loading."""
        try:
            health_status = {
                "status": "ok",
                "root_data": False,
                "components": [],
                "subcomponents": [],
                "errors": []
            }
            
            # Check root data
            root_data = self.get_root_data()
            if root_data:
                health_status["root_data"] = True
            else:
                health_status["errors"].append(f"Failed to load root data from {self.ROOT_JSON_FILE}")
                
            # Check components
            if os.path.isdir(self.COMPONENTS_DIR):
                component_files = glob.glob(os.path.join(self.COMPONENTS_DIR, "*.json"))
                for file_path in component_files:
                    component_id = os.path.basename(file_path).replace(".json", "")
                    try:
                        data = self.load_json_file(file_path)
                        if data:
                            health_status["components"].append({
                                "id": component_id,
                                "status": "loaded",
                                "file": file_path
                            })
                        else:
                            health_status["components"].append({
                                "id": component_id,
                                "status": "failed",
                                "file": file_path
                            })
                            health_status["errors"].append(f"Failed to load component: {file_path}")
                    except Exception as e:
                        health_status["components"].append({
                            "id": component_id,
                            "status": "error",
                            "file": file_path,
                            "error": str(e)
                        })
                        health_status["errors"].append(f"Error loading component {file_path}: {str(e)}")
            else:
                health_status["errors"].append(f"Components directory not found: {self.COMPONENTS_DIR}")
                
            # Check subcomponents
            if os.path.isdir(self.SUBCOMPONENTS_DIR):
                subcomponent_files = glob.glob(os.path.join(self.SUBCOMPONENTS_DIR, "*.json"))
                for file_path in subcomponent_files:
                    subcomp_id = os.path.basename(file_path).replace(".json", "")
                    try:
                        data = self.load_json_file(file_path)
                        if data:
                            health_status["subcomponents"].append({
                                "id": subcomp_id,
                                "status": "loaded",
                                "file": file_path
                            })
                        else:
                            health_status["subcomponents"].append({
                                "id": subcomp_id,
                                "status": "failed",
                                "file": file_path
                            })
                            health_status["errors"].append(f"Failed to load subcomponent: {file_path}")
                    except Exception as e:
                        health_status["subcomponents"].append({
                            "id": subcomp_id,
                            "status": "error",
                            "file": file_path,
                            "error": str(e)
                        })
                        health_status["errors"].append(f"Error loading subcomponent {file_path}: {str(e)}")
            else:
                health_status["errors"].append(f"Subcomponents directory not found: {self.SUBCOMPONENTS_DIR}")
                
            if health_status["errors"]:
                health_status["status"] = "error"
                return jsonify(health_status), 500
                
            return jsonify(health_status)
            
        except Exception as e:
            return jsonify({
                "status": "error",
                "error": str(e)
            }), 500

    def build_graph_data(self):
        """Build visualization graph data with nodes and links."""
        # Get data sources
        root_data = self.get_root_data()
        components = self.get_components()
        subcomponents = self.get_subcomponents()
        
        # Create nodes and links with optimized data structures
        nodes = []
        links = []
        node_map = {}  # For faster lookups
        
        # Add root node
        root_node = {
            "id": root_data["id"],
            "name": root_data["name"],
            "type": "component_group",
            "description": root_data["description"],
            "level": 0,
            "expandable": True,
            "has_children": bool(components)  # Faster than len() check
        }
        nodes.append(root_node)
        node_map[root_data["id"]] = root_node
        
        # Add component nodes with batch processing
        for component_id, component in components.items():
            # Check if this component has any subcomponents - use set for faster lookup
            component_subcomponents = {s_id: s for s_id, s in subcomponents.items() 
                                    if "parent" in s and s["parent"] == component_id}
            has_children = bool(component_subcomponents)
            
            component_node = {
                "id": component_id,
                "name": component["name"],
                "type": "component",
                "description": component.get("description", ""),
                "parent": root_data["id"],
                "level": 1,
                "expandable": has_children,
                "has_children": has_children
            }
            nodes.append(component_node)
            node_map[component_id] = component_node
            
            # Add link from root to component
            links.append({
                "source": root_data["id"],
                "target": component_id,
                "type": "contains"
            })
            
            # Process subcomponents in batches
            for subcomp_id, subcomp in component_subcomponents.items():
                capabilities = []
                if "capabilities" in subcomp:
                    if isinstance(subcomp["capabilities"], list):
                        capabilities = subcomp["capabilities"]
                    elif isinstance(subcomp["capabilities"], dict) and "items" in subcomp["capabilities"]:
                        capabilities = subcomp["capabilities"]["items"]
                
                has_children = bool(capabilities)
                
                subcomp_node = {
                    "id": subcomp_id,
                    "name": subcomp.get("name", subcomp_id),
                    "type": "subcomponent",
                    "description": subcomp.get("description", ""),
                    "parent": component_id,
                    "level": 2,
                    "expandable": has_children,
                    "has_children": has_children
                }
                nodes.append(subcomp_node)
                node_map[subcomp_id] = subcomp_node
                
                links.append({
                    "source": component_id,
                    "target": subcomp_id,
                    "type": "contains"
                })
                
                # Now add capabilities and their deeper descendants
                for capability in capabilities:
                    if not isinstance(capability, dict):
                        continue
                        
                    capability_id = capability.get("id", f"{subcomp_id}-capability-{len(nodes)}")
                    functions = capability.get("functions", [])
                    has_capability_children = bool(functions)
                    
                    capability_node = {
                        "id": capability_id,
                        "name": capability.get("name", "Capability"),
                        "type": "capability",
                        "description": capability.get("description", ""),
                        "parent": subcomp_id,
                        "level": 3,
                        "expandable": has_capability_children,
                        "has_children": has_capability_children
                    }
                    
                    nodes.append(capability_node)
                    node_map[capability_id] = capability_node
                    
                    links.append({
                        "source": subcomp_id,
                        "target": capability_id,
                        "type": "has_capability"
                    })
                    
                    # Add functions
                    for function in functions:
                        if not isinstance(function, dict):
                            continue
                            
                        function_id = function.get("id", f"{capability_id}-function-{len(nodes)}")
                        specifications = function.get("specifications", [])
                        has_function_children = bool(specifications)
                        
                        function_node = {
                            "id": function_id,
                            "name": function.get("name", "Function"),
                            "type": "function",
                            "description": function.get("description", ""),
                            "parent": capability_id,
                            "level": 4,
                            "expandable": has_function_children,
                            "has_children": has_function_children
                        }
                        
                        nodes.append(function_node)
                        node_map[function_id] = function_node
                        
                        links.append({
                            "source": capability_id,
                            "target": function_id,
                            "type": "has_function"
                        })
                        
                        # Add specifications
                        for spec in specifications:
                            if not isinstance(spec, dict):
                                continue
                                
                            spec_id = spec.get("id", f"{function_id}-spec-{len(nodes)}")
                            integration = spec.get("integration")
                            has_spec_children = bool(integration)
                            
                            spec_node = {
                                "id": spec_id,
                                "name": spec.get("name", "Specification"),
                                "type": "specification",
                                "description": spec.get("description", ""),
                                "parent": function_id,
                                "level": 5,
                                "expandable": has_spec_children,
                                "has_children": has_spec_children
                            }
                            
                            nodes.append(spec_node)
                            node_map[spec_id] = spec_node
                            
                            links.append({
                                "source": function_id,
                                "target": spec_id,
                                "type": "has_specification"
                            })
                            
                            # Add integration if present
                            if integration and isinstance(integration, dict):
                                integration_id = integration.get("id", f"{spec_id}-integration-{len(nodes)}")
                                techniques = integration.get("techniques", [])
                                has_integration_children = bool(techniques)
                                
                                integration_node = {
                                    "id": integration_id,
                                    "name": integration.get("name", "Integration"),
                                    "type": "integration",
                                    "description": integration.get("description", ""),
                                    "parent": spec_id,
                                    "level": 6,
                                    "expandable": has_integration_children,
                                    "has_children": has_integration_children
                                }
                                
                                nodes.append(integration_node)
                                node_map[integration_id] = integration_node
                                
                                links.append({
                                    "source": spec_id,
                                    "target": integration_id,
                                    "type": "has_integration"
                                })
                                
                                # Add techniques 
                                for technique in techniques:
                                    if not isinstance(technique, dict):
                                        continue
                                        
                                    technique_id = technique.get("id", f"{integration_id}-technique-{len(nodes)}")
                                    applications = technique.get("applications", [])
                                    has_technique_children = bool(applications)
                                    
                                    technique_node = {
                                        "id": technique_id,
                                        "name": technique.get("name", "Technique"),
                                        "type": "technique",
                                        "description": technique.get("description", ""),
                                        "parent": integration_id,
                                        "level": 7,
                                        "expandable": has_technique_children,
                                        "has_children": has_technique_children
                                    }
                                    
                                    nodes.append(technique_node)
                                    node_map[technique_id] = technique_node
                                    
                                    links.append({
                                        "source": integration_id,
                                        "target": technique_id,
                                        "type": "has_technique"
                                    })
                                    
                                    # Add applications (deeper level)
                                    for app in applications:
                                        if not isinstance(app, dict):
                                            continue
                                            
                                        app_id = app.get("id", f"{technique_id}-app-{len(nodes)}")
                                        
                                        # Get inputs and directly extract outputs
                                        inputs = app.get("inputs", [])
                                        standalone_outputs = app.get("outputs", [])  # Some apps have direct outputs
                                        nested_outputs = []  # Outputs from inputs
                                        
                                        # Extract all outputs from inputs
                                        for input_item in inputs:
                                            if isinstance(input_item, dict) and "outputs" in input_item:
                                                input_outputs = input_item.get("outputs", [])
                                                if isinstance(input_outputs, list):
                                                    nested_outputs.extend(input_outputs)
                                                elif isinstance(input_outputs, dict):
                                                    nested_outputs.append(input_outputs)
                                        
                                        # Combine all outputs
                                        outputs = standalone_outputs + nested_outputs
                                        
                                        # Ensure uniqueness by ID
                                        unique_outputs = []
                                        output_ids = set()
                                        for output in outputs:
                                            if not isinstance(output, dict):
                                                continue
                                            output_id = output.get("id")
                                            if output_id and output_id not in output_ids:
                                                output_ids.add(output_id)
                                                unique_outputs.append(output)
                                            elif not output_id:  # If no ID, include anyway
                                                unique_outputs.append(output)
                                        
                                        outputs = unique_outputs
                                        has_app_children = bool(inputs) or bool(outputs)
                                        
                                        app_node = {
                                            "id": app_id,
                                            "name": app.get("name", "Application"),
                                            "type": "application",
                                            "description": app.get("description", ""),
                                            "parent": technique_id,
                                            "level": 8,
                                            "expandable": has_app_children,
                                            "has_children": has_app_children
                                        }
                                        
                                        nodes.append(app_node)
                                        node_map[app_id] = app_node
                                        
                                        links.append({
                                            "source": technique_id,
                                            "target": app_id,
                                            "type": "has_application"
                                        })
                                        
                                        # Add inputs as direct children of application
                                        for input_item in inputs:
                                            if not isinstance(input_item, dict):
                                                continue
                                                
                                            input_id = input_item.get("id", f"{app_id}-input-{len(nodes)}")
                                            
                                            input_node = {
                                                "id": input_id,
                                                "name": input_item.get("name", "Input"),
                                                "type": "input",
                                                "description": input_item.get("description", ""),
                                                "parent": app_id,
                                                "level": 9,
                                                "expandable": False,
                                                "has_children": False
                                            }
                                            
                                            nodes.append(input_node)
                                            node_map[input_id] = input_node
                                            
                                            links.append({
                                                "source": app_id,
                                                "target": input_id,
                                                "type": "has_input"
                                            })
                                        
                                        # Add outputs as direct children of application (siblings to inputs)
                                        for output_idx, output_item in enumerate(outputs):
                                            if not isinstance(output_item, dict):
                                                continue
                                                
                                            # Ensure output has a good ID to avoid clashes
                                            if "id" in output_item and output_item["id"]:
                                                output_id = output_item["id"]
                                            else:
                                                output_id = f"{app_id}-output-{output_idx}"
                                                
                                            output_node = {
                                                "id": output_id,
                                                "name": output_item.get("name", f"Output {output_idx+1}"),
                                                "type": "output",
                                                "description": output_item.get("description", ""),
                                                "parent": app_id,  # Direct child of application
                                                "level": 9,        # Same level as inputs
                                                "expandable": False,
                                                "has_children": False
                                            }
                                            
                                            # Only add if not already in nodes
                                            if output_id not in node_map:
                                                nodes.append(output_node)
                                                node_map[output_id] = output_node
                                                
                                                links.append({
                                                    "source": app_id,
                                                    "target": output_id,
                                                    "type": "has_output"
                                                })
        
        self.app.logger.info(f"Built comprehensive graph with {len(nodes)} nodes and {len(links)} links")
        return {"nodes": nodes, "links": links}

    def get_root_data(self):
        """Get the root AI Alignment data."""
        root_data = self.load_json_file(self.ROOT_JSON_FILE)
        if not root_data:
            self.app.logger.warning(f"Using default root data since {self.ROOT_JSON_FILE} was not found")
            return DEFAULT_ROOT_DATA
        return root_data

    def get_components(self):
        """Get all component data with optimized loading."""
        try:
            components = {}
            
            # Check if components directory exists
            if not os.path.isdir(self.COMPONENTS_DIR):
                self.app.logger.warning(f"Components directory not found: {self.COMPONENTS_DIR}")
                # Use components from the default data
                for component in DEFAULT_ROOT_DATA["components"]:
                    components[component["id"]] = component
                return components
            
            # Load components in batches
            component_files = glob.glob(os.path.join(self.COMPONENTS_DIR, "*.json"))
            self.app.logger.info(f"Found {len(component_files)} component files")
            
            # Process files in batches of 10
            batch_size = 10
            for i in range(0, len(component_files), batch_size):
                batch = component_files[i:i + batch_size]
                for file_path in batch:
                    self.app.logger.debug(f"Loading component file: {file_path}")
                    component_data = self.load_json_file(file_path)
                    if component_data:
                        component_id = os.path.basename(file_path).replace(".json", "")
                        components[component_id] = component_data
                        self.app.logger.debug(f"Successfully loaded component: {component_id}")
                    else:
                        self.app.logger.error(f"Failed to load component file: {file_path}")
            
            return components
        except Exception as e:
            self.app.logger.error(f"Error in get_components: {str(e)}")
            return {}

    def get_subcomponents(self):
        """Get all subcomponent data with optimized loading."""
        try:
            subcomponents = {}
            
            if not os.path.isdir(self.SUBCOMPONENTS_DIR):
                self.app.logger.warning(f"Subcomponents directory not found: {self.SUBCOMPONENTS_DIR}")
                return subcomponents
            
            # Load subcomponents in batches
            subcomponent_files = glob.glob(os.path.join(self.SUBCOMPONENTS_DIR, "*.json"))
            self.app.logger.info(f"Found {len(subcomponent_files)} subcomponent files")
            
            # Process files in batches of 10
            batch_size = 10
            for i in range(0, len(subcomponent_files), batch_size):
                batch = subcomponent_files[i:i + batch_size]
                for file_path in batch:
                    self.app.logger.debug(f"Loading subcomponent file: {file_path}")
                    data = self.load_json_file(file_path)
                    if data:
                        subcomponent_id = os.path.basename(file_path).replace(".json", "")
                        if "id" not in data:
                            data["id"] = subcomponent_id
                        subcomponents[subcomponent_id] = data
                        self.app.logger.debug(f"Successfully loaded subcomponent: {subcomponent_id}")
                    else:
                        self.app.logger.error(f"Failed to load subcomponent file: {file_path}")
            
            return subcomponents
        except Exception as e:
            self.app.logger.error(f"Error in get_subcomponents: {str(e)}")
            return {}

    def load_json_file(self, file_path):
        """Load and parse a JSON file with robust error handling."""
        try:
            self.app.logger.info(f"Attempting to load file: {file_path}")
            
            # Normalize path for Windows
            normalized_path = os.path.normpath(file_path)
            self.app.logger.info(f"Normalized path: {normalized_path}")
            
            # First check if the file exists
            if not os.path.isfile(normalized_path):
                self.app.logger.error(f"File not found: {normalized_path}")
                return None
            
            # Try different encodings and handle BOM
            encodings = ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']
            content = None
            last_error = None
            
            for encoding in encodings:
                try:
                    with open(normalized_path, 'r', encoding=encoding) as f:
                        content = f.read().strip()
                        if not content:
                            continue
                        
                        # Remove BOM if present
                        if content.startswith('\ufeff'):
                            content = content[1:]
                        
                        # Remove any non-JSON leading/trailing characters
                        content = content.strip()
                        if not content.startswith('{') and not content.startswith('['):
                            continue
                            
                        # Try to parse JSON
                        try:
                            data = json.loads(content)
                            self.app.logger.info(f"Successfully loaded {normalized_path} with {encoding} encoding")
                            return data
                        except json.JSONDecodeError as je:
                            last_error = f"JSON parsing error with {encoding} encoding: {str(je)}"
                            self.app.logger.error(last_error)
                            self.app.logger.error(f"Content preview: {content[:200]}...")
                            continue
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    last_error = f"Error reading file with {encoding} encoding: {str(e)}"
                    self.app.logger.error(last_error)
                    continue
                
            if content is None:
                self.app.logger.error(f"Could not read file with any encoding: {normalized_path}")
                return None
            
            if last_error:
                self.app.logger.error(f"Final error loading {normalized_path}: {last_error}")
            return None
            
        except Exception as e:
            self.app.logger.error(f"Unexpected error loading {normalized_path}: {str(e)}")
            return None

    def root_details(self):
        self.app.logger.info("API request for root details")
        try:
            node_data, status_code = node_details_helper.get_node_details("ai-alignment")
            return jsonify(node_data), status_code
        except Exception as e:
            error_msg = f"Error in root_details: {str(e)}"
            self.app.logger.error(error_msg)
            return jsonify({
                "error": "Server error processing root node",
                "details": str(e)
            }), 500

# Create and run the application
def create_app():
    visualizer = AIAlignmentVisualizer()
    app = visualizer.app

    # Add routes that need to use the app instance directly
    @app.route('/api/details/<node_id>')
    def node_details_route(node_id):
        app.logger.info(f"API request for node details: {node_id}")
        try:
            app.logger.info(f"Processing request for node: {node_id}")
            
            # Use the new helper module for all node requests
            node_data, status_code = node_details_helper.get_node_details(node_id)
            app.logger.debug(f"Node details result: {status_code}")
            return jsonify(node_data), status_code
        except Exception as e:
            app.logger.error(f"Error in node_details_route: {str(e)}")
            return jsonify({
                "error": f"Server error processing node: {node_id}",
                "details": str(e)
            }), 500
    
    # Add a specific route for the root node
    @app.route('/api/root')
    def root_node():
        app.logger.info("API request for root node details")
        try:
            node_data, status_code = node_details_helper.get_node_details("ai-alignment")
            return jsonify(node_data), status_code
        except Exception as e:
            app.logger.error(f"Error in root_node: {str(e)}")
            return jsonify({
                "error": "Server error processing root node",
                "details": str(e)
            }), 500

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(error):
        app.logger.error(f"Server error: {error}")
        return jsonify({"error": "Internal server error"}), 500

    # Ensure CORS is disabled for API endpoints
    @app.after_request
    def after_request(response):
        if request.path.startswith('/api/'):
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'GET')
        return response

    return app

app = create_app()

# Define absolute paths correctly for Windows environment
APP_DIR = os.path.abspath(os.path.dirname(__file__))
PARENT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))
COMPONENTS_DIR = os.path.normpath(os.path.join(PARENT_DIR, "components"))
SUBCOMPONENTS_DIR = os.path.normpath(os.path.join(PARENT_DIR, "subcomponents"))
ROOT_JSON_FILE = os.path.normpath(os.path.join(PARENT_DIR, "ai-alignment.json"))

# Print paths to verify
app.logger.info(f"APP_DIR: {APP_DIR}")
app.logger.info(f"PARENT_DIR: {PARENT_DIR}")
app.logger.info(f"COMPONENTS_DIR: {COMPONENTS_DIR}")
app.logger.info(f"SUBCOMPONENTS_DIR: {SUBCOMPONENTS_DIR}")
app.logger.info(f"ROOT_JSON_FILE: {ROOT_JSON_FILE}")

# Default data to use if files aren't found
DEFAULT_ROOT_DATA = {
    "id": "ai-alignment",
    "name": "AI Alignment",
    "description": "Methods to ensure AI systems remain aligned with human values and intentions.",
    "type": "component_group",
    "components": [
        {
            "id": "technical-safeguards",
            "name": "Technical Safeguards",
            "description": "Engineering approaches to ensure AI systems behave as intended"
        },
        {
            "id": "value-learning",
            "name": "Value Learning",
            "description": "Systems that enable AI to learn and internalize human values"
        },
        {
            "id": "interpretability-tools",
            "name": "Interpretability Tools",
            "description": "Methods to understand AI reasoning and decision-making"
        },
        {
            "id": "oversight-mechanisms",
            "name": "Oversight Mechanisms",
            "description": "Systems for monitoring and evaluating AI behavior"
        }
    ]
}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"Starting AI Alignment Visualization on http://localhost:{port}/")
    visualizer = AIAlignmentVisualizer()
    visualizer.run(port=port) 