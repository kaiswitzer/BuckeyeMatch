# models/student.py
# Three models that together represent a full student:
#   StudentProfile — hard info (name, major, year, hometown, bio)
#   StudentTarget  — one row per target company/role
#   SurveyResponse — personality survey answers as JSON

from . import db
from datetime import datetime
import json

class StudentProfile(db.Model):
    __tablename__ = 'student_profiles'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    first_name = db.Column(db.Text, nullable=False)
    last_name = db.Column(db.Text, nullable=False)
    major = db.Column(db.Text, nullable=False)
    minor = db.Column(db.Text)
    year = db.Column(db.Text, nullable=False)  # 'junior' or 'senior'
    hometown = db.Column(db.Text)
    bio = db.Column(db.Text)  # short personal blurb shown to matched alumni

    # One student has many targets — like a @OneToMany in Java
    targets = db.relationship('StudentTarget', backref='student', lazy=True)
    survey = db.relationship('SurveyResponse', backref='student', uselist=False)
    experiences = db.relationship(
        'StudentExperience',
        backref='student',
        lazy=True,
        cascade='all, delete-orphan',
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'major': self.major,
            'minor': self.minor,
            'year': self.year,
            'hometown': self.hometown,
            'bio': self.bio,
            'targets': [t.to_dict() for t in self.targets],
            'experience': [e.to_dict() for e in self.experiences],
        }


class StudentExperience(db.Model):
    __tablename__ = 'student_experience'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    company_name = db.Column(db.Text, nullable=False)
    role_name = db.Column(db.Text)
    term_label = db.Column(db.Text)
    visible_to_peers = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'company_name': self.company_name,
            'role_name': self.role_name,
            'term_label': self.term_label,
            'visible_to_peers': bool(self.visible_to_peers),
        }


class StudentTarget(db.Model):
    __tablename__ = 'student_targets'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    company_name = db.Column(db.Text, nullable=False)
    role_name = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'company_name': self.company_name,
            'role_name': self.role_name
        }


class SurveyResponse(db.Model):
    __tablename__ = 'survey_responses'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False, unique=True)

    # Stored as a JSON string in SQLite, parsed back to a dict when accessed.
    # We use a property (like a Java getter) to handle the conversion automatically.
    _responses = db.Column('responses', db.Text, nullable=False)

    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def responses(self):
        return json.loads(self._responses)

    @responses.setter
    def responses(self, value):
        self._responses = json.dumps(value)

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'responses': self.responses,
            'completed_at': self.completed_at.isoformat()
        }