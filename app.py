#!/usr/bin/env python3
"""
Scholar's Home - AI-Powered Academic Research Tracker & Paper Summarizer
Flask Backend Application with Authentication & 3NF Multi-Tenant Data Isolation
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from functools import wraps
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
import pypdf
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("scholarshome")

# Initialize Flask App
app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)
app.secret_key = os.getenv("SECRET_KEY", "scholarshome-production-3nf-vault-key-2026")
CORS(app)

# Application Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB max file size
ALLOWED_EXTENSIONS = {"pdf"}

# Database Configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "scholarshome_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DATABASE_URL = os.getenv("DATABASE_URL")

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_db_connection():
    """
    Establish and return a connection to PostgreSQL.
    Uses DATABASE_URL if available, else individual connection parameters.
    """
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def init_db():
    """
    Execute schema.sql to ensure 3NF tables, columns, and indexes exist.
    """
    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
    if not os.path.exists(schema_path):
        logger.warning(f"schema.sql not found at {schema_path}")
        return

    try:
        conn = get_db_connection()
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            with conn.cursor() as cur:
                cur.execute(schema_sql)
            conn.commit()
            logger.info("Database schema & authentication columns verified successfully.")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error initializing database schema: {e}")
        finally:
            conn.close()
    except Exception as e:
        logger.warning(f"Could not connect to database on startup: {e}. Tables will initialize on first connection.")


def login_required(f):
    """
    Decorator to protect routes and API endpoints.
    Redirects HTML visitors to /welcome and returns 401 JSON to API clients.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required. Please log in."}), 401
            return redirect("/welcome")
        return f(*args, **kwargs)
    return decorated_function


def allowed_file(filename: str) -> bool:
    """Validate file extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract raw text from a PDF file using pypdf.
    Caps extracted characters to avoid token saturation while capturing comprehensive context.
    """
    extracted_text_blocks = []
    try:
        reader = pypdf.PdfReader(file_path)
        total_pages = len(reader.pages)
        char_count = 0
        max_chars = 40000

        for i, page in enumerate(reader.pages[:20]):
            text = page.extract_text() or ""
            extracted_text_blocks.append(text)
            char_count += len(text)
            if char_count >= max_chars:
                break

        full_text = "\n\n".join(extracted_text_blocks).strip()
        logger.info(f"Extracted {len(full_text)} characters from {total_pages} page(s) in {file_path}")
        return full_text
    except Exception as e:
        logger.error(f"Failed to extract text with pypdf: {e}")
        raise ValueError(f"Could not parse PDF content: {str(e)}")


def query_gemini_for_summary(extracted_text: str, fallback_title: str) -> Dict[str, Any]:
    """
    Query Google Gemini API (gemini-2.5-flash) using official google-genai SDK
    to generate structured JSON containing title, summary, and taxonomy tags.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    prompt = f"""You are a principal academic research assistant for "Scholar's Home".
Analyze the following extracted academic paper text.

Provide a high-quality synthesis with:
1. "title": The formal, complete research paper title (clean and formatted, avoid raw PDF artifacts).
2. "summary": A comprehensive, rigorous executive research summary (3-5 structured sentences highlighting: research question/hypothesis, core methodology, key findings, and scientific significance).
3. "tags": An array of 3 to 6 distinct, relevant domain/methodology tags (e.g. ["Machine Learning", "Transformers", "Computer Vision"]).

