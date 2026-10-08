-- PostgreSQL Schema for AI Mock Interview Coach
-- Compatible with PostgreSQL 13+ and Supabase / Render PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    extracted_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INT REFERENCES resumes(id) ON DELETE SET NULL,
    role VARCHAR(120) NOT NULL,
    experience VARCHAR(80) NOT NULL,
    interview_type VARCHAR(80) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium',
    current_difficulty VARCHAR(20) DEFAULT 'medium',
    adaptive_enabled BOOLEAN DEFAULT TRUE,
    question_count INT DEFAULT 5,
    status VARCHAR(30) DEFAULT 'in_progress',
    overall_score DECIMAL(4,2),
    final_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    interview_id INT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    question_text TEXT NOT NULL,
    topic VARCHAR(120),
    difficulty VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    question_id INT UNIQUE NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    technical_score DECIMAL(4,2) DEFAULT 0,
    relevance_score DECIMAL(4,2) DEFAULT 0,
    communication_score DECIMAL(4,2) DEFAULT 0,
    completeness_score DECIMAL(4,2) DEFAULT 0,
    overall_score DECIMAL(4,2) DEFAULT 0,
    strengths JSONB,
    weaknesses JSONB,
    improvement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_resume_id ON interviews(resume_id);
CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
