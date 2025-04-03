import CryptoJS from 'crypto-js';
import registry from '../../ModuleRegistry';

/**
 * Utility functions for cryptographic operations
 * Provides helper methods for encryption, hashing, and secure random generation
 */
const CryptoHelpers = {
  /**
   * Generate a secure random string of specified length
   * @param {number} length - Length of the random string
   * @param {boolean} includeSpecialChars - Whether to include special characters
   * @returns {string} Random string
   */
  generateRandomString(length = 16, includeSpecialChars = true) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allowedChars = includeSpecialChars ? chars + specialChars : chars;
    
    // Generate random bytes
    const randomBytes = CryptoJS.lib.WordArray.random(length);
    const randomBytesHex = randomBytes.toString(CryptoJS.enc.Hex);
    
    // Convert to characters
    let result = '';
    for (let i = 0; i < length; i++) {
      // Use two hex chars (byte) to get an index for allowed chars
      const hexPair = randomBytesHex.substr(i * 2, 2);
      const index = parseInt(hexPair, 16) % allowedChars.length;
      result += allowedChars.charAt(index);
    }
    
    return result;
  },
  
  /**
   * Generate a secure password
   * @param {number} length - Length of the password
   * @param {Object} options - Password generation options
   * @returns {string} Generated password
   */
  generatePassword(length = 12, options = {}) {
    const defaultOptions = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      minUppercase: 1,
      minLowercase: 1,
      minNumbers: 1,
      minSpecialChars: 1
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Character sets
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Build character pool
    let charPool = '';
    if (config.includeUppercase) charPool += uppercaseChars;
    if (config.includeLowercase) charPool += lowercaseChars;
    if (config.includeNumbers) charPool += numberChars;
    if (config.includeSpecialChars) charPool += specialChars;
    
    if (charPool.length === 0) {
      throw new Error('Cannot generate password: No character sets selected');
    }
    
    // Check if minimum requirements are possible
    const minRequired = (config.includeUppercase ? config.minUppercase : 0) +
                        (config.includeLowercase ? config.minLowercase : 0) +
                        (config.includeNumbers ? config.minNumbers : 0) +
                        (config.includeSpecialChars ? config.minSpecialChars : 0);
    
    if (minRequired > length) {
      throw new Error('Cannot generate password: Minimum requirements exceed password length');
    }
    
    // Generate basic random password
    let password = '';
    
    // Ensure minimum requirements
    if (config.includeUppercase && config.minUppercase > 0) {
      for (let i = 0; i < config.minUppercase; i++) {
        const randomIndex = CryptoJS.lib.WordArray.random(1).words[0] & 0xFF % uppercaseChars.length;
        password += uppercaseChars.charAt(Math.abs(randomIndex) % uppercaseChars.length);
      }
    }
    
    if (config.includeLowercase && config.minLowercase > 0) {
      for (let i = 0; i < config.minLowercase; i++) {
        const randomIndex = CryptoJS.lib.WordArray.random(1).words[0] & 0xFF % lowercaseChars.length;
        password += lowercaseChars.charAt(Math.abs(randomIndex) % lowercaseChars.length);
      }
    }
    
    if (config.includeNumbers && config.minNumbers > 0) {
      for (let i = 0; i < config.minNumbers; i++) {
        const randomIndex = CryptoJS.lib.WordArray.random(1).words[0] & 0xFF % numberChars.length;
        password += numberChars.charAt(Math.abs(randomIndex) % numberChars.length);
      }
    }
    
    if (config.includeSpecialChars && config.minSpecialChars > 0) {
      for (let i = 0; i < config.minSpecialChars; i++) {
        const randomIndex = CryptoJS.lib.WordArray.random(1).words[0] & 0xFF % specialChars.length;
        password += specialChars.charAt(Math.abs(randomIndex) % specialChars.length);
      }
    }
    
    // Fill the rest with random characters from the pool
    const remaining = length - password.length;
    for (let i = 0; i < remaining; i++) {
      const randomIndex = CryptoJS.lib.WordArray.random(1).words[0] & 0xFF % charPool.length;
      password += charPool.charAt(Math.abs(randomIndex) % charPool.length);
    }
    
    // Shuffle the password characters
    return this.shuffleString(password);
  },
  
  /**
   * Shuffle a string (used for password generation)
   * @param {string} str - String to shuffle
   * @returns {string} Shuffled string
   */
  shuffleString(str) {
    const array = str.split('');
    
    // Fisher-Yates shuffle algorithm
    for (let i = array.length - 1; i > 0; i--) {
      // Generate random index using CryptoJS
      const randomBytes = CryptoJS.lib.WordArray.random(4);
      const randomInt = randomBytes.words[0] & 0x7FFFFFFF; // Ensure positive number
      const j = randomInt % (i + 1);
      
      // Swap elements
      [array[i], array[j]] = [array[j], array[i]];
    }
    
    return array.join('');
  },
  
  /**
   * Generate a hash of a string using SHA-512
   * @param {string} input - String to hash
   * @param {string} salt - Optional salt to add to the hash
   * @returns {string} SHA-512 hash
   */
  sha512Hash(input, salt = '') {
    return CryptoJS.SHA512(salt + input).toString(CryptoJS.enc.Hex);
  },
  
  /**
   * Calculate the strength of a password
   * @param {string} password - Password to evaluate
   * @returns {Object} Strength assessment
   */
  assessPasswordStrength(password) {
    if (!password) {
      return {
        score: 0,
        strength: 'None',
        feedback: 'No password provided'
      };
    }
    
    let score = 0;
    const feedback = [];
    
    // Length check
    if (password.length < 8) {
      feedback.push('Password is too short');
    } else {
      score += Math.min(Math.floor(password.length / 2), 10);
    }
    
    // Character variety
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[^A-Za-z0-9]/.test(password);
    
    score += hasUppercase ? 5 : 0;
    score += hasLowercase ? 5 : 0;
    score += hasNumbers ? 5 : 0;
    score += hasSpecialChars ? 5 : 0;
    
    if (!hasUppercase) feedback.push('Add uppercase letters');
    if (!hasLowercase) feedback.push('Add lowercase letters');
    if (!hasNumbers) feedback.push('Add numbers');
    if (!hasSpecialChars) feedback.push('Add special characters');
    
    // Repeated characters and patterns
    const repeatedChars = password.match(/(.)\1{2,}/g);
    if (repeatedChars) {
      score -= repeatedChars.length * 2;
      feedback.push('Avoid repeated characters');
    }
    
    // Sequential characters
    const sequentialPatterns = [
      'abcdef', 'qwerty', 'asdfgh', 'zxcvbn',
      '123456', '098765'
    ];
    
    for (const pattern of sequentialPatterns) {
      if (password.toLowerCase().includes(pattern)) {
        score -= 5;
        feedback.push('Avoid sequential characters');
        break;
      }
    }
    
    // Common words check (simplified)
    const commonWords = [
      'password', 'admin', '123456', 'qwerty', 'welcome',
      'letmein', 'monkey', 'dragon', 'baseball', 'football',
      'secret', 'abc123', 'password123'
    ];
    
    for (const word of commonWords) {
      if (password.toLowerCase().includes(word)) {
        score -= 10;
        feedback.push('Avoid common words or patterns');
        break;
      }
    }
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(score, 40));
    
    // Determine strength category
    let strength;
    if (score < 10) {
      strength = 'Very Weak';
    } else if (score < 20) {
      strength = 'Weak';
    } else if (score < 30) {
      strength = 'Moderate';
    } else if (score < 35) {
      strength = 'Strong';
    } else {
      strength = 'Very Strong';
    }
    
    // If no specific feedback was given but score is not max, add generic advice
    if (feedback.length === 0 && score < 35) {
      feedback.push('Make your password longer and more complex');
    }
    
    return {
      score,
      strength,
      feedback: feedback.length > 0 ? feedback.join('. ') : 'Good password'
    };
  },
  
  /**
   * Encrypt data with AES using a password
   * @param {string|Object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {Object} Encrypted data object
   */
  encryptData(data, password) {
    // Convert data to string if it's an object
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Create salt and IV
    const salt = CryptoJS.lib.WordArray.random(128/8);
    const iv = CryptoJS.lib.WordArray.random(128/8);
    
    // Generate key from password and salt using PBKDF2
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 10000
    });
    
    // Encrypt the data
    const encrypted = CryptoJS.AES.encrypt(dataStr, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC
    });
    
    // Combined everything into a single object
    return {
      encrypted: true,
      salt: salt.toString(CryptoJS.enc.Hex),
      iv: iv.toString(CryptoJS.enc.Hex),
      data: encrypted.toString(),
      algorithm: 'aes-256',
      hash: this.sha512Hash(dataStr).slice(0, 16) // Store hash prefix for verification
    };
  },
  
  /**
   * Decrypt data with AES using a password
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - Decryption password
   * @returns {string|Object} Decrypted data
   */
  decryptData(encryptedData, password) {
    // Extract encryption details
    const { salt, iv, data, algorithm } = encryptedData;
    
    if (!salt || !iv || !data) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Verify algorithm
    if (algorithm !== 'aes-256') {
      throw new Error('Unsupported encryption algorithm');
    }
    
    try {
      // Parse salt and IV
      const saltBytes = CryptoJS.enc.Hex.parse(salt);
      const ivBytes = CryptoJS.enc.Hex.parse(iv);
      
      // Generate key from password and salt
      const key = CryptoJS.PBKDF2(password, saltBytes, {
        keySize: 256/32,
        iterations: 10000
      });
      
      // Decrypt the data
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: ivBytes,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
      });
      
      // Convert to string
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedStr) {
        throw new Error('Invalid password or corrupted data');
      }
      
      // Verify hash if provided in encrypted data
      if (encryptedData.hash) {
        const dataHash = this.sha512Hash(decryptedStr).slice(0, 16);
        if (dataHash !== encryptedData.hash) {
          throw new Error('Data integrity check failed');
        }
      }
      
      // Try to parse as JSON, return as string if not valid JSON
      try {
        return JSON.parse(decryptedStr);
      } catch (e) {
        return decryptedStr;
      }
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  },
  
  /**
   * Encrypt a file using SHA-512 for GitHub storage
   * @param {Object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @param {string} accessLevel - Access level for basic information ('public', 'viewer', 'editor', 'admin')
   * @returns {Object} Encrypted file ready for storage
   */
  encryptFileForGitHub(data, password, accessLevel = 'viewer') {
    if (!data) {
      throw new Error('No data provided for encryption');
    }
    
    try {
      // Create a deep copy of the data
      const dataCopy = JSON.parse(JSON.stringify(data));
      
      // Extract basic information that will be accessible without full decryption
      const basicInfo = {
        id: data.id,
        name: data.name,
        type: data.type,
        parent: data.parent,
        description: data.description ? `${data.description.substring(0, 50)}...` : null,
        access_level: accessLevel,
        encrypted: true,
        encrypted_timestamp: new Date().toISOString()
      };
      
      // Encrypt the full data
      const encryptedContent = this.encryptData(dataCopy, password);
      
      // Create the final file structure
      return {
        ...basicInfo,
        content: encryptedContent
      };
    } catch (error) {
      throw new Error(`Error encrypting file: ${error.message}`);
    }
  },
  
  /**
   * Decrypt a file retrieved from GitHub
   * @param {Object} encryptedFile - Encrypted file from GitHub
   * @param {string} password - Decryption password
   * @returns {Object} Decrypted data
   */
  decryptFileFromGitHub(encryptedFile, password) {
    if (!encryptedFile || !encryptedFile.content || !encryptedFile.content.encrypted) {
      return encryptedFile; // Not encrypted or invalid format
    }
    
    try {
      // Decrypt the content
      const decryptedContent = this.decryptData(encryptedFile.content, password);
      
      // Merge with basic info
      return {
        ...encryptedFile,
        ...decryptedContent,
        content: decryptedContent // Replace encrypted content with decrypted
      };
    } catch (error) {
      // If decryption fails, return basic info with error
      console.error('Decryption failed:', error);
      return {
        ...encryptedFile,
        _decryption_error: error.message
      };
    }
  }
};

export default registry.register(
  'encryption.utils.CryptoHelpers',
  CryptoHelpers,
  [],
  {
    description: 'Cryptographic utility functions for encryption operations',
    usage: 'Used by the encryption system for hash generation, encryption/decryption, and password management'
  }
); 