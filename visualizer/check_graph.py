import requests

# Get the graph data
response = requests.get('http://localhost:3000/api/graph')
data = response.json()

# Count nodes and links
node_count = len(data['nodes'])
link_count = len(data['links'])
print(f"Graph contains {node_count} nodes and {link_count} links")

# Count nodes by type
type_counts = {}
for node in data['nodes']:
    node_type = node.get('type', 'unknown')
    if node_type not in type_counts:
        type_counts[node_type] = 0
    type_counts[node_type] += 1

print("\nNode types:")
for node_type, count in sorted(type_counts.items()):
    print(f"  {node_type}: {count}")

# Check for deep nodes (level > 7)
deep_nodes = [node for node in data['nodes'] if node.get('level', 0) > 7]
print(f"\nDeep nodes (level > 7): {len(deep_nodes)}")
if deep_nodes:
    for node in deep_nodes[:5]:  # Show first 5 examples
        print(f"  {node.get('id')} - {node.get('name')} (level {node.get('level')})")
    if len(deep_nodes) > 5:
        print(f"  ... and {len(deep_nodes) - 5} more") 