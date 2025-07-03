# Refactoring Candidates (Phase 2)

Based on a review of the `src` directory, here are several parts of the codebase that could benefit from refactoring to improve simplicity, maintainability, and robustness.

---

### 1. Centralize IPC Handlers in `main.ts` ✅ **COMPLETED**

-   **Location**: `src/main.ts`
-   **Problem**: The main process file has numerous `ipcMain.handle` and `ipcMain.on` calls at the top level, mixing concerns from different features (API settings, topic settings, etc.). This clutters the file and makes it difficult to maintain as new features are added.
-   **Proposed Refactor**: Group related IPC handlers into dedicated functions or modules.
    -   Create functions like `setupSettingsIpcHandlers()` and `setupTopicSettingsIpcHandlers()` within `main.ts`.
    -   For a cleaner architecture, move these groups of handlers into separate files (e.g., `src/ipc/settings.ts`, `src/ipc/topic-settings.ts`) and import them into the main process. This makes `main.ts` a high-level orchestrator and clarifies which handlers belong to which feature.
-   **Implementation**: Created organized IPC handler functions grouped by functionality:
    -   `setupConfigHandlers()` - Configuration loading, saving, and validation
    -   `setupApiTestHandlers()` - Firebase and OpenAI connection testing
    -   `setupWindowHandlers()` - Window management (opening, closing, navigation)
    -   `setupLegacyHandlers()` - Backward compatibility handlers
    -   All handlers are now centralized in a dedicated section with clear documentation and called during app initialization.

---

### 2. Abstract Window Creation Logic

-   **Location**: `src/main.ts`
-   **Problem**: The `createSettingsWindow`, `createTopicSettingsWindow`, and `createMainWindow` functions contain duplicated code for `BrowserWindow` configuration. Common settings like `webPreferences`, menu visibility, and `on('closed')` event handling are repeated.
-   **Proposed Refactor**: Create a factory function to abstract away the common `BrowserWindow` properties. A function like `createWindow(options)` could accept parameters for unique properties (`width`, `height`, `preload`, `htmlFile`, `parent`) while applying a consistent set of base options (security settings, dev tools logic, etc.). This reduces duplication and ensures all windows have consistent behavior.

---

### 3. Simplify Configuration Path Logic

-   **Location**: `src/config/user-config.ts`
-   **Problem**: The `getConfigPath` function uses a `try...catch` block for control flow to determine if it's running in Electron or a plain Node.js process. The fallback path logic is manually constructed for each OS, which is brittle and may not handle the production application name (`Adjutant` vs. `adjutant`) correctly.
-   **Proposed Refactor**: Use a dedicated, well-tested library like `env-paths` to determine the application data directory. This library correctly handles different operating systems and execution environments (development vs. production). This would simplify the code, make it more robust, and remove the need for a `try...catch` block for control flow.

---

### 4. Use a Schema for Configuration Validation

-   **Location**: `src/config/user-config.ts`
-   **Problem**: The `isConfigValid` function consists of a long, repetitive series of `if` statements to manually validate the structure of the user configuration object. This is verbose, error-prone, and must be manually updated whenever the `UserConfig` interface changes.
-   **Proposed Refactor**: Adopt a schema validation library like `zod`. Define the `UserConfig` shape once as a schema. The validation then becomes a single call to `schema.safeParse(config)`. This approach is more declarative, less error-prone, automatically stays in sync with type definitions (if using `zod.infer`), and provides detailed validation errors for free.

---

### 5. Abstract UI Logic in Settings Window

-   **Location**: `src/windows/settings.js`
-   **Problem**: The settings window's JavaScript has repetitive logic. The `handleFormSubmit`, `handleTestFirebase`, and `handleTestOpenAI` functions all contain similar `try...catch...finally` blocks to manage button loading states (`disabled`, adding/removing a `loading` class) and displaying status messages.
-   **Proposed Refactor**:
    1.  **Create UI Helpers**: Implement a helper function, `setButtonLoading(button, isLoading)`, to encapsulate the logic for managing a button's loading state.
    2.  **Create an API Wrapper**: Create a higher-order function, `withApiCall(button, apiFunction)`, that takes a button element and an async function. This wrapper would handle the `try...catch...finally` block, manage the button's loading state using the helper, execute the API call, and display the resulting success or error message. This would drastically reduce code duplication in the event handler functions.
