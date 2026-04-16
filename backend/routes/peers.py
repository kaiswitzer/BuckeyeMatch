# routes/peers.py
# Student-to-peer discovery by company and intro requests (async, purpose-driven).

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func
from models import db
from models.user import User
from models.student import StudentProfile, StudentExperience
from models.peer import PeerIntroRequest, PeerMessage
from datetime import datetime
import jwt

peers_bp = Blueprint('peers', __name__)


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


def require_student():
    user = get_current_user()
    if not user:
        return None, (jsonify({'error': 'Unauthorized'}), 401)
    if user.account_type != 'student':
        return None, (jsonify({'error': 'Only students can use peer intros'}), 403)
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return None, (jsonify({'error': 'Student profile required'}), 400)
    return (user, profile), None


def normalize_company(name):
    if not name or not str(name).strip():
        return ''
    return str(name).strip().lower()


def display_name_peer(first_name, last_name):
    """Campus-style: first name + last initial (no prestige metrics)."""
    fn = (first_name or '').strip()
    ln = (last_name or '').strip()
    initial = ln[:1].upper() + '.' if ln else ''
    return f'{fn} {initial}'.strip()


def recipient_has_visible_experience(recipient_student_id, company_norm):
    row = (
        StudentExperience.query.filter_by(student_id=recipient_student_id)
        .filter(StudentExperience.visible_to_peers.is_(True))
        .filter(func.lower(func.trim(StudentExperience.company_name)) == company_norm)
        .first()
    )
    return row is not None


@peers_bp.route('/by-company', methods=['GET'])
def peers_by_company():
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    company = request.args.get('company', '').strip()
    if not company:
        return jsonify({'error': 'company query parameter is required'}), 400

    company_norm = normalize_company(company)

    rows = (
        db.session.query(StudentExperience, StudentProfile)
        .join(StudentProfile, StudentExperience.student_id == StudentProfile.id)
        .filter(StudentExperience.visible_to_peers.is_(True))
        .filter(func.lower(func.trim(StudentExperience.company_name)) == company_norm)
        .filter(StudentProfile.id != me.id)
        .all()
    )

    seen = set()
    peers = []
    for exp, prof in rows:
        if prof.id in seen:
            continue
        seen.add(prof.id)
        peers.append(
            {
                'student_id': prof.id,
                'display_name': display_name_peer(prof.first_name, prof.last_name),
                'major': prof.major,
                'year': prof.year,
                'company_name': exp.company_name,
                'role_name': exp.role_name,
                'term_label': exp.term_label,
            }
        )

    return jsonify({'company': company, 'peers': peers}), 200


@peers_bp.route('/introductions', methods=['GET'])
def list_introductions():
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    incoming = (
        PeerIntroRequest.query.filter_by(recipient_student_id=me.id)
        .order_by(PeerIntroRequest.created_at.desc())
        .all()
    )
    outgoing = (
        PeerIntroRequest.query.filter_by(requester_student_id=me.id)
        .order_by(PeerIntroRequest.created_at.desc())
        .all()
    )

    def summarize(intro, perspective):
        other_sid = (
            intro.requester_student_id
            if perspective == 'incoming'
            else intro.recipient_student_id
        )
        other = StudentProfile.query.get(other_sid)
        other_name = display_name_peer(other.first_name, other.last_name) if other else 'Peer'
        return {
            'id': intro.id,
            'company_name': intro.company_name,
            'status': intro.status,
            'created_at': intro.created_at.isoformat(),
            'perspective': perspective,
            'other_student': {
                'student_id': other_sid,
                'display_name': other_name,
            },
            'preview': intro.initial_message[:120] + ('…' if len(intro.initial_message) > 120 else ''),
        }

    return jsonify(
        {
            'incoming': [summarize(i, 'incoming') for i in incoming],
            'outgoing': [summarize(o, 'outgoing') for o in outgoing],
        }
    ), 200


@peers_bp.route('/introductions', methods=['POST'])
def create_introduction():
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    data = request.get_json() or {}
    recipient_student_id = data.get('recipient_student_id')
    company_name = (data.get('company_name') or '').strip()
    body = (data.get('body') or '').strip()

    if recipient_student_id is None:
        return jsonify({'error': 'recipient_student_id is required'}), 400
    try:
        recipient_student_id = int(recipient_student_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'recipient_student_id must be an integer'}), 400

    if not company_name:
        return jsonify({'error': 'company_name is required'}), 400
    if not body:
        return jsonify({'error': 'body is required'}), 400

    if recipient_student_id == me.id:
        return jsonify({'error': 'You cannot send an intro to yourself'}), 400

    recipient = StudentProfile.query.get(recipient_student_id)
    if not recipient:
        return jsonify({'error': 'Recipient not found'}), 404

    company_norm = normalize_company(company_name)
    if not recipient_has_visible_experience(recipient_student_id, company_norm):
        return jsonify(
            {'error': 'That student has not shared experience at this company with peers'}
        ), 400

    intro = PeerIntroRequest(
        requester_student_id=me.id,
        recipient_student_id=recipient_student_id,
        company_name=company_name.strip(),
        initial_message=body,
        status='pending',
    )
    db.session.add(intro)
    db.session.commit()

    return jsonify({'message': 'Intro request sent', 'introduction': intro.to_dict()}), 201


