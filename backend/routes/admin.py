from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func
from models import db
from models.user import User
from models.student import StudentProfile, StudentTarget, SurveyResponse
from models.alumni import AlumniProfile, AlumniHistory
from models.match import Match, Message, Milestone
from matching.engine import run_matching_for_student
import jwt
import os
from werkzeug.security import generate_password_hash

admin_bp = Blueprint('admin', __name__)


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


def require_admin():
    user = get_current_user()
    if not user:
        return None, (jsonify({'error': 'Unauthorized'}), 401)
    if not getattr(user, 'is_admin', False):
        return None, (jsonify({'error': 'Forbidden'}), 403)
    return user, None


def _enriched_match_payload(matches):
    payload = []
    for m in matches:
        student = StudentProfile.query.get(m.student_id)
        alumni = AlumniProfile.query.get(m.alumni_id)
        payload.append({
            'match': m.to_dict(),
            'student': student.to_dict() if student else None,
            'alumni': alumni.to_dict() if alumni else None,
        })
    return payload


def _require_enum(value, allowed, field_name):
    if value not in allowed:
        return jsonify({'error': f'{field_name} must be one of {list(allowed)}'}), 400
    return None


@admin_bp.route('/users', methods=['GET'])
def list_users():
    user, err = require_admin()
    if err:
        return err

    q = (request.args.get('q') or '').strip().lower()
    query = User.query
    if q:
        query = query.filter(func.lower(User.email).contains(q))

    users = query.order_by(User.id.desc()).limit(200).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


