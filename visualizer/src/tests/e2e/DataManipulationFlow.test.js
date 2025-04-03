/**
 * Data Manipulation Flow End-to-End Tests
 * Tests the node creation, editing, deletion, and connection functionality
 */

import '@testing-library/jest-dom';
import puppeteer from 'puppeteer';

// Test config
const APP_URL = process.env.E2E_TEST_URL || 'http://localhost:3000';
const VIEWPORT = { width: 1366, height: 768 };
const TIMEOUT = 30000; // 30 second timeout for tests

// Test data
const TEST_NODE = {
  name: 'Test Node',
  type: 'capability',
  description: 'This is a test node created by E2E tests',
  content: 'Detailed content for the test node',
  tags: ['test', 'e2e', 'automation']
};

// Selectors
const SELECTORS = {
  // Visualization containers
  visualizationContainer: '[data-testid="visualization-container"]',
  canvas: 'canvas',
  loadingIndicator: '[data-testid="loading-indicator"]',
  
  // Controls and tools
  addNodeButton: '[data-testid="add-node-btn"]',
  editNodeButton: '[data-testid="edit-node-btn"]',
  deleteNodeButton: '[data-testid="delete-node-btn"]',
  connectNodeButton: '[data-testid="connect-node-btn"]',
  saveButton: '[data-testid="save-btn"]',
  cancelButton: '[data-testid="cancel-btn"]',
  confirmButton: '[data-testid="confirm-btn"]',
  
  // Node form elements
  nodeForm: '[data-testid="node-form"]',
  nodeNameInput: '[data-testid="node-name-input"]',
  nodeTypeSelect: '[data-testid="node-type-select"]',
  nodeDescriptionInput: '[data-testid="node-description-input"]',
  nodeContentInput: '[data-testid="node-content-input"]',
  nodeTagsInput: '[data-testid="node-tags-input"]',
  
  // Node connection form elements
  connectionForm: '[data-testid="connection-form"]',
  sourceNodeInput: '[data-testid="source-node-input"]',
  targetNodeInput: '[data-testid="target-node-input"]',
  relationshipTypeSelect: '[data-testid="relationship-type-select"]',
  
  // Node details panel
  detailsPanel: '[data-testid="details-panel"]',
  nodeTitle: '[data-testid="node-title"]',
  nodeType: '[data-testid="node-type"]',
  nodeDescription: '[data-testid="node-description"]',
  nodeContent: '[data-testid="node-content"]',
  
  // Search
  searchInput: '[data-testid="search-input"]',
  searchResults: '[data-testid="search-results"]',
  
  // Notifications
  notification: '[data-testid="notification"]',
  
  // Connection visualization elements
  connectionLine: '.connection-line',
  selectedNode: '.node.selected',
  
  // Auth elements (for login if needed)
  loginForm: '[data-testid="login-form"]',
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  loginButton: '[data-testid="login-button"]'
};