@peers_bp.route('/introductions/<int:intro_id>', methods=['GET'])
def get_introduction(intro_id):
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    intro = PeerIntroRequest.query.get(intro_id)
    if not intro:
        return jsonify({'error': 'Intro not found'}), 404
    if intro.requester_student_id != me.id and intro.recipient_student_id != me.id:
        return jsonify({'error': 'Forbidden'}), 403

    req_profile = StudentProfile.query.get(intro.requester_student_id)
    rec_profile = StudentProfile.query.get(intro.recipient_student_id)
    is_requester = intro.requester_student_id == me.id
    other = rec_profile if is_requester else req_profile

    full_name = bool(intro.status == 'accepted')
    if full_name:
        other_out = {
            'student_id': other.id,
            'display_name': f'{other.first_name} {other.last_name}'.strip(),
            'first_name': other.first_name,
            'last_name': other.last_name,
        }
    else:
        other_out = {
            'student_id': other.id,
            'display_name': display_name_peer(other.first_name, other.last_name),
        }

    # Build message list: initial + follow-ups when accepted
    messages_out = []
    if req_profile:
        messages_out.append(
            {
                'id': None,
                'intro_request_id': intro.id,
                'sender_id': req_profile.user_id,
                'body': intro.initial_message,
                'sent_at': intro.created_at.isoformat(),
                'read_at': None,
                'is_initial': True,
            }
        )

    if intro.status == 'accepted':
        followups = (
            PeerMessage.query.filter_by(intro_request_id=intro.id)
            .order_by(PeerMessage.sent_at.asc())
            .all()
        )
        for m in followups:
            messages_out.append({**m.to_dict(), 'is_initial': False})

    return jsonify(
        {
            'introduction': intro.to_dict(),
            'is_requester': is_requester,
            'company_name': intro.company_name,
            'other_student': other_out,
            'messages': messages_out,
        }
    ), 200


@peers_bp.route('/introductions/<int:intro_id>/accept', methods=['POST'])
def accept_introduction(intro_id):
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    intro = PeerIntroRequest.query.get(intro_id)
    if not intro:
        return jsonify({'error': 'Intro not found'}), 404
    if intro.recipient_student_id != me.id:
        return jsonify({'error': 'Only the recipient can accept'}), 403
    if intro.status != 'pending':
        return jsonify({'error': 'This intro is no longer pending'}), 400

    intro.status = 'accepted'
    db.session.commit()
    return jsonify({'message': 'Intro accepted', 'introduction': intro.to_dict()}), 200


@peers_bp.route('/introductions/<int:intro_id>/decline', methods=['POST'])
def decline_introduction(intro_id):
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    intro = PeerIntroRequest.query.get(intro_id)
    if not intro:
        return jsonify({'error': 'Intro not found'}), 404
    if intro.recipient_student_id != me.id:
        return jsonify({'error': 'Only the recipient can decline'}), 403
    if intro.status != 'pending':
        return jsonify({'error': 'This intro is no longer pending'}), 400

    intro.status = 'declined'
    db.session.commit()
    return jsonify({'message': 'Intro declined', 'introduction': intro.to_dict()}), 200


@peers_bp.route('/introductions/<int:intro_id>/messages', methods=['POST'])
def send_peer_message(intro_id):
    pair, err = require_student()
    if err:
        return err
    user, me = pair

    intro = PeerIntroRequest.query.get(intro_id)
    if not intro:
        return jsonify({'error': 'Intro not found'}), 404
    if intro.requester_student_id != me.id and intro.recipient_student_id != me.id:
        return jsonify({'error': 'Forbidden'}), 403
    if intro.status != 'accepted':
        return jsonify({'error': 'Messaging is available after the intro is accepted'}), 400

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'Message body cannot be empty'}), 400

    msg = PeerMessage(intro_request_id=intro.id, sender_id=user.id, body=body)
    db.session.add(msg)
    db.session.commit()

    return jsonify({'message': 'Message sent', 'data': {**msg.to_dict(), 'is_initial': False}}), 201


@peers_bp.route('/introductions/<int:intro_id>/messages', methods=['GET'])
def get_peer_messages(intro_id):
    """Same payload as GET introduction; kept for symmetry with alumni messages API."""
    return get_introduction(intro_id)
