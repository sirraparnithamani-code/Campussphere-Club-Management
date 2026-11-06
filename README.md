# CampusSphere

**Your campus. Your community.** A campus clubs and events app built with React, TypeScript, Vite, Express, and Node.js 24 built-in SQLite.

## Run locally on Windows

From the project folder:

```powershell
Copy-Item .env.example .env
```

Set a private `SESSION_SECRET` of at least 32 characters in `.env`. To create local demo accounts, set `CAMPUSSPHERE_SEED=true` and choose a `CAMPUSSPHERE_SEED_PASSWORD` of at least 12 characters. Never reuse demo passwords for personal accounts.

```powershell
npm install
npm run init-db
npm run seed
npm run dev
```

Open `http://127.0.0.1:5173`. The root development command starts both the API and the frontend. Keep the terminal open while using the app.

## Free portfolio demo on Render

The included `render.yaml` creates a free Render web service with a public HTTPS URL and sample CampusSphere data. Connect the project repository to Render as a Blueprint and use the `render.yaml` configuration. The app displays public demo login details on its sign-in page.

This mode is only for a portfolio showcase. Render Free puts idle services to sleep, and its local files are temporary. On a restart or redeploy, SQLite changes are lost; the sample data is recreated on startup. Visitors can use the public demo administrator account, so do not put real student information or private content in this deployment. The default `onrender.com` URL and HTTPS certificate are provided by Render.

Render Free services sleep after 15 minutes without traffic, and the first visit after sleep can take about a minute. Free services also have usage limits. See [Render's free-plan details](https://render.com/docs/free).

## Production deployment

Deploy this as one Node.js service with a persistent disk mounted for SQLite. Use Node.js 24 or newer. The server serves the built frontend and API from the same HTTPS origin. Keep one app instance while using SQLite; configure the host's backups for the database volume.

Build command:

```sh
npm ci
npm run build
```

Start command:

```sh
npm start
```

Set these environment variables in the hosting service's private configuration:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | A unique, randomly generated secret with at least 32 characters |
| `APP_ORIGIN` | The exact public HTTPS origin, such as `https://campus.example.edu` |
| `DATABASE_PATH` | An absolute path on the persistent disk, such as `/var/data/campussphere.sqlite` |
| `HOST` | `0.0.0.0` (the default in production) |
| `PORT` | Use the port supplied by the host |
| `CAMPUSSPHERE_SEED` | `false` |
| `TRUST_PROXY` | Set to `1` only when the host terminates HTTPS at one trusted reverse proxy; otherwise leave unset |

Do not copy `.env` into a public repository or deploy the demo database. Keep the database volume private. The session cookie is HTTP-only, SameSite Lax, and Secure in production. The API checks a session-bound CSRF token and the request origin for state-changing requests.

### Create the first administrator

After the service has initialized its production database, run `npm run admin:create` against that same database from a private interactive terminal. The password is entered without echo and must be at least 16 characters. Do not create production admin accounts through demo seeding.

### Before sharing the public URL

- Confirm HTTPS is active and `APP_ORIGIN` exactly matches the public origin.
- Confirm the persistent disk is mounted at `DATABASE_PATH` and backups are enabled.
- Create the first administrator, then sign in and check key student and admin workflows.
- Review who may register. Student self-registration currently has no email verification or campus-domain restriction.
- Decide how users will recover accounts; password change and reset flows are not implemented.

## Useful commands

```sh
npm run dev       # local client and API
npm run build     # production client and API build
npm test          # API and client tests
npm run seed      # opt-in local demo data only
npm run admin:create # create an admin in the configured database
```

## Current feature limits

The app includes student club discovery and membership, event registration, announcements, profile editing, coordinator club/event/membership workflows, and administrator management. Event date-range filtering, image uploads, notification read UI, attendance marking, password recovery, configurable settings, and pagination remain unimplemented. Student registration has no email verification or campus-domain restriction. Render Free mode is a disposable public demo, not a production service for real users.
