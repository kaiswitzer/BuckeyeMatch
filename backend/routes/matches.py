# routes/matches.py
# Match endpoints:
#   POST /api/matches/run              — trigger matching engine for logged-in student
#   GET  /api/matches/mine             — get current user's matches
#   POST /api/matches/<id>/respond     — alumni accepts or passes on a match
#   POST /api/matches/<id>/undo        — alumni resets a match back to pending
#   GET  /api/matches/<id>/student     — get the student profile for a match (alumni only)
#   GET  /api/matches/<id>/alumni      — get the alumni profile for a match (student only)

from flask import Blueprint, request, jsonify, current_app
from models import db
from models.user import User
from models.student import StudentProfile
from models.alumni import AlumniProfile
from models.match import Match
from matching.engine import run_matching_for_student
import jwt

matches_bp = Blueprint('matches', __name__)


def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        if payload.get('purpose') != 'auth':
            return None
        return User.query.get(payload['user_id'])
    except Exception:
        return None


@matches_bp.route('/run', methods=['POST'])
def run_matching():
    """
    Triggers the matching engine for the logged-in student.
    Call this after a student completes onboarding.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can run matching'}), 403

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Complete your profile before matching'}), 400
    if not profile.survey:
        return jsonify({'error': 'Complete your survey before matching'}), 400

    match = run_matching_for_student(profile.id)

    if not match:
        return jsonify({'message': 'No eligible matches found yet. Check back soon.'}), 200

    alumni = AlumniProfile.query.get(match.alumni_id)
    return jsonify({
        'match': match.to_dict(),
        'alumni': alumni.to_dict(),
        'explanation': match.explanation
    }), 201


@matches_bp.route('/mine', methods=['GET'])
def get_my_matches():
    """
    Returns all matches for the logged-in user (student or alumni).
    Students see their matched alumni. Alumni see their matched students.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    if user.account_type == 'student':
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({'matches': []}), 200

        matches = Match.query.filter_by(student_id=profile.id).filter(Match.status != 'passed').all()
        result = []
        for m in matches:
            alumni = AlumniProfile.query.get(m.alumni_id)
            result.append({
                'match': m.to_dict(),
                'alumni': alumni.to_dict() if alumni else None
            })
        return jsonify({'matches': result}), 200

    else:  # alumni
        profile = AlumniProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({'matches': []}), 200

        matches = Match.query.filter_by(alumni_id=profile.id).all()
        result = []
        for m in matches:
            student = StudentProfile.query.get(m.student_id)
            result.append({
                'match': m.to_dict(),
                'student': student.to_dict() if student else None
            })
        return jsonify({'matches': result}), 200


@matches_bp.route('/<int:match_id>/respond', methods=['POST'])
def respond_to_match(match_id):
    """
    Alumni accepts or passes on a match.
    Expects: { action: 'accept' | 'pass' }
    Now uses 'accepted' status (not 'active') so the frontend can distinguish
    a newly created match from one the alumni has explicitly accepted.
    'active' is reserved for matches that have message activity.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'alumni':
        return jsonify({'error': 'Only alumni can respond to matches'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    alumni_profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not alumni_profile or match.alumni_id != alumni_profile.id:
        return jsonify({'error': 'This match does not belong to you'}), 403

    data = request.get_json()
    action = data.get('action')
    if action not in ('accept', 'pass'):
        return jsonify({'error': 'Action must be accept or pass'}), 400

    # Use 'accepted' (not 'active') so we can tell the difference between
    # pending → accepted and pending → has messages
    match.status = 'accepted' if action == 'accept' else 'passed'
    db.session.commit()

    return jsonify({'message': f'Match {match.status}', 'match': match.to_dict()}), 200


@matches_bp.route('/<int:match_id>/undo', methods=['POST'])
def undo_match_response(match_id):
    """
    Resets a match back to 'pending' so the alumni can reconsider.
    Only works if the match is currently 'accepted' or 'passed'.
    Think of this like a Java undo stack — we just reset the state field.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'alumni':
        return jsonify({'error': 'Only alumni can undo a match response'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    alumni_profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not alumni_profile or match.alumni_id != alumni_profile.id:
        return jsonify({'error': 'This match does not belong to you'}), 403

    if match.status not in ('accepted', 'passed'):
        return jsonify({'error': 'This match cannot be undone'}), 400

    match.status = 'pending'
    db.session.commit()

    return jsonify({'message': 'Match reset to pending', 'match': match.to_dict()}), 200


@matches_bp.route('/<int:match_id>/student', methods=['GET'])
def get_match_student(match_id):
    """
    Returns the student profile for a given match.
    Only the alumni in the match can call this.
    Used to render the student's read-only profile page.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'alumni':
        return jsonify({'error': 'Only alumni can view student profiles this way'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    alumni_profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not alumni_profile or match.alumni_id != alumni_profile.id:
        return jsonify({'error': 'This match does not belong to you'}), 403

    student = StudentProfile.query.get(match.student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    return jsonify({'student': student.to_dict()}), 200


@matches_bp.route('/<int:match_id>/alumni', methods=['GET'])
def get_match_alumni(match_id):
    """
    Returns the alumni profile for a given match.
    Only the student in the match can call this.
    Used to render the alumni's read-only profile page.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can view alumni profiles this way'}), 403

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    student_profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not student_profile or match.student_id != student_profile.id:
        return jsonify({'error': 'This match does not belong to you'}), 403

    alumni = AlumniProfile.query.get(match.alumni_id)
    if not alumni:
        return jsonify({'error': 'Alumni not found'}), 404

    return jsonify({'alumni': alumni.to_dict()}), 200