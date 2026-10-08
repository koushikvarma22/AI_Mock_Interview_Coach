from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.interview import Interview, Question, Answer
from models.resume import Resume
from services.hf_service import generate_question, evaluate_answer, report
from services.rag_service import retrieve_context

interview_bp = Blueprint('interview', __name__)

DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']


def clamp_score(val) -> float:
    try:
        return max(0.0, min(10.0, round(float(val), 2)))
    except (TypeError, ValueError):
        return 0.0


def calculate_adaptive_difficulty(current_level: str, score: float) -> tuple[str, bool, str]:
    """
    Adaptive Interview Engine:
    - Score >= 8.0: Increase difficulty (easy -> medium -> hard)
    - Score < 5.0: Decrease difficulty (hard -> medium -> easy)
    - Score 5.0 - 7.9: Keep current difficulty
    Returns (new_level, changed, reason)
    """
    current_level = current_level.lower()
    if current_level not in DIFFICULTY_LEVELS:
        current_level = 'medium'

    idx = DIFFICULTY_LEVELS.index(current_level)

    if score >= 8.0 and idx < len(DIFFICULTY_LEVELS) - 1:
        new_level = DIFFICULTY_LEVELS[idx + 1]
        return new_level, True, f"Great job! Score ({score}/10) elevated difficulty to {new_level.capitalize()}."
    elif score < 5.0 and idx > 0:
        new_level = DIFFICULTY_LEVELS[idx - 1]
        return new_level, True, f"Score ({score}/10) adjusted difficulty to {new_level.capitalize()} to reinforce core concepts."
    else:
        return current_level, False, f"Solid response ({score}/10). Maintaining {current_level.capitalize()} difficulty."


@interview_bp.post('/start')
@jwt_required()
def start_interview():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    role = data.get('role', '').strip()
    experience = data.get('experience', '').strip()
    interview_type = data.get('interview_type', 'Technical').strip()
    initial_difficulty = data.get('difficulty', 'medium').lower()
    if initial_difficulty not in DIFFICULTY_LEVELS:
        initial_difficulty = 'medium'

    adaptive_enabled = bool(data.get('adaptive_enabled', True))
    question_count = max(1, min(15, int(data.get('question_count', 5))))

    if not role or not experience:
        return jsonify(error='Role and experience level are required to start an interview'), 400

    # Retrieve and link resume if provided
    resume_id = data.get('resume_id')
    resume = None
    if resume_id:
        try:
            resume = Resume.query.filter_by(id=int(resume_id), user_id=user_id).first()
            if not resume:
                return jsonify(error='Selected resume not found'), 404
        except (ValueError, TypeError):
            return jsonify(error='Invalid resume ID format'), 400

    interview = Interview(
        user_id=user_id,
        resume_id=resume.id if resume else None,
        role=role,
        experience=experience,
        interview_type=interview_type,
        difficulty=initial_difficulty,
        current_difficulty=initial_difficulty,
        adaptive_enabled=adaptive_enabled,
        question_count=question_count,
        status='in_progress'
    )
    db.session.add(interview)
    db.session.flush()

    # Retrieve RAG context grounded in the candidate's role and interview type
    rag_query = f"{role} {interview_type} {experience}"
    rag_context = retrieve_context(rag_query, top_k=3)
    resume_text = resume.extracted_text if resume else ''

    # Generate first personalized question
    q_data = generate_question(
        role=interview.role,
        experience=interview.experience,
        itype=interview.interview_type,
        difficulty=interview.current_difficulty,
        resume=resume_text,
        previous=[],
        context=rag_context
    )

    first_q = Question(
        interview_id=interview.id,
        sequence=1,
        question_text=q_data.get('question', f"Describe your background and core experience in {role}."),
        topic=q_data.get('topic', 'Overview'),
        difficulty=q_data.get('difficulty', interview.current_difficulty)
    )
    db.session.add(first_q)
    db.session.commit()

    return jsonify(
        interview=interview.to_dict(),
        question={
            'id': first_q.id,
            'sequence': 1,
            'text': first_q.question_text,
            'topic': first_q.topic,
            'difficulty': first_q.difficulty
        }
    ), 201


