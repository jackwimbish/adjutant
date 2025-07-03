import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('trashAPI', {
  closeWindow: () => ipcRenderer.send('trash:close-window'),
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  unrateArticle: (articleUrl: string) => ipcRenderer.invoke('trash:unrate-article', articleUrl),
  rateArticle: (articleUrl: string, isRelevant: boolean) => ipcRenderer.invoke('trash:rate-article', articleUrl, isRelevant),
}); 