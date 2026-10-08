"""
RAG Service: Interview Knowledge Base retrieval using TF-IDF and Cosine Similarity.
Provides grounded technical and behavioral context to Hugging Face LLM prompts.
"""

from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Curated Technical & Behavioral Interview Knowledge Base
INTERVIEW_KNOWLEDGE_BASE = [
    {
        "topic": "Python Core & Advanced",
        "keywords": "python oop decorators generators iterators gil asyncio memory management typing",
        "text": (
            "Python technical interviews focus on core data structures (lists, dicts, sets, tuples), "
            "object-oriented programming, exception handling, decorators, generators (yield), list/dict comprehensions, "
            "the Global Interpreter Lock (GIL), asynchronous programming with asyncio, typing/type hints, "
            "and memory management (reference counting and garbage collection)."
        )
    },
    {
        "topic": "Flask & Python Web Frameworks",
        "keywords": "flask framework blueprints rest routing middleware wsgi gunicorn cors sqlalchemy",
        "text": (
            "Flask interview topics include application factory pattern, Blueprints for modular architecture, "
            "request/response lifecycles, error handlers, JSON serialization, database integration via SQLAlchemy ORM, "
            "CORS handling, authentication hooks, WSGI deployment with Gunicorn, and unit testing with pytest."
        )
    },
    {
        "topic": "PostgreSQL & Relational Databases",
        "keywords": "postgresql sql database indexing acid transactions joins normalization b-tree query optimization",
        "text": (
            "PostgreSQL and SQL interviews cover ACID properties (Atomicity, Consistency, Isolation, Durability), "
            "transaction isolation levels, complex JOINs, GROUP BY/HAVING, subqueries and window functions, "
            "indexing strategies (B-Tree, GIN, Hash), EXPLAIN ANALYZE for query optimization, schema normalization (1NF-3NF), "
            "connection pooling, foreign keys, and cascading constraints."
        )
    },
    {
        "topic": "RESTful API Design & HTTP",
        "keywords": "rest api http methods status codes idempotency pagination rate limiting json crud",
        "text": (
            "REST API interviews evaluate HTTP methods (GET, POST, PUT, PATCH, DELETE), status codes (200, 201, 400, 401, 403, 404, 429, 500), "
            "idempotency principles, statelessness, URL resource naming conventions, cursor vs offset pagination, "
            "error response structures, payload validation, and API versioning."
        )
    },
    {
        "topic": "System Design & Scalability",
        "keywords": "system design microservices caching redis message queues kafka load balancer cap theorem scaling",
        "text": (
            "System design interviews assess horizontal vs vertical scaling, load balancing algorithms, "
            "caching strategies (Cache-Aside, Write-Through, Redis/Memcached), asynchronous message queues (RabbitMQ, Kafka), "
            "monolith vs microservices architecture, database sharding/replication, CDN usage, "
            "and trade-offs under the CAP theorem (Consistency, Availability, Partition tolerance)."
        )
    },
    {
        "topic": "Web Security & Authentication",
        "keywords": "jwt authentication oauth2 security hashing bcrypt xss csrf sql injection cors",
        "text": (
            "Web security interviews emphasize stateless JWT (JSON Web Tokens) verification and expiration, "
            "password hashing with salted algorithms (bcrypt/Argon2), OAuth2 flows, defense against SQL injection via parameterized queries, "
            "Cross-Site Scripting (XSS) sanitization, Cross-Site Request Forgery (CSRF) tokens, "
            "Secure/HttpOnly cookie attributes, and robust CORS policy configuration."
        )
    },
    {
        "topic": "Frontend & React Architecture",
        "keywords": "react hooks usestate useeffect usememo virtual dom components props state management vite",
        "text": (
            "React and modern frontend interviews cover component lifecycle, functional components, "
            "core hooks (useState, useEffect, useMemo, useCallback, useRef), virtual DOM diffing and reconciliation, "
            "state management, performance optimization, controlled vs uncontrolled inputs, "
            "API integration with fetch/Axios, error boundaries, and modern build tooling (Vite)."
        )
    },
    {
        "topic": "Data Structures & Algorithms",
        "keywords": "dsa big-o time complexity space arrays hash tables binary trees graphs dynamic programming sorting",
        "text": (
            "DSA interview questions test algorithmic efficiency using Big-O time and space complexity. "
            "Core topics include arrays, hash maps, two-pointer techniques, sliding windows, stacks, queues, "
            "binary search, tree traversals (in-order, pre-order, post-order, BFS/DFS), graph representations, "
            "and dynamic programming memoization/tabulation."
        )
    },
    {
        "topic": "DevOps, Docker & Cloud Deployment",
        "keywords": "docker containers devops cicd render vercel deployment environment variables linux gunicorn",
        "text": (
            "DevOps and deployment discussions cover containerization with Docker (Dockerfiles, multi-stage builds), "
            "CI/CD deployment pipelines, hosting platforms like Render and Vercel, managing production environment secrets (.env), "
            "reverse proxying, process managers (Gunicorn), health check monitoring, and zero-downtime deployments."
        )
    },
    {
        "topic": "Behavioral & STAR Method",
        "keywords": "behavioral hr star situation task action result teamwork conflict leadership communication",
        "text": (
            "HR and behavioral interviews evaluate candidate answers using the STAR method: "
            "Situation (context and background), Task (specific responsibility/challenge), "
            "Action (individual steps taken and rationale), and Result (quantifiable impact and lessons learned). "
            "Evaluators look for active listening, concise communication, empathy, accountability, and problem-solving maturity."
        )
    },
    {
        "topic": "Generative AI & LLM Systems",
        "keywords": "genai llm prompt engineering rag embeddings hallucinations fine-tuning tokens hugging face",
        "text": (
            "Generative AI interviews focus on Large Language Models (LLMs), prompt engineering strategies "
            "(few-shot, chain-of-thought), Retrieval-Augmented Generation (RAG) architectures, tokenization, "
            "mitigating hallucinations with ground truth documents, temperature/top-p decoding parameters, "
            "vector similarity metrics (cosine similarity), and model evaluation metrics."
        )
    }
]

