**Phase 1: Today (Tuesday) - Build the Core Functional Prototype**

The objective today is to get a "wire" running through the entire system: from data fetching to UI display. Don't worry about making it pretty; focus on making it work.

**Step 1: Project Setup (Estimated Time: 1 hour)**

* **Goal**: Create a blank canvas for your project.
* **Tasks**:
   * Set up a new project folder.
   * Initialize a `package.json` file (`npm init -y`).
   * Install core dependencies: `npm install electron typescript firebase openai langgraph`.
   * Set up a basic `tsconfig.json` for your TypeScript configuration.
   * Create your basic Electron entry point file (e.g., `main.ts`) and a UI file (`index.html`).

**Step 2: The Backend Workflow (Standalone Script) (Estimated Time: 3-4 hours)**

* **Goal**: Create a Node.js script that performs the entire data processing pipeline. This is the most critical step. Run this script manually from your terminal for now.
* **Tasks**:
   * `workflow.ts`:
      1. **Connect to Firebase**: Initialize the Firebase app and connect to your Firestore database.
      2. **Fetch Raw Data**: Hardcode a single, reliable RSS feed URL. Write the code to fetch it and parse the articles.
      3. **Call AI for Analysis**: For a single article, send its content to the OpenAI API using your "scoring prompt".
      4. **Save to Firestore**: Take the result from OpenAI and save the complete `article` object to your `articles` collection in Firebase.
   * **Test**: Run `ts-node workflow.ts` from your terminal. Verify that a new document appears in your Firebase console.

**Step 3: Basic UI to Display Data (Estimated Time: 2-3 hours)**

* **Goal**: Create a simple, read-only UI that displays the articles from Firestore.
* **Tasks**:
   * `index.html`: Create a basic HTML structure with a list element (e.g., `<ul>`) to hold the articles.
   * `renderer.ts`: This is the TypeScript file for your UI.
      1. Connect to Firebase (same as in your workflow script).
      2. Query the `articles` collection and sort the results by `ai_score`.
      3. For each article, dynamically create a list item in the HTML and display the `title`, `ai_summary`, and `ai_score`.
      4. **Crucially**: Implement a real-time listener. When a new article is added to Firestore, the UI should update automatically without a refresh.

**Step 4: Integrate Workflow into Electron (Estimated Time: 1 hour)**

* **Goal**: Make the Electron app automatically run your workflow script.
* **Tasks**:
   * `main.ts`:
      1. Import and use Node.js's `child_process` module to `spawn` your `workflow.ts` script when the app starts.
      2. Set up a `setInterval` to run the workflow script periodically (e.g., every 30 minutes).
   * **Test**: Launch the Electron app. You should see the UI load existing data, and after a short delay, the workflow should run and a new article should pop into your UI in real-time.

By the end of today, you will have a functional prototype that meets the core requirements for the early submission deadline.

**Phase 2: Wednesday & Thursday - Polish and Enhance**

With the core functionality operational, you can now focus on refining the application for the final deadline on Thursday at 8 PM Central.

**Step 5: Refine and Add Features**

* **Goal**: Improve the user experience and add the features that make the tool truly useful.
* **Tasks**:
   * **Improve the UI**: Use CSS to make the display cleaner and more readable.
   * **Implement User Interaction**: Add buttons to mark articles as "read" or "hidden" and update the `is_read` / `is_hidden` flags in Firebase.
   * **Expand Sources**: Implement the `sources` collection. Make your workflow read from this collection instead of a hardcoded URL.
   * **Error Handling**: Add `try/catch` blocks and logging to your workflow to handle cases where an RSS feed or API call fails.
   * **Start the Adaptive Filter**: Begin sketching out the logic for how you might use the `is_hidden` flags to influence future `ai_score` values.