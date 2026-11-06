# CampusSphere REST API

Base URL in development: `http://127.0.0.1:4000/api`. Production serves the API and frontend from one HTTPS origin. All responses use JSON. The browser sends an HttpOnly `campussphere.sid` cookie for authenticated requests. Errors return `{ "error": "..." }`.

## Authentication

| Method | Route | Access | Body / result |
|---|---|---|---|
| GET | `/health` | Public | `{ ok, app }` |
| GET | `/auth/csrf` | Public | Returns a session-bound `{ token }` for the next state-changing request |
| POST | `/auth/login` | Public, rate limited | `{ identifier, password }`; returns safe `user` and sets cookie |
| GET | `/auth/me` | Signed in | Current safe user |
| POST | `/auth/logout` | Signed in | Destroys session and clears cookie |

`identifier` accepts email or student ID. Password hashes are never returned.
State-changing requests must include the `X-CSRF-Token` returned by `/auth/csrf` and a same-origin `Origin` header. The web client handles this automatically. Production rejects non-HTTPS origins and non-JSON unsafe requests are not exempted.

## People and dashboard

- `GET /users/me` — current profile.
- `PATCH /users/me` — student may change `name`, `department`, `program`.
- `GET /dashboard` — role-specific live metrics.
- `GET /admin/users?q=...` — admin only; search users.
- `PATCH /admin/users/:id/status` — admin only; `{ status: "active" | "suspended" }`.

## Clubs and membership

- `GET /clubs?q=...` — browse; coordinator results are restricted to assigned clubs.
- `GET /clubs/:id` — club detail.
- `POST /clubs/:id/join` — student joins or requests approval.
- `POST /clubs/:id/withdraw` — student withdraws their membership.
- `GET /memberships` — own student memberships, assigned-club coordinator memberships, or admin view.
- `PATCH /memberships/:id` — coordinator/admin; `{ status: "active" | "rejected" | "withdrawn" }`; resource assignment checked server-side.
- `POST /admin/clubs` — admin; `{ name, category, description, policy: "open" | "approval" }`.
- `POST /admin/assignments` — admin; `{ club_id, user_id }` where target user must be a coordinator.

## Events and registrations

- `GET /events?q=...` — published events with registration counts.
- `GET /events/:id` — event detail.
- `POST /events` — assigned coordinator/admin; event fields: `club_id`, `title`, `description`, `category`, ISO `starts_at`, ISO `ends_at`, `location`, positive integer `capacity`, ISO `deadline`, `status` (`draft` or `published`).
- `PATCH /events/:id` — same fields and authorization against old and new club assignments.
- `GET /registrations` — own student records, assigned-club coordinator records, or admin records.
- `POST /events/:id/register` — student; server checks status, deadline, start time, duplicate registration, and capacity transactionally.
- `POST /registrations/:id/cancel` — owning student cancels their registration.

## Announcements and notifications

- `GET /announcements` — admin sees all published entries; others see global announcements and announcements for active club memberships.
- `POST /announcements` — coordinator/admin; body `{ club_id, title, body, audience: "all" | "members" }`; coordinators must choose an assigned club, admins may use `null` for campus-wide posts.
- `GET /notifications` — current user's notifications.
- `PATCH /notifications/:id/read` — marks an owned notification read.

Validation failures use 400, unauthenticated requests 401, unauthorized role/resource or CSRF/origin requests 403, missing resources 404, and duplicate/conflicting operations 409. Pagination and richer filtering are not yet implemented.
