import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Expose method to get Firebase config
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  
  // Expose method to open settings window
  openSettings: () => ipcRenderer.send('open-settings'),
  
  // Expose method to open topic settings window
  openTopicSettings: () => ipcRenderer.send('settings:open-topic-settings'),
  
  // Expose method to manually fetch stories
  fetchStories: () => ipcRenderer.invoke('workflow:fetch-stories'),
});

// Expose a promise-based Firebase config getter
contextBridge.exposeInMainWorld('getFirebaseConfig', () => 
  ipcRenderer.invoke('get-firebase-config')
); 