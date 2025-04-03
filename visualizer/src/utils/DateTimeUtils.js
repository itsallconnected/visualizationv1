// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React from 'react';
import registry from '../ModuleRegistry';

/**
 * Utility functions for date and time handling
 * Provides formatting, parsing, and manipulation capabilities
 */
const DateTimeUtils = {
  /**
   * Format a date to a readable string
   * @param {Date|string|number} date - Date object, ISO string, or timestamp
   * @param {string} format - Format string (optional)
   * @returns {string} - Formatted date string
   */
  formatDate(date, format = 'default') {
    if (!date) return '';
    
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';
    
    try {
      switch (format) {
        case 'default':
          return dateObj.toLocaleDateString();
        case 'full':
          return dateObj.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        case 'short':
          return dateObj.toLocaleDateString(undefined, {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric'
          });
        case 'iso':
          return dateObj.toISOString();
        case 'relative':
          return this.getRelativeTimeString(dateObj);
        default:
          return dateObj.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  },
  
  /**
   * Format a time to a readable string
   * @param {Date|string|number} date - Date object, ISO string, or timestamp
   * @param {string} format - Format string (optional)
   * @returns {string} - Formatted time string
   */
  formatTime(date, format = 'default') {
    if (!date) return '';
    
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';
    
    try {
      switch (format) {
        case 'default':
          return dateObj.toLocaleTimeString();
        case 'short':
          return dateObj.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit'
          });
        case 'full':
          return dateObj.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
        case '24hour':
          return dateObj.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        default:
          return dateObj.toLocaleTimeString();
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  },
  
  /**
   * Format a date and time to a readable string
   * @param {Date|string|number} date - Date object, ISO string, or timestamp
   * @param {string} format - Format string (optional)
   * @returns {string} - Formatted date and time string
   */
  formatDateTime(date, format = 'default') {
    if (!date) return '';
    
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';
    
    try {
      switch (format) {
        case 'default':
          return dateObj.toLocaleString();
        case 'full':
          return dateObj.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
          });
        case 'short':
          return dateObj.toLocaleString(undefined, {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
        case 'iso':
          return dateObj.toISOString();
        case 'relative':
          return this.getRelativeTimeString(dateObj);
        default:
          return dateObj.toLocaleString();
      }
    } catch (error) {
      console.error('Error formatting date time:', error);
      return '';
    }
  },
  
  /**
   * Parse a date string or timestamp to a Date object
   * @param {Date|string|number} date - Date object, ISO string, or timestamp
   * @returns {Date|null} - Date object or null if invalid
   */
  parseDate(date) {
    if (!date) return null;
    
    try {
      // If already a Date object
      if (date instanceof Date) {
        return isNaN(date.getTime()) ? null : date;
      }
      
      // If a number (timestamp)
      if (typeof date === 'number') {
        const parsedDate = new Date(date);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      
      // If a string
      if (typeof date === 'string') {
        const parsedDate = new Date(date);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  },
  
  /**
   * Get a relative time string (e.g., "5 minutes ago")
   * @param {Date|string|number} date - Date object, ISO string, or timestamp
   * @returns {string} - Relative time string
   */
  getRelativeTimeString(date) {
    const dateObj = this.parseDate(date);
    if (!dateObj) return '';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    // Handle future dates
    if (diffInSeconds < 0) {
      const absDiff = Math.abs(diffInSeconds);
      
      if (absDiff < 60) return 'in a few seconds';
      if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)} minutes`;
      if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)} hours`;
      if (absDiff < 2592000) return `in ${Math.floor(absDiff / 86400)} days`;
      if (absDiff < 31536000) return `in ${Math.floor(absDiff / 2592000)} months`;
      return `in ${Math.floor(absDiff / 31536000)} years`;
    }
    
    // Handle past dates
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  },
  
  /**
   * Calculate the time difference between two dates
   * @param {Date|string|number} start - Start date
   * @param {Date|string|number} end - End date
   * @returns {Object} - Object with difference in various units
   */
  getDateDifference(start, end) {
    const startDate = this.parseDate(start);
    const endDate = this.parseDate(end || new Date());
    
    if (!startDate || !endDate) return null;
    
    const diffInMs = endDate - startDate;
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    return {
      milliseconds: diffInMs,
      seconds: diffInSeconds,
      minutes: diffInMinutes,
      hours: diffInHours,
      days: diffInDays
    };
  },
  
  /**
   * Format a duration in milliseconds to a readable string
   * @param {number} durationMs - Duration in milliseconds
   * @param {string} format - Format string (optional)
   * @returns {string} - Formatted duration string
   */
  formatDuration(durationMs, format = 'default') {
    if (typeof durationMs !== 'number' || isNaN(durationMs)) return '';
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    
    switch (format) {
      case 'full':
        return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
      case 'short':
        if (days > 0) return `${days}d ${remainingHours}h`;
        if (hours > 0) return `${hours}h ${remainingMinutes}m`;
        if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
        return `${seconds}s`;
      case 'compact':
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
      default:
        if (days > 0) return `${days} days, ${remainingHours} hours`;
        if (hours > 0) return `${hours} hours, ${remainingMinutes} minutes`;
        if (minutes > 0) return `${minutes} minutes, ${remainingSeconds} seconds`;
        return `${seconds} seconds`;
    }
  },
  
  /**
   * Check if a date is today
   * @param {Date|string|number} date - Date to check
   * @returns {boolean} - True if the date is today
   */
  isToday(date) {
    const dateObj = this.parseDate(date);
    if (!dateObj) return false;
    
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  },
  
  /**
   * Check if a date is in the past
   * @param {Date|string|number} date - Date to check
   * @returns {boolean} - True if the date is in the past
   */
  isPast(date) {
    const dateObj = this.parseDate(date);
    if (!dateObj) return false;
    
    return dateObj < new Date();
  },
  
  /**
   * Check if a date is in the future
   * @param {Date|string|number} date - Date to check
   * @returns {boolean} - True if the date is in the future
   */
  isFuture(date) {
    const dateObj = this.parseDate(date);
    if (!dateObj) return false;
    
    return dateObj > new Date();
  },
  
  /**
   * Add time to a date
   * @param {Date|string|number} date - Date to add to
   * @param {number} amount - Amount to add
   * @param {string} unit - Unit to add (days, hours, minutes, seconds)
   * @returns {Date} - New date with added time
   */
  addTime(date, amount, unit = 'days') {
    const dateObj = this.parseDate(date);
    if (!dateObj) return null;
    
    const newDate = new Date(dateObj);
    
    switch (unit.toLowerCase()) {
      case 'years':
        newDate.setFullYear(newDate.getFullYear() + amount);
        break;
      case 'months':
        newDate.setMonth(newDate.getMonth() + amount);
        break;
      case 'days':
        newDate.setDate(newDate.getDate() + amount);
        break;
      case 'hours':
        newDate.setHours(newDate.getHours() + amount);
        break;
      case 'minutes':
        newDate.setMinutes(newDate.getMinutes() + amount);
        break;
      case 'seconds':
        newDate.setSeconds(newDate.getSeconds() + amount);
        break;
      default:
        return dateObj;
    }
    
    return newDate;
  }
};

export default registry.register(
  'utils.DateTimeUtils',
  DateTimeUtils,
  [],
  {
    description: 'Utility functions for date and time handling',
    usage: 'Used throughout the application for date formatting, parsing, and manipulation'
  }
);

