from datetime import datetime
from extensions import db

class Resume(db.Model):
    __tablename__ = 'resumes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    extracted_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    interviews = db.relationship('Interview', backref='resume', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'character_count': len(self.extracted_text) if self.extracted_text else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
