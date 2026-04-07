# matching/engine.py
# The Buckeye Match scoring engine.
#
# Scoring breakdown (total possible = 1.0):
#   Company match      — 0.35
#   Survey overlap     — 0.30
#   Background signals — 0.20
#   Milestone signal   — 0.15

from models.student import StudentProfile, StudentTarget, SurveyResponse
from models.alumni import AlumniProfile
from models.match import Match, Milestone
from models import db

WEIGHT_COMPANY    = 0.35
WEIGHT_SURVEY     = 0.30
WEIGHT_BACKGROUND = 0.20
WEIGHT_MILESTONE  = 0.15


def score_company_match(student, alumni):
    target_companies = {t.company_name.lower().strip() for t in student.targets}
    if alumni.current_company.lower().strip() in target_companies:
        return 1.0
    for h in alumni.history:
        if h.company_name.lower().strip() in target_companies:
            return 0.5
    return 0.0


def score_survey_overlap(student_survey, alumni):
    if not student_survey:
        return 0.0

    responses = student_survey.responses
    score = 0.0
    dimensions = 4

    alumni_context = (alumni.current_company + ' ' + alumni.current_role +
                      ' ' + (alumni.career_summary or '')).lower()

    industry = responses.get('industry_interest', '').lower()
    industry_keywords = {
        'finance': ['bank', 'finance', 'investment', 'capital', 'goldman', 'jpmorgan',
                    'morgan stanley', 'blackstone', 'analyst', 'trading'],
        'consulting': ['consulting', 'mckinsey', 'bcg', 'bain', 'deloitte', 'strategy'],
        'tech': ['software', 'engineer', 'google', 'amazon', 'microsoft', 'apple',
                 'meta', 'product', 'data'],
        'healthcare': ['health', 'medical', 'pharma', 'hospital', 'clinical'],
        'marketing': ['marketing', 'brand', 'advertising', 'media', 'creative']
    }
    keywords = industry_keywords.get(industry, [industry])
    if any(kw in alumni_context for kw in keywords):
        score += 1.0 / dimensions

    career_goal = responses.get('career_goal', '').lower()
    if career_goal == 'corporate' and any(word in alumni_context for word in
                                          ['vp', 'director', 'manager', 'vice president', 'president', 'senior']):
        score += 1.0 / dimensions
    elif career_goal == 'startup' and any(word in alumni_context for word in
                                          ['founder', 'startup', 'entrepreneur', 'venture']):
        score += 1.0 / dimensions
    elif career_goal == 'finance' and any(word in alumni_context for word in
                                          ['finance', 'bank', 'investment', 'analyst']):
        score += 1.0 / dimensions
    else:
        score += 0.5 / dimensions

    company_size = responses.get('company_size', '').lower()
    large_companies = ['goldman', 'jpmorgan', 'morgan stanley', 'mckinsey', 'deloitte',
                       'google', 'amazon', 'microsoft', 'apple', 'meta', 'blackstone']
    is_large = any(co in alumni.current_company.lower() for co in large_companies)
    if company_size == 'large' and is_large:
        score += 1.0 / dimensions
    elif company_size == 'small' and not is_large:
        score += 1.0 / dimensions
    else:
        score += 0.25 / dimensions

    work_style = responses.get('work_style', '').lower()
    if work_style == 'collaborative' and any(word in alumni_context for word in
                                             ['team', 'mentor', 'collaborate', 'together']):
        score += 1.0 / dimensions
    else:
        score += 0.5 / dimensions

    return min(score, 1.0)


def score_background(student, alumni):
    score = 0.0
    signals = 2
    alumni_context = (alumni.career_summary or '').lower()

    if student.hometown and student.hometown.lower() in alumni_context:
        score += 1.0 / signals

    if student.major:
        major_lower = student.major.lower()
        if major_lower in alumni_context:
            score += 1.0 / signals
        elif major_lower == 'finance' and any(w in alumni_context for w in
                                              ['bank', 'investment', 'financial']):
            score += 0.5 / signals

    return min(score, 1.0)


def score_milestone_signal(alumni):
    alumni_matches = Match.query.filter_by(alumni_id=alumni.id).all()
    alumni_match_ids = {m.id for m in alumni_matches}
    if not alumni_match_ids:
        return 0.0

    credited_milestones = Milestone.query.filter(
        Milestone.match_id.in_(alumni_match_ids)
    ).all()
    if not credited_milestones:
        return 0.0

    OUTCOME_WEIGHTS = {'job': 1.0, 'offer': 0.6, 'interview': 0.3}
    raw_score = sum(OUTCOME_WEIGHTS.get(m.outcome_type, 0) for m in credited_milestones)
    return min(raw_score / 3.0, 1.0)


# ─── EXPLANATION GENERATORS ──────────────────────────────────────────────────
# We generate two versions of the explanation:
#   - student-facing: shown on the student's match card ("Sarah works at Goldman...")
#   - alumni-facing:  shown on the alumni's match card ("Kai is targeting Goldman...")
#
# This matters because the student-facing text reads from the student's POV
# and the alumni-facing text should tell the alumni WHY this student is relevant
# to them — what the student wants, not what the alumni already knows about themselves.

