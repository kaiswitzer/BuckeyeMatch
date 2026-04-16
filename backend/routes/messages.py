# routes/messages.py
# Messaging endpoints — async, thread-based (like email, not live chat)
#
#   POST /api/messages/<match_id>     — send a message in a match thread
#   GET  /api/messages/<match_id>     — get all messages in a match thread
#   POST /api/messages/<match_id>/read — mark all messages as read

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func
from models import db
from models.user import User
from models.student import StudentProfile
from models.alumni import AlumniProfile
from models.match import Match, Message
from datetime import datetime
import jwt

messages_bp = Blueprint('messages', __name__)


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


def user_belongs_to_match(user, match):
    """
    Checks that the logged-in user is actually part of this match.
    A student can only message in their own matches.
    An alumni can only message in matches assigned to them.
    Think of this like an authorization check in Java — we verify
    the user has permission to touch this specific resource.
    """
    if user.account_type == 'student':
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        return profile and match.student_id == profile.id
    else:
        profile = AlumniProfile.query.filter_by(user_id=user.id).first()
        return profile and match.alumni_id == profile.id


def _matches_for_user(user):
    """Same match set as GET /api/matches/mine (student: non-passed; alumni: all)."""
    if user.account_type == 'student':
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return []
        return Match.query.filter_by(student_id=profile.id).filter(
            Match.status != 'passed'
        ).order_by(Match.created_at.desc()).all()
    profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return []
    return Match.query.filter_by(alumni_id=profile.id).order_by(
        Match.created_at.desc()
    ).all()


@messages_bp.route('/unread-summary', methods=['GET'])
def unread_summary():
    """
    Lightweight counts for header badges: unread messages across all threads,
    and matches still pending alumni action (pairing requests).
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    matches = _matches_for_user(user)
    match_ids = [m.id for m in matches]

    total_unread = 0
    if match_ids:
        total_unread = (
            db.session.query(func.count(Message.id))
            .filter(
                Message.match_id.in_(match_ids),
                Message.read_at.is_(None),
                Message.sender_id != user.id,
            )
            .scalar()
            or 0
        )

    pending_pairing_requests = sum(1 for m in matches if m.status == 'pending')

    return jsonify({
        'total_unread': total_unread,
        'pending_pairing_requests': pending_pairing_requests,
    }), 200


@messages_bp.route('/inbox', methods=['GET'])
def inbox():
    """
    All conversations for the current user with last message preview and
    per-thread unread counts. Does not mark messages as read.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    matches = _matches_for_user(user)
    conversations = []
    total_unread = 0

    for m in matches:
        if user.account_type == 'student':
            other = AlumniProfile.query.get(m.alumni_id)
            other_name = (
                f"{other.first_name} {other.last_name}".strip()
                if other
                else 'Alumni'
            )
        else:
            other = StudentProfile.query.get(m.student_id)
            other_name = (
                f"{other.first_name} {other.last_name}".strip()
                if other
                else 'Student'
            )

        last = (
            Message.query.filter_by(match_id=m.id)
            .order_by(Message.sent_at.desc())
            .first()
        )

        unread = (
            Message.query.filter_by(match_id=m.id)
            .filter(Message.read_at.is_(None))
            .filter(Message.sender_id != user.id)
            .count()
        )
        total_unread += unread

        last_payload = None
        if last:
            last_payload = {
                'body': last.body,
                'sent_at': last.sent_at.isoformat(),
                'sender_id': last.sender_id,
            }

        sort_ts = last.sent_at if last else m.created_at

        conversations.append({
            'match_id': m.id,
            'match_status': m.status,
            'other_name': other_name,
            'last_message': last_payload,
            'unread_count': unread,
            '_sort_ts': sort_ts,
        })

    conversations.sort(key=lambda x: x['_sort_ts'], reverse=True)
    for c in conversations:
        del c['_sort_ts']

    return jsonify({
        'conversations': conversations,
        'total_unread': total_unread,
    }), 200


@messages_bp.route('/<int:match_id>', methods=['POST'])
def send_message(match_id):
    """
    Sends a message in a match thread.
    Both the student and alumni in the match can send messages.
    The match must be 'active' (alumni accepted) before messaging is allowed.
    Expects: { body: "message text" }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not user_belongs_to_match(user, match):
        return jsonify({'error': 'You are not part of this match'}), 403

    # Messaging is only allowed after alumni acceptance.
    # - Students: can only message once accepted/active
    # - Alumni: can only message once accepted/active
    if user.account_type == 'student' and match.status not in ('accepted', 'active'):
        return jsonify({'error': 'Alumni must accept before messaging is available'}), 400

    if user.account_type == 'alumni' and match.status not in ('accepted', 'active'):
        return jsonify({'error': 'Match must be accepted before alumni can message'}), 400

    if match.status == 'passed':
        return jsonify({'error': 'This match has been closed'}), 400

    data = request.get_json()
    body = data.get('body', '').strip()
    if not body:
        return jsonify({'error': 'Message body cannot be empty'}), 400

    message = Message(
        match_id=match.id,
        sender_id=user.id,
        body=body
    )
    db.session.add(message)

    # Transition accepted -> active on first message activity
    if match.status == 'accepted':
        match.status = 'active'

    db.session.commit()

    return jsonify({'message': 'Message sent', 'data': message.to_dict()}), 201


@messages_bp.route('/<int:match_id>', methods=['GET'])
def get_messages(match_id):
    """
    Returns all messages in a match thread, oldest first.
    Also marks any unread messages as read for the current user.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not user_belongs_to_match(user, match):
        return jsonify({'error': 'You are not part of this match'}), 403

    # Mark messages sent by the OTHER person as read
    unread = Message.query.filter_by(
        match_id=match_id,
        read_at=None
    ).filter(Message.sender_id != user.id).all()

    for msg in unread:
        msg.read_at = datetime.utcnow()
    db.session.commit()

    # Return all messages in chronological order
    all_messages = Message.query.filter_by(match_id=match_id)\
        .order_by(Message.sent_at.asc()).all()

    return jsonify({
        'match_id': match_id,
        'messages': [m.to_dict() for m in all_messages]
    }), 200