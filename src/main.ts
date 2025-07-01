import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

// Function to create the main application window
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Security note: In a real-world app, consider using a preload script
      // to expose specific Node.js APIs to the renderer instead of enabling full integration.
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the index.html file into the window
  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  // mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  // Open DevTools for debugging, you can remove this for production
  mainWindow.webContents.openDevTools();
}

// Function to run the background workflow script
function runWorkflow(): void {
  console.log('Spawning workflow process...');
  // Use 'ts-node' to execute the TypeScript workflow file.
  // In a packaged app, you would spawn the compiled .js file directly.
  const workflowProcess = spawn('npx', ['ts-node', path.join(__dirname, 'workflow.ts')], {
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

  // Then, run the workflow on a schedule (e.g., every 30 minutes)
  const thirtyMinutes = 30 * 60 * 1000;
  setInterval(runWorkflow, thirtyMinutes);

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
