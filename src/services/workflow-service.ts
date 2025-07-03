import { spawn } from 'child_process';
import path from 'path';
import { UserConfig } from '../config/user-config';

// Types for workflow service responses
export interface WorkflowStartResult {
  success: boolean;
  message: string;
}

/**
 * Service class for managing background workflow operations
 */
export class WorkflowService {
  private config: UserConfig;

  constructor(config: UserConfig) {
    this.config = config;
  }

  /**
   * Start the story fetching workflow
   */
  async startStoryFetching(): Promise<WorkflowStartResult> {
    try {
      console.log('Manual workflow triggered by user');
      this.runWorkflow();
      
      return { 
        success: true, 
        message: 'Story fetching started successfully' 
      };
    } catch (error) {
      console.error('Error starting workflow:', error);
      return { 
        success: false, 
        message: 'Failed to start story fetching' 
      };
    }
  }

  /**
   * Execute the background workflow script
   * Private method that handles the actual workflow execution
   */
  private runWorkflow(): void {
    console.log('Spawning workflow process...');
    
    // Determine the correct workflow path based on whether we're in development or production
    // In development: src/workflow.ts
    // In production/compiled: dist/workflow.js
    const workflowPath = path.resolve(__dirname, '../../src/workflow.ts');
    
    // Use 'ts-node' to execute the TypeScript workflow file.
    // In a packaged app, you would spawn the compiled .js file directly.
    const workflowProcess = spawn('npx', ['ts-node', workflowPath], {
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
} 