import requests

# Check a specific deep node
node_id = "deliberative-capacity-building.ai-literacy.knowledge-building.educational-curriculum.implementation.learning-frameworks.online-course"

try:
    response = requests.get(f'http://localhost:3000/api/details/{node_id}')
    data = response.json()
    
    print(f"Status code: {response.status_code}")
    
    if response.status_code == 200:
        print(f"\nSuccessfully retrieved node: {data.get('name', 'Unknown')}")
        print(f"Node ID: {data.get('id', 'Unknown')}")
        print(f"Node type: {data.get('type', 'Unknown')}")
        print(f"Description: {data.get('description', 'No description')[:100]}...")
        
        # Check for inputs if it's an application
        inputs = data.get('inputs', [])
        if inputs:
            print(f"\nInputs count: {len(inputs)}")
            for i, input_item in enumerate(inputs[:3]):
                print(f"  Input {i+1}: {input_item.get('name', 'Unnamed')}")
            if len(inputs) > 3:
                print(f"  ... and {len(inputs) - 3} more inputs")
    else:
        print(f"Error: {data.get('error', 'Unknown error')}")
        
except Exception as e:
    print(f"Exception occurred: {str(e)}") 