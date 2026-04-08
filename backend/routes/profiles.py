# routes/profiles.py
# Profile onboarding endpoints for both students and alumni.
# All routes here require the user to be logged in (verified JWT token).
#
# Student endpoints:
#   POST /api/profiles/student        — save step 1 (name, major, year, hometown)
#   POST /api/profiles/student/targets — save step 2 (target companies/roles)
#   POST /api/profiles/student/survey  — save step 3 (personality survey)
#   GET  /api/profiles/student/me      — get the current student's full profile
#
# Alumni endpoints:
#   POST /api/profiles/alumni         — save step 1 (name, role, company, summary)
#   POST /api/profiles/alumni/availability — save step 2 (availability preference)
#   GET  /api/profiles/alumni/me       — get the current alumni's full profile

from flask import Blueprint, request, jsonify, current_app
from models import db
from models.user import User
from models.student import StudentProfile, StudentTarget, SurveyResponse
from models.alumni import AlumniProfile, AlumniHistory
import jwt

profiles_bp = Blueprint('profiles', __name__)


# ─── AUTH HELPER ─────────────────────────────────────────────────────────────

def get_current_user():
    """
    Reads the JWT token from the Authorization header and returns the User object.
    Every protected route calls this first — if it returns None, we reject the request.

    The frontend sends the token like this:
        Authorization: Bearer eyJhbGci...

    This is like a Java @PreAuthorize check or a servlet filter — it runs
    before the actual route logic and stops unauthorized requests cold.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        if payload.get('purpose') != 'auth':
            return None
        return User.query.get(payload['user_id'])
    except Exception:
        return None


# ─── STUDENT ROUTES ──────────────────────────────────────────────────────────

@profiles_bp.route('/student', methods=['POST'])
def create_student_profile():
    """
    Onboarding step 1 for students.
    Saves name, major, minor, year, hometown.
    Expects: { first_name, last_name, major, minor (optional), year, hometown (optional) }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'student':
        return jsonify({'error': 'Only students can create a student profile'}), 403

    data = request.get_json()
    required = ['first_name', 'last_name', 'major', 'year']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    if data['year'] not in ('freshman', 'sophomore', 'junior', 'senior'):
        return jsonify({'error': 'Year must be freshman, sophomore, junior, or senior'}), 400

    # Check if profile already exists — if so, update it instead of creating a duplicate
    existing = StudentProfile.query.filter_by(user_id=user.id).first()
    if existing:
        existing.first_name = data['first_name']
        existing.last_name = data['last_name']
        existing.major = data['major']
        existing.minor = data.get('minor')
        existing.year = data['year']
        existing.hometown = data.get('hometown')
        db.session.commit()
        return jsonify({'message': 'Profile updated', 'profile': existing.to_dict()}), 200

    profile = StudentProfile(
        user_id=user.id,
        first_name=data['first_name'],
        last_name=data['last_name'],
        major=data['major'],
        minor=data.get('minor'),
        year=data['year'],
        hometown=data.get('hometown')
    )
    db.session.add(profile)
    db.session.commit()
    return jsonify({'message': 'Profile created', 'profile': profile.to_dict()}), 201


@profiles_bp.route('/student/targets', methods=['POST'])
def save_student_targets():
    """
    Onboarding step 2 for students.
    Replaces all existing targets with the new list.
    Expects: { targets: [ { company_name, role_name }, ... ] }

    We delete and re-insert every time — simpler than trying to diff
    what changed. Fine for V1 since target lists are small.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Complete your basic profile first'}), 400

    data = request.get_json()
    targets = data.get('targets', [])

    if not targets or len(targets) == 0:
        return jsonify({'error': 'At least one target company is required'}), 400

    # Delete existing targets and replace with new ones
    StudentTarget.query.filter_by(student_id=profile.id).delete()

    for t in targets:
        if not t.get('company_name'):
            continue
        target = StudentTarget(
            student_id=profile.id,
            company_name=t['company_name'].strip(),
            role_name=t.get('role_name', '').strip()
        )
        db.session.add(target)

    db.session.commit()
    return jsonify({'message': 'Targets saved', 'profile': profile.to_dict()}), 200


@profiles_bp.route('/student/survey', methods=['POST'])
def save_student_survey():
    """
    Onboarding step 3 for students.
    Saves personality survey responses as structured JSON.

    The survey has 10 questions. Each response is stored as a key-value pair
    where the key is the question ID and the value is the selected answer.
    Example: { "work_style": "collaborative", "motivation": "impact", ... }

    This structured format is what makes the matching engine work —
    it can compare two students' responses question by question.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Complete your basic profile first'}), 400

    data = request.get_json()
    responses = data.get('responses')

    if not responses or not isinstance(responses, dict):
        return jsonify({'error': 'Survey responses must be a JSON object'}), 400

    # Define the expected question keys — every submission must answer all 10
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

    # Update if exists, create if not
    existing = SurveyResponse.query.filter_by(student_id=profile.id).first()
    if existing:
        existing.responses = responses
        db.session.commit()
        return jsonify({'message': 'Survey updated'}), 200

    survey = SurveyResponse(student_id=profile.id)
    survey.responses = responses
    db.session.add(survey)
    db.session.commit()
    return jsonify({'message': 'Survey saved'}), 201


