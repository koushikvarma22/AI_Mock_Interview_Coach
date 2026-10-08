from datetime import datetime
from extensions import db

class Interview(db.Model):
    __tablename__ = 'interviews'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    resume_id = db.Column(db.Integer, db.ForeignKey('resumes.id', ondelete='SET NULL'), nullable=True, index=True)
    role = db.Column(db.String(120), nullable=False)
    experience = db.Column(db.String(80), nullable=False)
    interview_type = db.Column(db.String(80), nullable=False)
    difficulty = db.Column(db.String(20), default='medium')
    current_difficulty = db.Column(db.String(20), default='medium')
    adaptive_enabled = db.Column(db.Boolean, default=True)
    question_count = db.Column(db.Integer, default=5)
    status = db.Column(db.String(30), default='in_progress')
    overall_score = db.Column(db.Float, nullable=True)
    final_report = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    questions = db.relationship('Question', backref='interview', cascade='all, delete-orphan', lazy=True, order_by='Question.sequence')

    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'resume_id': self.resume_id,
            'resume_filename': self.resume.filename if self.resume else None,
            'role': self.role,
            'experience': self.experience,
            'interview_type': self.interview_type,
            'difficulty': self.difficulty,
            'current_difficulty': self.current_difficulty,
            'adaptive_enabled': bool(self.adaptive_enabled),
            'question_count': self.question_count,
            'status': self.status,
            'overall_score': self.overall_score,
            'final_report': self.final_report,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
        if include_questions:
            data['questions'] = [q.to_dict() for q in self.questions]
        return data


class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey('interviews.id', ondelete='CASCADE'), nullable=False, index=True)
    sequence = db.Column(db.Integer, nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    topic = db.Column(db.String(120), nullable=True)
    difficulty = db.Column(db.String(20), default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    answer = db.relationship('Answer', backref='question', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'interview_id': self.interview_id,
            'sequence': self.sequence,
            'question_text': self.question_text,
            'topic': self.topic,
            'difficulty': self.difficulty,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'answer': self.answer.to_dict() if self.answer else None
        }


class Answer(db.Model):
    __tablename__ = 'answers'

    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    answer_text = db.Column(db.Text, nullable=False)
    technical_score = db.Column(db.Float, default=0)
    relevance_score = db.Column(db.Float, default=0)
    communication_score = db.Column(db.Float, default=0)
    completeness_score = db.Column(db.Float, default=0)
    overall_score = db.Column(db.Float, default=0)
    strengths = db.Column(db.JSON, default=list)
    weaknesses = db.Column(db.JSON, default=list)
    improvement = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'question_id': self.question_id,
            'answer_text': self.answer_text,
            'technical_score': self.technical_score,
            'relevance_score': self.relevance_score,
            'communication_score': self.communication_score,
            'completeness_score': self.completeness_score,
            'overall_score': self.overall_score,
            'strengths': self.strengths or [],
            'weaknesses': self.weaknesses or [],
            'improvement': self.improvement or '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
