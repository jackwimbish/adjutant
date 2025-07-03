import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { APP_CONFIG } from './config/app-config';
import { 
  loadUserConfig, 
  saveUserConfig, 
  configExists, 
  isConfigValid, 
  UserConfig,
  getConfigPath
} from './config/user-config';

// Global references to windows
let mainWindow: BrowserWindow | null = null;
let userConfig: UserConfig | null = null;

// Window registry for data-driven window management
const windowRegistry = new Map<string, BrowserWindow | null>([
  ['main', null],
  ['api-config', null],
  ['settings', null],
  ['topic-settings', null],
  ['trash', null],
]);

// Window definitions configuration
interface WindowDefinition extends WindowConfig {
  id: string;
  menu?: {
    label: string;
    accelerator?: string;
  };
}

const windowDefinitions: WindowDefinition[] = [
  {
    id: 'main',
    width: APP_CONFIG.WINDOW_CONFIG.width,
    height: APP_CONFIG.WINDOW_CONFIG.height,
    title: 'Adjutant - AI News Aggregator',
    htmlFile: '../index.html',
    preloadFile: 'preload.js',
    resizable: true,
    modal: false,
    showMenuBar: true,
  },
  {
    id: 'api-config',
    width: 700,
    height: 800,
    title: 'API Configuration',
    htmlFile: 'windows/api-config.html',
    preloadFile: 'windows/api-config-preload.js',
    resizable: false,
    modal: true,
    showMenuBar: false,
    menu: {
      label: 'API Configuration...',
      accelerator: 'CmdOrCtrl+A',
    },
  },
  {
    id: 'settings',
    width: 600,
    height: 500,
    title: 'Settings',
    htmlFile: 'windows/settings.html',
    preloadFile: 'windows/settings-preload.js',
    resizable: false,
    modal: true,
    showMenuBar: false,
    menu: {
      label: 'Settings...',
      accelerator: 'CmdOrCtrl+,',
    },
  },
  {
    id: 'topic-settings',
    width: 600,
    height: 700,
    title: 'Topic Settings - Adjutant',
    htmlFile: 'windows/topic-settings.html',
    preloadFile: 'windows/topic-settings-preload.js',
    resizable: false,
    modal: true,
    showMenuBar: false,
  },
  {
    id: 'trash',
    width: 1000,
    height: 800,
    title: 'Trash - Not Relevant Articles',
    htmlFile: 'windows/trash.html',
    preloadFile: 'windows/trash-preload.js',
    resizable: true,
    modal: true,
    showMenuBar: false,
    menu: {
      label: 'Trash...',
      accelerator: 'CmdOrCtrl+T',
    },
  },
  {
    id: 'profile-management',
    width: 900,
    height: 800,
    title: 'Profile Management - Adjutant',
    htmlFile: 'windows/profile-management.html',
    preloadFile: 'windows/profile-management-preload.js',
    resizable: true,
    modal: true,
    showMenuBar: false,
    menu: {
      label: 'Profile Management...',
      accelerator: 'CmdOrCtrl+P',
    },
  },
];

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Setup all IPC handlers organized by functionality
 */
function setupIpcHandlers(): void {
  // Settings Configuration Handlers
  setupConfigHandlers();
  
  // API Testing Handlers
  setupApiTestHandlers();
  
  // Window Management Handlers
  setupWindowHandlers();
  
  // Learner Workflow Handlers
  setupLearnerHandlers();
  
  // Backward Compatibility Handlers
  setupLegacyHandlers();
}

/**
 * Handlers for configuration loading, saving, and validation
 */
function setupConfigHandlers(): void {
  // Generic config loading (used by both API config and settings)
  ipcMain.handle('config:load', async () => {
    try {
      return loadUserConfig();
    } catch (error) {
      console.error('Error loading config via IPC:', error);
      return null;
    }
  });

  // Full config saving (used by API configuration window)
  ipcMain.handle('config:save', async (event, config: UserConfig) => {
    try {
      const success = saveUserConfig(config);
      if (success) {
        userConfig = config;
        console.log('Full configuration saved successfully');
      }
      return success;
    } catch (error) {
      console.error('Error saving config via IPC:', error);
      return false;
    }
  });

  // Legacy handlers for backward compatibility
  ipcMain.handle('settings:load-config', async () => {
    try {
      return loadUserConfig();
    } catch (error) {
      console.error('Error loading config via IPC:', error);
      return null;
    }
  });

  ipcMain.handle('settings:save-config', async (event, config: UserConfig) => {
    try {
      const success = saveUserConfig(config);
      if (success) {
        userConfig = config;
        // Notify settings window that config was saved
        const settingsWindow = windowRegistry.get('settings');
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.send('settings:config-saved');
        }
      }
      return success;
    } catch (error) {
      console.error('Error saving config via IPC:', error);
      return false;
    }
  });

  ipcMain.handle('save-topic-settings', async (event, settings: { topicDescription: string }) => {
    try {
      const currentConfig = loadUserConfig();
      if (!currentConfig) {
        console.error('No user config found for topic settings update');
        return false;
      }

      // Update the app settings
      currentConfig.appSettings.topicDescription = settings.topicDescription;
      
      const success = saveUserConfig(currentConfig);
      if (success) {
        userConfig = currentConfig;
        console.log('Topic settings saved successfully');
      }
      return success;
    } catch (error) {
      console.error('Error saving topic settings:', error);
      return false;
    }
  });

  ipcMain.handle('load-config', async () => {
    try {
      return loadUserConfig();
    } catch (error) {
      console.error('Error loading config for topic settings:', error);
      return null;
    }
  });
}

