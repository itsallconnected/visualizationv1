# AI Alignment Visualization Tool

A React-based visualization tool for exploring AI alignment concepts and their relationships.

## Architecture

This project uses a GitHub-based architecture:

- **Frontend**: React application with THREE.js for 3D visualization
- **Data Storage**: All data is stored in the GitHub repository directly
- **Authentication**: GitHub OAuth for user authentication
- **Hosting**: AWS Amplify for hosting and connecting to a custom domain

## Key Features

- Interactive 3D visualization of AI alignment concepts
- Hierarchical node structure with expandable nodes
- Multiple visualization spheres
- Node content encryption for sensitive information
- Version history tracking through GitHub commits
- User management and permissions

## Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-alignment-visualization.git
   cd ai-alignment-visualization/visualizer
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file with the following variables:
   ```
   REACT_APP_GITHUB_REPO=yourusername/ai-alignment-visualization
   REACT_APP_GITHUB_BRANCH=main
   REACT_APP_GITHUB_CLIENT_ID=your_github_oauth_app_client_id
   REACT_APP_AUTH_REDIRECT_URI=http://localhost:3000/auth-callback
   ```

4. Start the development server:
   ```
   npm start
   ```

## Deployment to AWS Amplify

1. Create a new Amplify app in the AWS console
2. Connect it to your GitHub repository
3. Configure the build settings using the provided `amplify.yml` file
4. Add environment variables for GitHub integration
5. Deploy the application

## Project Structure

- `/src/components` - UI components
- `/src/visualization` - 3D visualization engine
- `/src/data` - Data handling and processing
- `/src/auth` - Authentication services
- `/src/api` - GitHub API integration
- `/src/utils` - Utility functions
- `/src/config` - Application configuration
- `/src/styles` - CSS and styling

## Data Structure

All visualization data is stored in the repository under:

- `/data/components` - Components data
- `/data/subcomponents` - Subcomponents data
- `/data/users` - User profiles
- `/data/spheres` - Visualization spheres configuration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 