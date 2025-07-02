import { contextBridge, ipcRenderer } from 'electron';
import { UserConfig } from '../config/user-config';

// Expose protected methods that allow the renderer process to work with the main process
contextBridge.exposeInMainWorld('settingsAPI', {
  // Load existing configuration
  loadConfig: (): Promise<UserConfig | null> => {
    return ipcRenderer.invoke('settings:load-config');
  },

  // Save configuration
  saveConfig: (config: UserConfig): Promise<boolean> => {
    return ipcRenderer.invoke('settings:save-config', config);
  },

  // Test Firebase connection
  testFirebase: (firebaseConfig: UserConfig['firebase']): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke('settings:test-firebase', firebaseConfig);
  },

  // Test OpenAI connection
  testOpenAI: (openaiConfig: UserConfig['openai']): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke('settings:test-openai', openaiConfig);
  },

  // Close settings window
  closeWindow: (): void => {
    ipcRenderer.send('settings:close-window');
  },

  // Listen for events from main process
  onConfigSaved: (callback: () => void): void => {
    ipcRenderer.on('settings:config-saved', callback);
  },

  // Remove event listeners
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('settings:config-saved');
  }
});

// Type definition for the exposed API
declare global {
  interface Window {
    settingsAPI: {
      loadConfig: () => Promise<UserConfig | null>;
      saveConfig: (config: UserConfig) => Promise<boolean>;
      testFirebase: (firebaseConfig: UserConfig['firebase']) => Promise<{ success: boolean; message: string }>;
      testOpenAI: (openaiConfig: UserConfig['openai']) => Promise<{ success: boolean; message: string }>;
      closeWindow: () => void;
      onConfigSaved: (callback: () => void) => void;
      removeAllListeners: () => void;
    };
  }
} 