@admin_bp.route('/users', methods=['POST'])
def create_user():
    user, err = require_admin()
    if err:
        return err

    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    account_type = data.get('account_type')
    is_verified = bool(data.get('is_verified', True))
    is_admin = bool(data.get('is_admin', False))

    if not email or not password or account_type not in ('student', 'alumni'):
        return jsonify({'error': 'email, password, and account_type are required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'User already exists'}), 409

    new_user = User(
        email=email,
        password_hash=generate_password_hash(password, method='pbkdf2:sha256'),
        account_type=account_type,
        is_verified=is_verified,
        is_admin=is_admin
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User created', 'user': new_user.to_dict()}), 201


@admin_bp.route('/users/<int:user_id>', methods=['PATCH'])
def patch_user(user_id):
    user, err = require_admin()
    if err:
        return err

    target = User.query.get(user_id)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    if 'is_verified' in data:
        target.is_verified = bool(data['is_verified'])
    if 'is_admin' in data:
        target.is_admin = bool(data['is_admin'])

    db.session.commit()
    return jsonify({'message': 'User updated', 'user': target.to_dict()}), 200


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user, err = require_admin()
    if err:
        return err

    target = User.query.get(user_id)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    # Best-effort cascade cleanup for v1 testing.
    if target.account_type == 'student':
        sp = StudentProfile.query.filter_by(user_id=target.id).first()
        if sp:
            # delete student targets + survey
            StudentTarget.query.filter_by(student_id=sp.id).delete()
            SurveyResponse.query.filter_by(student_id=sp.id).delete()
            # delete milestones logged by student
            Milestone.query.filter_by(student_id=sp.id).delete()
            # delete matches and their messages
            matches = Match.query.filter_by(student_id=sp.id).all()
            for m in matches:
                Message.query.filter_by(match_id=m.id).delete()
                db.session.delete(m)
            db.session.delete(sp)
    else:
        ap = AlumniProfile.query.filter_by(user_id=target.id).first()
        if ap:
            AlumniHistory.query.filter_by(alumni_id=ap.id).delete()
            matches = Match.query.filter_by(alumni_id=ap.id).all()
            for m in matches:
                Message.query.filter_by(match_id=m.id).delete()
                db.session.delete(m)
            db.session.delete(ap)

    db.session.delete(target)
    db.session.commit()
    return jsonify({'message': 'User deleted'}), 200


@admin_bp.route('/users/<int:user_id>/profile', methods=['GET'])
def admin_get_user_profile(user_id):
    user, err = require_admin()
    if err:
        return err

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    if target_user.account_type == 'student':
        profile = StudentProfile.query.filter_by(user_id=target_user.id).first()
        if not profile:
            return jsonify({
                'user': target_user.to_dict(),
                'account_type': target_user.account_type,
                'profile': None,
                'extras': {'targets': [], 'survey': None}
            }), 200

        extras = {
            'targets': [t.to_dict() for t in profile.targets],
            'survey': profile.survey.to_dict() if profile.survey else None
        }
        return jsonify({
            'user': target_user.to_dict(),
            'account_type': target_user.account_type,
            'profile': profile.to_dict(),
            'extras': extras
        }), 200

    profile = AlumniProfile.query.filter_by(user_id=target_user.id).first()
    if not profile:
        return jsonify({
            'user': target_user.to_dict(),
            'account_type': target_user.account_type,
            'profile': None,
            'extras': {'history': []}
        }), 200

    extras = {'history': [h.to_dict() for h in profile.history]}
    return jsonify({
        'user': target_user.to_dict(),
        'account_type': target_user.account_type,
        'profile': profile.to_dict(),
        'extras': extras
    }), 200


@admin_bp.route('/users/<int:user_id>/profile', methods=['PATCH'])
def admin_patch_user_profile(user_id):
    user, err = require_admin()
    if err:
        return err

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}

    if target_user.account_type == 'student':
        # Basic profile
        required = ['first_name', 'last_name', 'major', 'year']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        year = data.get('year')
        enum_err = _require_enum(year, ('freshman', 'sophomore', 'junior', 'senior'), 'year')
        if enum_err:
            return enum_err

        profile = StudentProfile.query.filter_by(user_id=target_user.id).first()
        if not profile:
            profile = StudentProfile(user_id=target_user.id)
            db.session.add(profile)

        profile.first_name = data['first_name']
        profile.last_name = data['last_name']
        profile.major = data['major']
        profile.minor = data.get('minor')
        profile.year = year
        profile.hometown = data.get('hometown')
        profile.bio = data.get('bio')

        db.session.flush()

        # Targets (replace-all semantics, consistent with profiles.py)
        if 'targets' in data:
            targets = data.get('targets') or []
            StudentTarget.query.filter_by(student_id=profile.id).delete()
            for t in targets:
                company = (t.get('company_name') or '').strip()
                if not company:
                    continue
                target = StudentTarget(
                    student_id=profile.id,
                    company_name=company,
                    role_name=(t.get('role_name') or '').strip()
                )
                db.session.add(target)

        # Survey (replace/update)
        if 'survey' in data:
            survey_payload = data.get('survey') or {}
            responses = survey_payload.get('responses')
            if responses is not None:
                if not isinstance(responses, dict):
                    return jsonify({'error': 'survey.responses must be a JSON object'}), 400

                required_keys = [
                    'work_style',
                    'communication_style',
                    'motivation',
                    'work_environment',
                    'strengths',
                    'industry_interest',
                    'role_type',
                    'company_size',
                    'networking_comfort',
                    'career_goal'
                ]
                missing = [k for k in required_keys if k not in responses]
                if missing:
                    return jsonify({'error': f'Missing survey responses: {missing}'}), 400

                existing = SurveyResponse.query.filter_by(student_id=profile.id).first()
                if not existing:
                    existing = SurveyResponse(student_id=profile.id)
                    db.session.add(existing)
                existing.responses = responses

        db.session.commit()

        profile = StudentProfile.query.filter_by(user_id=target_user.id).first()
        return jsonify({
            'message': 'Profile updated',
            'account_type': target_user.account_type,
            'profile': profile.to_dict() if profile else None,
            'extras': {
                'targets': [t.to_dict() for t in (profile.targets if profile else [])],
                'survey': profile.survey.to_dict() if (profile and profile.survey) else None
            }
        }), 200

    # Alumni
    required = ['first_name', 'last_name', 'current_company', 'current_role']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    availability = data.get('availability')
    if availability is not None:
        enum_err = _require_enum(availability, ('open', 'limited', 'closed'), 'availability')
        if enum_err:
            return enum_err

    profile = AlumniProfile.query.filter_by(user_id=target_user.id).first()
    if not profile:
        profile = AlumniProfile(user_id=target_user.id)
        db.session.add(profile)

    profile.first_name = data['first_name']
    profile.last_name = data['last_name']
    profile.current_company = data['current_company']
    profile.current_role = data['current_role']
    profile.career_summary = data.get('career_summary')
    profile.bio = data.get('bio')

    if availability is not None:
        profile.availability = availability
    if 'show_helped_count' in data:
        profile.show_helped_count = 1 if data.get('show_helped_count') else 0

    db.session.flush()

    # History (replace-all semantics)
    if 'history' in data:
        AlumniHistory.query.filter_by(alumni_id=profile.id).delete()
        for h in data.get('history') or []:
            company = (h.get('company_name') or '').strip()
            if not company:
                continue
            history = AlumniHistory(
                alumni_id=profile.id,
                company_name=company,
                role_name=(h.get('role_name') or '').strip() or None,
                start_year=h.get('start_year'),
                end_year=h.get('end_year')
            )
            db.session.add(history)

    db.session.commit()
    profile = AlumniProfile.query.filter_by(user_id=target_user.id).first()
    return jsonify({
        'message': 'Profile updated',
        'account_type': target_user.account_type,
        'profile': profile.to_dict() if profile else None,
        'extras': {'history': [h.to_dict() for h in (profile.history if profile else [])]}
    }), 200


@admin_bp.route('/students', methods=['GET'])
def list_students():
    user, err = require_admin()
    if err:
        return err

    students = StudentProfile.query.order_by(StudentProfile.id.desc()).limit(200).all()
    return jsonify({'students': [s.to_dict() for s in students]}), 200


@admin_bp.route('/alumni', methods=['GET'])
def list_alumni():
    user, err = require_admin()
    if err:
        return err

    alumni = AlumniProfile.query.order_by(AlumniProfile.id.desc()).limit(200).all()
    return jsonify({'alumni': [a.to_dict() for a in alumni]}), 200


@admin_bp.route('/matches', methods=['GET'])
def list_matches():
    user, err = require_admin()
    if err:
        return err

    matches = Match.query.order_by(Match.id.desc()).limit(300).all()
    return jsonify({'matches': _enriched_match_payload(matches)}), 200


@admin_bp.route('/users/<int:user_id>/matches', methods=['GET'])
def admin_list_matches_for_user(user_id):
    user, err = require_admin()
    if err:
        return err

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    if target_user.account_type == 'student':
        profile = StudentProfile.query.filter_by(user_id=target_user.id).first()
        if not profile:
            return jsonify({'matches': []}), 200
        matches = Match.query.filter_by(student_id=profile.id).order_by(Match.id.desc()).limit(300).all()
        return jsonify({'matches': _enriched_match_payload(matches)}), 200

    profile = AlumniProfile.query.filter_by(user_id=target_user.id).first()
    if not profile:
        return jsonify({'matches': []}), 200
    matches = Match.query.filter_by(alumni_id=profile.id).order_by(Match.id.desc()).limit(300).all()
    return jsonify({'matches': _enriched_match_payload(matches)}), 200


@admin_bp.route('/matches/<int:match_id>', methods=['DELETE'])
def delete_match(match_id):
    user, err = require_admin()
    if err:
        return err

    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    Message.query.filter_by(match_id=match.id).delete()
    db.session.delete(match)
    db.session.commit()
    return jsonify({'message': 'Match deleted'}), 200


@admin_bp.route('/messages', methods=['GET'])
def list_messages():
    user, err = require_admin()
    if err:
        return err

    match_id = request.args.get('match_id')
    if not match_id:
        return jsonify({'error': 'match_id is required'}), 400

    msgs = Message.query.filter_by(match_id=int(match_id)).order_by(Message.sent_at.asc()).all()
    return jsonify({'messages': [m.to_dict() for m in msgs]}), 200


@admin_bp.route('/messages/search', methods=['GET'])
def admin_search_messages():
    user, err = require_admin()
    if err:
        return err

    q = (request.args.get('q') or '').strip()
    match_id = request.args.get('match_id')
    sender_user_id = request.args.get('user_id')

    limit = min(int(request.args.get('limit') or 50), 200)
    offset = max(int(request.args.get('offset') or 0), 0)

    query = Message.query
    if q:
        query = query.filter(Message.body.contains(q))
    if match_id:
        query = query.filter_by(match_id=int(match_id))
    if sender_user_id:
        query = query.filter_by(sender_id=int(sender_user_id))

    total = query.count()
    msgs = query.order_by(Message.sent_at.desc()).offset(offset).limit(limit).all()

    sender_ids = list({m.sender_id for m in msgs})
    senders = {}
    if sender_ids:
        for u in User.query.filter(User.id.in_(sender_ids)).all():
            senders[u.id] = u.to_dict()

    return jsonify({
        'total': total,
        'limit': limit,
        'offset': offset,
        'results': [
            {
                'message': m.to_dict(),
                'sender': senders.get(m.sender_id),
            } for m in msgs
        ]
    }), 200


@admin_bp.route('/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    user, err = require_admin()
    if err:
        return err

    msg = Message.query.get(message_id)
    if not msg:
        return jsonify({'error': 'Message not found'}), 404
    db.session.delete(msg)
    db.session.commit()
    return jsonify({'message': 'Message deleted'}), 200


@admin_bp.route('/milestones', methods=['GET'])
def list_milestones():
    user, err = require_admin()
    if err:
        return err

    student_id = request.args.get('student_id')
    user_id = request.args.get('user_id')
    query = Milestone.query
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    elif user_id:
        target_user = User.query.get(int(user_id))
        if not target_user:
            return jsonify({'error': 'User not found'}), 404

        if target_user.account_type == 'student':
            sp = StudentProfile.query.filter_by(user_id=target_user.id).first()
            if not sp:
                return jsonify({'milestones': []}), 200
            query = query.filter_by(student_id=sp.id)
        else:
            ap = AlumniProfile.query.filter_by(user_id=target_user.id).first()
            if not ap:
                return jsonify({'milestones': []}), 200
            match_ids = [m.id for m in Match.query.filter_by(alumni_id=ap.id).all()]
            if not match_ids:
                return jsonify({'milestones': []}), 200
            query = query.filter(Milestone.match_id.in_(match_ids))
    miles = query.order_by(Milestone.logged_at.desc()).limit(300).all()
    return jsonify({'milestones': [m.to_dict() for m in miles]}), 200


@admin_bp.route('/milestones/<int:milestone_id>', methods=['DELETE'])
def delete_milestone_admin(milestone_id):
    user, err = require_admin()
    if err:
        return err

    mile = Milestone.query.get(milestone_id)
    if not mile:
        return jsonify({'error': 'Milestone not found'}), 404
    db.session.delete(mile)
    db.session.commit()
    return jsonify({'message': 'Milestone deleted'}), 200


@admin_bp.route('/matches/run_nightly', methods=['POST'])
def run_nightly_matching():
    user, err = require_admin()
    if err:
        return err

    # Optional shared secret (defense in depth for cron jobs)
    expected = os.environ.get('ADMIN_JOB_SECRET')
    if expected:
        provided = request.headers.get('X-Admin-Job-Secret')
        if provided != expected:
            return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    max_students = int(data.get('max_students') or 200)
    skip_if_pending = bool(data.get('skip_if_pending', True))

    students = StudentProfile.query.order_by(StudentProfile.id.asc()).all()

    processed = 0
    created = 0
    skipped = 0
    no_match = 0

    for s in students:
        if processed >= max_students:
            break

        # Needs targets + survey
        if not s.targets or not s.survey:
            skipped += 1
            continue

        if skip_if_pending:
            pending = Match.query.filter_by(student_id=s.id, status='pending').first()
            if pending:
                skipped += 1
                continue

        processed += 1
        match = run_matching_for_student(s.id)
        if match:
            created += 1
        else:
            no_match += 1

    return jsonify({
        'message': 'Nightly matching run complete',
        'summary': {
            'processed': processed,
            'created': created,
            'skipped': skipped,
            'no_match': no_match,
            'max_students': max_students,
            'skip_if_pending': skip_if_pending,
        }
    }), 200

