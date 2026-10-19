# Original Personal Tracker MySQL schema (reference only)

The SQL below is reproduced from the uploaded schema file for source-data mapping **only**. It is not a migration to PostgreSQL. It defines a single-user schema, so never run it as the new app data model. Confirm ownership and a safe database snapshot before any import.

```sql
-- Personal Tracker schema (single-user)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    work_hours_start TIME NULL,
    work_hours_end TIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
    priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    due_date DATE NULL,
    is_important TINYINT(1) NOT NULL DEFAULT 0,
    on_kanban TINYINT(1) NOT NULL DEFAULT 0,
    kanban_column ENUM('backlog','todo','in_progress','review','done') NOT NULL DEFAULT 'backlog',
    kanban_position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_due_date (due_date),
    INDEX idx_tasks_important (is_important),
    INDEX idx_tasks_kanban (on_kanban, kanban_column)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS todo_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS todo_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    todo_list_id INT NOT NULL,
    task_id INT NOT NULL,
    due_date DATE NULL,
    status ENUM('open','in_progress','done') NOT NULL DEFAULT 'open',
    is_important TINYINT(1) NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_items_list FOREIGN KEY (todo_list_id) REFERENCES todo_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_items_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    INDEX idx_todo_items_due_date (due_date),
    INDEX idx_todo_items_important (is_important)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS todo_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    todo_item_id INT NOT NULL,
    body TEXT NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_comments_item FOREIGN KEY (todo_item_id) REFERENCES todo_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    remind_at DATETIME NOT NULL,
    status ENUM('pending','done','dismissed') NOT NULL DEFAULT 'pending',
    is_important TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_reminders_remind_at (remind_at),
    INDEX idx_reminders_important (is_important)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sprints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('work','short_break','long_break') NOT NULL DEFAULT 'work',
    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,
    duration_seconds INT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pomodoro_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

```
