import { contextBridge, ipcRenderer } from 'electron';
import { UserConfig } from '../config/user-config';

// Expose protected methods that allow the renderer process to work with the main process
contextBridge.exposeInMainWorld('settingsAPI', {
  // Load existing configuration
  loadConfig: (): Promise<UserConfig | null> => {
    return ipcRenderer.invoke('config:load');
  },

  // Save topic settings
  saveTopicSettings: (settings: { topicDescription: string }): Promise<boolean> => {
    return ipcRenderer.invoke('save-topic-settings', settings);
  },

  // Close settings window
  closeWindow: (): void => {
    ipcRenderer.send('settings:close-window');
  },

  // Open API configuration window
  openApiConfig: (): void => {
    ipcRenderer.send('settings:open-api-config');
  }
});

// Type definition for the exposed API
declare global {
  interface Window {
    settingsAPI: {
      loadConfig: () => Promise<UserConfig | null>;
      saveTopicSettings: (settings: { topicDescription: string }) => Promise<boolean>;
      closeWindow: () => void;
      openApiConfig: () => void;
    };
  }
} 