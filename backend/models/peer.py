# models/peer.py
# Student-to-student intro requests and messages (separate from alumni match threads).

from . import db
from datetime import datetime


class PeerIntroRequest(db.Model):
    __tablename__ = 'peer_intro_requests'

    id = db.Column(db.Integer, primary_key=True)
    requester_student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    recipient_student_id = db.Column(db.Integer, db.ForeignKey('student_profiles.id'), nullable=False)
    company_name = db.Column(db.Text, nullable=False)
    initial_message = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, nullable=False, default='pending')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship('PeerMessage', backref='intro_request', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'requester_student_id': self.requester_student_id,
            'recipient_student_id': self.recipient_student_id,
            'company_name': self.company_name,
            'initial_message': self.initial_message,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class PeerMessage(db.Model):
    __tablename__ = 'peer_messages'

    id = db.Column(db.Integer, primary_key=True)
    intro_request_id = db.Column(db.Integer, db.ForeignKey('peer_intro_requests.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'intro_request_id': self.intro_request_id,
            'sender_id': self.sender_id,
            'body': self.body,
            'sent_at': self.sent_at.isoformat(),
            'read_at': self.read_at.isoformat() if self.read_at else None,
        }
