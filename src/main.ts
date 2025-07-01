import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { APP_CONFIG } from './config/app-config';

// Function to create the main application window
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: APP_CONFIG.WINDOW_CONFIG.width,
    height: APP_CONFIG.WINDOW_CONFIG.height,
    webPreferences: {
      // Enhanced security: disable node integration and enable context isolation
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html file into the window
  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  // Open DevTools for debugging in development
  if (APP_CONFIG.DEV_TOOLS_OPEN) {
    mainWindow.webContents.openDevTools();
  }
}

// Function to run the background workflow script
function runWorkflow(): void {
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

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // Run the workflow immediately on app start
  runWorkflow();

  // Then, run the workflow on a schedule
  setInterval(runWorkflow, APP_CONFIG.WORKFLOW_INTERVAL_MS);

  // Handle macOS 'activate' event
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