# Pre-compile corpus for TF-IDF
_CORPUS = [f"{item['topic']} {item['keywords']} {item['text']}" for item in INTERVIEW_KNOWLEDGE_BASE]
_VECTORIZER = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
_TFIDF_MATRIX = _VECTORIZER.fit_transform(_CORPUS)


def retrieve_context(query: str, top_k: int = 3, min_score: float = 0.05) -> List[Dict[str, Any]]:
    """
    Retrieve the most relevant knowledge base chunks for a query using TF-IDF and cosine similarity.
    Returns a list of dicts with topic, text, and similarity score.
    """
    if not query or not query.strip():
        return []

    try:
        query_vec = _VECTORIZER.transform([query])
        similarities = cosine_similarity(query_vec, _TFIDF_MATRIX)[0]

        ranked_indices = similarities.argsort()[::-1]
        results = []
        for idx in ranked_indices:
            score = float(similarities[idx])
            if score >= min_score:
                kb_entry = INTERVIEW_KNOWLEDGE_BASE[idx]
                results.append({
                    "topic": kb_entry["topic"],
                    "text": kb_entry["text"],
                    "score": round(score, 4)
                })
            if len(results) >= top_k:
                break

        # If no result passed min_score, return the single highest score if > 0
        if not results and len(ranked_indices) > 0 and similarities[ranked_indices[0]] > 0:
            top_idx = ranked_indices[0]
            kb_entry = INTERVIEW_KNOWLEDGE_BASE[top_idx]
            results.append({
                "topic": kb_entry["topic"],
                "text": kb_entry["text"],
                "score": round(float(similarities[top_idx]), 4)
            })

        return results
    except Exception as e:
        # Fallback cleanly without breaking the caller
        return []
