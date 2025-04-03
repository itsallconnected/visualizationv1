/**
 * Visualization Flow End-to-End Tests
 * Tests the complete visualization user experience from loading to interaction
 */

import '@testing-library/jest-dom';
import puppeteer from 'puppeteer';

// Test config
const APP_URL = process.env.E2E_TEST_URL || 'http://localhost:3000';
const VIEWPORT = { width: 1366, height: 768 };
const TIMEOUT = 30000; // 30 second timeout for tests

// Selectors
const SELECTORS = {
  visualizationContainer: '[data-testid="visualization-container"]',
  canvas: 'canvas',
  loadingIndicator: '[data-testid="loading-indicator"]',
  sidebar: '[data-testid="app-sidebar"]',
  controlsToolbar: '[data-testid="controls-toolbar"]',
  detailsPanel: '[data-testid="details-panel"]',
  zoomInButton: '[data-testid="zoom-in-btn"]',
  zoomOutButton: '[data-testid="zoom-out-btn"]',
  searchButton: '[data-testid="search-btn"]',
  searchInput: '[data-testid="search-input"]',
  searchResults: '[data-testid="search-results"]',
  notificationCenter: '[data-testid="notification-center"]',
};

describe('Visualization Flow', () => {
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

  // Create new page before each test
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setDefaultTimeout(TIMEOUT);
    
    // Mock performance.now() to have consistent animation timing
    await page.evaluateOnNewDocument(() => {
      let startTime = Date.now();
      window.originalPerformanceNow = window.performance.now;
      window.performance.now = () => Date.now() - startTime;
    });
    
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    
    // Wait for visualization to load
    await page.waitForSelector(SELECTORS.visualizationContainer);
    await page.waitForSelector(SELECTORS.canvas);
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="loading-indicator"]') || 
             getComputedStyle(document.querySelector('[data-testid="loading-indicator"]')).display === 'none', 
      { timeout: TIMEOUT }
    );
  });

  afterEach(async () => {
    await page.close();
  });

  test('Initial visualization loads with nodes and links visible', async () => {
    // Verify visualization container is present
    const vizContainer = await page.$(SELECTORS.visualizationContainer);
    expect(vizContainer).toBeTruthy();
    
    // Verify canvas is rendered
    const canvas = await page.$(SELECTORS.canvas);
    expect(canvas).toBeTruthy();
    
    // Take screenshot for visual verification
    if (process.env.SAVE_E2E_SCREENSHOTS) {
      await page.screenshot({ path: './e2e-screenshots/initial-visualization.png' });
    }
    
    // Verify nodes are visible (check for node count)
    const nodeCount = await page.evaluate(() => {
      // Access the visualization store/state
      return window.__VISUALIZATION_DEBUG_INFO?.nodeCount || 0;
    });
    
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('User can zoom in and out of the visualization', async () => {
    // Get initial camera position
    const initialCameraPosition = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.cameraPosition || null;
    });
    
    expect(initialCameraPosition).toBeTruthy();
    
    // Click zoom in button
    await page.click(SELECTORS.zoomInButton);
    
    // Wait for animation to complete
    await page.waitForTimeout(1000);
    
    // Get new camera position
    const zoomedInPosition = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.cameraPosition || null;
    });
    
    // Verify camera moved closer (z position decreased)
    expect(zoomedInPosition.z).toBeLessThan(initialCameraPosition.z);
    
    // Click zoom out button
    await page.click(SELECTORS.zoomOutButton);
    
    // Wait for animation to complete
    await page.waitForTimeout(1000);
    
    // Get final camera position
    const zoomedOutPosition = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.cameraPosition || null;
    });
    
    // Verify camera moved back (z position increased)
    expect(zoomedOutPosition.z).toBeGreaterThan(zoomedInPosition.z);
  });

  test('User can click on a node to view details', async () => {
    // Simulate click on a node in the center of the screen
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    
    // Wait for details panel to become visible
    await page.waitForSelector(SELECTORS.detailsPanel, { visible: true });
    
    // Verify node details are displayed
    const detailsContent = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="details-panel"]');
      return panel ? panel.textContent : '';
    });
    
    // Should have node content
    expect(detailsContent.length).toBeGreaterThan(10);
    
    // Take screenshot for visual verification
    if (process.env.SAVE_E2E_SCREENSHOTS) {
      await page.screenshot({ path: './e2e-screenshots/node-details.png' });
    }
  });

  test('User can search for nodes', async () => {
    // Click search button to open search panel
    await page.click(SELECTORS.searchButton);
    
    // Wait for search input to appear
    await page.waitForSelector(SELECTORS.searchInput, { visible: true });
    
    // Type search query
    await page.type(SELECTORS.searchInput, 'Alignment');
    
    // Wait for search results
    await page.waitForSelector(SELECTORS.searchResults, { visible: true });
    
    // Get search results
    const searchResults = await page.evaluate(() => {
      const results = document.querySelector('[data-testid="search-results"]');
      const items = results.querySelectorAll('[data-testid="search-result-item"]');
      return Array.from(items).map(item => item.textContent);
    });
    
    // Should have at least one result
    expect(searchResults.length).toBeGreaterThan(0);
    
    // Click first search result
    await page.click('[data-testid="search-result-item"]:first-child');
    
    // Wait for details panel with the selected node
    await page.waitForSelector(SELECTORS.detailsPanel, { visible: true });
    
    // Check that camera has moved to focus on the selected node
    const isCameraAnimating = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.isCameraAnimating || false;
    });
    
    // Camera should be animating to the selected node
    expect(isCameraAnimating).toBe(true);
  });

  test('User can toggle sidebar visibility', async () => {
    // Verify sidebar is initially visible
    let sidebarVisible = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="app-sidebar"]');
      return sidebar && !sidebar.classList.contains('collapsed');
    });
    
    expect(sidebarVisible).toBe(true);
    
    // Find and click the sidebar toggle button
    await page.click('.sidebar-toggle');
    
    // Verify sidebar is now collapsed
    sidebarVisible = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="app-sidebar"]');
      return sidebar && !sidebar.classList.contains('collapsed');
    });
    
    expect(sidebarVisible).toBe(false);
    
    // Click toggle button again
    await page.click('.sidebar-toggle');
    
    // Verify sidebar is visible again
    sidebarVisible = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="app-sidebar"]');
      return sidebar && !sidebar.classList.contains('collapsed');
    });
    
    expect(sidebarVisible).toBe(true);
  });

  test('User can expand and collapse nodes', async () => {
    // Click on a parent node
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    
    // Wait for details panel
    await page.waitForSelector(SELECTORS.detailsPanel, { visible: true });
    
    // Get initial node count
    const initialNodeCount = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.visibleNodeCount || 0;
    });
    
    // Find and click expand button in details panel
    await page.click('[data-testid="expand-node-btn"]');
    
    // Wait for animation to complete
    await page.waitForTimeout(1000);
    
    // Get new node count
    const expandedNodeCount = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.visibleNodeCount || 0;
    });
    
    // Should have more visible nodes after expanding
    expect(expandedNodeCount).toBeGreaterThan(initialNodeCount);
    
    // Click collapse button
    await page.click('[data-testid="collapse-node-btn"]');
    
    // Wait for animation to complete
    await page.waitForTimeout(1000);
    
    // Get final node count
    const collapsedNodeCount = await page.evaluate(() => {
      return window.__VISUALIZATION_DEBUG_INFO?.visibleNodeCount || 0;
    });
    
    // Should be back to initial count
    expect(collapsedNodeCount).toBe(initialNodeCount);
  });

  test('Visualization responds to window resize', async () => {
    // Get initial canvas size
    const initialSize = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        width: canvas.width,
        height: canvas.height
      };
    });
    
    // Resize viewport
    const newViewport = { width: 1024, height: 768 };
    await page.setViewport(newViewport);
    
    // Wait for resize to propagate
    await page.waitForTimeout(500);
    
    // Get new canvas size
    const newSize = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        width: canvas.width,
        height: canvas.height
      };
    });
    
    // Canvas should resize with viewport
    expect(newSize.width).not.toBe(initialSize.width);
    expect(newSize.height).not.toBe(initialSize.height);
  });

  test('User receives notifications for important events', async () => {
    // Trigger an event that causes notification (e.g., search with no results)
    await page.click(SELECTORS.searchButton);
    await page.waitForSelector(SELECTORS.searchInput, { visible: true });
    await page.type(SELECTORS.searchInput, 'NonExistentNodeXYZ123');
    
    // Wait for notification
    await page.waitForSelector(SELECTORS.notificationCenter + ' .notification', { visible: true });
    
    // Verify notification content
    const notificationText = await page.evaluate(() => {
      const notification = document.querySelector('[data-testid="notification-center"] .notification');
      return notification ? notification.textContent : '';
    });
    
    // Should contain "no results" message
    expect(notificationText.toLowerCase()).toContain('no results');
    
    // Notification should auto-dismiss
    await page.waitForTimeout(5000);
    
    const isNotificationGone = await page.evaluate(() => {
      const notification = document.querySelector('[data-testid="notification-center"] .notification');
      return !notification || notification.classList.contains('dismissing');
    });
    
    expect(isNotificationGone).toBe(true);
  });
}); 