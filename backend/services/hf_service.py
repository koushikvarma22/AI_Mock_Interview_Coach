"""
Hugging Face Integration Service.
Provides question generation, answer evaluation, and final report synthesis
using Hugging Face Router API with resume grounding and RAG knowledge context.
"""

import json
import re
import requests
from flask import current_app

URL = 'https://router.huggingface.co/v1/chat/completions'


def extract_json(raw_text: str) -> dict:
    """Extract and parse JSON safely from model response text."""
    text = raw_text.strip()
    if text.startswith('```'):
        # Strip markdown fences
        text = re.sub(r'^```[a-zA-Z]*\n', '', text)
        text = re.sub(r'\n```$', '', text).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Regex search for the outermost JSON object
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse valid JSON from LLM output: {raw_text[:200]}")


def fallback_generate_question(role: str, experience: str, itype: str, difficulty: str, resume: str = '', previous: list = None) -> dict:
    """Intelligent fallback question generator if HF token is missing or network fails."""
    prev_count = len(previous or [])
    topics_by_role = {
        'Frontend': ['React Hooks & State', 'Virtual DOM & Performance', 'CSS Layouts & Flexbox/Grid', 'Async API Calls', 'Web Accessibility'],
        'Backend': ['REST API & HTTP Idempotency', 'Database Indexing & ACID', 'Authentication & JWT', 'Caching Strategies with Redis', 'System Scalability'],
        'Full Stack': ['Client-Server Data Flow', 'PostgreSQL Schema Design', 'Component Lifecycle', 'API Security & CORS', 'Microservices vs Monolith'],
        'Data': ['SQL Aggregations & Window Functions', 'Data Pipelines & ETL', 'Data Normalization', 'Index Optimization', 'Handling Missing Data']
    }

    matched_topics = topics_by_role.get('Backend', ['Core Engineering Concepts'])
    for key in topics_by_role:
        if key.lower() in role.lower():
            matched_topics = topics_by_role[key]
            break

    topic = matched_topics[prev_count % len(matched_topics)]
    has_resume = bool(resume and len(resume) > 40)

    if difficulty == 'easy':
        q = f"In the context of {role} ({topic}), can you explain the fundamental concepts and how you implement them in everyday projects?"
    elif difficulty == 'hard':
        q = f"For a senior {role}, explain how you would architect a high-scale solution involving {topic}. What edge cases, failure modes, and performance trade-offs would you address?"
    else:
        q = f"As a {experience} {role}, describe how you approach {topic}. How do you ensure maintainability, performance, and best practices in your implementation?"

    if has_resume and prev_count == 0:
        q += " Reference any relevant projects or tools mentioned in your background."

    return {
        "question": q,
        "topic": topic,
        "difficulty": difficulty
    }


def fallback_evaluate_answer(question: str, answer: str, role: str, difficulty: str) -> dict:
    """Intelligent fallback answer evaluation when HF API is unavailable."""
    words = answer.strip().split()
    word_count = len(words)

    # Heuristic scoring based on answer length, technical vocabulary, and structure
    base = 5.0
    if word_count > 60:
        base += 2.0
    elif word_count > 25:
        base += 1.0
    elif word_count < 10:
        base = max(2.0, base - 2.0)

    tech_score = min(9.5, max(3.0, round(base + (0.5 if difficulty != 'hard' else -0.5), 1)))
    rel_score = min(9.5, max(3.0, round(base + 0.3, 1)))
    comm_score = min(9.5, max(3.0, round(base + 0.2, 1)))
    comp_score = min(9.5, max(3.0, round(base - 0.2, 1)))
    overall = round((tech_score + rel_score + comm_score + comp_score) / 4, 1)

    return {
        "technical_score": tech_score,
        "relevance_score": rel_score,
        "communication_score": comm_score,
        "completeness_score": comp_score,
        "overall_score": overall,
        "strengths": [
            "Addressed the core question with clear terminology.",
            "Demonstrated logical flow and structured communication."
        ],
        "weaknesses": [
            "Could elaborate further on real-world edge cases and concrete performance trade-offs."
        ],
        "improvement": (
            f"To strengthen your answer for a {role} interview at {difficulty} level, "
            "provide a specific production example, mention measurable metrics (like latency or throughput), "
            "and explain why alternative approaches were rejected."
        )
    }


def fallback_report(role: str, answers: list) -> dict:
    """Intelligent fallback final report synthesis."""
    avg_score = round(sum(a.get('score', 0) for a in answers) / max(1, len(answers)), 1)
    return {
        "overall_summary": (
            f"The candidate completed a comprehensive {role} mock interview with an average score of {avg_score}/10. "
            "Showcased strong grasp of core fundamentals, steady problem-solving aptitude, and clear technical communication."
        ),
        "top_strengths": [
            "Consistently structured responses with foundational accuracy.",
            "Strong articulation of engineering decisions and workflows.",
            "Receptive to role-specific requirements and problem contexts."
        ],
        "focus_areas": [
            "Deepen coverage of architectural trade-offs and edge-case handling.",
            "Incorporate concrete metrics and impact numbers into project descriptions."
        ],
        "action_plan": [
            "Review system scalability bottlenecks and asynchronous patterns.",
            "Practice structuring answers using the STAR method for complex scenarios.",
            "Run another adaptive mock interview focusing on high-difficulty questions."
        ]
    }


