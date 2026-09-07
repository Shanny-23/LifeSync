# LifeSync Backend Service

Intelligent task & schedule synchronization backend powered by Node.js, Express, and Google Calendar API.

---

## 1. Overview & Architecture

- **Runtime**: Node.js (v18+) with Express.
- **Data Store (`backend/data/tasks.json`)**: Lightweight JSON-file-backed persistent task database with atomic, serialized write chains to guarantee zero write concurrency corruption.
- **Single-User Google Token Storage (`backend/data/google-tokens.json`)**:
  > **Architectural Note:** The application currently operates in single-user mode. Google OAuth2 tokens are stored in `backend/data/google-tokens.json` using a serialized write chain. This serves as a clean, modular seam designed to be replaced by a per-user account store once multi-tenant authentication is introduced.

---

## 2. API Endpoints

### Tasks API (`/api/tasks`)
- `GET /api/tasks` — List all tasks with optional filters (`?status=completed|pending`, `?urgency=high|medium|low`, `?category=`, `?search=`).
- `GET /api/tasks/:id` — Retrieve a single task by ID.
- `POST /api/tasks` — Create a new task (auto-assigned `task-${nanoid(8)}` ID).
- `PUT /api/tasks/:id` — Update existing task fields.
- `DELETE /api/tasks/:id` — Delete a task.

### Dashboard API (`/api/dashboard`)
- `GET /api/dashboard/summary` — Returns task metrics (total, completed, pending, highUrgency).
- `GET /api/dashboard/week` — Returns tasks scheduled within the current calendar week.
- `GET /api/dashboard/conflicts` — Detects and returns any overlapping `scheduledSlot` intervals.

### File Upload & Parsing API (`/api/upload`)
- `POST /api/upload` — Ingests `.ics`, `.csv`, or `.json` calendar files via `multipart/form-data`.
  - Without query: returns preview of parsed tasks and detected conflicts.
  - With `?commit=true`: persists parsed tasks into `tasks.json`.

### Google Calendar Sync API (`/api/google`)
- `GET /api/google/auth` — Initiates Google OAuth2 consent flow (`calendar.events.readonly` scope).
- `GET /api/google/callback` — OAuth2 redirect URI handler; exchanges authorization code for access and refresh tokens.
- `GET /api/google/status` — Returns connection state (`{ connected: boolean, email: string }`).
- `POST /api/google/disconnect` — Clears stored tokens.
- `POST /api/google/sync/import` — Imports Google Calendar events into LifeSync tasks.
  - Query parameters:
    - `timeMin` (optional ISO string, defaults to Sunday 00:00 of current week)
    - `timeMax` (optional ISO string, defaults to Sunday 23:59 of current week)
    - `commit=true` (optional boolean, persists tasks to database with deduplication on `googleEventId`; defaults to preview mode)

---

## 3. Google Cloud Console Setup Guide

Follow these steps to generate your Google Cloud OAuth 2.0 credentials for LifeSync:

### Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and click **New Project**.
3. Name the project `LifeSync` and click **Create**.

### Step 2: Enable the Google Calendar API
1. Navigate to **APIs & Services > Library**.
2. Search for **Google Calendar API**.
3. Select it and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** user type and click **Create**.
3. Fill in the required application details:
   - **App name**: `LifeSync`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. In the **Scopes** step, click **Add or Remove Scopes** and add:
   - `.../auth/calendar.events.readonly` (View events on your calendars)
   - `.../auth/userinfo.email` (See primary Google account email)
6. Click **Save and Continue**.
7. In the **Test Users** step, click **+ Add Users** and add the Gmail address you will use to test the integration.
8. Click **Save and Continue**.

### Step 4: Create OAuth 2.0 Client Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Name: `LifeSync Web Client`.
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   http://localhost:5000/api/google/callback
   ```
6. Click **Create**.
7. Copy your **Client ID** and **Client Secret**.

### Step 5: Configure Environment Variables
Copy `.env.example` to `.env` in the `backend` folder:
```bash
cp .env.example .env
```
Paste your Google credentials into `.env`:
```env
PORT=5000
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
```

---

## 4. Running the Backend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# or
npm start
```
The server will start at `http://localhost:5000`.
