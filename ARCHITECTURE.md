# Offline-First Learning Management System: Architecture Guide

This document provides a comprehensive, deep-dive technical overview of the Offline Learning App. It explains how the system "lives and breathes," the architectural decisions behind it, and the security models enforced.

---

## 1. High-Level Architecture

The project is architected as a **pnpm Monorepo**. This means multiple distinct software projects co-exist in a single repository but act as one cohesive organism.

### The Anatomy
*   **`apps/renderer` (The Face)**
    *   **Technology:** React 18, Vite, TailwindCSS (Neo-Brutalism).
    *   **Role:** Handles all User Interface (UI) and User Experience (UX).
    *   **Constraints:** Sandboxed environment. It communicates with the backend exclusively via the IPC Bridge.
    
*   **`apps/desktop` (The Brain)**
    *   **Technology:** Electron (v28+), TypeScript.
    *   **Role:** The main entry point. Manages application lifecycle, window creation, and secure system access.
    *   **Capabilities:** Powers the SQLite database, AI inference, and filesystem operations.

*   **`packages/backend/*` (The Core Services)**
    *   **`@backend/db`**: SQLite core via `better-sqlite3` and Drizzle ORM. Manages schema, migrations, and type-safe queries.
    *   **`@backend/content-engine`**: Parses `manifest.json`, validates content integrity, and resolves local asset paths.
    *   **`@backend/ai-tutor`**: Orchestrates local AI inference using Ollama (`qwen2.5:1.5b`), generating session titles and learning summaries.
    *   **`@backend/analytics`**: Processes learning telemetry (video watch time, PDF reading progress, quiz performance).
    *   **`@afe/shared`**: The source of truth for TypeScript interfaces, IPC channel constants, and global configuration.

---

## 2. Electron Architecture: The "Two Worlds" Concept

Electron is a fusion of Google Chrome (UI) and Node.js (Backend). It runs two separate, isolated process types:

### A. The Main Process (Node.js)
*   **File:** `apps/desktop/src/main/index.ts`
*   **Environment:** Verified Node.js environment.
*   **Powers:**
    *   Spawns the Renderer process.
    *   Manages native GUI elements (Menus, Tray, Dock).
    *   Performs all "heavy lifting" (Database writes, AI inference).
*   **Security:** This process is trusted. It can do anything the user can do.

### B. The Renderer Process (Web)
*   **File:** `apps/renderer/src/main.tsx`
*   **Environment:** Chromium Browser (Sandboxed).
*   **Powers:** Rendering HTML/CSS, executing client-side JavaScript.
*   **Security:** **Untrusted**. This process is sandboxed. It cannot access `fs` (File System) or `require()` Node modules directly. This prevents potential XSS attacks from escalating into System Takeovers.

---

## 3. Communication: The IPC Bridge

Since the Renderer (UI) cannot access the Database directly, how do we save a student?
We use **Inter-Process Communication (IPC)**.

### Why not allow direct access? `(nodeIntegration: false)`
In older Electron apps, it was common to set `nodeIntegration: true`. This allowed the UI to run code like:
```javascript
const fs = require('fs');
fs.unlinkSync('C:\\Windows\\System32\\important_file.dll'); // ❌ CATASTROPHIC DANGER
```
If a malicious script (or a compromised dependency) ran on your UI, it could wipe the user's hard drive.

### The Modern Security Model
We enforce **Context Isolation**.
1.  **The Wall:** The Renderer cannot talk to Node.js.
2.  **The Gatekeeper (Preload Script):** A special script (`secure.cjs`) runs *before* the website loads. It has access to both worlds but exposes only a **tiny, whitelisted API**.

### The Flow of Data
Instead of giving the UI a "Master Key", we give it a "Menu".

**User Action:** "Create Student 'Mukul'"

1.  **Renderer (React)**
    *   Calls `window.electronAPI.invoke('student:create', { name: 'Mukul' })`.
    *   *Note: usage is wrapped in `apps/renderer/src/lib/ipc.ts` for type safety.*

2.  **Preload Script (`secure.cjs`)**
    *   Intercepts the call.
    *   **Whitelist Check:** Is `'student:create'` in the `VALID_CHANNELS` array?
        *   ✅ **Yes:** Pass it to the Main Process.
        *   ❌ **No:** Throw Error "Blocked unauthorized IPC call".

