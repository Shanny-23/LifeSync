# LifeSync Backend

REST API for the LifeSync task/schedule sync app (built to pair with the
existing React + Vite frontend in this repo, which currently uses
`src/mockData.js` as a placeholder).

## Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT auth (bcrypt password hashing)
- Multer for file uploads (`.ics`, `.csv`, `.json`, `.txt`)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI / JWT_SECRET
npm run dev            # nodemon, or `npm start` for production
```

Requires a running MongoDB instance (local `mongod` or a hosted Atlas URI).

To try it out with sample data matching the frontend's mock tasks:

```bash
npm run seed
```

This creates a demo user (`demo@lifesync.app` / `password123`) and the same
9 tasks found in `src/mockData.js`, anchored to the current week.

## Auth

All `/api/tasks` and `/api/upload` routes require a `Authorization: Bearer <token>`
header. Get a token via register/login.

| Method | Route              | Body                              | Description         |
|--------|---------------------|-----------------------------------|----------------------|
| POST   | `/api/auth/register` | `{ name, email, password }`      | Create an account    |
| POST   | `/api/auth/login`    | `{ email, password }`             | Get a JWT            |
| GET    | `/api/auth/me`       | —                                  | Current user profile |

## Tasks

| Method | Route                     | Description                                                |
|--------|---------------------------|--------------------------------------------------------------|
| GET    | `/api/tasks`               | List tasks. Query: `urgency`, `category`, `search`, `from`, `to` |
| GET    | `/api/tasks/:id`            | Get one task                                                |
| POST   | `/api/tasks`                | Create a task                                               |
| PUT    | `/api/tasks/:id`            | Update a task                                               |
| DELETE | `/api/tasks/:id`            | Delete a task                                               |
| GET    | `/api/tasks/stats/summary`  | Counts by urgency/category, for the Dashboard                |

Task shape (request body for create/update):

```json
{
  "task": "Quarterly Strategic Roadmap Review",
  "category": "Work",
  "urgency": "high",
  "deadline": "2026-09-07T17:00:00.000Z",
  "scheduledStart": "2026-09-07T09:30:00.000Z",
  "scheduledEnd": "2026-09-07T11:00:00.000Z"
}
```

Response tasks are reshaped to match the frontend's existing mock data
format (`task`, `deadline`, `urgency`, `scheduledSlot`, `category`, `id`) so
`src/mockData.js` can be swapped for a `fetch('/api/tasks')` call with
minimal changes to the page components.

## Upload

| Method | Route         | Description                                        |
|--------|---------------|------------------------------------------------------|
| POST   | `/api/upload`  | Multipart form, field name `file`. Accepts `.ics`, `.csv`, `.json`, `.txt` |

- `.ics`: standard iCalendar `VEVENT`s.
- `.csv` / `.txt`: headers `task,category,urgency,deadline,scheduledStart,scheduledEnd`
  (or a single `scheduledSlot` column formatted like `2026-09-07 09:30 - 11:00`).
- `.json`: an array of task objects (same fields as above), or `{ "tasks": [...] }`.

Response includes how many rows were imported vs. skipped, plus a list of
row-level parse errors so the frontend's Upload page can surface them.

## Project layout

```
backend/
├── config/db.js          # Mongo connection
├── controllers/          # Route handlers
├── middleware/           # JWT auth guard, error handler
├── models/                # User, Task (Mongoose schemas)
├── routes/                # Express routers
├── utils/
│   ├── scheduleParser.js  # "YYYY-MM-DD HH:mm - HH:mm" <-> Date
│   ├── uploadParsers.js   # ics/csv/json -> normalized task objects
│   └── seed.js            # Demo user + mock tasks
└── server.js
```

## Notes / next steps

- Frontend currently has no API calls at all (pure mock data) — wiring it
  up means replacing the `mockTasks` imports in `src/pages/*.jsx` with
  `fetch`/axios calls to these endpoints and storing the JWT (e.g. in
  memory or localStorage) after login.
- No refresh-token flow — the JWT just expires after `JWT_EXPIRES_IN` and
  the user logs in again. Add refresh tokens if you want silent renewal.
- CORS is controlled via `CLIENT_ORIGIN` in `.env` (comma-separated list,
  defaults to `*` if unset).