def generate_student_explanation(student, alumni, company_score, survey_score, background_score, milestone_score):
    """Explanation shown to the student on their match card."""
    reasons = []

    if company_score == 1.0:
        reasons.append(
            f"{alumni.first_name} currently works at {alumni.current_company} "
            f"as {alumni.current_role} — one of your target companies."
        )
    elif company_score == 0.5:
        matching_history = [h for h in alumni.history
                            if h.company_name.lower() in {t.company_name.lower() for t in student.targets}]
        if matching_history:
            reasons.append(
                f"{alumni.first_name} previously worked at "
                f"{matching_history[0].company_name}, one of your target companies."
            )

    if survey_score >= 0.5 and student.survey:
        industry = student.survey.responses.get('industry_interest', '')
        if industry:
            reasons.append(f"You both share an interest in {industry}.")

    if background_score > 0:
        if student.hometown and student.hometown.lower() in (alumni.career_summary or '').lower():
            reasons.append(f"You're both connected to {student.hometown}.")

    if milestone_score >= 0.3:
        reasons.append(
            f"{alumni.first_name} has helped students land interviews and opportunities "
            f"at their target companies."
        )

    if not reasons:
        reasons.append(
            f"{alumni.first_name} is an OSU alum at {alumni.current_company} "
            f"who is open to connecting with students."
        )

    return ' '.join(reasons)


def generate_alumni_explanation(student, alumni, company_score, survey_score, background_score):
    """
    Explanation shown to the alumni on their match card.
    Written from the alumni's POV — tells them about the student,
    not about the alumni's own background which they already know.
    """
    reasons = []

    # Lead with what the student wants — their target company
    if company_score >= 0.5:
        reasons.append(
            f"{student.first_name} is targeting {alumni.current_company} "
            f"and is looking for someone with your background."
        )
    else:
        matching_history = [h for h in alumni.history
                            if h.company_name.lower() in {t.company_name.lower() for t in student.targets}]
        if matching_history:
            reasons.append(
                f"{student.first_name} has {matching_history[0].company_name} on their target list, "
                f"where you have experience."
            )

    # Tell the alumni about the student's field and goal
    if student.survey:
        responses = student.survey.responses
        industry = responses.get('industry_interest', '')
        career_goal = responses.get('career_goal', '').replace('-', ' ')
        if industry:
            reasons.append(f"They're interested in {industry}" +
                           (f" with a long-term goal of becoming a {career_goal}." if career_goal else "."))

    # Mention the student's year and major as context
    if student.major and student.year:
        reasons.append(f"{student.first_name} is a {student.year} studying {student.major}.")
    elif student.major:
        reasons.append(f"They're studying {student.major}.")

    if not reasons:
        reasons.append(
            f"{student.first_name} is a Fisher student interested in connecting "
            f"with someone at {alumni.current_company}."
        )

    return ' '.join(reasons)


# ─── MAIN MATCHING FUNCTION ───────────────────────────────────────────────────

def run_matching_for_student(student_id):
    """
    Scores every eligible alumni and creates a match for the top result.
    Stores both a student-facing and alumni-facing explanation.
    """
    student = StudentProfile.query.get(student_id)
    if not student or not student.targets:
        return None

    eligible_alumni = AlumniProfile.query.filter(
        AlumniProfile.availability.in_(['open', 'limited'])
    ).all()
    if not eligible_alumni:
        return None

    existing_matches = Match.query.filter_by(student_id=student_id).all()
    already_matched = {m.alumni_id for m in existing_matches}

    best_match = None
    best_score = -1

    for alumni in eligible_alumni:
        if alumni.id in already_matched:
            continue

        company_score    = score_company_match(student, alumni)
        survey_score     = score_survey_overlap(student.survey, alumni)
        background_score = score_background(student, alumni)
        milestone_score  = score_milestone_signal(alumni)

        total_score = (
            company_score    * WEIGHT_COMPANY +
            survey_score     * WEIGHT_SURVEY +
            background_score * WEIGHT_BACKGROUND +
            milestone_score  * WEIGHT_MILESTONE
        )

        if total_score > best_score:
            best_score = total_score
            best_match = (alumni, company_score, survey_score, background_score, milestone_score, total_score)

    if not best_match or best_score == 0:
        return None

    alumni, company_score, survey_score, background_score, milestone_score, total_score = best_match

    # Generate both explanations and store them in the match row.
    # student_explanation goes on the student's dashboard card.
    # alumni_explanation goes on the alumni's dashboard card.
    student_explanation = generate_student_explanation(
        student, alumni, company_score, survey_score, background_score, milestone_score
    )
    alumni_explanation = generate_alumni_explanation(
        student, alumni, company_score, survey_score, background_score
    )

    match = Match(
        student_id=student.id,
        alumni_id=alumni.id,
        score=round(total_score, 4),
        explanation=student_explanation,           # student sees this
        alumni_explanation=alumni_explanation,     # alumni sees this
        status='pending'
    )
    db.session.add(match)
    db.session.commit()

    return match