3.  **Electron Internal Transport**
    *   Serializes the JSON object and pipes it over the IPC channel.

4.  **Main Process (Node.js)**
    *   Receives the signal in `apps/desktop/src/ipc/handlers.ts`.
    *   Executes the handler:
        ```typescript
        ipcMain.handle('student:create', async (event, data) => {
            return await db.createStudent(data.name); 
        });
        ```

5.  **Database (SQLite)**
    *   Performs the SQL Insert.
    *   Returns the new Student object.

6.  **Return Trip**
    *   The data flows back up the chain: DB -> Main -> IPC -> Preload -> React Component.

---

## 4. Technical Implementation Details

### The Preload Strategy (`secure.cjs`)
We use a **CommonJS (.cjs)** preload script instead of TypeScript/ESM.
*   **Reason:** Electron's sandbox loading mechanism is most robust with established CommonJS patterns. Complex ESM imports in preload scripts can fail silently or cause "module not found" errors in the isolated context.
*   **Mechanism:** It uses `contextBridge.exposeInMainWorld` to inject a global object `electronAPI` into the `window` object of the browser.

### Type Safety (The Contract)
To prevent chaos, the Frontend and Backend agree on a strict contract defined in `@afe/shared`.
```typescript
// packages/shared/src/ipc/contracts.ts
export type StudentCreateRequest = { name: string; avatar: string };
export type StudentCreateResponse = Student;
```
Both sides import these types. If you change a variable name in the backend, the frontend build will fail immediately. This ensures **Full-Stack Type Safety**.

### Database & Persistence
*   **Production Path:** `C:\ProgramData\OfflineLearningApp\data.db`
*   **Engine:** `better-sqlite3` — A synchronous, high-performance C-binding for SQLite.
*   **ORM:** Drizzle ORM. We use this for:
    *   **Migrations:** Automatic schema updates on application startup.
    *   **Type Safety:** `inferSelect` and `inferInsert` types ensure the Frontend never sends invalid data.
*   **Isolation:** The database runs entirely in the Main Process. The Renderer cannot "accidentally" corrupt the DB.

### AI Tutor (Ollama Integration)
The application provides an AI-powered tutor that works 100% offline.
*   **Runtime:** Ollama (running locally on `localhost:11434`).
*   **Model:** `qwen2.5:1.5b` (chosen for the best speed/quality ratio on average hardware).
*   **Key Features:**
    *   **Context Injection:** The tutor knows which module/lesson the student is currently viewing.
    *   **Automatic Summaries:** Generates initial learning summaries (<300 words) and follow-up progress notes (<100 words) every 10 days.
    *   **Session Management:** Auto-generates concise chat titles based on the first interaction.

### Learning Analytics & Sync Engine
*   **Granular Tracking:**
    *   **Video:** Precise watch percentage and total duration.
    *   **PDF Reading:** Tracks page progress and reading duration for document-based lessons.
    *   **Quizzes:** Stores every attempt, score, and detailed answer history.
*   **Synchronization:**
    *   **Mechanism:** When connectivity is detected, the app compiles an analytics payload (UUID, watch time, read time, latest AI summary).
    *   **Idempotency:** The sync uses an upsert mechanism to ensure data consistency on the central server even if retried multiple times.
    *   **Persistence:** A `sync_queue` table ensures no offline data is lost before it's successfully pushed to the cloud.

---

## 5. Summary Metaphor

Think of this application like a **High-Security Restaurant**.

*   **The Renderer (React)** is the **Customer**. They are hungry (need data) but are not allowed in the kitchen. They can look at the menu (UI) and shout orders.
*   **The Preload Script** is the **Waiter**. They are the *only* person allowed to talk to both the Customer and the Chef. They check if the order is valid (is it on the menu?) before writing it down. They will strictly *not* allow the customer to order "Poison" or "Fire".
*   **The Main Process** is the **Head Chef**. They receive the ticket from the waiter.
*   **The Database** is the **Pantry/Fridge**. The Chef walks into the pantry, grabs the ingredients (Data), cooks the meal (Business Logic), and hands the finished plate back to the Waiter.

This separation ensures that even if the Customer goes crazy (a bug in the UI), they cannot burn down the kitchen (destroy the database or OS).
