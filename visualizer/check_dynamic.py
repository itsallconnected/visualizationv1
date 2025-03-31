import json
import pprint

# Load the data
with open('adaptive.json', 'r') as f:
    data = json.load(f)

# Find the capability
for cap in data.get('capabilities', []):
    if cap.get('id') == 'adaptive-value-learning.dynamic-value-refinement':
        print("Found capability: adaptive-value-learning.dynamic-value-refinement")
        functions = cap.get('functions', [])
        print(f"Function count: {len(functions)}")
        
        for func in functions:
            print(f"Function ID: {func.get('id')}")
            print(f"Function name: {func.get('name')}")
            print(f"Function description: {func.get('description')}")
            print("-" * 50)
            
            # Check for specifications
            specs = func.get('specifications', [])
            if specs:
                print(f"Specifications count: {len(specs)}")
                for spec in specs:
                    print(f"  Spec ID: {spec.get('id')}")
                    print(f"  Spec name: {spec.get('name')}")
                    print("-" * 40) 