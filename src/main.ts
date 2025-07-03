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
let trashWindow: BrowserWindow | null = null;
let userConfig: UserConfig | null = null;

// Window registry for data-driven window management
const windowRegistry = new Map<string, BrowserWindow | null>([
  ['main', null],
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
    id: 'settings',
    width: 700,
    height: 800,
    title: 'Adjutant Settings',
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
    openWindow('settings');
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

      console.log('Manual workflow triggered by user');
      startWorkflow();
      
      return { success: true, message: 'Story fetching started successfully' };
    } catch (error) {
      console.error('Error starting workflow:', error);
      return { success: false, message: 'Failed to start story fetching' };
    }
  });

  ipcMain.on('trash:close-window', () => {
    closeWindow('trash');
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
      
      console.log('🧠 Starting learner workflow for profile generation...');
      
      // Import and run the learner workflow
      const { runLearnerWorkflow } = await import('./workflows/learner-workflow');
      const result = await runLearnerWorkflow(userConfig);
      
      // Check if profile was successfully generated
      if ((result as any).generatedProfile) {
        const profile = (result as any).generatedProfile;
        console.log('✅ Profile generated successfully');
        return { 
          success: true, 
          message: 'Profile generated successfully',
          profile: {
            likesCount: profile.likes.length,
            dislikesCount: profile.dislikes.length,
            lastUpdated: profile.last_updated
          }
        };
      } else if ((result as any).validationPassed === false) {
        console.log('❌ Profile generation failed - insufficient training data');
        return { 
          success: false, 
          message: 'Need at least 2 relevant and 2 not relevant ratings to generate profile'
        };
      } else {
        console.log('❌ Profile generation failed after retries');
        return { 
          success: false, 
          message: 'Profile generation failed after multiple attempts'
        };
      }
      
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
      
      console.log('📊 Checking learner threshold...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Initialize Firebase app for threshold checking
      const app = initializeApp(userConfig.firebase, 'threshold-check-app');
      const db = getFirestore(app);
      
      // Query for relevant and not relevant articles
      const articlesRef = collection(db, 'articles');
      const relevantQuery = query(articlesRef, where('relevant', '==', true));
      const notRelevantQuery = query(articlesRef, where('relevant', '==', false));
      
      const [relevantSnap, notRelevantSnap] = await Promise.all([
        getDocs(relevantQuery),
        getDocs(notRelevantQuery)
      ]);
      
      const relevantCount = relevantSnap.size;
      const notRelevantCount = notRelevantSnap.size;
      const thresholdMet = relevantCount >= 2 && notRelevantCount >= 2;
      
      console.log(`📊 Threshold check: ${relevantCount} relevant, ${notRelevantCount} not relevant`);
      
      return {
        thresholdMet,
        relevantCount,
        notRelevantCount,
        message: thresholdMet 
          ? 'Ready to generate profile' 
          : `Need ${Math.max(0, 2 - relevantCount)} more relevant and ${Math.max(0, 2 - notRelevantCount)} more not relevant ratings`
      };
      
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
      
      console.log('👤 Loading user profile...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile loading with unique name
      const appName = `profile-load-${Date.now()}`;
      const app = initializeApp(userConfig.firebase, appName);
      const db = getFirestore(app);
      
      // Load profile document
      const profileRef = doc(db, 'profiles', 'user-profile');
      console.log('📄 Attempting to load profile document...');
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        const profile = profileDoc.data();
        console.log(`✅ Profile loaded: ${profile.likes?.length || 0} likes, ${profile.dislikes?.length || 0} dislikes`);
        console.log('📊 Profile data structure:', JSON.stringify(profile, null, 2));
        
        const result = {
          success: true,
          profile: {
            id: 'user-profile',
            likes: profile.likes || [],
            dislikes: profile.dislikes || [],
            changelog: profile.changelog || '',
            last_updated: profile.last_updated,
            created_at: profile.created_at,
            version: profile.version || 1,
            articlesAnalyzed: (profile.likes?.length || 0) + (profile.dislikes?.length || 0)
          }
        };
        
        console.log('📤 Returning profile result:', JSON.stringify(result, null, 2));
        return result;
      } else {
        console.log('ℹ️ No profile found');
        return {
          success: false,
          message: 'No profile found'
        };
      }
      
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
      
      console.log('🗑️ Deleting user profile...');
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, deleteDoc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile deletion
      const app = initializeApp(userConfig.firebase, 'profile-delete-app');
      const db = getFirestore(app);
      
      // Check if profile exists
      const profileRef = doc(db, 'profiles', 'user-profile');
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        // Delete the profile document
        await deleteDoc(profileRef);
        console.log('✅ Profile deleted successfully');
        
        return {
          success: true,
          message: 'Profile deleted successfully'
        };
      } else {
        console.log('ℹ️ No profile found to delete');
        return {
          success: false,
          message: 'No profile found to delete'
        };
      }
      
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
      
      // Input validation
      if (!Array.isArray(likes) || !Array.isArray(dislikes)) {
        return { success: false, message: 'Invalid input: likes and dislikes must be arrays' };
      }
      
      if (likes.length > 15 || dislikes.length > 15) {
        return { success: false, message: 'Maximum 15 likes and 15 dislikes allowed' };
      }
      
      // Validate each preference
      const validatePreference = (pref: string): boolean => {
        if (typeof pref !== 'string') return false;
        const trimmed = pref.trim();
        return trimmed.length >= 5 && trimmed.length > 0;
      };
      
      const invalidLikes = likes.filter(like => !validatePreference(like));
      const invalidDislikes = dislikes.filter(dislike => !validatePreference(dislike));
      
      if (invalidLikes.length > 0 || invalidDislikes.length > 0) {
        return { 
          success: false, 
          message: 'All preferences must be at least 5 characters long and not empty' 
        };
      }
      
      console.log('📝 Updating user profile manually...');
      console.log(`   Likes: ${likes.length}, Dislikes: ${dislikes.length}`);
      
      // Import Firebase modules
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, doc, updateDoc, getDoc } = await import('firebase/firestore');
      
      // Initialize Firebase app for profile update
      const appName = `profile-update-${Date.now()}`;
      const app = initializeApp(userConfig.firebase, appName);
      const db = getFirestore(app);
      
      // Check if profile exists
      const profileRef = doc(db, 'profiles', 'user-profile');
      const profileDoc = await getDoc(profileRef);
      
      if (!profileDoc.exists()) {
        return {
          success: false,
          message: 'No profile found to update'
        };
      }
      
      // Update the profile document with manual changes
      const updateData = {
        likes: likes.map(like => like.trim()),
        dislikes: dislikes.map(dislike => dislike.trim()),
        changelog: 'User manually adjusted likes/dislikes',
        last_updated: new Date()
      };
      
      await updateDoc(profileRef, updateData);
      
      console.log('✅ Profile updated successfully');
      console.log(`   New likes: ${likes.length}, New dislikes: ${dislikes.length}`);
      
      return {
        success: true,
        message: 'Profile updated successfully'
      };
      
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
      // Update legacy references for backward compatibility
      updateLegacyWindowReferences(windowId, null);
    },
  };

  const newWindow = createWindow(config);
  windowRegistry.set(windowId, newWindow);
  
  // Update legacy references for backward compatibility
  updateLegacyWindowReferences(windowId, newWindow);
}

/**
 * Update legacy window references for backward compatibility
 * @param windowId - The window ID
 * @param window - The window instance or null
 */
function updateLegacyWindowReferences(windowId: string, window: BrowserWindow | null): void {
  switch (windowId) {
    case 'settings':
      settingsWindow = window;
      break;
    case 'topic-settings':
      topicSettingsWindow = window;
      break;
    case 'trash':
      trashWindow = window;
      break;
  }
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

// Legacy window creation functions (now using generic openWindow)
function createSettingsWindow(): void {
  openWindow('settings');
}

function createTopicSettingsWindow(): void {
  openWindow('topic-settings');
}

function createTrashWindow(): void {
  openWindow('trash');
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
      windowRegistry.set('main', null);
    },
    postCreate: (window) => {
      // Create application menu for main window
      createApplicationMenu();
    },
  });
  
  // Update the registry
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
    openWindow('settings');
    
    // Wait for settings to be configured before continuing
    return new Promise((resolve) => {
      const checkConfig = () => {
        const settingsWindow = windowRegistry.get('settings');
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
        openWindow('settings');
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
