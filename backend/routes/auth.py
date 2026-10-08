from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from extensions import db
from models.user import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.post('/register')
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or len(password) < 6:
        return jsonify(error='Name, valid email, and a password of at least 6 characters are required.'), 400

    if User.query.filter_by(email=email).first():
        return jsonify(error='An account with this email address already exists.'), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify(token=token, user=user.to_dict()), 201


@auth_bp.post('/login')
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify(error='Email and password are required.'), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error='Invalid email or password.'), 401

    token = create_access_token(identity=str(user.id))
    return jsonify(token=token, user=user.to_dict()), 200


@auth_bp.get('/me')
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify(error='User not found'), 404
    return jsonify(user=user.to_dict()), 200
