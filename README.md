# AI Alignment Visualization Tool

A modern, interactive 3D visualization platform for exploring AI alignment concepts, hierarchies, and relationships.

![AI Alignment Visualization Tool Screenshot](./docs/images/screenshot.png)

## Overview

The AI Alignment Visualization Tool is a powerful, interactive visualization platform built to help researchers, educators, and enthusiasts explore complex AI alignment concepts and their relationships. This application visualizes various components of AI alignment in an intuitive 3D interface, allowing users to navigate hierarchical relationships, explore connections between concepts, and learn about different approaches to AI safety.

## Features

- **Interactive 3D Visualization**: Navigate through a comprehensive 3D graph of AI alignment concepts and their relationships
- **Hierarchical Exploration**: Drill down from high-level components to detailed implementations
- **Multi-Sphere Support**: Visualize and switch between multiple conceptual spheres
- **Authentication System**: Secure user accounts with role-based access control
- **Content Encryption**: SHA-512 encryption for sensitive node content
- **Version Control**: Track changes and revert to previous versions
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Node Connection Management**: Interactive tools for creating and managing connections
- **Advanced Animation**: Physics-based animations for fluid user experience
- **Search Capabilities**: Find relevant nodes quickly with powerful search functionality

## Tech Stack

- **Frontend**: React.js with Three.js for 3D visualization
- **Backend**: AWS Amplify (AppSync, DynamoDB, Cognito)
- **Deployment**: GitHub + AWS Amplify pipeline
- **Authentication**: AWS Cognito
- **Storage**: AWS S3 + DynamoDB
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm (v6+)
- AWS Account
- Amplify CLI (`npm install -g @aws-amplify/cli`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/ai-alignment-visualization.git
   cd ai-alignment-visualization/visualizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize Amplify:
   ```bash
   amplify init
   ```

4. Push Amplify resources:
   ```bash
   amplify push
   ```

5. Start the development server:
   ```bash
   npm start
   ```

The application will be available at http://localhost:3000.

### Production Deployment

The application is configured for automatic deployment through GitHub + AWS Amplify:

1. Fork the repository
2. Connect your repository to AWS Amplify
3. Configure your environment variables in Amplify Console
4. Amplify will automatically build and deploy your application

Refer to the [Deployment Guide](./docs/deployment.md) for detailed instructions.

## Project Structure

The project follows a modular architecture designed for scalability and maintainability:

```
visualizer/
├── amplify/           # AWS Amplify configuration
├── public/            # Static assets
├── src/               # Application source code
│   ├── auth/          # Authentication components
│   ├── components/    # UI components
│   ├── config/        # Application configuration
│   ├── data/          # Data models and services
│   ├── encryption/    # Encryption utilities
│   ├── styles/        # CSS styles
│   ├── tests/         # Test suites
│   ├── utils/         # Utility functions
│   ├── versioning/    # Version control system
│   └── visualization/ # 3D visualization core
├── .gitignore
├── amplify.yml        # Amplify build configuration
├── package.json
└── README.md
```

## Data Structure

The visualization is based on a hierarchical node structure:

1. **Component Group** (Level 0): Top-level category
2. **Component** (Level 1): Major category
3. **Subcomponent** (Level 2): Specific approach
4. **Capability** (Level 3): Functional area
5. **Function** (Level 4): Specific function
6. **Specification** (Level 5): Detailed implementation
7. **Integration** (Level 6): System integration approach
8. **Technique** (Level 7): Specific technique
9. **Application** (Level 8): Practical application
10. **Input/Output** (Level 9): Data flows

Each node can have multiple relationships and connections to other nodes, creating a rich network of interrelated concepts.

## Usage Guide

### Navigation

- **Pan**: Click and drag to move the camera position
- **Zoom**: Use mouse wheel or pinch gesture to zoom in/out
- **Rotate**: Right-click and drag to rotate the view
- **Select Node**: Left-click on a node to view its details
- **Expand/Collapse**: Click the expand/collapse buttons in the node details panel

### Node Management

- **Search**: Use the search bar to find specific nodes
- **Create Connection**: Select "Connect" mode to create links between nodes
- **Encrypt Content**: Use the lock icon to encrypt/decrypt sensitive content

For more detailed instructions, see the [User Guide](./docs/user-guide.md).

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix
```

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- The Three.js community for their excellent 3D visualization library
- The AWS Amplify team for their comprehensive cloud platform
- All contributors who have helped shape this project

## Contact

For questions or support, please open an issue on GitHub or contact the maintainers at maintainers@example.com. 