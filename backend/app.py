import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from extensions import db, jwt

# Import models so SQLAlchemy registers them with metadata
from models.user import User
from models.resume import Resume
from models.interview import Interview, Question, Answer

# Import route blueprints
from routes.auth import auth_bp
from routes.resume import resume_bp
from routes.interview import interview_bp
from routes.analytics import analytics_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Configure CORS with support for development and production URLs
    frontend_env = app.config.get('FRONTEND_URL', 'http://localhost:5173')
    allowed_origins = [o.strip() for o in frontend_env.split(',') if o.strip()]
    if not allowed_origins or '*' in allowed_origins:
        allowed_origins = '*'

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)

    # Custom JWT error responses
    @jwt.unauthorized_loader
    def unauthorized_callback(callback):
        return jsonify(error="Authentication token is missing"), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(callback):
        return jsonify(error="Invalid authentication token"), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify(error="Authentication token has expired. Please log in again."), 401

    # Register blueprints under /api prefix
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(resume_bp, url_prefix='/api/resumes')
    app.register_blueprint(interview_bp, url_prefix='/api/interviews')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')

    @app.get('/api/health')
    def health():
        return jsonify({
            'service': 'AI Mock Interview Coach API',
            'status': 'healthy',
            'database': 'postgresql',
            'rag_enabled': True
        })

    @app.get('/api/health/hf')
    def health_hf():
        token = app.config.get('HF_API_TOKEN', '').strip()
        has_token = bool(token and token != 'your_huggingface_token_here')
        return jsonify({
            'service': 'Hugging Face LLM Service',
            'token_configured': has_token,
            'model': app.config.get('HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
            'mode': 'live_hf_api' if has_token else 'intelligent_fallback_engine',
            'documentation': 'https://huggingface.co/settings/tokens'
        })

    @app.get('/')
    def root():
        return jsonify({
            'message': 'AI Mock Interview Coach API is running',
            'health': '/api/health'
        })

    # Initialize database tables
    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"[*] Starting AI Mock Interview Coach API on http://localhost:{port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
