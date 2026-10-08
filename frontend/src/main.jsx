import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Base API configuration from Vite environment variable or local default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Robust API client with JWT authorization
async function apiRequest(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('mock_interview_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('mock_interview_token');
    localStorage.removeItem('mock_interview_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }
  return data;
}

const api = {
  auth: {
    register: (payload) =>
      apiRequest('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    login: (payload) =>
      apiRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    me: () => apiRequest('/auth/me')
  },
  resumes: {
    list: () => apiRequest('/resumes'),
    upload: (file) => {
      const formData = new FormData();
      formData.append('resume', file);
      return apiRequest('/resumes/upload', {
        method: 'POST',
        body: formData
      });
    },
    delete: (id) => apiRequest(`/resumes/${id}`, { method: 'DELETE' })
  },
  interviews: {
    start: (config) =>
      apiRequest('/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }),
    answer: (interviewId, payload) =>
      apiRequest(`/interviews/${interviewId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    list: () => apiRequest('/interviews'),
    get: (id) => apiRequest(`/interviews/${id}`)
  },
  analytics: {
    dashboard: () => apiRequest('/analytics/dashboard')
  }
};

// -------------------------------------------------------------
// Component: Auth View (Sign In & Sign Up)
// -------------------------------------------------------------
function AuthView({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res =
        mode === 'login'
          ? await api.auth.login({ email: formData.email, password: formData.password })
          : await api.auth.register(formData);

      localStorage.setItem('mock_interview_token', res.token);
      localStorage.setItem('mock_interview_user', JSON.stringify(res.user));
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-hero">
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
          <span className="badge badge-adaptive">RAG + SPEECH + ADAPTIVE AI</span>
        </div>
        <h1 className="auth-headline">
          Prepare Like a Pro.<br />
          <span>Interview with Confidence.</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem', maxWidth: '540px' }}>
          Simulate realistic technical and behavioral interviews grounded in your own resume, backed by RAG knowledge retrieval and speech synthesis.
        </p>

        <div className="auth-features">
          <div className="auth-feat-item">
            <b>📄 Resume Grounding</b>
            <p>Every generated question references your actual background, projects, and technologies.</p>
          </div>
          <div className="auth-feat-item">
            <b>🎯 Adaptive Difficulty</b>
            <p>Real-time scaling: score above 8 to level up, or scale down to strengthen fundamentals.</p>
          </div>
          <div className="auth-feat-item">
            <b>🎙 Voice Mode & Audio</b>
            <p>Speak your answers naturally using Speech-to-Text and listen with Text-to-Speech playback.</p>
          </div>
          <div className="auth-feat-item">
            <b>📊 Deep Performance Rubrics</b>
            <p>Instant scoring on Technical Depth, Relevance, Communication, and Completeness.</p>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label>Work or Personal Email</label>
            <input
              type="email"
              placeholder="jane@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Password (min 6 characters)</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In to Dashboard →' : 'Create Free Account →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Navigation Bar
// -------------------------------------------------------------
function Navbar({ user, activeTab, setActiveTab, onLogout }) {
  return (
    <nav className="navbar">
      <div className="brand" onClick={() => setActiveTab('setup')}>
        <div className="brand-icon">⚡</div>
        <div>
          <span className="brand-title">MockCoach AI</span>
        </div>
        <span className="brand-badge">PRO EDITION</span>
      </div>

      <div className="nav-links">
        <button
          className={`nav-btn ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          🎯 New Interview
        </button>
        <button
          className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History
        </button>
        <button
          className={`nav-btn ${activeTab === 'resumes' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumes')}
        >
          📄 Resumes
        </button>
      </div>

      <div className="user-profile">
        <div className="user-pill">
          <div className="user-avatar">{user.name ? user.name[0].toUpperCase() : 'U'}</div>
          <span>{user.name}</span>
        </div>
        <button className="btn-logout" onClick={onLogout} title="Log Out">
          Log Out
        </button>
      </div>
    </nav>
  );
}

// -------------------------------------------------------------
// Component: Setup Screen (Configure Interview & Resumes)
// -------------------------------------------------------------
function SetupScreen({ onStartInterview, onNavigate }) {
  const [config, setConfig] = useState({
    role: 'Backend Python Engineer',
    experience: 'Mid Level (2-4 yrs)',
    interview_type: 'Technical',
    difficulty: 'medium',
    question_count: 5,
    adaptive_enabled: true
  });

  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load existing resumes
  useEffect(() => {
    api.resumes.list()
      .then((data) => {
        setResumes(data);
        if (data.length > 0) {
          setSelectedResumeId(String(data[0].id));
        }
      })
      .catch((err) => console.error('Failed to load resumes', err));
  }, []);

  const handleUploadResume = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError('');
    setSuccessMsg('');

    try {
      const newResume = await api.resumes.upload(uploadFile);
      setResumes((prev) => [newResume, ...prev]);
      setSelectedResumeId(String(newResume.id));
      setUploadFile(null);
      setSuccessMsg(`Successfully uploaded & analyzed ${newResume.filename} (${newResume.character_count} characters)`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...config,
        question_count: parseInt(config.question_count, 10),
        resume_id: selectedResumeId ? parseInt(selectedResumeId, 10) : null
      };

      const result = await api.interviews.start(payload);
      onStartInterview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rolePresets = [
    'Backend Python Engineer',
    'Full Stack React & Node Developer',
    'PostgreSQL / Database Specialist',
    'System Design & Cloud Architect',
    'Machine Learning / GenAI Engineer',
    'Frontend Specialist (React / TypeScript)'
  ];

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.4rem' }}>Configure Your AI Mock Interview</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Customize your role, experience level, adaptive difficulty, and link your resume for grounded questions.
        </p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {successMsg && <div className="alert alert-success">✓ {successMsg}</div>}

      <form onSubmit={handleStart}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="card-title">1. Target Role & Experience</h2>
          <p className="card-subtitle">Select a target role or type your exact specialization.</p>

          <div className="form-group">
            <label>Target Role</label>
            <input
              type="text"
              required
              value={config.role}
              onChange={(e) => setConfig({ ...config, role: e.target.value })}
              placeholder="e.g. Senior Backend Engineer"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {rolePresets.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setConfig({ ...config, role: r })}
                  style={{
                    background: config.role === r ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: config.role === r ? '#a5b4fc' : 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label>Experience Level</label>
              <select
                value={config.experience}
                onChange={(e) => setConfig({ ...config, experience: e.target.value })}
              >
                <option>Entry Level / Fresher (0-1 yr)</option>
                <option>Junior Engineer (1-2 yrs)</option>
                <option>Mid Level (2-4 yrs)</option>
                <option>Senior Engineer (5-8 yrs)</option>
                <option>Lead / Principal Architect (8+ yrs)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Interview Focus</label>
              <select
                value={config.interview_type}
                onChange={(e) => setConfig({ ...config, interview_type: e.target.value })}
              >
                <option value="Technical">Technical Deep-Dive</option>
                <option value="System Design">System Design & Architecture</option>
                <option value="Behavioral">Behavioral (STAR Method)</option>
                <option value="Mixed">Mixed (Technical + Behavioral)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Initial Difficulty</label>
              <select
                value={config.difficulty}
                onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
              >
                <option value="easy">Easy (Fundamentals & Core syntax)</option>
                <option value="medium">Medium (Real-world scenarios & patterns)</option>
                <option value="hard">Hard (Scale, concurrency, edge cases)</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label>Number of Questions: {config.question_count}</label>
              <input
                type="range"
                min="3"
                max="10"
                value={config.question_count}
                onChange={(e) => setConfig({ ...config, question_count: e.target.value })}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>3 (Quick drill)</span>
                <span>5 (Standard)</span>
                <span>10 (Full session)</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '1.5rem' }}>
              <input
                type="checkbox"
                id="adaptive_chk"
                checked={config.adaptive_enabled}
                onChange={(e) => setConfig({ ...config, adaptive_enabled: e.target.checked })}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="adaptive_chk" style={{ cursor: 'pointer', margin: 0 }}>
                <b style={{ color: '#fff' }}>Enable Phase 5 Adaptive Engine</b>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Questions dynamically scale between Easy, Medium, and Hard based on your performance.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Resume Selection & Upload */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 className="card-title">2. Link Your Resume (RAG Grounding)</h2>
          <p className="card-subtitle">
            Ground questions directly into your projects, skills, and work history.
          </p>

          <div className="grid-2">
            <div className="form-group">
              <label>Select From Uploaded Resumes</label>
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                <option value="">No Resume (General Questions)</option>
                {resumes.map((res) => (
                  <option key={res.id} value={res.id}>
                    📄 {res.filename} ({res.character_count} chars)
                  </option>
                ))}
              </select>
              {selectedResumeId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-easy)', marginTop: '4px' }}>
                  ✓ This resume will be used to ground every interview question.
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Or Upload New PDF Resume</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  style={{ fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!uploadFile || uploading}
                  onClick={handleUploadResume}
                >
                  {uploading ? 'Analyzing...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
          disabled={loading}
        >
          {loading ? 'Initializing AI Coach & Generating Question 1...' : '🚀 Start AI Mock Interview Now'}
        </button>
      </form>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Active Interview Session
// -------------------------------------------------------------
function InterviewScreen({ sessionData, onFinish, onCancel }) {
  const [interview, setInterview] = useState(sessionData.interview);
  const [currentQuestion, setCurrentQuestion] = useState(sessionData.question);
  const [answerText, setAnswerText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [previousFeedback, setPreviousFeedback] = useState(null);
  const [adaptiveNotice, setAdaptiveNotice] = useState(null);

  // Voice State (STT & TTS)
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState('');

  const recognitionRef = useRef(null);

  // Text-to-Speech (TTS)
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Speak question automatically when question changes if enabled
  useEffect(() => {
    if (autoPlayAudio && currentQuestion?.text) {
      speakText(currentQuestion.text);
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentQuestion?.id]);

  // Speech-to-Text (STT) Setup
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setAnswerText((prev) => (prev ? prev.trim() + ' ' + finalTranscript.trim() : finalTranscript.trim()));
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition notice:', event.error);
      if (event.error === 'not-allowed') {
        setSpeechError('Microphone access was denied. Please allow microphone permissions.');
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your current browser. You can still type your answers!');
      return;
    }
    setSpeechError('');

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Error starting recognition', err);
      }
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answerText.trim() || evaluating) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    stopSpeaking();

    setEvaluating(true);
    setSpeechError('');

    try {
      const response = await api.interviews.answer(interview.id, {
        question_id: currentQuestion.id,
        answer: answerText
      });

      setPreviousFeedback(response.evaluation);

      if (response.adaptive_message) {
        setAdaptiveNotice({
          difficulty: response.adaptive_difficulty,
          message: response.adaptive_message,
          changed: response.difficulty_changed
        });
      }

      setAnswerText('');

      if (response.completed) {
        onFinish({
          interview: response.interview,
          report: response.report,
          lastEvaluation: response.evaluation
        });
      } else {
        setCurrentQuestion(response.next_question);
        setInterview((prev) => ({
          ...prev,
          current_difficulty: response.adaptive_difficulty
        }));
      }
    } catch (err) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const progressPercent = Math.round(((currentQuestion.sequence - 1) / interview.question_count) * 100);

  return (
    <div className="container">
      {/* Top Header & Progress */}
      <div className="interview-header">
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role Target</span>
          <h2 style={{ fontSize: '1.25rem' }}>{interview.role} ({interview.experience})</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-adaptive">
            ⚡ {interview.adaptive_enabled ? 'Adaptive Mode' : 'Fixed Mode'}
          </span>
          <span className={`badge badge-${interview.current_difficulty}`}>
            Level: {interview.current_difficulty}
          </span>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onCancel}>
            Exit
          </button>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>Question {currentQuestion.sequence} of {interview.question_count}</span>
          <span>{progressPercent}% Complete</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.max(5, progressPercent)}%` }}></div>
        </div>
      </div>

      {/* Adaptive Difficulty Alert Notice */}
      {adaptiveNotice && (
        <div className="alert alert-info" style={{ animation: 'slide-up 0.3s ease' }}>
          <div>
            <b>Difficulty Update:</b> {adaptiveNotice.message}
          </div>
        </div>
      )}

      {/* Question Card */}
      <div className="card question-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <span className="question-topic-pill">
            TOPIC: {currentQuestion.topic || 'Core Engineering'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isSpeaking ? (
              <button type="button" className="btn-tts speaking" onClick={stopSpeaking}>
                <div className="audio-waves">
                  <span className="audio-bar"></span>
                  <span className="audio-bar"></span>
                  <span className="audio-bar"></span>
                  <span className="audio-bar"></span>
                </div>
                Stop Reading
              </button>
            ) : (
              <button type="button" className="btn-tts" onClick={() => speakText(currentQuestion.text)}>
                🔊 Read Question
              </button>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoPlayAudio}
                onChange={(e) => setAutoPlayAudio(e.target.checked)}
              />
              Auto-read
            </label>
          </div>
        </div>

        <h3 className="question-text" style={{ marginTop: '0.75rem' }}>
          {currentQuestion.text}
        </h3>
      </div>

      {/* Answer Input Area */}
      <form onSubmit={handleSubmitAnswer} className="card">
        <div className="toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className={`btn-voice ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
            >
              {isRecording ? (
                <>
                  <div className="audio-waves">
                    <span className="audio-bar"></span>
                    <span className="audio-bar"></span>
                    <span className="audio-bar"></span>
                    <span className="audio-bar"></span>
                  </div>
                  Listening... Click to Stop
                </>
              ) : (
                '🎙 Speak Answer (Voice STT)'
              )}
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              {isRecording ? 'Listening through your microphone...' : 'Speech-to-text or manual keyboard typing'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Words: {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} | Characters: {answerText.length}
          </div>
        </div>

        {speechError && <div className="alert alert-error">⚠️ {speechError}</div>}

        <textarea
          rows={7}
          placeholder="Articulate your thought process, architecture decisions, trade-offs, and concrete examples here. You can speak or type freely..."
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Tip: Press Submit when ready. The AI will evaluate against technical depth, relevance, communication, and completeness.
          </span>
          <button
            type="submit"
            className="btn-primary"
            disabled={evaluating || !answerText.trim()}
          >
            {evaluating ? 'Evaluating Answer via AI...' : currentQuestion.sequence === interview.question_count ? 'Submit & View Final Report →' : 'Submit & Next Question →'}
          </button>
        </div>
      </form>

      {/* Previous Answer Evaluation Card */}
      {previousFeedback && (
        <div className="feedback-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontSize: '1.1rem', color: '#c7d2fe' }}>
              🎯 Previous Answer AI Evaluation
            </h4>
            <span className="badge badge-completed" style={{ fontSize: '0.95rem' }}>
              Overall Score: {previousFeedback.overall_score} / 10
            </span>
          </div>

          <div className="rubric-grid">
            <div className="rubric-item">
              <span>Technical Depth</span>
              <b>{previousFeedback.technical_score}</b>
            </div>
            <div className="rubric-item">
              <span>Relevance</span>
              <b>{previousFeedback.relevance_score}</b>
            </div>
            <div className="rubric-item">
              <span>Communication</span>
              <b>{previousFeedback.communication_score}</b>
            </div>
            <div className="rubric-item">
              <span>Completeness</span>
              <b>{previousFeedback.completeness_score}</b>
            </div>
          </div>

          {previousFeedback.strengths?.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-easy)', fontWeight: 700, textTransform: 'uppercase' }}>Key Strengths</span>
              <div className="tag-list">
                {previousFeedback.strengths.map((str, idx) => (
                  <span key={idx} className="tag-strength">✓ {str}</span>
                ))}
              </div>
            </div>
          )}

          {previousFeedback.weaknesses?.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-medium)', fontWeight: 700, textTransform: 'uppercase' }}>Focus Areas</span>
              <div className="tag-list">
                {previousFeedback.weaknesses.map((w, idx) => (
                  <span key={idx} className="tag-weakness">⚠ {w}</span>
                ))}
              </div>
            </div>
          )}

          {previousFeedback.improvement && (
            <div style={{ marginTop: '0.75rem', padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <b style={{ color: '#fff' }}>Recommended Improvement: </b>
              {previousFeedback.improvement}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: Completed Interview & Final Report
// -------------------------------------------------------------
function FinalReportScreen({ reportData, onStartNew, onViewAnalytics }) {
  const { interview, report } = reportData;
  const [details, setDetails] = useState(null);
  const [expandedQ, setExpandedQ] = useState(null);

  useEffect(() => {
    if (interview?.id) {
      api.interviews.get(interview.id)
        .then(setDetails)
        .catch((e) => console.error(e));
    }
  }, [interview?.id]);

  const score = interview.overall_score || 0;
  const grade =
    score >= 8.5 ? 'Distinction • Senior Ready' :
    score >= 7.0 ? 'Proficient • Strong Foundation' :
    score >= 5.0 ? 'Intermediate • Needs Practice' : 'Foundational Drill Required';

  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem', marginBottom: '2rem' }}>
        <span className="badge badge-adaptive" style={{ marginBottom: '1rem' }}>
          SESSION COMPLETED
        </span>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '0.5rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {score} / 10
        </h1>
        <h3 style={{ color: '#ffffff', marginBottom: '0.75rem' }}>{grade}</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto 2rem', fontSize: '1.05rem', lineHeight: '1.6' }}>
          {report?.overall_summary || 'Your comprehensive mock interview evaluation has been processed.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={onStartNew}>
            🚀 Start Another Interview
          </button>
          <button className="btn-secondary" onClick={onViewAnalytics}>
            📊 View Performance Dashboard
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--color-easy)' }}>
            ✓ Standout Strengths
          </h3>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '1rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            {(report?.top_strengths || []).map((s, idx) => (
              <li key={idx}><strong style={{ color: '#fff' }}>{s}</strong></li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--color-medium)' }}>
            ⚠ Key Focus Areas & Action Plan
          </h3>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '1rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            {(report?.focus_areas || []).map((f, idx) => (
              <li key={idx}><strong style={{ color: '#fff' }}>{f}</strong></li>
            ))}
          </ul>

          <h4 style={{ marginTop: '1.5rem', fontSize: '0.95rem', color: '#c7d2fe' }}>Next Steps:</h4>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            {(report?.action_plan || []).map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detailed Question by Question Review */}
      {details?.questions && (
        <div className="card">
          <h3 className="card-title">📝 Question-by-Question Detailed Review</h3>
          <p className="card-subtitle">Examine your answers, individual rubrics, and feedback.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {details.questions.map((q) => (
              <div
                key={q.id}
                style={{
                  background: 'rgba(10, 16, 29, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem'
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Question #{q.sequence} • Topic: {q.topic || 'General'} • Difficulty: {q.difficulty}
                    </span>
                    <h4 style={{ fontSize: '1.05rem', color: '#fff', marginTop: '4px' }}>
                      {q.question_text}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-completed">
                      {q.answer?.overall_score || 0} / 10
                    </span>
                    <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                      {expandedQ === q.id ? 'Collapse ▲' : 'Details ▼'}
                    </button>
                  </div>
                </div>

                {expandedQ === q.id && q.answer && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>Your Answer:</span>
                      <p style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--text-main)', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: 'var(--radius-sm)', lineHeight: '1.6' }}>
                        {q.answer.answer_text}
                      </p>
                    </div>

                    <div className="rubric-grid">
                      <div className="rubric-item">
                        <span>Technical</span>
                        <b>{q.answer.technical_score}</b>
                      </div>
                      <div className="rubric-item">
                        <span>Relevance</span>
                        <b>{q.answer.relevance_score}</b>
                      </div>
                      <div className="rubric-item">
                        <span>Communication</span>
                        <b>{q.answer.communication_score}</b>
                      </div>
                      <div className="rubric-item">
                        <span>Completeness</span>
                        <b>{q.answer.completeness_score}</b>
                      </div>
                    </div>

                    {q.answer.improvement && (
                      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--color-easy)' }}>Coach Tip: </strong>
                        {q.answer.improvement}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: Analytics Dashboard
// -------------------------------------------------------------
function AnalyticsScreen({ onReviewInterview }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.analytics.dashboard()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <h2>Loading Analytics Dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">⚠️ {error}</div>
      </div>
    );
  }

  const { summary, topic_breakdown, recent_interviews } = data;

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.4rem' }}>Performance & Skill Analytics</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Track comprehensive progress, domain mastery, and review past interview reports.
        </p>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
        <div className="kpi-card">
          <div className="kpi-title">Total Interviews</div>
          <div className="kpi-val">{summary.total_interviews}</div>
          <div className="kpi-sub">Practice sessions created</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Completed Sessions</div>
          <div className="kpi-val">{summary.completed_interviews}</div>
          <div className="kpi-sub">Fully evaluated by AI</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Average Overall Score</div>
          <div className="kpi-val" style={{ color: '#a5b4fc' }}>{summary.average_score} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ 10</span></div>
          <div className="kpi-sub">Mean across completed interviews</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Personal Best Score</div>
          <div className="kpi-val" style={{ color: 'var(--color-easy)' }}>{summary.best_score} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ 10</span></div>
          <div className="kpi-sub">Highest scoring performance</div>
        </div>
      </div>

      {/* Sub-competencies Breakdown */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="card-title">Competency Rubric Breakdown</h3>
        <p className="card-subtitle">Aggregate scores across all answered questions.</p>

        <div className="grid-4">
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Technical Accuracy</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '6px 0', color: '#fff' }}>{summary.technical_avg} / 10</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.technical_avg * 10}%` }}></div></div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Answer Relevance</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '6px 0', color: '#fff' }}>{summary.relevance_avg} / 10</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.relevance_avg * 10}%` }}></div></div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Communication Clarity</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '6px 0', color: '#fff' }}>{summary.communication_avg} / 10</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.communication_avg * 10}%` }}></div></div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Completeness & Breadth</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '6px 0', color: '#fff' }}>{summary.completeness_avg} / 10</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.completeness_avg * 10}%` }}></div></div>
          </div>
        </div>
      </div>

      {/* Topic-wise Performance */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="card-title">Topic-Wise Performance Breakdown</h3>
        <p className="card-subtitle">Mastery across technical domains encountered during interviews.</p>

        {topic_breakdown?.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No topic data available yet. Complete an interview to see breakdown.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Topic Domain</th>
                  <th>Questions Tested</th>
                  <th>Average Score</th>
                  <th>Mastery Status</th>
                </tr>
              </thead>
              <tbody>
                {topic_breakdown.map((t, idx) => (
                  <tr key={idx}>
                    <td><strong>{t.topic}</strong></td>
                    <td>{t.question_count} questions</td>
                    <td>
                      <span style={{ fontWeight: 700 }}>{t.average_score} / 10</span>
                    </td>
                    <td>
                      <span className={`badge ${t.mastery === 'Expert' ? 'badge-easy' : t.mastery === 'Proficient' ? 'badge-medium' : 'badge-hard'}`}>
                        {t.mastery}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Interview History */}
      <div className="card">
        <h3 className="card-title">Recent Interview History</h3>
        <p className="card-subtitle">Select any completed interview to view full reports and feedback.</p>

        {recent_interviews?.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No past interviews found. Start your first mock interview above!</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Target Role</th>
                  <th>Type</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Resume Used</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent_interviews.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.role}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{item.experience}</div>
                    </td>
                    <td>{item.interview_type}</td>
                    <td>
                      <span className={`badge badge-${item.difficulty}`}>{item.difficulty}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${item.status}`}>
                        {item.status === 'completed' ? '✓ Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td>
                      {item.overall_score !== null ? (
                        <b style={{ color: item.overall_score >= 7.5 ? 'var(--color-easy)' : '#fff' }}>
                          {item.overall_score} / 10
                        </b>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.resume_filename ? `📄 ${item.resume_filename}` : 'None'}
                      </span>
                    </td>
                    <td>
                      {item.status === 'completed' ? (
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => onReviewInterview(item.id)}
                        >
                          Review Report →
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: History Screen (List & Detailed Modal)
// -------------------------------------------------------------
function HistoryScreen({ onSelectInterview }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.interviews.list()
      .then((data) => {
        setInterviews(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.4rem' }}>Interview History</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Review all your past mock interviews, scores, and coaching recommendations.
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading history...</p>
        ) : interviews.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No interview sessions yet. Start an interview to see your history!</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Role & Level</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((i) => (
                  <tr key={i.id}>
                    <td>#{i.id}</td>
                    <td>
                      <strong>{i.role}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{i.experience}</div>
                    </td>
                    <td>{i.interview_type}</td>
                    <td>
                      {i.overall_score !== null ? (
                        <b style={{ color: i.overall_score >= 7.5 ? 'var(--color-easy)' : '#fff' }}>
                          {i.overall_score} / 10
                        </b>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${i.status}`}>
                        {i.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {i.created_at ? new Date(i.created_at).toLocaleDateString() : ''}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => onSelectInterview(i.id)}
                      >
                        Open Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Resumes Management Screen
// -------------------------------------------------------------
function ResumesScreen() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.resumes.list()
      .then((data) => {
        setResumes(data);
        setLoading(false);
      })
      .catch((e) => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setMsg('');
    try {
      await api.resumes.upload(uploadFile);
      setUploadFile(null);
      setMsg('Resume uploaded successfully!');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await api.resumes.delete(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.4rem' }}>Resume Library</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage your uploaded resumes used for grounding mock interview questions.
        </p>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="card-title">Upload New Resume</h3>
        <p className="card-subtitle">PDF resumes are parsed and indexed for RAG context extraction.</p>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '500px' }}>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setUploadFile(e.target.files[0])}
          />
          <button
            className="btn-primary"
            disabled={!uploadFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Parsing...' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Uploaded Resumes</h3>
        {loading ? (
          <p>Loading resumes...</p>
        ) : resumes.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No resumes uploaded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Extracted Characters</th>
                  <th>Date Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((r) => (
                  <tr key={r.id}>
                    <td><strong>📄 {r.filename}</strong></td>
                    <td>{r.character_count} characters</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</td>
                    <td>
                      <button
                        className="btn-logout"
                        style={{ padding: '4px 10px' }}
                        onClick={() => handleDelete(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Modal Detail Viewer (For Any Past Interview)
// -------------------------------------------------------------
function InterviewDetailModal({ interviewId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (interviewId) {
      api.interviews.get(interviewId)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [interviewId]);

  if (!interviewId) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading ? (
          <p>Loading interview report...</p>
        ) : !data ? (
          <p>Interview not found.</p>
        ) : (
          <div>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <span className="badge badge-adaptive">SESSION #{data.id}</span>
              <h2 style={{ fontSize: '1.8rem', marginTop: '6px' }}>{data.role} ({data.experience})</h2>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Type: {data.interview_type}</span>
                <span>•</span>
                <span>Difficulty: {data.difficulty}</span>
                <span>•</span>
                <span>Overall: <b>{data.overall_score || 0}/10</b></span>
              </div>
            </div>

            {data.final_report?.overall_summary && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                <b style={{ color: '#c7d2fe', display: 'block', marginBottom: '6px' }}>Executive Summary:</b>
                <p style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{data.final_report.overall_summary}</p>
              </div>
            )}

            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Questions & Answers:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(data.questions || []).map((q) => (
                <div key={q.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Q{q.sequence} • {q.topic}</span>
                    <span className="badge badge-completed">{q.answer?.overall_score || 0} / 10</span>
                  </div>
                  <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{q.question_text}</strong>
                  {q.answer && (
                    <div style={{ marginTop: '8px', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      <p style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                        {q.answer.answer_text}
                      </p>
                      {q.answer.improvement && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-easy)', marginTop: '6px' }}>
                          💡 {q.answer.improvement}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Root Application
// -------------------------------------------------------------
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mock_interview_user') || 'null');
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('setup');
  const [activeSession, setActiveSession] = useState(null);
  const [completedReport, setCompletedReport] = useState(null);
  const [inspectModalId, setInspectModalId] = useState(null);

  // Listen for unauthorized events to automatically logout
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setActiveTab('setup');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('mock_interview_token');
    localStorage.removeItem('mock_interview_user');
    setCurrentUser(null);
    setActiveSession(null);
    setCompletedReport(null);
    setActiveTab('setup');
  };

  if (!currentUser) {
    return <AuthView onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  // Active Interview Session View
  if (activeTab === 'interview' && activeSession) {
    return (
      <>
        <Navbar user={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
        <InterviewScreen
          sessionData={activeSession}
          onFinish={(reportPayload) => {
            setCompletedReport(reportPayload);
            setActiveTab('report');
          }}
          onCancel={() => {
            if (confirm('Are you sure you want to exit this interview session? Your progress will remain saved.')) {
              setActiveSession(null);
              setActiveTab('setup');
            }
          }}
        />
      </>
    );
  }

  // Completed Final Report View
  if (activeTab === 'report' && completedReport) {
    return (
      <>
        <Navbar user={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
        <FinalReportScreen
          reportData={completedReport}
          onStartNew={() => {
            setActiveSession(null);
            setCompletedReport(null);
            setActiveTab('setup');
          }}
          onViewAnalytics={() => setActiveTab('analytics')}
        />
      </>
    );
  }

  return (
    <>
      <Navbar user={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      {activeTab === 'setup' && (
        <SetupScreen
          onStartInterview={(session) => {
            setActiveSession(session);
            setActiveTab('interview');
          }}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsScreen
          onReviewInterview={(id) => setInspectModalId(id)}
        />
      )}

      {activeTab === 'history' && (
        <HistoryScreen
          onSelectInterview={(id) => setInspectModalId(id)}
        />
      )}

      {activeTab === 'resumes' && (
        <ResumesScreen />
      )}

      {inspectModalId && (
        <InterviewDetailModal
          interviewId={inspectModalId}
          onClose={() => setInspectModalId(null)}
        />
      )}
    </>
  );
}

// Mount React Root
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
