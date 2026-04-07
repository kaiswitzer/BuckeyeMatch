# routes/auth.py
# Three endpoints that handle the full auth flow:
#   POST /api/auth/signup  — create account, send OSU email verification
#   GET  /api/auth/verify/<token> — verify email from link
#   POST /api/auth/login   — validate credentials, return JWT

from flask import Blueprint, request, jsonify, current_app
from models import db
from models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import re

auth_bp = Blueprint('auth', __name__)


# ─── HELPERS ────────────────────────────────────────────────────────────────

def is_osu_email(email):
    """Only allow @osu.edu addresses. This is the entire trust gate."""
    return email.strip().lower().endswith('@osu.edu')

def generate_token(user_id, purpose='auth', expires_in_hours=24):
    """
    Creates a signed JWT token.
    Think of a JWT like a hall pass — it proves who you are without
    hitting the database on every request. It has three parts:
      1. Header  — algorithm used
      2. Payload — the data we store (user_id, expiry, purpose)
      3. Signature — signed with SECRET_KEY so it can't be faked
    """
    payload = {
        'user_id': user_id,
        'purpose': purpose,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=expires_in_hours)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def decode_token(token, expected_purpose='auth'):
    """
    Decodes and validates a JWT token.
    Returns the payload dict if valid, or raises an exception if expired/tampered.
    """
    payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    if payload.get('purpose') != expected_purpose:
        raise ValueError('Wrong token purpose')
    return payload


# ─── SIGNUP ─────────────────────────────────────────────────────────────────

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """
    Creates a new user account.
    Expects JSON body: { email, password, account_type }
    Returns: success message (email sent) or error
    """
    data = request.get_json()

    # Validate required fields exist
    if not data or not data.get('email') or not data.get('password') or not data.get('account_type'):
        return jsonify({'error': 'Email, password, and account type are required'}), 400

    email = data['email'].strip().lower()
    password = data['password']
    account_type = data['account_type']

    # OSU email gate — the entire trust model depends on this check
    if not is_osu_email(email):
        return jsonify({'error': 'You must use an @osu.edu email to sign up'}), 403

    # Validate account type
    if account_type not in ('student', 'alumni'):
        return jsonify({'error': 'Account type must be student or alumni'}), 400

    # Password length check
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    # Check if this email is already registered
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'An account with this email already exists'}), 409

    # Hash the password before storing it.
    # generate_password_hash uses bcrypt-style hashing — never store plain text passwords.
    # This is the equivalent of using BCryptPasswordEncoder in Spring Security.
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

    # Create the user row (not yet verified)
    new_user = User(
        email=email,
        password_hash=hashed_password,
        account_type=account_type,
        is_verified=False
    )
    db.session.add(new_user)
    db.session.commit()

    # Generate a short-lived verification token (24 hours)
    verification_token = generate_token(new_user.id, purpose='verify', expires_in_hours=24)

    # Send verification email
    # For now we'll just return the token in the response so you can test it.
    # We'll wire up real email sending in the next step.
    verification_link = f"http://localhost:5001/api/auth/verify/{verification_token}"

    # TODO: replace this with actual email sending once Flask-Mail is configured
    print(f"\n📧 Verification link for {email}:\n{verification_link}\n")

    return jsonify({
        'message': 'Account created. Check your email to verify your OSU address.',
        'dev_verification_link': verification_link  # remove this in production
    }), 201


# ─── EMAIL VERIFICATION ──────────────────────────────────────────────────────

@auth_bp.route('/verify/<token>', methods=['GET'])
def verify_email(token):
    """
    Confirms the user's OSU email by validating the token from the link.
    Marks is_verified = True on the user row.
    """
    try:
        payload = decode_token(token, expected_purpose='verify')
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Verification link has expired. Please sign up again.'}), 400
    except Exception:
        return jsonify({'error': 'Invalid verification link.'}), 400

    user = User.query.get(payload['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.is_verified:
        return jsonify({'message': 'Email already verified. You can log in.'}), 200

    user.is_verified = True
    db.session.commit()

    return jsonify({'message': 'Email verified successfully. You can now log in.'}), 200


# ─── LOGIN ───────────────────────────────────────────────────────────────────

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Validates credentials and returns a JWT auth token.
    Expects JSON body: { email, password }
    Returns: { token, user } or error

    The frontend stores this token and sends it in the Authorization header
    with every future request: "Authorization: Bearer <token>"
    """
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    email = data['email'].strip().lower()
    password = data['password']

    # Look up the user
    user = User.query.filter_by(email=email).first()

    # Use a generic error message — never tell the user which part was wrong
    # (saying "wrong password" confirms the email exists, which is a security leak)
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    # Block unverified users from logging in
    if not user.is_verified:
        return jsonify({'error': 'Please verify your OSU email before logging in'}), 403

    # Generate a 7-day auth token
    auth_token = generate_token(user.id, purpose='auth', expires_in_hours=168)

    return jsonify({
        'token': auth_token,
        'user': user.to_dict()
    }), 200


# ─── HEALTH CHECK ────────────────────────────────────────────────────────────

@auth_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'auth router is live'}), 200