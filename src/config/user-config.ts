import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UserConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  openai: {
    apiKey: string;
  };
  firstRun: boolean;
}

const CONFIG_FILE_NAME = 'config.json';

/**
 * Get the full path to the user config file
 * Works in both Electron main process and Node.js child processes
 */
export function getConfigPath(): string {
  let userDataPath: string;

  try {
    // Try to use Electron's app.getPath() if available (main process)
    const { app } = require('electron');
    if (app && app.getPath) {
      userDataPath = app.getPath('userData');
    } else {
      throw new Error('Electron app not available');
    }
  } catch (error) {
    // Fallback for Node.js processes: construct the path manually
    const appName = 'adjutant'; // Must match package.json name in development
    const platform = process.platform;
    
    if (platform === 'darwin') {
      userDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
    } else if (platform === 'win32') {
      userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
    } else {
      // Linux and others
      userDataPath = path.join(os.homedir(), '.config', appName);
    }
  }

  return path.join(userDataPath, CONFIG_FILE_NAME);
}

/**
 * Check if user config file exists
 */
export function configExists(): boolean {
  return fs.existsSync(getConfigPath());
}

/**
 * Load user configuration from JSON file
 * Returns null if file doesn't exist or is invalid
 */
export function loadUserConfig(): UserConfig | null {
  try {
    const configPath = getConfigPath();
    
    if (!fs.existsSync(configPath)) {
      console.log('Config file does not exist:', configPath);
      return null;
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as UserConfig;
    
    // Validate the config structure
    if (!isConfigValid(config)) {
      console.error('Invalid config structure found');
      return null;
    }

    console.log('User config loaded successfully from:', configPath);
    return config;
  } catch (error) {
    console.error('Error loading user config:', error);
    return null;
  }
}

/**
 * Save user configuration to JSON file
 */
export function saveUserConfig(config: UserConfig): boolean {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);
    
    // Ensure the user data directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('User config saved successfully to:', configPath);
    return true;
  } catch (error) {
    console.error('Error saving user config:', error);
    return false;
  }
}

/**
 * Validate that config has all required fields
 */
export function isConfigValid(config: any): config is UserConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check Firebase config
  if (!config.firebase || typeof config.firebase !== 'object') {
    return false;
  }

  const requiredFirebaseFields = [
    'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
  ];

  for (const field of requiredFirebaseFields) {
    if (!config.firebase[field] || typeof config.firebase[field] !== 'string') {
      return false;
    }
  }

  // Check OpenAI config
  if (!config.openai || typeof config.openai !== 'object') {
    return false;
  }

  if (!config.openai.apiKey || typeof config.openai.apiKey !== 'string') {
    return false;
  }

  // Check firstRun flag
  if (typeof config.firstRun !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Create a default config structure (for first run)
 */
export function createDefaultConfig(): UserConfig {
  return {
    firebase: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    },
    openai: {
      apiKey: ''
    },
    firstRun: true
  };
}

/**
 * Delete the user config file (useful for testing/reset)
 */
export function deleteUserConfig(): boolean {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('User config deleted:', configPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting user config:', error);
    return false;
  }
} 