/**
 * Handlers for testing API connections (Firebase and OpenAI)
 */
function setupApiTestHandlers(): void {
  // API testing handlers (used by API configuration window)
  ipcMain.handle('api-test:firebase', async (event, firebaseConfig: UserConfig['firebase']) => {
    try {
      // Test Firebase connection by attempting to initialize
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
      
      const testApp = initializeApp(firebaseConfig, 'test-app');
      const testDb = getFirestore(testApp);
      
      // If we get here without error, Firebase config is valid
      return { success: true, message: 'Firebase configuration is valid' };
    } catch (error: any) {
      console.error('Firebase test failed:', error);
      return { success: false, message: error.message || 'Firebase connection failed' };
    }
  });

  ipcMain.handle('api-test:openai', async (event, openaiConfig: UserConfig['openai']) => {
    try {
      const { OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: openaiConfig.apiKey,
      });

      // Test with a minimal API call
      await client.models.list();
      
      return { success: true, message: 'OpenAI connection successful' };
    } catch (error: any) {
      console.error('OpenAI test failed:', error);
      let message = 'OpenAI connection failed';
      
      if (error.status === 401) {
        message = 'Invalid API key';
      } else if (error.status === 403) {
        message = 'API key lacks necessary permissions';
      } else if (error.status === 429) {
        message = 'Rate limit exceeded';
      } else if (error.message) {
        message = error.message;
      }
      
      return { success: false, message };
    }
  });

  // Legacy handlers for backward compatibility
  ipcMain.handle('settings:test-firebase', async (event, firebaseConfig: UserConfig['firebase']) => {
    try {
      // Test Firebase connection by attempting to initialize
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
      
      const testApp = initializeApp(firebaseConfig, 'test-app-legacy');
      const testDb = getFirestore(testApp);
      
      // If we get here without error, Firebase config is valid
      return { success: true, message: 'Firebase configuration is valid' };
    } catch (error: any) {
      console.error('Firebase test failed:', error);
      return { success: false, message: error.message || 'Firebase connection failed' };
    }
  });

  ipcMain.handle('settings:test-openai', async (event, openaiConfig: UserConfig['openai']) => {
    try {
      const { OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: openaiConfig.apiKey,
      });

      // Test with a minimal API call
      await client.models.list();
      
      return { success: true, message: 'OpenAI connection successful' };
    } catch (error: any) {
      console.error('OpenAI test failed:', error);
      let message = 'OpenAI connection failed';
      
      if (error.status === 401) {
        message = 'Invalid API key';
      } else if (error.status === 403) {
        message = 'API key lacks necessary permissions';
      } else if (error.status === 429) {
        message = 'Rate limit exceeded';
      } else if (error.message) {
        message = error.message;
      }
      
      return { success: false, message };
    }
  });
}

/**
 * Handlers for window management (opening, closing, navigation)
 */
