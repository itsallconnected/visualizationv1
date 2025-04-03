// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React from 'react';
import registry from '../ModuleRegistry';

// Implement component here

/**
 * Utility functions for string manipulation and validation
 * Provides common operations on strings used throughout the application
 */
const StringUtils = {
  /**
   * Truncate a string to a maximum length and add ellipsis if needed
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} ellipsis - Ellipsis string (default: '...')
   * @returns {string} - Truncated string
   */
  truncate(str, maxLength, ellipsis = '...') {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    
    return str.substring(0, maxLength - ellipsis.length) + ellipsis;
  },
  
  /**
   * Capitalize the first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   */
  capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    if (str.length === 0) return str;
    
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  /**
   * Convert a string to title case
   * @param {string} str - String to convert
   * @returns {string} - Title case string
   */
  titleCase(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },
  
  /**
   * Convert a string to camel case
   * @param {string} str - String to convert
   * @returns {string} - Camel case string
   */
  camelCase(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .replace(/[\s-_]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/[\s-_]+$/, '')
      .replace(/^[\s-_]+/, '')
      .replace(/^[A-Z]/, c => c.toLowerCase());
  },
  
  /**
   * Convert a string to kebab case (dash-separated)
   * @param {string} str - String to convert
   * @returns {string} - Kebab case string
   */
  kebabCase(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
  },
  
  /**
   * Convert a string to snake case (underscore_separated)
   * @param {string} str - String to convert
   * @returns {string} - Snake case string
   */
  snakeCase(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  },
  
  /**
   * Check if a string is empty or contains only whitespace
   * @param {string} str - String to check
   * @returns {boolean} - True if the string is empty or whitespace
   */
  isBlank(str) {
    return !str || typeof str !== 'string' || str.trim().length === 0;
  },
  
  /**
   * Check if a string has content (not empty and not just whitespace)
   * @param {string} str - String to check
   * @returns {boolean} - True if the string has content
   */
  hasContent(str) {
    return str && typeof str === 'string' && str.trim().length > 0;
  },
  
  /**
   * Strip HTML tags from a string
   * @param {string} html - HTML string
   * @returns {string} - Plain text string
   */
  stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },
  
  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  
  /**
   * Extract the file extension from a filename
   * @param {string} filename - Filename to process
   * @returns {string} - File extension (without the dot)
   */
  getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    
    const parts = filename.split('.');
    if (parts.length === 1) return '';
    
    return parts[parts.length - 1].toLowerCase();
  },
  
  /**
   * Generate a slug from a string (URL-friendly version)
   * @param {string} str - String to convert
   * @returns {string} - Slug
   */
  slugify(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove non-word chars
      .replace(/[\s_-]+/g, '-')   // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, '');   // Remove leading/trailing hyphens
  },
  
  /**
   * Pad a string to a certain length with a padding character
   * @param {string} str - String to pad
   * @param {number} length - Target length
   * @param {string} padChar - Character to pad with (default: ' ')
   * @param {boolean} padEnd - Whether to pad at the end (default: true)
   * @returns {string} - Padded string
   */
  pad(str, length, padChar = ' ', padEnd = true) {
    if (!str || typeof str !== 'string') return '';
    if (str.length >= length) return str;
    
    const padding = padChar.repeat(length - str.length);
    return padEnd ? str + padding : padding + str;
  },
  
  /**
   * Convert a string to a hash number
   * @param {string} str - String to hash
   * @returns {number} - Hash value
   */
  hashCode(str) {
    if (!str || typeof str !== 'string') return 0;
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },
  
  /**
   * Generate a random string of specified length
   * @param {number} length - Length of the string
   * @param {string} charset - Characters to use (default: alphanumeric)
   * @returns {string} - Random string
   */
  randomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    const charsetLength = charset.length;
    
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charsetLength));
    }
    
    return result;
  },
  
  /**
   * Format a number with commas as thousands separators
   * @param {number} num - Number to format
   * @returns {string} - Formatted number
   */
  formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '';
    
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  
  /**
   * Pluralize a word based on count
   * @param {string} singular - Singular form
   * @param {string} plural - Plural form
   * @param {number} count - Count
   * @returns {string} - Correct form based on count
   */
  pluralize(singular, plural, count) {
    return count === 1 ? singular : plural;
  },
  
  /**
   * Format a byte size into a human-readable string
   * @param {number} bytes - Size in bytes
   * @param {number} decimals - Number of decimal places (default: 2)
   * @returns {string} - Formatted size string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
  
  /**
   * Highlight occurrences of a substring within a string
   * @param {string} text - Original text
   * @param {string} highlight - Text to highlight
   * @param {string} highlightClass - CSS class for highlighting
   * @returns {string} - HTML with highlighted text
   */
  highlightText(text, highlight, highlightClass = 'highlighted') {
    if (!text || !highlight || typeof text !== 'string' || typeof highlight !== 'string') {
      return text || '';
    }
    
    if (highlight.trim() === '') return text;
    
    const escapedHighlight = highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    
    return text.replace(regex, `<span class="${highlightClass}">$1</span>`);
  },
  
  /**
   * Compare two strings for similarity (Levenshtein distance)
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} - Similarity score (0-1, where 1 is identical)
   */
  stringSimilarity(a, b) {
    if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return 0;
    if (a === b) return 1;
    
    const track = Array(b.length + 1).fill(null).map(() => 
      Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= b.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    const distance = track[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    
    return maxLength === 0 ? 1 : (1 - distance / maxLength);
  }
};

export default registry.register(
  'utils.StringUtils',
  StringUtils,
  [],
  {
    description: 'Utility functions for string manipulation and validation',
    usage: 'Used throughout the application for common string operations'
  }
);