describe('Data Manipulation Flow', () => {
  let browser;
  let page;

  // Set up browser for tests
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true', // Use headless in CI, non-headless for local development
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  // Close browser after tests
  afterAll(async () => {
    await browser.close();
  });

  // Helper function to login if authentication is required
  const login = async () => {
    try {
      // Check if we need to login
      const loginFormExists = await page.$(SELECTORS.loginForm);
      
      if (loginFormExists) {
        await page.type(SELECTORS.emailInput, 'test-user@example.com');
        await page.type(SELECTORS.passwordInput, 'password123');
        await page.click(SELECTORS.loginButton);
        
        // Wait for redirect after login
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      }
    } catch (e) {
      console.log('Login not required or failed, continuing tests');
    }
  };

  // Create new page and navigate to app before each test
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setDefaultTimeout(TIMEOUT);
    
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    
    // Attempt login if necessary
    await login();
    
    // Wait for visualization to load
    await page.waitForSelector(SELECTORS.visualizationContainer);
    await page.waitForSelector(SELECTORS.canvas);
    
    // Wait for loading to complete
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="loading-indicator"]') || 
             getComputedStyle(document.querySelector('[data-testid="loading-indicator"]')).display === 'none', 
      { timeout: TIMEOUT }
    );
  });

  afterEach(async () => {
    // Clean up - could add code to delete any test nodes created
    await page.close();
  });
  
  // Helper to take screenshots if enabled
  const takeScreenshot = async (name) => {
    if (process.env.SAVE_E2E_SCREENSHOTS) {
      await page.screenshot({ path: `./e2e-screenshots/${name}.png` });
    }
  };

  test('User can create a new node', async () => {
    // Click add node button
    await page.click(SELECTORS.addNodeButton);
    
    // Wait for node form to appear
    await page.waitForSelector(SELECTORS.nodeForm);
    
    // Fill in node details
    await page.type(SELECTORS.nodeNameInput, TEST_NODE.name);
    
    // Select node type
    await page.select(SELECTORS.nodeTypeSelect, TEST_NODE.type);
    
    // Fill in description and content
    await page.type(SELECTORS.nodeDescriptionInput, TEST_NODE.description);
    await page.type(SELECTORS.nodeContentInput, TEST_NODE.content);
    
    // Add tags
    for (const tag of TEST_NODE.tags) {
      await page.type(SELECTORS.nodeTagsInput, tag);
      await page.keyboard.press('Enter');
    }
    
    await takeScreenshot('new-node-form');
    
    // Save the node
    await page.click(SELECTORS.saveButton);
    
    // Wait for notification of successful creation
    await page.waitForSelector(SELECTORS.notification);
    
    // Verify notification contains success message
    const notificationText = await page.evaluate(() => {
      return document.querySelector('[data-testid="notification"]').textContent;
    });
    
    expect(notificationText.toLowerCase()).toContain('created');
    
    // Search for the created node to verify
    await page.type(SELECTORS.searchInput, TEST_NODE.name);
    await page.waitForSelector(SELECTORS.searchResults);
    
    // Check if node appears in search results
    const searchResults = await page.evaluate(() => {
      const results = document.querySelector('[data-testid="search-results"]');
      return results.textContent;
    });
    
    expect(searchResults).toContain(TEST_NODE.name);
    
    await takeScreenshot('node-created');
  });

  test('User can edit an existing node', async () => {
    // First, search for our test node
    await page.type(SELECTORS.searchInput, TEST_NODE.name);
    await page.waitForSelector(SELECTORS.searchResults);
    
    // Click on the node in search results
    await page.click(`${SELECTORS.searchResults} li:first-child`);
    
    // Wait for details panel to appear
    await page.waitForSelector(SELECTORS.detailsPanel);
    
    // Click edit button
    await page.click(SELECTORS.editNodeButton);
    
    // Wait for node form to appear
    await page.waitForSelector(SELECTORS.nodeForm);
    
    // Update node description
    await page.evaluate(() => {
      document.querySelector('[data-testid="node-description-input"]').value = '';
    });
    await page.type(SELECTORS.nodeDescriptionInput, 'Updated description from E2E test');
    
    await takeScreenshot('edit-node-form');
    
    // Save changes
    await page.click(SELECTORS.saveButton);
    
    // Wait for notification of successful update
    await page.waitForSelector(SELECTORS.notification);
    
    // Verify notification contains success message
    const notificationText = await page.evaluate(() => {
      return document.querySelector('[data-testid="notification"]').textContent;
    });
    
    expect(notificationText.toLowerCase()).toContain('updated');
    
    // Check if details panel shows updated information
    await page.waitForSelector(SELECTORS.nodeDescription);
    const updatedDescription = await page.evaluate(() => {
      return document.querySelector('[data-testid="node-description"]').textContent;
    });
    
    expect(updatedDescription).toContain('Updated description');
    
    await takeScreenshot('node-updated');
  });

  test('User can delete a node', async () => {
    // First, search for our test node
    await page.type(SELECTORS.searchInput, TEST_NODE.name);
    await page.waitForSelector(SELECTORS.searchResults);
    
    // Click on the node in search results
    await page.click(`${SELECTORS.searchResults} li:first-child`);
    
    // Wait for details panel to appear
    await page.waitForSelector(SELECTORS.detailsPanel);
    
    // Click delete button
    await page.click(SELECTORS.deleteNodeButton);
    
    // Wait for confirmation dialog
    await page.waitForSelector(SELECTORS.confirmButton);
    
    await takeScreenshot('delete-confirmation');
    
    // Confirm deletion
    await page.click(SELECTORS.confirmButton);
    
    // Wait for notification of successful deletion
    await page.waitForSelector(SELECTORS.notification);
    
    // Verify notification contains success message
    const notificationText = await page.evaluate(() => {
      return document.querySelector('[data-testid="notification"]').textContent;
    });
    
    expect(notificationText.toLowerCase()).toContain('deleted');
    
    // Search again to verify node is gone
    await page.evaluate(() => {
      document.querySelector('[data-testid="search-input"]').value = '';
    });
    await page.type(SELECTORS.searchInput, TEST_NODE.name);
    
    // Check if node doesn't appear in search results
    try {
      // Should timeout or show empty results
      await page.waitForSelector(`${SELECTORS.searchResults} li`, { timeout: 3000 });
      
      // If we reach here, check if the result doesn't contain our node
      const searchResults = await page.evaluate(() => {
        const results = document.querySelector('[data-testid="search-results"]');
        return results ? results.textContent : '';
      });
      
      expect(searchResults).not.toContain(TEST_NODE.name);
    } catch (e) {
      // If timeout occurs, that's expected because no results should be found
      const emptyResults = await page.evaluate(() => {
        return document.querySelector('[data-testid="search-results"]')?.textContent || 'No results';
      });
      
      expect(emptyResults.toLowerCase()).toContain('no results');
    }
    
    await takeScreenshot('node-deleted');
  });
  
  test('User can create and connect nodes', async () => {
    // Create first node
    await page.click(SELECTORS.addNodeButton);
    await page.waitForSelector(SELECTORS.nodeForm);
    await page.type(SELECTORS.nodeNameInput, 'Source Node');
    await page.select(SELECTORS.nodeTypeSelect, 'capability');
    await page.type(SELECTORS.nodeDescriptionInput, 'A source node for connection testing');
    await page.click(SELECTORS.saveButton);
    await page.waitForSelector(SELECTORS.notification);
    
    // Create second node
    await page.click(SELECTORS.addNodeButton);
    await page.waitForSelector(SELECTORS.nodeForm);
    await page.type(SELECTORS.nodeNameInput, 'Target Node');
    await page.select(SELECTORS.nodeTypeSelect, 'function');
    await page.type(SELECTORS.nodeDescriptionInput, 'A target node for connection testing');
    await page.click(SELECTORS.saveButton);
    await page.waitForSelector(SELECTORS.notification);
    
    // Search for source node
    await page.type(SELECTORS.searchInput, 'Source Node');
    await page.waitForSelector(SELECTORS.searchResults);
    await page.click(`${SELECTORS.searchResults} li:first-child`);
    
    // Wait for details panel
    await page.waitForSelector(SELECTORS.detailsPanel);
    
    // Click connect button
    await page.click(SELECTORS.connectNodeButton);
    
    // Wait for connection mode or form
    try {
      // If we have a visual connection mode
      await page.waitForSelector(SELECTORS.selectedNode, { timeout: 5000 });
      
      // Search for target node while in connection mode
      await page.type(SELECTORS.searchInput, 'Target Node');
      await page.waitForSelector(SELECTORS.searchResults);
      await page.click(`${SELECTORS.searchResults} li:first-child`);
      
      // At this point a connection should be created visually
      // Wait for connection line or connection form to complete the relationship
      await page.waitForSelector(SELECTORS.connectionForm, { timeout: 5000 });
      
      // Select relationship type if a form appears
      await page.select(SELECTORS.relationshipTypeSelect, 'implements');
      await page.click(SELECTORS.saveButton);
    } catch (e) {
      // Alternative: If we have a direct connection form instead
      await page.waitForSelector(SELECTORS.connectionForm);
      
      // Fill in source and target
      await page.type(SELECTORS.sourceNodeInput, 'Source Node');
      await page.type(SELECTORS.targetNodeInput, 'Target Node');
      
      // Select relationship type
      await page.select(SELECTORS.relationshipTypeSelect, 'implements');
      
      // Save the connection
      await page.click(SELECTORS.saveButton);
    }
    
    // Wait for notification of successful connection
    await page.waitForSelector(SELECTORS.notification);
    
    // Verify notification contains success message
    const notificationText = await page.evaluate(() => {
      return document.querySelector('[data-testid="notification"]').textContent;
    });
    
    expect(notificationText.toLowerCase()).toContain('connect');
    
    await takeScreenshot('nodes-connected');
    
    // Verify the connection is visible when viewing either node
    await page.type(SELECTORS.searchInput, 'Source Node');
    await page.waitForSelector(SELECTORS.searchResults);
    await page.click(`${SELECTORS.searchResults} li:first-child`);
    
    // Wait for details panel
    await page.waitForSelector(SELECTORS.detailsPanel);
    
    // Verify details panel shows connection information
    const detailsContent = await page.evaluate(() => {
      return document.querySelector('[data-testid="details-panel"]').textContent;
    });
    
    expect(detailsContent).toContain('Target Node');
    expect(detailsContent).toContain('implements');
  });
  
  test('User receives validation errors when creating invalid nodes', async () => {
    // Click add node button
    await page.click(SELECTORS.addNodeButton);
    
    // Wait for node form to appear
    await page.waitForSelector(SELECTORS.nodeForm);
    
    // Leave name empty and try to save
    await page.type(SELECTORS.nodeDescriptionInput, 'A description without a name');
    await page.click(SELECTORS.saveButton);
    
    // Should show validation error
    const validationError = await page.evaluate(() => {
      // Look for error message elements
      const errorElements = document.querySelectorAll('.error-message, .invalid-feedback');
      return Array.from(errorElements).map(el => el.textContent).join(' ');
    });
    
    expect(validationError.toLowerCase()).toContain('required');
    expect(validationError.toLowerCase()).toContain('name');
    
    await takeScreenshot('node-validation-error');
    
    // Fill in the name and try again
    await page.type(SELECTORS.nodeNameInput, 'Valid Node Name');
    await page.click(SELECTORS.saveButton);
    
    // Now it should pass validation and show success
    await page.waitForSelector(SELECTORS.notification);
    
    const successMessage = await page.evaluate(() => {
      return document.querySelector('[data-testid="notification"]').textContent;
    });
    
    expect(successMessage.toLowerCase()).toContain('created');
  });
}); 