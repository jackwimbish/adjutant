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
let settingsWindow: BrowserWindow | null = null;
let topicSettingsWindow: BrowserWindow | null = null;
let userConfig: UserConfig | null = null;

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
  
  // Backward Compatibility Handlers
  setupLegacyHandlers();
}

/**
 * Handlers for configuration loading, saving, and validation
 */
function setupConfigHandlers(): void {
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
  ipcMain.handle('settings:test-firebase', async (event, firebaseConfig: UserConfig['firebase']) => {
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
  ipcMain.on('settings:close-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });

  ipcMain.on('settings:open-topic-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    if (!topicSettingsWindow || topicSettingsWindow.isDestroyed()) {
      createTopicSettingsWindow();
    } else {
      topicSettingsWindow.focus();
    }
  });

  ipcMain.on('close-settings', () => {
    if (topicSettingsWindow && !topicSettingsWindow.isDestroyed()) {
      topicSettingsWindow.close();
    }
  });

  ipcMain.on('open-api-settings', () => {
    if (topicSettingsWindow && !topicSettingsWindow.isDestroyed()) {
      topicSettingsWindow.close();
    }
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      createSettingsWindow();
    } else {
      settingsWindow.focus();
    }
  });

  ipcMain.on('open-settings', () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      createSettingsWindow();
    } else {
      settingsWindow.focus();
    }
  });

  ipcMain.handle('workflow:fetch-stories', async () => {
    try {
      if (!userConfig) {
        console.error('Cannot fetch stories - no user configuration');
        return { success: false, message: 'No user configuration available' };
      }

      console.log('Manual workflow triggered by user');
      startWorkflow();
      
      return { success: true, message: 'Story fetching started successfully' };
    } catch (error) {
      console.error('Error starting workflow:', error);
      return { success: false, message: 'Failed to start story fetching' };
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

// Function to create settings window
function createSettingsWindow(): void {
  settingsWindow = createWindow({
    width: 700,
    height: 800,
    title: 'Adjutant Settings',
    htmlFile: 'windows/settings.html',
    preloadFile: 'windows/settings-preload.js',
    resizable: false,
    modal: true,
    parent: mainWindow || undefined,
    showMenuBar: false,
    onClosed: () => {
      settingsWindow = null;
    },
  });
}

// Function to create topic settings window
function createTopicSettingsWindow(): void {
  topicSettingsWindow = createWindow({
    width: 600,
    height: 700,
    title: 'Topic Settings - Adjutant',
    htmlFile: 'windows/topic-settings.html',
    preloadFile: 'windows/topic-settings-preload.js',
    resizable: false,
    modal: true,
    parent: mainWindow || undefined,
    showMenuBar: false,
    onClosed: () => {
      topicSettingsWindow = null;
    },
  });
}

// Function to create the main application window
function createMainWindow(): void {
  mainWindow = createWindow({
    width: APP_CONFIG.WINDOW_CONFIG.width,
    height: APP_CONFIG.WINDOW_CONFIG.height,
    title: 'Adjutant - AI News Aggregator',
    htmlFile: '../index.html',
    preloadFile: 'preload.js',
    onClosed: () => {
      mainWindow = null;
    },
    postCreate: (window) => {
      // Create application menu for main window
      createApplicationMenu();
    },
  });
}

// Function to create application menu
function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Adjutant',
      submenu: [
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (!settingsWindow || settingsWindow.isDestroyed()) {
              createSettingsWindow();
            } else {
              settingsWindow.focus();
            }
          }
        },
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

// Function to run the background workflow script
function runWorkflow(): void {
  if (!userConfig) {
    console.log('Skipping workflow - no user configuration available');
    return;
  }

  console.log('Spawning workflow process...');
  // Use 'ts-node' to execute the TypeScript workflow file.
  // In a packaged app, you would spawn the compiled .js file directly.
  const workflowProcess = spawn('npx', ['ts-node', path.join(__dirname, APP_CONFIG.WORKFLOW_SCRIPT_PATH)], {
    shell: true, // Use shell to properly handle 'npx' command across platforms
  });

  workflowProcess.stdout.on('data', (data) => {
    console.log(`Workflow STDOUT: ${data}`);
  });

  workflowProcess.stderr.on('data', (data) => {
    console.error(`Workflow STDERR: ${data}`);
  });

  workflowProcess.on('close', (code) => {
    console.log(`Workflow process exited with code ${code}`);
  });
}

// Function to initialize the application
async function initializeApp(): Promise<void> {
  // Setup IPC handlers first
  setupIpcHandlers();
  
  // Try to load existing configuration
  userConfig = loadUserConfig();
  
  if (!userConfig || !isConfigValid(userConfig) || userConfig.firstRun) {
    console.log('No valid configuration found or first run - showing settings window');
    
    // Show settings window first
    createSettingsWindow();
    
    // Wait for settings to be configured before continuing
    return new Promise((resolve) => {
      const checkConfig = () => {
        if (settingsWindow && settingsWindow.isDestroyed()) {
          // Settings window was closed, check if we have config now
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
          // Settings window still open, check again in 1 second
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

// Function to start the workflow system (now manual only)
function startWorkflow(): void {
  if (!userConfig) {
    console.error('Cannot start workflow - no user configuration');
    return;
  }

  // Run the workflow manually (no automatic scheduling)
  runWorkflow();
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
        createSettingsWindow();
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
