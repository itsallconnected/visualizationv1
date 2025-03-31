import json
import os
import glob
import logging

# Setup basic logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def setup_paths():
    APP_DIR = os.path.abspath(os.path.dirname(__file__))
    PARENT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))
    COMPONENTS_DIR = os.path.normpath(os.path.join(PARENT_DIR, "components"))
    SUBCOMPONENTS_DIR = os.path.normpath(os.path.join(PARENT_DIR, "subcomponents"))
    ROOT_JSON_FILE = os.path.normpath(os.path.join(PARENT_DIR, "ai-alignment.json"))
    
    return {
        'APP_DIR': APP_DIR,
        'PARENT_DIR': PARENT_DIR,
        'COMPONENTS_DIR': COMPONENTS_DIR,
        'SUBCOMPONENTS_DIR': SUBCOMPONENTS_DIR,
        'ROOT_JSON_FILE': ROOT_JSON_FILE
    }

def load_json_file(file_path):
    """Load and parse a JSON file with robust error handling."""
    try:
        logger.info(f"Attempting to load file: {file_path}")
        
        # Normalize path for Windows
        normalized_path = os.path.normpath(file_path)
        logger.info(f"Normalized path: {normalized_path}")
        
        # First check if the file exists
        if not os.path.isfile(normalized_path):
            logger.error(f"File not found: {normalized_path}")
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
                        logger.info(f"Successfully loaded {normalized_path} with {encoding} encoding")
                        return data
                    except json.JSONDecodeError as je:
                        last_error = f"JSON parsing error with {encoding} encoding: {str(je)}"
                        logger.error(last_error)
                        logger.error(f"Content preview: {content[:200]}...")
                        continue
            except UnicodeDecodeError:
                continue
            except Exception as e:
                last_error = f"Error reading file with {encoding} encoding: {str(e)}"
                logger.error(last_error)
                continue
            
        if content is None:
            logger.error(f"Could not read file with any encoding: {normalized_path}")
            return None
        
        if last_error:
            logger.error(f"Final error loading {normalized_path}: {last_error}")
        return None
        
    except Exception as e:
        logger.error(f"Unexpected error loading {normalized_path}: {str(e)}")
        return None

def get_root_data():
    """Get the root AI Alignment data."""
    paths = setup_paths()
    root_data = load_json_file(paths['ROOT_JSON_FILE'])
    if not root_data:
        logger.warning(f"Using default root data since {paths['ROOT_JSON_FILE']} was not found")
        return DEFAULT_ROOT_DATA
    return root_data

def get_components():
    """Get all component data."""
    paths = setup_paths()
    components = {}
    
    # Check if components directory exists
    if not os.path.isdir(paths['COMPONENTS_DIR']):
        logger.warning(f"Components directory not found: {paths['COMPONENTS_DIR']}")
        return components
    
    # Load components
    component_files = glob.glob(os.path.join(paths['COMPONENTS_DIR'], "*.json"))
    logger.info(f"Found {len(component_files)} component files")
    
    for file_path in component_files:
        logger.debug(f"Loading component file: {file_path}")
        component_data = load_json_file(file_path)
        if component_data:
            component_id = os.path.basename(file_path).replace(".json", "")
            components[component_id] = component_data
            logger.debug(f"Successfully loaded component: {component_id}")
        else:
            logger.error(f"Failed to load component file: {file_path}")
    
    return components

def get_subcomponents():
    """Get all subcomponent data."""
    paths = setup_paths()
    subcomponents = {}
    
    if not os.path.isdir(paths['SUBCOMPONENTS_DIR']):
        logger.warning(f"Subcomponents directory not found: {paths['SUBCOMPONENTS_DIR']}")
        return subcomponents
    
    # Load subcomponents
    subcomponent_files = glob.glob(os.path.join(paths['SUBCOMPONENTS_DIR'], "*.json"))
    logger.info(f"Found {len(subcomponent_files)} subcomponent files")
    
    for file_path in subcomponent_files:
        logger.debug(f"Loading subcomponent file: {file_path}")
        data = load_json_file(file_path)
        if data:
            subcomponent_id = os.path.basename(file_path).replace(".json", "")
            if "id" not in data:
                data["id"] = subcomponent_id
            subcomponents[subcomponent_id] = data
            logger.debug(f"Successfully loaded subcomponent: {subcomponent_id}")
        else:
            logger.error(f"Failed to load subcomponent file: {file_path}")
    
    return subcomponents

