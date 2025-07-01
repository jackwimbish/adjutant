export const APP_CONFIG = {
  WORKFLOW_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
  WORKFLOW_SCRIPT_PATH: 'workflow.ts',
  WINDOW_CONFIG: {
    width: 1200,
    height: 800,
  },
  DEV_TOOLS_OPEN: process.env.NODE_ENV === 'development',
}; 