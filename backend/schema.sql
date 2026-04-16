-- schema.sql
-- Run this to create the database from scratch.
-- If you need to reset the DB, delete buckeye_match.db and run this again.

-- One row per person (student or alumni)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('student', 'alumni')),
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student hard info (linked to users table by user_id)
CREATE TABLE IF NOT EXISTS student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    major TEXT NOT NULL,
    minor TEXT,
    year TEXT NOT NULL CHECK(year IN ('junior', 'senior')),
    hometown TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Each target company/role is its own row (so the matching engine can query them)
CREATE TABLE IF NOT EXISTS student_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    role_name TEXT,
    FOREIGN KEY (student_id) REFERENCES student_profiles(id)
);

-- Personality survey responses stored as JSON
CREATE TABLE IF NOT EXISTS survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL UNIQUE,
    responses TEXT NOT NULL,  -- JSON string: {"q1": "answer", "q2": "answer", ...}
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_profiles(id)
);

-- Alumni hard info
CREATE TABLE IF NOT EXISTS alumni_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    current_company TEXT NOT NULL,
    current_role TEXT NOT NULL,
    career_summary TEXT,
    availability TEXT NOT NULL DEFAULT 'open' CHECK(availability IN ('open', 'limited', 'closed')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Previous companies/roles for alumni (one row per job)
CREATE TABLE IF NOT EXISTS alumni_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumni_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    role_name TEXT,
    start_year INTEGER,
    end_year INTEGER,
    FOREIGN KEY (alumni_id) REFERENCES alumni_profiles(id)
);

-- One row per student-alumni match the engine creates
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    alumni_id INTEGER NOT NULL,
    score REAL NOT NULL,           -- matching engine score (0.0 to 1.0)
    explanation TEXT NOT NULL,     -- plain-English reason shown to student
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'active', 'passed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_profiles(id),
    FOREIGN KEY (alumni_id) REFERENCES alumni_profiles(id)
);

-- Messages between a student and alumni (async, no real-time needed for V1)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,             -- NULL means unread
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Interview / job outcomes logged by students
CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    match_id INTEGER,              -- which alumni helped (optional)
    outcome_type TEXT NOT NULL CHECK(outcome_type IN ('interview', 'offer', 'job')),
    notes TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_profiles(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

-- Thumbs up/down sent 2 weeks after a match
CREATE TABLE IF NOT EXISTS match_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    rated_by TEXT NOT NULL CHECK(rated_by IN ('student', 'alumni')),
    rating INTEGER NOT NULL CHECK(rating IN (1, -1)),
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

-- Past internships / roles for students (opt-in visibility to other students)
CREATE TABLE IF NOT EXISTS student_experience (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    role_name TEXT,
    term_label TEXT,
    visible_to_peers INTEGER NOT NULL DEFAULT 0 CHECK(visible_to_peers IN (0, 1)),
    FOREIGN KEY (student_id) REFERENCES student_profiles(id)
);

-- Student-to-student intro requests (not alumni matches)
CREATE TABLE IF NOT EXISTS peer_intro_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_student_id INTEGER NOT NULL,
    recipient_student_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    initial_message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_student_id) REFERENCES student_profiles(id),
    FOREIGN KEY (recipient_student_id) REFERENCES student_profiles(id)
);

CREATE TABLE IF NOT EXISTS peer_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intro_request_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    FOREIGN KEY (intro_request_id) REFERENCES peer_intro_requests(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);