# routes/milestones.py
# Three endpoints:
#   GET  /api/milestones              — fetch all milestones for the logged-in student
#   POST /api/milestones              — student logs an interview, offer, or job outcome
#   POST /api/milestones/rate/<match_id> — thumbs up/down on a match

from flask import Blueprint, request, jsonify, current_app
from models import db
from models.user import User
from models.student import StudentProfile
from models.match import Match, Milestone, MatchRating
import jwt

milestones_bp = Blueprint('milestones', __name__)


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


@milestones_bp.route('', methods=['GET'])
def get_milestones():
    """
    Returns all milestones logged by the current student, newest first.
    The frontend uses this to show prior milestones inside the modal.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students have milestones'}), 403

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'milestones': []}), 200

    milestones = Milestone.query.filter_by(student_id=profile.id)\
        .order_by(Milestone.logged_at.desc()).all()

    return jsonify({'milestones': [m.to_dict() for m in milestones]}), 200


@milestones_bp.route('', methods=['POST'])
def log_milestone():
    """
    Student logs an interview, offer, or job outcome.
    This is the most valuable data in the system — it tells us which
    matches actually led to real outcomes.
    Expects: { outcome_type: 'interview'|'offer'|'job', match_id (optional), notes (optional) }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can log milestones'}), 403

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404

    data = request.get_json()
    outcome_type = data.get('outcome_type')

    if outcome_type not in ('interview', 'offer', 'job'):
        return jsonify({'error': 'outcome_type must be interview, offer, or job'}), 400

    milestone = Milestone(
        student_id=profile.id,
        match_id=data.get('match_id'),
        outcome_type=outcome_type,
        notes=data.get('notes')
    )
    db.session.add(milestone)
    db.session.commit()

    return jsonify({
        'message': f'🎉 Congrats on the {outcome_type}!',
        'milestone': milestone.to_dict()
    }), 201


def _milestone_for_student_or_404(user, milestone_id):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return None, (jsonify({'error': 'Profile not found'}), 404)
    milestone = Milestone.query.get(milestone_id)
    if not milestone:
        return None, (jsonify({'error': 'Milestone not found'}), 404)
    if milestone.student_id != profile.id:
        return None, (jsonify({'error': 'Forbidden'}), 403)
    return milestone, None


@milestones_bp.route('/<int:milestone_id>', methods=['PATCH'])
def update_milestone(milestone_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can edit milestones'}), 403

    milestone, err = _milestone_for_student_or_404(user, milestone_id)
    if err:
        return err

    data = request.get_json() or {}
    if 'outcome_type' in data:
        ot = data['outcome_type']
        if ot not in ('interview', 'offer', 'job'):
            return jsonify({'error': 'outcome_type must be interview, offer, or job'}), 400
        milestone.outcome_type = ot

    if 'match_id' in data:
        mid = data['match_id']
        if mid is None or mid == '':
            milestone.match_id = None
        else:
            profile = StudentProfile.query.filter_by(user_id=user.id).first()
            match = Match.query.get(int(mid))
            if not match or match.student_id != profile.id:
                return jsonify({'error': 'Invalid match for this student'}), 400
            milestone.match_id = match.id

    if 'notes' in data:
        milestone.notes = data.get('notes')

    db.session.commit()
    return jsonify({'message': 'Milestone updated', 'milestone': milestone.to_dict()}), 200


@milestones_bp.route('/<int:milestone_id>', methods=['DELETE'])
def delete_milestone(milestone_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can delete milestones'}), 403

    milestone, err = _milestone_for_student_or_404(user, milestone_id)
    if err:
        return err

    db.session.delete(milestone)
    db.session.commit()
    return jsonify({'message': 'Milestone deleted'}), 200


@milestones_bp.route('/rate/<int:match_id>', methods=['POST'])
def rate_match(match_id):
    """
    Thumbs up (1) or thumbs down (-1) on a match.
    Framed as 'Still talking to your match?' not a formal survey.
    Expects: { rating: 1 or -1 }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    data = request.get_json()
    rating = data.get('rating')
    if rating not in (1, -1):
        return jsonify({'error': 'Rating must be 1 (thumbs up) or -1 (thumbs down)'}), 400

    rated_by = user.account_type
    existing = MatchRating.query.filter_by(match_id=match_id, rated_by=rated_by).first()
    if existing:
        return jsonify({'error': 'You have already rated this match'}), 409

    match_rating = MatchRating(match_id=match_id, rated_by=rated_by, rating=rating)
    db.session.add(match_rating)
    db.session.commit()

    return jsonify({'message': 'Rating saved', 'rating': match_rating.to_dict()}), 201