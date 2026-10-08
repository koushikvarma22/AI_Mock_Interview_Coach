import io
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from pypdf import PdfReader

from extensions import db
from models.resume import Resume

resume_bp = Blueprint('resume', __name__)


@resume_bp.post('/upload')
@jwt_required()
def upload_resume():
    user_id = int(get_jwt_identity())
    file = request.files.get('resume')

    if not file or not file.filename:
        return jsonify(error='A PDF resume file is required'), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith('.pdf'):
        return jsonify(error='Only PDF files are supported'), 400

    max_bytes = current_app.config.get('MAX_RESUME_SIZE_MB', 5) * 1024 * 1024
    content = file.read(max_bytes + 1)
    if len(content) > max_bytes:
        return jsonify(error=f"Resume file exceeds the maximum size limit of {current_app.config.get('MAX_RESUME_SIZE_MB', 5)}MB"), 413

    try:
        reader = PdfReader(io.BytesIO(content))
        extracted_pages = [(page.extract_text() or '') for page in reader.pages]
        text = '\n'.join(extracted_pages).strip()
    except Exception as e:
        return jsonify(error='Failed to parse this PDF file. Please ensure it is not password protected.'), 400

    if len(text) < 40:
        return jsonify(error='Too little extractable text found in this PDF. Please ensure the resume is text-based and not a scanned image.'), 400

    # Limit stored text to avoid runaway payload sizes
    clean_text = text[:35000]

    resume = Resume(
        user_id=user_id,
        filename=filename,
        extracted_text=clean_text
    )
    db.session.add(resume)
    db.session.commit()

    return jsonify(resume.to_dict()), 201


@resume_bp.get('')
@jwt_required()
def list_resumes():
    user_id = int(get_jwt_identity())
    resumes = Resume.query.filter_by(user_id=user_id).order_by(Resume.created_at.desc()).all()
    return jsonify([r.to_dict() for r in resumes])


@resume_bp.get('/<int:resume_id>')
@jwt_required()
def get_resume(resume_id: int):
    user_id = int(get_jwt_identity())
    resume = Resume.query.filter_by(id=resume_id, user_id=user_id).first()
    if not resume:
        return jsonify(error='Resume not found'), 404
    return jsonify({
        'id': resume.id,
        'filename': resume.filename,
        'extracted_preview': resume.extracted_text[:1000],
        'character_count': len(resume.extracted_text),
        'created_at': resume.created_at.isoformat() if resume.created_at else None
    })


@resume_bp.delete('/<int:resume_id>')
@jwt_required()
def delete_resume(resume_id: int):
    user_id = int(get_jwt_identity())
    resume = Resume.query.filter_by(id=resume_id, user_id=user_id).first()
    if not resume:
        return jsonify(error='Resume not found'), 404
    db.session.delete(resume)
    db.session.commit()
    return jsonify(message='Resume deleted successfully')