@profiles_bp.route('/student/me', methods=['GET'])
def get_student_profile():
    """Returns the full profile for the logged-in student, including targets and survey."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404

    result = profile.to_dict()

    # Include survey responses if they exist
    if profile.survey:
        result['survey'] = profile.survey.to_dict()

    return jsonify(result), 200


# ─── ALUMNI ROUTES ───────────────────────────────────────────────────────────

@profiles_bp.route('/alumni/me', methods=['GET'])
def get_alumni_profile():
    """Returns the full alumni profile for the logged-in user (same shape as AlumniProfile.to_dict)."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'alumni':
        return jsonify({'error': 'Only alumni can view this profile'}), 403

    profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404

    return jsonify(profile.to_dict()), 200


@profiles_bp.route('/alumni', methods=['POST'])
def create_alumni_profile():
    """
    Onboarding step 1 for alumni.
    Saves name, current company/role, career summary, and past history.
    Expects: {
        first_name, last_name, current_company, current_role,
        career_summary (optional),
        history: [ { company_name, role_name, start_year, end_year }, ... ]
    }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user.account_type != 'alumni':
        return jsonify({'error': 'Only alumni can create an alumni profile'}), 403

    data = request.get_json()
    required = ['first_name', 'last_name', 'current_company', 'current_role']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Update if exists
    existing = AlumniProfile.query.filter_by(user_id=user.id).first()
    if existing:
        existing.first_name = data['first_name']
        existing.last_name = data['last_name']
        existing.current_company = data['current_company']
        existing.current_role = data['current_role']
        existing.career_summary = data.get('career_summary')
        existing.bio = data.get('bio')

        # Replace history
        AlumniHistory.query.filter_by(alumni_id=existing.id).delete()
        for h in data.get('history', []):
            if not h.get('company_name'):
                continue
            history = AlumniHistory(
                alumni_id=existing.id,
                company_name=h['company_name'],
                role_name=h.get('role_name'),
                start_year=h.get('start_year'),
                end_year=h.get('end_year')
            )
            db.session.add(history)

        db.session.commit()
        return jsonify({'message': 'Profile updated', 'profile': existing.to_dict()}), 200

    profile = AlumniProfile(
        user_id=user.id,
        first_name=data['first_name'],
        last_name=data['last_name'],
        current_company=data['current_company'],
        current_role=data['current_role'],
        career_summary=data.get('career_summary'),
        bio=data.get('bio')
    )
    db.session.add(profile)
    db.session.flush()  # flush to get profile.id before inserting history rows

    for h in data.get('history', []):
        if not h.get('company_name'):
            continue
        history = AlumniHistory(
            alumni_id=profile.id,
            company_name=h['company_name'],
            role_name=h.get('role_name'),
            start_year=h.get('start_year'),
            end_year=h.get('end_year')
        )
        db.session.add(history)

    db.session.commit()
    return jsonify({'message': 'Profile created', 'profile': profile.to_dict()}), 201


@profiles_bp.route('/alumni/availability', methods=['POST'])
def set_alumni_availability():
    """
    Onboarding step 2 for alumni.
    Sets how often they want to receive student matches.
    Expects: { availability: 'open' | 'limited' | 'closed' }
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Complete your basic profile first'}), 400

    data = request.get_json()
    availability = data.get('availability')

    if availability not in ('open', 'limited', 'closed'):
        return jsonify({'error': 'Availability must be open, limited, or closed'}), 400

    profile.availability = availability
    db.session.commit()
    return jsonify({'message': 'Availability updated', 'availability': availability}), 200


@profiles_bp.route('/alumni/privacy', methods=['POST'])
def set_alumni_privacy():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    profile = AlumniProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    data = request.get_json()
    profile.show_helped_count = 1 if data.get('show_helped_count') else 0
    db.session.commit()
    return jsonify({'message': 'Privacy settings updated'}), 200