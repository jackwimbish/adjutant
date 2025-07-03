import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('trashAPI', {
  // Window management
  closeWindow: () => ipcRenderer.send('trash:close-window'),
  
  // Firebase configuration
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  
  // Article management (if needed for future features)
  unrateArticle: (articleUrl: string) => ipcRenderer.invoke('trash:unrate-article', articleUrl),
}); 