# models/alumni.py
# Two models for alumni:
#   AlumniProfile — current role, availability, bio, helped count toggle
#   AlumniHistory — past companies/roles (one row each)

from . import db
from models.match import Match, Milestone

class AlumniProfile(db.Model):
    __tablename__ = 'alumni_profiles'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    first_name = db.Column(db.Text, nullable=False)
    last_name = db.Column(db.Text, nullable=False)
    current_company = db.Column(db.Text, nullable=False)
    current_role = db.Column(db.Text, nullable=False)
    career_summary = db.Column(db.Text)
    bio = db.Column(db.Text)  # short personal blurb shown to matched students

    # 'open' = happy to get matches, 'limited' = occasionally, 'closed' = pause
    availability = db.Column(db.Text, nullable=False, default='open')

    # Whether to show the "X students helped" count publicly on their profile.
    # Stored as INTEGER in SQLite (1 = True, 0 = False) — SQLite has no native boolean.
    # Think of this like a Java boolean field backed by a tinyint column.
    show_helped_count = db.Column(db.Integer, nullable=False, default=1)

    history = db.relationship('AlumniHistory', backref='alumni', lazy=True)

    def get_helped_count(self):
        """
        Counts the number of unique students this alumni has been credited
        with helping via milestone outcomes (interview, offer, or job).

        We join through Match to find all milestones tied to this alumni's matches.
        Think of it like a SQL JOIN: milestones → matches → alumni.

        Only milestones where a match_id is set count — those are the ones
        explicitly credited to an alumni by the student.
        """
        alumni_match_ids = {
            m.id for m in Match.query.filter_by(alumni_id=self.id).all()
        }
        if not alumni_match_ids:
            return 0

        # Count unique students helped (not raw milestone count —
        # one student getting an interview AND a job still counts as 1)
        credited = Milestone.query.filter(
            Milestone.match_id.in_(alumni_match_ids)
        ).all()

        unique_students = {m.student_id for m in credited}
        return len(unique_students)

    def to_dict(self):
        helped = self.get_helped_count()
        return {
            'id': self.id,
            'user_id': self.user_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'current_company': self.current_company,
            'current_role': self.current_role,
            'career_summary': self.career_summary,
            'bio': self.bio,
            'availability': self.availability,
            'show_helped_count': bool(self.show_helped_count),
            # Only expose the count if the alumni has opted in
            # If show_helped_count is False, we send None so the frontend
            # knows not to render it at all — not even a 0
            'helped_count': helped if self.show_helped_count else None,
            'history': [h.to_dict() for h in self.history]
        }


class AlumniHistory(db.Model):
    __tablename__ = 'alumni_history'

    id = db.Column(db.Integer, primary_key=True)
    alumni_id = db.Column(db.Integer, db.ForeignKey('alumni_profiles.id'), nullable=False)
    company_name = db.Column(db.Text, nullable=False)
    role_name = db.Column(db.Text)
    start_year = db.Column(db.Integer)
    end_year = db.Column(db.Integer)

    def to_dict(self):
        return {
            'id': self.id,
            'company_name': self.company_name,
            'role_name': self.role_name,
            'start_year': self.start_year,
            'end_year': self.end_year
        }