function setupWindowHandlers(): void {
  // API Configuration window handlers
  ipcMain.handle('window:close-api-config', () => {
    closeWindow('api-config');
  });

  ipcMain.on('open-api-config', () => {
    openWindow('api-config');
  });

  ipcMain.on('settings:open-api-config', () => {
    closeWindow('settings');
    openWindow('api-config');
  });

  // Settings window handlers
  ipcMain.on('settings:close-window', () => {
    closeWindow('settings');
  });

  ipcMain.on('settings:open-topic-settings', () => {
    closeWindow('settings');
    openWindow('topic-settings');
  });

  ipcMain.on('close-settings', () => {
    closeWindow('topic-settings');
  });

  ipcMain.on('open-api-settings', () => {
    closeWindow('topic-settings');
    openWindow('api-config');
  });

  ipcMain.on('open-settings', () => {
    openWindow('settings');
  });

  ipcMain.handle('workflow:fetch-stories', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot fetch stories - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }

      const { WorkflowService } = await import('./services/workflow-service');
      const workflowService = new WorkflowService(userConfig);
      return await workflowService.startStoryFetching();
      
    } catch (error) {
      console.error('Error starting workflow:', error);
      return { success: false, message: 'Failed to start story fetching' };
    }
  });

  ipcMain.on('trash:close-window', () => {
    closeWindow('trash');
  });

  // Add trash window article rating handlers
  ipcMain.handle('trash:unrate-article', async (event, articleUrl: string) => {
    try {
      if (!userConfig) {
        console.error('Cannot unrate article - no user configuration');
        return false;
      }
      
      const { ArticleService } = await import('./services/article-service');
      const articleService = new ArticleService(userConfig.firebase);
      await articleService.unrateArticle(articleUrl);
      return true;
      
    } catch (error) {
      console.error('Error unrating article:', error);
      return false;
    }
  });

  ipcMain.handle('trash:rate-article', async (event, articleUrl: string, isRelevant: boolean) => {
    try {
      if (!userConfig) {
        console.error('Cannot rate article - no user configuration');
        return false;
      }
      
      const { ArticleService } = await import('./services/article-service');
      const articleService = new ArticleService(userConfig.firebase);
      await articleService.rateArticle(articleUrl, isRelevant);
      return true;
      
    } catch (error) {
      console.error('Error rating article:', error);
      return false;
    }
  });

  ipcMain.on('open-trash', () => {
    openWindow('trash');
  });

  ipcMain.on('open-profile-management', () => {
    openWindow('profile-management');
  });

  ipcMain.on('window:close', () => {
    // Close the focused window
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.close();
    }
  });
}

/**
 * Handlers for learner workflow operations (profile generation and threshold checking)
 */
function setupLearnerHandlers(): void {
  ipcMain.handle('learner:generate-profile', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot generate profile - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }
      
      const { LearnerService } = await import('./services/learner-service');
      const learnerService = new LearnerService(userConfig);
      return await learnerService.generateProfile();
      
    } catch (error) {
      console.error('❌ Error in learner workflow:', error);
      return { 
        success: false, 
        message: `Profile generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });

  ipcMain.handle('learner:check-threshold', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot check threshold - no user configuration');
        return { 
          thresholdMet: false, 
          message: 'No user configuration available',
          relevantCount: 0,
          notRelevantCount: 0
        };
      }
      
      const { LearnerService } = await import('./services/learner-service');
      const learnerService = new LearnerService(userConfig);
      return await learnerService.checkThreshold();
      
    } catch (error) {
      console.error('❌ Error checking threshold:', error);
      return { 
        thresholdMet: false, 
        message: `Error checking rating threshold: ${error instanceof Error ? error.message : 'Unknown error'}`,
        relevantCount: 0,
        notRelevantCount: 0
      };
    }
  });

  ipcMain.handle('learner:get-profile', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot get profile - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }
      
      const { LearnerService } = await import('./services/learner-service');
      const learnerService = new LearnerService(userConfig);
      return await learnerService.getProfile();
      
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      return {
        success: false,
        message: `Error loading profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });

  ipcMain.handle('learner:delete-profile', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot delete profile - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }
      
      const { LearnerService } = await import('./services/learner-service');
      const learnerService = new LearnerService(userConfig);
      return await learnerService.deleteProfile();
      
    } catch (error) {
      console.error('❌ Error deleting profile:', error);
      return {
        success: false,
        message: `Error deleting profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });

  ipcMain.handle('learner:update-profile-manual', async (event, likes: string[], dislikes: string[]) => {
    try {
      if (!userConfig) {
        console.error('Cannot update profile - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }
      
      const { LearnerService } = await import('./services/learner-service');
      const learnerService = new LearnerService(userConfig);
      return await learnerService.updateProfileManual(likes, dislikes);
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return {
        success: false,
        message: `Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  });
}

/**
 * Legacy handlers for backward compatibility with renderer
 */
function setupLegacyHandlers(): void {
  ipcMain.handle('get-firebase-config', () => {
    if (!userConfig) {
      console.error('No user config available for Firebase');
      return null;
    }
    
    console.log('Main: Providing Firebase config via IPC:', userConfig.firebase.projectId);
    return userConfig.firebase;
  });
}

// ============================================================================
// WINDOW CREATION
// ============================================================================

// Window creation configuration interface
interface WindowConfig {
  width: number;
  height: number;
  title: string;
  htmlFile: string;
  preloadFile: string;
  resizable?: boolean;
  modal?: boolean;
  parent?: BrowserWindow;
  showMenuBar?: boolean;
  onClosed?: () => void;
  postCreate?: (window: BrowserWindow) => void;
}