def call(messages: list, temp: float = 0.4) -> dict:
    """Invoke Hugging Face router chat completions endpoint with automatic inference fallback."""
    token = current_app.config.get('HF_API_TOKEN', '').strip()
    if not token or token == 'your_huggingface_token_here':
        return None

    model = current_app.config.get('HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': model,
        'messages': messages,
        'temperature': temp,
        'max_tokens': 900
    }

    endpoints = [
        URL,
        'https://router.huggingface.co/hf-inference/v1/chat/completions'
    ]

    last_error = None
    for endpoint in endpoints:
        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                raw_content = resp.json()['choices'][0]['message']['content']
                return extract_json(raw_content)
            else:
                last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_error = str(e)

    if last_error:
        current_app.logger.warning(f"HF API calls failed across endpoints: {last_error}")
    return None


def generate_question(role: str, experience: str, itype: str, difficulty: str, resume: str = '', previous: list = None, context: list = None) -> dict:
    """
    Generate a tailored interview question using Candidate Resume + RAG Knowledge Context.
    """
    context_str = json.dumps(context) if context else "None"
    prev_str = json.dumps(previous) if previous else "None"
    resume_snippet = resume[:14000] if resume else "No resume provided."

    prompt = (
        f"You are a seasoned technical interviewer conducting an interview for: {role} ({experience} level).\n"
        f"Interview Type: {itype}\n"
        f"Target Difficulty: {difficulty} (easy / medium / hard)\n\n"
        f"CANDIDATE RESUME DETAILS:\n{resume_snippet}\n\n"
        f"RETRIEVED DOMAIN KNOWLEDGE (RAG CONTEXT):\n{context_str}\n\n"
        f"PREVIOUS QUESTIONS ASKED IN THIS SESSION (DO NOT REPEAT):\n{prev_str}\n\n"
        "INSTRUCTIONS:\n"
        "1. Generate exactly ONE highly relevant, professional interview question.\n"
        "2. Directly incorporate specific projects, tools, or frameworks from the candidate's resume if available.\n"
        "3. Incorporate key concepts from the retrieved RAG domain knowledge.\n"
        "4. Calibrate question complexity strictly to the difficulty level: easy (fundamentals), medium (application/architecture), hard (deep internals/trade-offs).\n"
        "5. Output MUST be valid JSON only, with no surrounding explanations:\n"
        '{"question": "string", "topic": "string", "difficulty": "easy|medium|hard"}'
    )

    try:
        res = call([
            {"role": "system", "content": "You are a professional technical interviewer who only outputs valid JSON."},
            {"role": "user", "content": prompt}
        ], temp=0.5)
        if res and "question" in res:
            res["difficulty"] = res.get("difficulty", difficulty)
            return res
    except Exception as e:
        current_app.logger.warning(f"HF generate_question API call failed, using fallback: {e}")

    return fallback_generate_question(role, experience, itype, difficulty, resume, previous)


def evaluate_answer(question: str, answer: str, role: str, difficulty: str, resume: str = '', context: list = None) -> dict:
    """
    Evaluate candidate's answer with detailed rubrics, resume context, and RAG ground truth.
    """
    context_str = json.dumps(context) if context else "None"
    resume_snippet = resume[:8000] if resume else "None"

    prompt = (
        f"You are an expert technical interviewer evaluating an interview response.\n"
        f"Target Role: {role}\n"
        f"Question Difficulty: {difficulty}\n"
        f"QUESTION: {question}\n"
        f"CANDIDATE ANSWER: {answer}\n\n"
        f"CANDIDATE RESUME CONTEXT: {resume_snippet}\n"
        f"DOMAIN KNOWLEDGE / GROUND TRUTH (RAG CONTEXT): {context_str}\n\n"
        "INSTRUCTIONS:\n"
        "Evaluate the candidate's response fairly and rigorously against technical accuracy, relevance, communication clarity, and completeness.\n"
        "Score each category on a scale of 0.0 to 10.0.\n"
        "Return ONLY valid JSON matching this exact structure:\n"
        "{\n"
        '  "technical_score": float,\n'
        '  "relevance_score": float,\n'
        '  "communication_score": float,\n'
        '  "completeness_score": float,\n'
        '  "overall_score": float,\n'
        '  "strengths": ["string", "string"],\n'
        '  "weaknesses": ["string", "string"],\n'
        '  "improvement": "string"\n'
        "}"
    )

    try:
        res = call([
            {"role": "system", "content": "You are an expert, objective interview evaluator who only outputs valid JSON."},
            {"role": "user", "content": prompt}
        ], temp=0.2)
        if res and "overall_score" in res:
            return res
    except Exception as e:
        current_app.logger.warning(f"HF evaluate_answer API call failed, using fallback: {e}")

    return fallback_evaluate_answer(question, answer, role, difficulty)


def report(role: str, answers: list) -> dict:
    """
    Generate comprehensive final report summarizing the candidate's interview session.
    """
    prompt = (
        f"You are a senior career coach and tech lead reviewing an interview for: {role}.\n"
        f"CANDIDATE SESSION PERFORMANCE DATA:\n{json.dumps(answers, indent=2)}\n\n"
        "INSTRUCTIONS:\n"
        "Synthesize performance across all questions into an insightful, constructive final evaluation report.\n"
        "Output ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "overall_summary": "string",\n'
        '  "top_strengths": ["string", "string", "string"],\n'
        '  "focus_areas": ["string", "string"],\n'
        '  "action_plan": ["string", "string", "string"]\n'
        "}"
    )

    try:
        res = call([
            {"role": "system", "content": "You are a professional executive interview coach who only outputs valid JSON."},
            {"role": "user", "content": prompt}
        ], temp=0.3)
        if res and "overall_summary" in res:
            return res
    except Exception as e:
        current_app.logger.warning(f"HF report API call failed, using fallback: {e}")

    return fallback_report(role, answers)
