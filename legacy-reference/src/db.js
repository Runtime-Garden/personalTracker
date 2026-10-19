import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const iso = () => new Date().toISOString();
export const uid = () => randomUUID();
export function connect(filename = process.env.DB_FILE || './data/tracker.sqlite') {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  db.exec(`CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, pass_hash TEXT, system_role TEXT NOT NULL DEFAULT 'user' CHECK(system_role IN ('user','admin')), disabled INTEGER NOT NULL DEFAULT 0, timezone TEXT NOT NULL DEFAULT 'UTC', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(provider,subject));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, return_to TEXT NOT NULL, link_user_id TEXT, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invites (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, workspace_id TEXT, role TEXT NOT NULL DEFAULT 'member', created_by TEXT REFERENCES users(id), expires_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('personal','team')), owner_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')), joined_at TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), project_id TEXT REFERENCES projects(id), title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 220), description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('backlog','todo','in_progress','review','done')), priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')), important INTEGER NOT NULL DEFAULT 0, assignee_id TEXT REFERENCES users(id), due_date TEXT, creator_id TEXT NOT NULL REFERENCES users(id), position REAL NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, completed_at TEXT, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tasks_scope ON tasks(workspace_id,status,due_date); CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id,position);
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS todo_lists (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, owner_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), list_id TEXT REFERENCES todo_lists(id), task_id TEXT REFERENCES tasks(id), title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, important INTEGER NOT NULL DEFAULT 0, due_date TEXT, creator_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, remind_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','delivered','done','dismissed')), important INTEGER NOT NULL DEFAULT 0, task_id TEXT REFERENCES tasks(id), created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS reminders_queue ON reminders(state,remind_at);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id), reminder_id TEXT UNIQUE REFERENCES reminders(id), message TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT);
CREATE TABLE IF NOT EXISTS sprints (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','active','closed')), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sprint_tasks (sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, PRIMARY KEY(sprint_id,task_id));
CREATE TABLE IF NOT EXISTS my_day (user_id TEXT NOT NULL REFERENCES users(id), task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, plan_date TEXT NOT NULL, PRIMARY KEY(user_id,task_id,plan_date));
CREATE TABLE IF NOT EXISTS focus_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), task_id TEXT REFERENCES tasks(id), kind TEXT NOT NULL CHECK(kind IN ('work','short_break','long_break')), planned_sec INTEGER NOT NULL, started_at TEXT NOT NULL, ends_at TEXT NOT NULL, ended_at TEXT, state TEXT NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','cancelled')));
CREATE TABLE IF NOT EXISTS ai_connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL, model TEXT NOT NULL, base_url TEXT NOT NULL, secret_blob TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_proposals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id), connection_id TEXT REFERENCES ai_connections(id), summary TEXT NOT NULL, action_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','failed')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), workspace_id TEXT, action TEXT NOT NULL, target_id TEXT, meta TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_created ON audit(created_at);
CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, blocked_until TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS worker_state (name TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO settings(name,value) VALUES (?,?)').run('signup_mode','invite_only');
  db.prepare('INSERT OR IGNORE INTO settings(name,value) VALUES (?,?)').run('app_name','Personal Tracker');
  return db;
}
export const run = (db, sql, ...args) => db.prepare(sql).run(...args);
export const one = (db, sql, ...args) => db.prepare(sql).get(...args) || null;
export const all = (db, sql, ...args) => db.prepare(sql).all(...args);
export function transaction(db, fn) { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } }
export function audit(db,user,workspace,action,target,meta={}) {run(db,'INSERT INTO audit VALUES (?,?,?,?,?,?,?)',uid(),user||null,workspace||null,action,target||null,JSON.stringify(meta),iso());}
export function personalWorkspace(db,userId,name='Personal') {const id=uid();run(db,'INSERT INTO workspaces VALUES (?,?,?,?,?)',id,name,'personal',userId,iso());run(db,'INSERT INTO members VALUES (?,?,?,?)',id,userId,'owner',iso());return id;}
