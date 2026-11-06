import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
const configured = process.env.DATABASE_PATH ?? './data/campussphere.sqlite';
if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_PATH || !path.isAbsolute(configured))) {
  throw new Error('Set DATABASE_PATH to an absolute path on persistent storage before starting in production.');
}
if (configured !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(configured)), { recursive: true });
export const db = new DatabaseSync(configured);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','coordinator','admin')), name TEXT NOT NULL, student_id TEXT UNIQUE, department TEXT NOT NULL DEFAULT '', program TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS clubs (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, category TEXT NOT NULL, category_id INTEGER REFERENCES categories(id), description TEXT NOT NULL DEFAULT '', meeting_schedule TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')), policy TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS club_coordinators (club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(club_id,user_id));
CREATE TABLE IF NOT EXISTS memberships (id INTEGER PRIMARY KEY, club_id INTEGER NOT NULL REFERENCES clubs(id), user_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('pending','active','rejected','withdrawn')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(club_id,user_id));
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, club_id INTEGER NOT NULL REFERENCES clubs(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Community', starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, location TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0), deadline TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','cancelled','archived')), created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS registrations (id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id), user_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','cancelled','attended')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id,user_id));
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, club_id INTEGER REFERENCES clubs(id), author_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'all', status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(starts_at,status); CREATE INDEX IF NOT EXISTS idx_membership_user ON memberships(user_id,status); CREATE INDEX IF NOT EXISTS idx_registration_user ON registrations(user_id,status);
`);
// Additive migrations keep existing club IDs and relationships intact.
const ensureColumn=(table:string,column:string,definition:string)=>{
 const columns=db.prepare(`PRAGMA table_info(${table})`).all() as Array<{name:string}>;
 if(!columns.some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn('clubs','category_id','INTEGER REFERENCES categories(id)');
ensureColumn('clubs','meeting_schedule',"TEXT NOT NULL DEFAULT ''");
ensureColumn('clubs','contact_email',"TEXT NOT NULL DEFAULT ''");
ensureColumn('memberships','reviewed_at','TEXT');
ensureColumn('memberships','updated_at',"TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'");
ensureColumn('events','image_url',"TEXT NOT NULL DEFAULT ''");
ensureColumn('events','updated_at',"TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'");
ensureColumn('announcements','updated_at',"TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'");
db.exec('CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category_id,status); CREATE INDEX IF NOT EXISTS idx_coordinator_user ON club_coordinators(user_id,club_id);');
if (process.argv[1]?.endsWith('db.ts')) console.log('CampusSphere database initialized.');

