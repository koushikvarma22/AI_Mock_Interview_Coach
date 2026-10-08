import os
from dotenv import load_dotenv

load_dotenv()

def get_database_uri():
    raw_uri = os.getenv('DATABASE_URL', 'postgresql+psycopg://postgres:password@localhost:5432/ai_mock_interview').strip()

    # Normalize Render / standard PostgreSQL URIs to use psycopg v3
    if raw_uri.startswith('postgres://'):
        raw_uri = raw_uri.replace('postgres://', 'postgresql+psycopg://', 1)
    elif raw_uri.startswith('postgresql://') and not raw_uri.startswith('postgresql+'):
        raw_uri = raw_uri.replace('postgresql://', 'postgresql+psycopg://', 1)

    # In production or Render environments, always use the configured DATABASE_URL
    if os.getenv('RENDER') or os.getenv('PRODUCTION') or 'sqlite' in raw_uri:
        return raw_uri

    # In local development, check if the local PostgreSQL connection works
    try:
        from sqlalchemy import create_engine
        engine = create_engine(raw_uri, pool_pre_ping=True)
        with engine.connect():
            pass
        return raw_uri
    except Exception as e:
        # If local PostgreSQL password/database is not set up, use local SQLite database so local app runs immediately
        local_db = os.path.abspath(os.path.join(os.path.dirname(__file__), 'ai_mock_interview.db')).replace('\\', '/')
        print(f"[*] Local PostgreSQL notice: {e}")
        print(f"[*] Using local SQLite database (ai_mock_interview.db) for instant local development...")
        return f"sqlite:///{local_db}"


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret-change-in-production')
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    HF_API_TOKEN = os.getenv('HF_API_TOKEN', '')
    HF_MODEL = os.getenv('HF_MODEL', 'meta-llama/Llama-3.1-8B-Instruct')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    MAX_RESUME_SIZE_MB = int(os.getenv('MAX_RESUME_SIZE_MB', '5'))
