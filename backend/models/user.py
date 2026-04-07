# models/user.py
# The User model — one row per person in the system, student or alumni.
# This is the authentication table. Profile data lives in separate tables.

from . import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.Text, nullable=False, unique=True)
    password_hash = db.Column(db.Text, nullable=False)

    # 'student' or 'alumni' — set at signup, never changes
    account_type = db.Column(db.Text, nullable=False)

    # False until they click the verification link in their OSU email
    is_verified = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships — lets you do user.student_profile directly in code
    # like a @OneToOne in Java
    student_profile = db.relationship('StudentProfile', backref='user', uselist=False)
    alumni_profile = db.relationship('AlumniProfile', backref='user', uselist=False)

    def to_dict(self):
        # Pick the right profile based on account type.
        # Think of this like a Java ternary on a nullable field —
        # we grab whichever profile exists, or None if onboarding isn't done yet.
        profile = self.student_profile if self.account_type == 'student' else self.alumni_profile

        return {
            'id': self.id,
            'email': self.email,
            'account_type': self.account_type,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat(),
            # True if the user has completed step 1 of onboarding
            'has_profile': profile is not None,
            # These come from the profile row, not the user row.
            # None if the user hasn't completed onboarding yet.
            'first_name': profile.first_name if profile else None,
            'last_name': profile.last_name if profile else None,
        }