from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.interview import Interview, Question, Answer

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.get('/dashboard')
@jwt_required()
def dashboard():
    user_id = int(get_jwt_identity())

    interviews = Interview.query.filter_by(user_id=user_id).order_by(Interview.created_at.desc()).all()
    completed_interviews = [i for i in interviews if i.status == 'completed' and i.overall_score is not None]

    # Calculate average and best score
    scores = [float(i.overall_score) for i in completed_interviews]
    average_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    best_score = round(max(scores), 2) if scores else 0.0

    # Retrieve all answers submitted by this user
    user_answers = (
        Answer.query
        .join(Question, Answer.question_id == Question.id)
        .join(Interview, Question.interview_id == Interview.id)
        .filter(Interview.user_id == user_id)
        .all()
    )

    def calc_metric_avg(attr: str) -> float:
        vals = [float(getattr(a, attr) or 0) for a in user_answers]
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    # Topic-wise performance aggregation
    topic_data = {}
    for ans in user_answers:
        topic_name = ans.question.topic or 'General'
        topic_data.setdefault(topic_name, []).append(float(ans.overall_score or 0))

    topic_breakdown = []
    for topic, topic_scores in topic_data.items():
        avg_topic_score = round(sum(topic_scores) / len(topic_scores), 2)
        if avg_topic_score >= 8.0:
            mastery = 'Expert'
        elif avg_topic_score >= 6.0:
            mastery = 'Proficient'
        else:
            mastery = 'Needs Practice'

        topic_breakdown.append({
            'topic': topic,
            'average_score': avg_topic_score,
            'question_count': len(topic_scores),
            'mastery': mastery
        })

    # Sort topics by question count and score
    topic_breakdown.sort(key=lambda x: (x['question_count'], x['average_score']), reverse=True)

    # Score trend across completed interviews (chronological order)
    chronological_completed = sorted(completed_interviews, key=lambda x: x.created_at or 0)
    score_trend = [
        {
            'id': i.id,
            'role': i.role,
            'score': round(float(i.overall_score), 2),
            'date': i.created_at.strftime('%b %d') if i.created_at else ''
        }
        for i in chronological_completed
    ]

    # Recent interview history (up to 10 most recent)
    recent_interviews = [
        {
            'id': i.id,
            'role': i.role,
            'experience': i.experience,
            'interview_type': i.interview_type,
            'difficulty': i.difficulty,
            'current_difficulty': i.current_difficulty,
            'status': i.status,
            'overall_score': round(float(i.overall_score), 2) if i.overall_score is not None else None,
            'question_count': i.question_count,
            'resume_filename': i.resume.filename if i.resume else None,
            'created_at': i.created_at.isoformat() if i.created_at else None,
            'completed_at': i.completed_at.isoformat() if i.completed_at else None
        }
        for i in interviews[:10]
    ]

    return jsonify(
        summary={
            'total_interviews': len(interviews),
            'completed_interviews': len(completed_interviews),
            'average_score': average_score,
            'best_score': best_score,
            'technical_avg': calc_metric_avg('technical_score'),
            'relevance_avg': calc_metric_avg('relevance_score'),
            'communication_avg': calc_metric_avg('communication_score'),
            'completeness_avg': calc_metric_avg('completeness_score')
        },
        topic_breakdown=topic_breakdown,
        recent_interviews=recent_interviews,
        score_trend=score_trend
    )
