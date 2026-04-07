# models/match.py
# Four models covering everything post-match:
#   Match        — the pairing itself, with score and two explanations
#   Message      — async messages within a match thread
#   Milestone    — interview/job outcomes logged by students
#   MatchRating  — thumbs up/down sent 2 weeks after matching

from . import db
from datetime import datetime

class Match(db.Model):
    __tablename__ = 'matches'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    alumni_id = db.Column(db.Integer, db.ForeignKey('alumni_profiles.id'), nullable=False)

    score = db.Column(db.Float, nullable=False)

    # Student sees this — written from their POV ("Sarah works at Goldman...")
    explanation = db.Column(db.Text, nullable=False)

    # Alumni sees this — written from their POV ("Kai is targeting Goldman...")
    # Nullable because existing matches won't have this until re-matched
    alumni_explanation = db.Column(db.Text, nullable=True)

    # 'pending'  = waiting for alumni to respond
    # 'accepted' = alumni accepted
    # 'passed'   = alumni declined
    # 'active'   = has message activity (future use)
    status = db.Column(db.Text, nullable=False, default='pending')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship('Message', backref='match', lazy=True)
    milestones = db.relationship('Milestone', backref='match', lazy=True)
    rating = db.relationship('MatchRating', backref='match', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'alumni_id': self.alumni_id,
            'score': self.score,
            'explanation': self.explanation,
            'alumni_explanation': self.alumni_explanation,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }


class Message(db.Model):
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'sender_id': self.sender_id,
            'body': self.body,
            'sent_at': self.sent_at.isoformat(),
            'read_at': self.read_at.isoformat() if self.read_at else None
        }


class Milestone(db.Model):
    __tablename__ = 'milestones'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=True)
    outcome_type = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text)
    logged_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'match_id': self.match_id,
            'outcome_type': self.outcome_type,
            'notes': self.notes,
            'logged_at': self.logged_at.isoformat()
        }


class MatchRating(db.Model):
    __tablename__ = 'match_ratings'

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    rated_by = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    rated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'rated_by': self.rated_by,
            'rating': self.rating,
            'rated_at': self.rated_at.isoformat()
        }