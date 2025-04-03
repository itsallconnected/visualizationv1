/**
 * Jest setup file for the AI Alignment Visualization project
 * This file configures the test environment for all Jest tests
 */

// Import necessary testing libraries
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';

// Configure testing-library
configure({ 
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock browser APIs that might not exist in Jest environment
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
    this.observedEntries = [];
  }

  observe(element) {
    this.elements.add(element);
    this.observedEntries.push({
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRatio: 1,
      intersectionRect: element.getBoundingClientRect(),
      isIntersecting: true,
      rootBounds: null,
      target: element,
      time: Date.now(),
    });

    // Call the callback function synchronously
    this.callback(this.observedEntries, this);
  }

  unobserve(element) {
    this.elements.delete(element);
    this.observedEntries = this.observedEntries.filter(entry => entry.target !== element);
  }

  disconnect() {
    this.elements.clear();
    this.observedEntries = [];
  }
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
  }

  observe(element) {
    this.elements.add(element);
    this.callback([{ target: element }], this);
  }

  unobserve(element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }
}

global.ResizeObserver = MockResizeObserver;

// Mock requestAnimationFrame and cancelAnimationFrame
let lastTime = 0;
global.requestAnimationFrame = callback => {
  const currentTime = Date.now();
  const timeToCall = Math.max(0, 16 - (currentTime - lastTime));
  const id = setTimeout(() => callback(currentTime + timeToCall), timeToCall);
  lastTime = currentTime + timeToCall;
  return id;
};

global.cancelAnimationFrame = id => {
  clearTimeout(id);
};

// Mock THREE.js module
jest.mock('three', () => {
  const actualThree = jest.requireActual('three');
  
  // Create basic mock implementations for THREE classes
  class MockScene {
    constructor() {
      this.children = [];
      this.add = jest.fn(child => this.children.push(child));
      this.remove = jest.fn(child => {
        const index = this.children.indexOf(child);
        if (index !== -1) this.children.splice(index, 1);
      });
    }
  }
  
  class MockCamera {
    constructor() {
      this.position = { x: 0, y: 0, z: 0 };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.updateProjectionMatrix = jest.fn();
    }
  }
  
  class MockRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.setSize = jest.fn();
      this.render = jest.fn();
      this.setPixelRatio = jest.fn();
      this.setClearColor = jest.fn();
    }
  }
  
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    
    copy(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
  }
  
  // Return a mix of actual THREE exports and our mocks
  return {
    ...actualThree,
    Scene: MockScene,
    PerspectiveCamera: MockCamera,
    WebGLRenderer: MockRenderer,
    Vector3: MockVector3,
  };
});

// Mock TWEEN.js module
jest.mock('@tweenjs/tween.js', () => {
  const Tween = function(object) {
    this.object = object;
    this.isPlaying = false;
    
    this.to = jest.fn().mockReturnThis();
    this.from = jest.fn().mockReturnThis();
    this.delay = jest.fn().mockReturnThis();
    this.easing = jest.fn().mockReturnThis();
    this.onUpdate = jest.fn().mockReturnThis();
    this.onStart = jest.fn().mockReturnThis();
    this.onComplete = jest.fn().mockReturnThis();
    this.repeat = jest.fn().mockReturnThis();
    this.yoyo = jest.fn().mockReturnThis();
    
    this.start = jest.fn(() => {
      this.isPlaying = true;
      return this;
    });
    
    this.pause = jest.fn(() => {
      this.isPlaying = false;
      return this;
    });
    
    this.resume = jest.fn(() => {
      this.isPlaying = true;
      return this;
    });
    
    return this;
  };
  
  return {
    Tween,
    update: jest.fn(),
    remove: jest.fn(),
    Easing: {
      Linear: { None: 'Linear.None' },
      Quadratic: { 
        In: 'Quadratic.In',
        Out: 'Quadratic.Out',
        InOut: 'Quadratic.InOut',
      },
      Cubic: {
        In: 'Cubic.In',
        Out: 'Cubic.Out',
        InOut: 'Cubic.InOut',
      },
      Bounce: {
        In: 'Bounce.In',
        Out: 'Bounce.Out',
        InOut: 'Bounce.InOut',
      },
    },
  };
});

// Set up console mocks to keep tests tidy
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Silence specific expected warnings or errors in tests
console.error = (...args) => {
  // Do not log errors about act() warnings - these are common in testing async components
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning: An update to')) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  // Silence specific expected warnings
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Some expected warning')) {
    return;
  }
  originalConsoleWarn(...args);
};

// Cleanup after tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
}); 