@interview_bp.post('/<int:interview_id>/answer')
@jwt_required()
def submit_answer(interview_id: int):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    interview = Interview.query.filter_by(id=interview_id, user_id=user_id).first()
    if not interview:
        return jsonify(error='Interview not found'), 404

    question_id = data.get('question_id')
    question = Question.query.filter_by(id=question_id, interview_id=interview.id).first()
    if not question:
        return jsonify(error='Question not found for this interview'), 404

    # Check if question has already been answered
    if question.answer:
        return jsonify(error='This question has already been answered'), 400

    answer_text = data.get('answer', '').strip()
    if not answer_text:
        return jsonify(error='Answer text cannot be empty'), 400

    # Ensure resume text is available
    resume = Resume.query.filter_by(id=interview.resume_id, user_id=user_id).first() if interview.resume_id else None
    resume_text = resume.extracted_text if resume else ''

    # Retrieve relevant RAG context for the question and topic
    rag_query = f"{interview.role} {question.topic or ''} {question.question_text}"
    rag_context = retrieve_context(rag_query, top_k=3)

    # Evaluate candidate answer
    eval_result = evaluate_answer(
        question=question.question_text,
        answer=answer_text,
        role=interview.role,
        difficulty=question.difficulty,
        resume=resume_text,
        context=rag_context
    )

    answer = Answer(
        question_id=question.id,
        answer_text=answer_text,
        technical_score=clamp_score(eval_result.get('technical_score')),
        relevance_score=clamp_score(eval_result.get('relevance_score')),
        communication_score=clamp_score(eval_result.get('communication_score')),
        completeness_score=clamp_score(eval_result.get('completeness_score')),
        overall_score=clamp_score(eval_result.get('overall_score')),
        strengths=eval_result.get('strengths', []),
        weaknesses=eval_result.get('weaknesses', []),
        improvement=eval_result.get('improvement', '')
    )
    question.answer = answer
    db.session.add(answer)
    db.session.flush()

    # Adaptive difficulty calculation
    prev_difficulty = interview.current_difficulty
    new_difficulty, changed, reason = calculate_adaptive_difficulty(interview.current_difficulty, answer.overall_score)
    if interview.adaptive_enabled:
        interview.current_difficulty = new_difficulty

    evaluation_payload = {
        'technical_score': answer.technical_score,
        'relevance_score': answer.relevance_score,
        'communication_score': answer.communication_score,
        'completeness_score': answer.completeness_score,
        'overall_score': answer.overall_score,
        'strengths': answer.strengths,
        'weaknesses': answer.weaknesses,
        'improvement': answer.improvement
    }

    # Count answered questions accurately
    all_questions = Question.query.filter_by(interview_id=interview.id).order_by(Question.sequence).all()
    answered_questions = [q for q in all_questions if q.answer is not None]
    total_answered = len(answered_questions)

    # Check if interview is finished
    if total_answered >= interview.question_count:
        scores = [q.answer.overall_score for q in answered_questions]
        interview.status = 'completed'
        interview.completed_at = datetime.utcnow()
        interview.overall_score = round(sum(scores) / max(1, len(scores)), 2)

        # Generate comprehensive final report
        answers_summary = [
            {
                'sequence': q.sequence,
                'question': q.question_text,
                'topic': q.topic,
                'difficulty': q.difficulty,
                'answer': q.answer.answer_text,
                'score': q.answer.overall_score,
                'technical_score': q.answer.technical_score,
                'improvement': q.answer.improvement
            }
            for q in answered_questions
        ]
        final_rep = report(interview.role, answers_summary)
        interview.final_report = final_rep
        db.session.commit()

        return jsonify(
            completed=True,
            evaluation=evaluation_payload,
            report=interview.final_report,
            interview=interview.to_dict(),
            adaptive_difficulty=interview.current_difficulty,
            adaptive_message=reason
        )

    # Otherwise, generate the next question using candidate resume + RAG context
    previous_questions = [q.question_text for q in interview.questions]
    next_seq = total_answered + 1

    next_rag_query = f"{interview.role} {interview.interview_type} {question.topic or ''}"
    next_rag_context = retrieve_context(next_rag_query, top_k=3)

    next_q_data = generate_question(
        role=interview.role,
        experience=interview.experience,
        itype=interview.interview_type,
        difficulty=interview.current_difficulty,
        resume=resume_text,
        previous=previous_questions,
        context=next_rag_context
    )

    next_question = Question(
        interview_id=interview.id,
        sequence=next_seq,
        question_text=next_q_data.get('question'),
        topic=next_q_data.get('topic', 'Technical Deep Dive'),
        difficulty=next_q_data.get('difficulty', interview.current_difficulty)
    )
    db.session.add(next_question)
    db.session.commit()

    return jsonify(
        completed=False,
        evaluation=evaluation_payload,
        next_question={
            'id': next_question.id,
            'sequence': next_question.sequence,
            'text': next_question.question_text,
            'topic': next_question.topic,
            'difficulty': next_question.difficulty
        },
        adaptive_difficulty=interview.current_difficulty,
        difficulty_changed=changed,
        adaptive_message=reason
    )


@interview_bp.get('')
@jwt_required()
def list_interviews():
    user_id = int(get_jwt_identity())
    interviews = Interview.query.filter_by(user_id=user_id).order_by(Interview.created_at.desc()).all()
    return jsonify([i.to_dict() for i in interviews])


@interview_bp.get('/<int:interview_id>')
@jwt_required()
def get_interview_detail(interview_id: int):
    user_id = int(get_jwt_identity())
    interview = Interview.query.filter_by(id=interview_id, user_id=user_id).first()
    if not interview:
        return jsonify(error='Interview not found'), 404

    return jsonify(interview.to_dict(include_questions=True))