/**
 * Factory function to create windows with consistent configuration
 * @param config - Window configuration options
 * @returns The created BrowserWindow instance
 */
function createWindow(config: WindowConfig): BrowserWindow {
  // Base window options with security defaults
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: config.width,
    height: config.height,
    title: config.title,
    resizable: config.resizable ?? true,
    modal: config.modal ?? false,
    parent: config.parent,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, config.preloadFile),
    },
  };

  // Create the window
  const window = new BrowserWindow(windowOptions);

  // Load the HTML file
  window.loadFile(path.join(__dirname, config.htmlFile));

  // Set menu bar visibility
  if (config.showMenuBar === false) {
    window.setMenuBarVisibility(false);
  }

  // Handle window closed event
  if (config.onClosed) {
    window.on('closed', config.onClosed);
  }

  // Open DevTools in development
  if (APP_CONFIG.DEV_TOOLS_OPEN) {
    window.webContents.openDevTools();
  }

  // Execute post-creation callback if provided
  if (config.postCreate) {
    config.postCreate(window);
  }

  return window;
}

/**
 * Generic function to open a window by ID
 * @param windowId - The ID of the window to open
 */
function openWindow(windowId: string): void {
  const windowDef = windowDefinitions.find(def => def.id === windowId);
  if (!windowDef) {
    console.error(`Window definition not found for ID: ${windowId}`);
    return;
  }

  const existingWindow = windowRegistry.get(windowId);
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus();
    return;
  }

  // Create window config with parent set to main window if modal
  const config: WindowConfig = {
    ...windowDef,
    parent: windowDef.modal ? mainWindow || undefined : undefined,
    onClosed: () => {
      windowRegistry.set(windowId, null);
    },
  };

  const newWindow = createWindow(config);
  windowRegistry.set(windowId, newWindow);
}



/**
 * Close a window by ID
 * @param windowId - The ID of the window to close
 */
function closeWindow(windowId: string): void {
  const window = windowRegistry.get(windowId);
  if (window && !window.isDestroyed()) {
    window.close();
  }
}



// Function to create the main application window
function createMainWindow(): void {
  const mainWindowDef = windowDefinitions.find(def => def.id === 'main');
  if (!mainWindowDef) {
    console.error('Main window definition not found');
    return;
  }

  const config: WindowConfig = {
    ...mainWindowDef,
    onClosed: () => {
      mainWindow = null;
      windowRegistry.set('main', null);
    },
    postCreate: (window) => {
      // Create application menu for main window
      createApplicationMenu();
    },
  };

  mainWindow = createWindow(config);
  windowRegistry.set('main', mainWindow);
}

// Function to create application menu
function createApplicationMenu(): void {
  // Build dynamic menu items from window definitions
  const dynamicMenuItems: Electron.MenuItemConstructorOptions[] = windowDefinitions
    .filter(def => def.menu) // Only include windows with menu definitions
    .map(def => ({
      label: def.menu!.label,
      accelerator: def.menu!.accelerator,
      click: () => openWindow(def.id),
    }));

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Adjutant',
      submenu: [
        ...dynamicMenuItems,
        { type: 'separator' },
        {
          label: 'Show Config Location',
          click: () => {
            const configPath = getConfigPath();
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'Config File Location',
              message: 'Configuration file location:',
              detail: configPath,
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}



// Function to initialize the application
async function initializeApp(): Promise<void> {
  // Setup IPC handlers first
  setupIpcHandlers();
  
  // Try to load existing configuration
  userConfig = loadUserConfig();
  
  if (!userConfig || !isConfigValid(userConfig) || userConfig.firstRun) {
    console.log('No valid configuration found or first run - showing API configuration window');
    
    // Show API configuration window first
    openWindow('api-config');
    
    // Wait for API configuration to be configured before continuing
    return new Promise((resolve) => {
      const checkConfig = () => {
        const apiConfigWindow = windowRegistry.get('api-config');
        if (apiConfigWindow && apiConfigWindow.isDestroyed()) {
          // API configuration window was closed, check if we have config now
          userConfig = loadUserConfig();
          if (userConfig && isConfigValid(userConfig)) {
            console.log('Configuration completed, starting main application');
            createMainWindow();
            resolve();
          } else {
            console.log('No valid configuration, exiting application');
            app.quit();
          }
        } else {
          // API configuration window still open, check again in 1 second
          setTimeout(checkConfig, 1000);
        }
      };
      
      // Start checking
      setTimeout(checkConfig, 1000);
    });
  } else {
    console.log('Valid configuration found, starting main application');
    createMainWindow();
  }
}



// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await initializeApp();

  // Handle macOS 'activate' event
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (userConfig && isConfigValid(userConfig)) {
        createMainWindow();
      } else {
        openWindow('api-config');
      }
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