def find_nested_node(node_id, subcomponents):
    """Find a node in the nested structure of subcomponents."""
    for subcomp_id, subcomp in subcomponents.items():
        if not isinstance(subcomp, dict):
            logger.warning(f"Invalid subcomponent data type for {subcomp_id}: {type(subcomp)}")
            continue
            
        if 'capabilities' in subcomp:
            capabilities = subcomp.get('capabilities', [])
            if isinstance(capabilities, dict):
                capabilities = capabilities.get('items', [])
            if not isinstance(capabilities, list):
                logger.warning(f"Invalid capabilities data type in {subcomp_id}: {type(capabilities)}")
                continue
                
            for capability in capabilities:
                if not isinstance(capability, dict):
                    continue
                    
                if capability.get('id') == node_id:
                    logger.debug(f"Found capability: {node_id}")
                    return capability
                    
                # Check functions
                for function in capability.get('functions', []):
                    if not isinstance(function, dict):
                        continue
                        
                    if function.get('id') == node_id:
                        logger.debug(f"Found function: {node_id}")
                        return function
                        
                    # Check specifications
                    for spec in function.get('specifications', []):
                        if not isinstance(spec, dict):
                            continue
                            
                        if spec.get('id') == node_id:
                            logger.debug(f"Found specification: {node_id}")
                            return spec
                            
                        # Check integration
                        integration = spec.get('integration')
                        if integration and isinstance(integration, dict):
                            if integration.get('id') == node_id:
                                logger.debug(f"Found integration: {node_id}")
                                return integration
                                
                            # Check techniques
                            for technique in integration.get('techniques', []):
                                if not isinstance(technique, dict):
                                    continue
                                    
                                if technique.get('id') == node_id:
                                    logger.debug(f"Found technique: {node_id}")
                                    return technique
                                    
                                # Check applications
                                for app in technique.get('applications', []):
                                    if not isinstance(app, dict):
                                        continue
                                        
                                    if app.get('id') == node_id:
                                        logger.debug(f"Found application: {node_id}")
                                        return app
                                        
                                    # Check inputs and outputs
                                    for io_list in [app.get('inputs', []), app.get('outputs', [])]:
                                        for io_item in io_list:
                                            if isinstance(io_item, dict) and io_item.get('id') == node_id:
                                                logger.debug(f"Found IO item: {node_id}")
                                                return io_item
    
    return None

def get_node_details(node_id):
    """Get details for a specific node."""
    # Get data sources
    root_data = get_root_data()
    if not root_data:
        error_msg = "Could not load root data"
        logger.error(error_msg)
        return {
            "error": error_msg,
            "id": node_id,
            "name": "Error Loading Node",
            "description": "Could not load root data",
            "type": "error"
        }, 500
        
    components = get_components()
    subcomponents = get_subcomponents()
    
    logger.debug(f"Loaded data: root={bool(root_data)}, components={len(components)}, subcomponents={len(subcomponents)}")
    
    # Check if it's the root node
    if node_id == "ai-alignment" or node_id == root_data["id"]:
        logger.debug("Returning root node data")
        return root_data, 200
    
    # Check if it's a component
    if node_id in components:
        logger.debug(f"Found component: {node_id}")
        return components[node_id], 200
    
    # Check if it's a subcomponent
    if node_id in subcomponents:
        logger.debug(f"Found subcomponent: {node_id}")
        try:
            subcomp_data = subcomponents[node_id]
            if not isinstance(subcomp_data, dict):
                raise ValueError(f"Invalid subcomponent data type: {type(subcomp_data)}")
            return subcomp_data, 200
        except Exception as e:
            error_msg = f"Error processing subcomponent data: {str(e)}"
            logger.error(error_msg)
            return {
                "error": error_msg,
                "id": node_id,
                "name": "Error Processing Node",
                "description": "Could not process subcomponent data",
                "type": "error"
            }, 500
    
    # Look for nested nodes
    nested_node = find_nested_node(node_id, subcomponents)
    if nested_node:
        return nested_node, 200
        
    error_msg = f"Node not found: {node_id}"
    logger.warning(error_msg)
    return {
        "error": error_msg,
        "id": node_id,
        "name": "Unknown Node",
        "description": "Node details not found",
        "type": "unknown"
    }, 404

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