Extracted Paper Content:
\"\"\"
{extracted_text[:30000]}
\"\"\"
"""

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            json_schema = {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "summary": {"type": "STRING"},
                    "tags": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    }
                },
                "required": ["title", "summary", "tags"]
            }

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=json_schema,
                    temperature=0.2
                )
            )

            raw_response = response.text.strip()
            data = json.loads(raw_response)

            title = data.get("title") or fallback_title
            summary = data.get("summary") or "Summary generated from extracted manuscript."
            tags = [t.strip() for t in data.get("tags", []) if isinstance(t, str) and t.strip()]
            if not tags:
                tags = ["Academic Research", "Peer Review"]

            return {
                "title": title,
                "summary": summary,
                "tags": tags[:6]
            }

        except Exception as e:
            logger.warning(f"Gemini API request failed ({e}). Utilizing robust text heuristic fallback.")

    logger.info("Executing heuristic extraction fallback.")
    lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
    derived_title = fallback_title
    for line in lines[:8]:
        if len(line) > 12 and not line.lower().startswith("arxiv:") and not line.lower().startswith("issn"):
            derived_title = line
            break

    abstract_match = re.search(r'(?i)abstract[:\s]*(.*?)(?:\n\s*\n|introduction|1\.\s+introduction|keywords)', extracted_text, re.DOTALL)
    if abstract_match:
        derived_summary = abstract_match.group(1).strip()[:1000]
    else:
        derived_summary = (extracted_text[:800] + "...") if len(extracted_text) > 800 else extracted_text

    return {
        "title": derived_title,
        "summary": derived_summary if derived_summary else "Automated extract from uploaded document.",
        "tags": ["Academic Research", "PDF Extract", "Uncategorized"]
    }


# =============================================================================
# AUTHENTICATION API ENDPOINTS
# =============================================================================

@app.route("/welcome")
def welcome():
    """Serve the Welcome & Authentication (Sign in / Sign up) page."""
    if "user_id" in session:
        return redirect("/")
    return render_template("welcome.html")


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    """
    Register a new user account with email, password, and full name.
    Stores password hashed with PBKDF2:SHA256 in 3NF users table.
    """
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip() or "Academic Researcher"

    if not email or "@" not in email:
        return jsonify({"error": "A valid academic email address is required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check existing email
            cur.execute("SELECT user_id FROM users WHERE email = %s;", (email,))
            if cur.fetchone():
                return jsonify({"error": "An account with this email already exists. Please log in."}), 409

            # Insert user
            cur.execute("""
                INSERT INTO users (email, password_hash, full_name)
                VALUES (%s, %s, %s)
                RETURNING user_id, email, full_name, created_at;
            """, (email, password_hash, full_name))
            new_user = cur.fetchone()

        conn.commit()

        # Log user in
        session["user_id"] = new_user["user_id"]
        session["user_email"] = new_user["email"]
        session["user_name"] = new_user["full_name"]

        logger.info(f"New user registered: {email} (ID #{new_user['user_id']})")
        return jsonify({
            "message": "Account created successfully.",
            "user": {
                "user_id": new_user["user_id"],
                "email": new_user["email"],
                "full_name": new_user["full_name"]
            }
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Signup error: {e}")
        return jsonify({"error": f"Failed to create account: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """
    Authenticate an existing researcher with email and password.
    """
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Please provide both email and password."}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT user_id, email, password_hash, full_name
                FROM users
                WHERE email = %s;
            """, (email,))
            user = cur.fetchone()

        if not user:
            return jsonify({"error": "No account found with this email. Please check your spelling or sign up."}), 401

        # Check password hash (or handle legacy seed user without password_hash)
        stored_hash = user.get("password_hash")
        is_valid = False
        if stored_hash:
            is_valid = check_password_hash(stored_hash, password)
        elif password == "Password123!":
            # Auto-upgrade legacy seed user
            new_hash = generate_password_hash("Password123!", method="pbkdf2:sha256")
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET password_hash = %s WHERE user_id = %s;", (new_hash, user["user_id"]))
            conn.commit()
            is_valid = True

        if not is_valid:
            return jsonify({"error": "Incorrect password. Please verify and try again."}), 401

        # Establish session
        session["user_id"] = user["user_id"]
        session["user_email"] = user["email"]
        session["user_name"] = user.get("full_name") or "Academic Researcher"

        logger.info(f"User authenticated: {email} (ID #{user['user_id']})")
        return jsonify({
            "message": "Login successful.",
            "user": {
                "user_id": user["user_id"],
                "email": user["email"],
                "full_name": session["user_name"]
            }
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": f"Failed to authenticate: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/auth/logout", methods=["POST", "GET"])
def auth_logout():
    """Clear session and log user out."""
    user_id = session.get("user_id")
    session.clear()
    logger.info(f"User #{user_id} logged out.")
    if request.method == "GET":
        return redirect("/welcome")
    return jsonify({"message": "Logged out successfully."}), 200


def get_current_user_profile() -> dict:
    """Fetch current authenticated user profile from session or database."""
    user_id = session.get("user_id")
    if not user_id:
        return {}
    user_email = session.get("user_email")
    user_name = session.get("user_name")
    if not user_email:
        try:
            conn = get_db_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT email, full_name FROM users WHERE user_id = %s;", (user_id,))
                row = cur.fetchone()
                if row:
                    user_email = row["email"]
                    user_name = row["full_name"]
                    session["user_email"] = user_email
                    session["user_name"] = user_name
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to fetch user #{user_id}: {e}")

    return {
        "user_id": user_id,
        "email": user_email or "",
        "full_name": user_name or (user_email.split("@")[0] if user_email else "Scholar")
    }


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    """Return currently authenticated user profile."""
    if "user_id" in session:
        profile = get_current_user_profile()
        return jsonify({
            "authenticated": True,
            "user_id": profile["user_id"],
            "email": profile["email"],
            "full_name": profile["full_name"],
            "user": profile
        }), 200
    return jsonify({"authenticated": False}), 401


# =============================================================================
# PROTECTED UI PAGES (Stitch Project Screens)
# =============================================================================

@app.route("/")
@app.route("/feed")
@login_required
def index():
    """Serve Research Feed & Paper Tracker (Screen 1)."""
    return render_template("index.html", current_user=get_current_user_profile())


@app.route("/analyzer")
@login_required
def paper_analyzer():
    """Serve Paper Deep-Dive & AI Summarizer (Screen 4)."""
    return render_template("screen4.html", current_user=get_current_user_profile())


@app.route("/matrix")
@login_required
def synthesis_matrix():
    """Serve Literature Synthesis & Comparison Matrix (Screen 2)."""
    return render_template("screen2.html", current_user=get_current_user_profile())


@app.route("/graph")
@login_required
def citation_graph():
    """Serve Knowledge Graph & Citation Explorer (Screen 3)."""
    return render_template("screen3.html", current_user=get_current_user_profile())


@app.route("/health", methods=["GET"])
def health_check():
    """
    Basic health check verifying database and server connectivity.
    """
    db_status = "disconnected"
    db_error = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_error = str(e)
        logger.error(f"Health check DB error: {e}")

    gemini_configured = bool(os.getenv("GEMINI_API_KEY", "").strip())

    status_code = 200 if db_status == "connected" else 503
    return jsonify({
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "Scholar's Home API",
        "timestamp": datetime.utcnow().isoformat(),
        "database": {
            "status": db_status,
            "error": db_error
        },
        "ai_orchestration": {
            "model": GEMINI_MODEL,
            "api_key_configured": gemini_configured
        }
    }), status_code


# =============================================================================
# MULTI-TENANT USER-ISOLATED DATA API
# =============================================================================

@app.route("/api/upload-pdf", methods=["POST"])
@login_required
def upload_pdf():
    """
    Accepts a multipart PDF upload for the authenticated user.
    Extracts text via pypdf, synthesizes with Gemini 2.5 Flash,
    and isolates the paper to the current user's user_id in 3NF PostgreSQL.
    """
    current_user_id = session["user_id"]

    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF files are supported"}), 400

    original_filename = secure_filename(file.filename)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"user{current_user_id}_{timestamp}_{original_filename}"
    saved_file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)

    try:
        file.save(saved_file_path)
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        return jsonify({"error": "Failed to save file on server"}), 500

    try:
        extracted_text = extract_text_from_pdf(saved_file_path)
    except Exception as e:
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        return jsonify({"error": str(e)}), 422

    fallback_title = os.path.splitext(original_filename)[0].replace("_", " ").title()
    ai_result = query_gemini_for_summary(extracted_text, fallback_title)

    title = ai_result["title"]
    summary = ai_result["summary"]
    tags = ai_result["tags"]
    abstract_raw = extracted_text[:4000]

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Insert Paper isolated to current_user_id
            insert_paper_sql = """
                INSERT INTO papers (user_id, title, summary, abstract_raw, file_path)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING paper_id, uploaded_at;
            """
            cur.execute(
                insert_paper_sql,
                (current_user_id, title, summary, abstract_raw, unique_filename)
            )
            paper_data = cur.fetchone()
            paper_id = paper_data["paper_id"]
            uploaded_at = paper_data["uploaded_at"]

            # 2. Upsert Tags & Link via paper_tags Junction Table
            saved_tags = []
            for tag_name in tags:
                tag_name_clean = tag_name.strip()
                if not tag_name_clean:
                    continue

                upsert_tag_sql = """
                    INSERT INTO tags (tag_name)
                    VALUES (%s)
                    ON CONFLICT (tag_name) DO UPDATE SET tag_name = EXCLUDED.tag_name
                    RETURNING tag_id;
                """
                cur.execute(upsert_tag_sql, (tag_name_clean,))
                tag_id = cur.fetchone()["tag_id"]

                link_sql = """
                    INSERT INTO paper_tags (paper_id, tag_id)
                    VALUES (%s, %s)
                    ON CONFLICT (paper_id, tag_id) DO NOTHING;
                """
                cur.execute(link_sql, (paper_id, tag_id))
                saved_tags.append(tag_name_clean)

        conn.commit()
        logger.info(f"User #{current_user_id} saved paper ID {paper_id} with {len(saved_tags)} tags.")

        return jsonify({
            "paper_id": paper_id,
            "user_id": current_user_id,
            "title": title,
            "summary": summary,
            "abstract_raw": abstract_raw,
            "file_path": unique_filename,
            "uploaded_at": uploaded_at.isoformat() if hasattr(uploaded_at, "isoformat") else str(uploaded_at),
            "tags": saved_tags
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error during paper persistence: {e}")
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        return jsonify({"error": f"Failed to persist paper in database: {str(e)}"}), 500

    finally:
        if conn:
            conn.close()


@app.route("/api/papers", methods=["GET"])
@login_required
def get_papers():
    """
    Returns only the papers belonging to the authenticated researcher (user data isolation).
    """
    current_user_id = session["user_id"]
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT 
                    p.paper_id,
                    p.user_id,
                    p.title,
                    p.summary,
                    p.abstract_raw,
                    p.file_path,
                    p.uploaded_at,
                    COALESCE(
                        ARRAY_AGG(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL),
                        '{}'
                    ) AS tags
                FROM papers p
                LEFT JOIN paper_tags pt ON p.paper_id = pt.paper_id
                LEFT JOIN tags t ON pt.tag_id = t.tag_id
                WHERE p.user_id = %s
                GROUP BY p.paper_id
                ORDER BY p.uploaded_at DESC;
            """
            cur.execute(query, (current_user_id,))
            papers = cur.fetchall()

            for paper in papers:
                if paper.get("uploaded_at") and hasattr(paper["uploaded_at"], "isoformat"):
                    paper["uploaded_at"] = paper["uploaded_at"].isoformat()

            return jsonify(papers), 200

    except Exception as e:
        logger.error(f"Error fetching user's papers: {e}")
        return jsonify({"error": f"Failed to retrieve papers: {str(e)}"}), 500

    finally:
        if conn:
            conn.close()


@app.route("/api/papers/<int:paper_id>", methods=["DELETE"])
@login_required
def delete_paper(paper_id: int):
    """
    Deletes a paper belonging exclusively to the authenticated user.
    Prevents cross-tenant deletion anomalies.
    """
    current_user_id = session["user_id"]
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify paper exists and belongs to this user
            cur.execute("""
                SELECT file_path FROM papers
                WHERE paper_id = %s AND user_id = %s;
            """, (paper_id, current_user_id))
            paper = cur.fetchone()

            if not paper:
                return jsonify({"error": f"Paper #{paper_id} not found or you lack permission to delete it."}), 404

            file_path = paper.get("file_path")

            # Delete paper (cascade clears paper_tags)
            cur.execute("""
                DELETE FROM papers
                WHERE paper_id = %s AND user_id = %s;
            """, (paper_id, current_user_id))

        conn.commit()

        # Clean up binary file
        if file_path:
            full_disk_path = os.path.join(app.config["UPLOAD_FOLDER"], file_path)
            if os.path.exists(full_disk_path):
                try:
                    os.remove(full_disk_path)
                    logger.info(f"Removed physical file {full_disk_path}")
                except Exception as file_err:
                    logger.warning(f"Failed to remove physical file {full_disk_path}: {file_err}")

        logger.info(f"User #{current_user_id} deleted paper #{paper_id}.")
        return jsonify({
            "message": "Paper deleted successfully.",
            "paper_id": paper_id
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error deleting paper #{paper_id}: {e}")
        return jsonify({"error": f"Failed to delete paper: {str(e)}"}), 500

    finally:
        if conn:
            conn.close()


@app.route("/uploads/<path:filename>")
@login_required
def serve_upload(filename: str):
    """Serve uploaded PDF files for in-browser viewing."""
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# =============================================================================
# APPLICATION ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "5000"))
    logger.info(f"Starting Scholar's Home server on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
