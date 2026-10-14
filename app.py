import os
import json
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-development-secret-before-deploying")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

DATABASE_URL = os.getenv("DATABASE_URL", "")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "abisiva")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "abisiva_19")

EMPTY_STATE = {"teams": [], "employees": [], "tasks": [], "links": [], "link_categories": ["GitHub", "YouTube", "Google Drive", "Google Docs", "Other"]}

def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is missing. Copy .env.example to .env and configure PostgreSQL.")
    return psycopg2.connect(DATABASE_URL, sslmode=os.getenv("DB_SSLMODE", "prefer"))

def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS tlms_state (
                id INTEGER PRIMARY KEY CHECK (id = 1), payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
            cur.execute("""CREATE TABLE IF NOT EXISTS tlms_users (
                id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','employee')),
                employee_id TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
            cur.execute("SELECT id FROM tlms_state WHERE id=1")
            if not cur.fetchone():
                cur.execute("INSERT INTO tlms_state (id,payload) VALUES (1,%s)", (Json(EMPTY_STATE),))
            cur.execute("SELECT id FROM tlms_users WHERE role='admin' LIMIT 1")
            if not cur.fetchone():
                cur.execute("INSERT INTO tlms_users (username,password_hash,role) VALUES (%s,%s,'admin')",
                            (ADMIN_USERNAME, generate_password_hash(ADMIN_PASSWORD)))
            conn.commit()

def read_state():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT payload FROM tlms_state WHERE id=1")
            row = cur.fetchone()
    state = row["payload"] if row else dict(EMPTY_STATE)
    for key, default in EMPTY_STATE.items():
        state.setdefault(key, default.copy() if isinstance(default, list) else default)
    # Passwords are never sent back to the browser.
    state["employees"] = [{k:v for k,v in emp.items() if k != "password"} for emp in state.get("employees", [])]
    return state

def require_role(role):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if session.get("role") != role:
                if request.path.startswith('/api/'):
                    return jsonify({"message":"Please sign in again."}), 401
                return redirect(url_for('index'))
            return fn(*args, **kwargs)
        return wrapped
    return decorator

@app.before_request
def ensure_database():
    # Initialize tables on first request; safe to call repeatedly for this small app.
    if request.endpoint not in ("static",):
        try:
            init_db()
        except Exception as exc:
            if request.path.startswith('/api/'):
                return jsonify({"message": f"Database is not ready: {exc}"}), 503
            return ("Database is not ready. Configure PostgreSQL using SETUP.md. Details: " + str(exc), 503)

@app.get('/')
def index():
    return render_template('index.html', initial_state=read_state())

@app.get('/admin')
@require_role('admin')
def admin_page():
    return render_template('admin.html', initial_state=read_state())

@app.get('/employee')
@require_role('employee')
def employee_page():
    return render_template('employee.html', initial_state=read_state())

@app.get('/admin.html')
def admin_html_alias(): return redirect(url_for('admin_page'))

@app.get('/employee.html')
def employee_html_alias(): return redirect(url_for('employee_page'))

@app.get('/admin-login.html')
def admin_login_alias(): return redirect(url_for('index'))
@app.get('/employee-login.html')
def employee_login_alias(): return redirect(url_for('index'))

@app.post('/api/login')
def login():
    body = request.get_json(silent=True) or {}
    username = str(body.get('username','')).strip()
    password = str(body.get('password',''))
    if not username or not password:
        return jsonify({"message":"Enter your username and password."}), 400
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tlms_users WHERE LOWER(username)=LOWER(%s) AND active=TRUE ORDER BY id LIMIT 1", (username,))
            user = cur.fetchone()
            if user and check_password_hash(user['password_hash'], password):
                session.clear(); session['role'] = user['role']; session['user_id'] = user['id']
                if user['role'] == 'employee': session['employee_id'] = user['employee_id']
                return jsonify({"role":user['role'], "employee_id":user.get('employee_id')})
    return jsonify({"message":"Invalid username or password."}), 401

@app.post('/api/logout')
def api_logout():
    session.clear(); return jsonify({"ok":True})

@app.get('/api/state')
@require_role('admin')
def api_get_state(): return jsonify(read_state())

@app.put('/api/state')
@require_role('admin')
def api_save_state():
    incoming = request.get_json(silent=True)
    if not isinstance(incoming, dict): return jsonify({"message":"Expected a JSON object."}), 400
    state = {}
    for key, default in EMPTY_STATE.items():
        value = incoming.get(key, default)
        if not isinstance(value, list): return jsonify({"message":f"{key} must be a list."}), 400
        state[key] = value
    # Sync employee accounts to the users table. Only newly provided passwords are hashed.
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for emp in state['employees']:
                username = str(emp.get('username') or emp.get('userId') or '').strip()
                employee_id = str(emp.get('id',''))
                password = str(emp.get('password') or '')
                if not username: continue
                cur.execute("SELECT id FROM tlms_users WHERE role='employee' AND employee_id=%s", (employee_id,))
                existing = cur.fetchone()
                if existing:
                    if password:
                        cur.execute("UPDATE tlms_users SET username=%s,password_hash=%s,active=TRUE WHERE id=%s",
                                    (username, generate_password_hash(password), existing['id']))
                    else:
                        cur.execute("UPDATE tlms_users SET username=%s,active=TRUE WHERE id=%s", (username, existing['id']))
                elif password:
                    cur.execute("INSERT INTO tlms_users (username,password_hash,role,employee_id) VALUES (%s,%s,'employee',%s) ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, employee_id=EXCLUDED.employee_id, active=TRUE",
                                (username, generate_password_hash(password), employee_id))
            active_ids = [str(e.get('id','')) for e in state['employees']]
            cur.execute("SELECT id,employee_id FROM tlms_users WHERE role='employee'")
            for row in cur.fetchall():
                if str(row['employee_id']) not in active_ids:
                    cur.execute("UPDATE tlms_users SET active=FALSE WHERE id=%s", (row['id'],))
            safe_state = json.loads(json.dumps(state))
            for emp in safe_state['employees']:
                emp.pop('password', None)
            cur.execute("UPDATE tlms_state SET payload=%s,updated_at=NOW() WHERE id=1", (Json(safe_state),))
        conn.commit()
    return jsonify({"ok":True})

@app.get('/health')
def health():
    with get_conn() as conn:
        with conn.cursor() as cur: cur.execute('SELECT 1')
    return jsonify({"status":"ok", "database":"connected"})

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG','false').lower() == 'true')
