import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';

// Zod schema for user configuration validation
const UserConfigSchema = z.object({
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    storageBucket: z.string().min(1),
    messagingSenderId: z.string().min(1),
    appId: z.string().min(1)
  }),
  openai: z.object({
    apiKey: z.string().min(1)
  }),
  appSettings: z.object({
    topicDescription: z.string().min(1)
  }),
  firstRun: z.boolean()
});

// Infer TypeScript type from Zod schema
export type UserConfig = z.infer<typeof UserConfigSchema>;

const CONFIG_FILE_NAME = 'config.json';

/**
 * Get the full path to the user config file
 * Uses cross-platform path logic that works in both Electron and Node.js
 */
export function getConfigPath(): string {
  const appName = getAppName();
  const userDataPath = getUserDataPath(appName);
  return path.join(userDataPath, CONFIG_FILE_NAME);
}

/**
 * Get the appropriate app name based on the environment
 */
function getAppName(): string {
  try {
    // Try to use Electron's app.getName() if available (production builds use 'Adjutant')
    const { app } = require('electron');
    if (app && app.getName) {
      return app.getName();
    }
  } catch (error) {
    // Fallback for Node.js processes or development
  }
  
  // Default to package.json name for development
  return 'adjutant';
}

/**
 * Get the user data directory path for the given app name
 * Handles different operating systems and contexts properly
 */
function getUserDataPath(appName: string): string {
  try {
    // Try to use Electron's app.getPath() if available (most reliable)
    const { app } = require('electron');
    if (app && app.getPath) {
      return app.getPath('userData');
    }
  } catch (error) {
    // Fallback for Node.js processes: construct path manually
  }
  
  // Manual path construction for Node.js contexts
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', appName);
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', appName);
    case 'linux':
    default:
      // Linux and other Unix-like systems
      return path.join(homeDir, '.config', appName);
  }
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
    
    // Migrate old config format if needed
    const migratedConfig = migrateConfig(config);
    
    // Validate the config structure
    if (!isConfigValid(migratedConfig)) {
      const errors = getConfigValidationErrors(migratedConfig);
      console.error('Invalid config structure found:', errors);
      return null;
    }

    // Save migrated config if it was updated
    if (migratedConfig !== config) {
      saveUserConfig(migratedConfig);
    }

    console.log('User config loaded successfully from:', configPath);
    return migratedConfig;
  } catch (error) {
    console.error('Error loading user config:', error);
    return null;
  }
}

/**
 * Migrate old config format to new format
 */
function migrateConfig(config: any): UserConfig {
  // If appSettings doesn't exist, add it with default values
  if (!config.appSettings) {
    config.appSettings = {
      topicDescription: 'developer-focused AI stories'
    };
  }
  
  // If topicDescription doesn't exist in appSettings, add it
  if (!config.appSettings.topicDescription) {
    config.appSettings.topicDescription = 'developer-focused AI stories';
  }
  
  return config as UserConfig;
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
 * Validate that config has all required fields using Zod schema
 */
export function isConfigValid(config: any): config is UserConfig {
  const result = UserConfigSchema.safeParse(config);
  return result.success;
}

/**
 * Get detailed validation errors for debugging
 */
export function getConfigValidationErrors(config: any): string[] {
  const result = UserConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }
  
  return result.error.errors.map(err => 
    `${err.path.join('.')}: ${err.message}`
  );
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
    appSettings: {
      topicDescription: 'developer-focused AI stories'
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