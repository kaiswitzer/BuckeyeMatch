# app.py
# The Flask application entry point.
# This file creates the app, loads config, initializes the database,
# and registers all route blueprints.
#
# A "blueprint" in Flask is like a Java package of related endpoints —
# it lets you split routes across multiple files instead of one giant file.

from flask import Flask
from flask_cors import CORS
from config import Config
from models import db
from sqlalchemy import inspect, text

def create_app():
    app = Flask(__name__)

    # Load all settings from config.py (which reads from .env)
    app.config.from_object(Config)

    # Allow the React frontend (running on port 5173) to talk to this server.
    # Without this, the browser blocks cross-origin requests — like a firewall rule.
    CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173", 
    "https://buckeyematch.onrender.com"
]}})

    # Connect SQLAlchemy to the app and create all tables if they don't exist.
    # db.init_app() is like injecting the app context into the database layer.
    db.init_app(app)

    with app.app_context():
        # Import all models so SQLAlchemy knows about them before creating tables
        from models.user import User
        from models.student import StudentProfile, StudentTarget, SurveyResponse
        from models.alumni import AlumniProfile, AlumniHistory
        from models.match import Match, Message, Milestone, MatchRating

        # Creates all tables in the database if they don't already exist.
        # Safe to run every time — won't overwrite existing data.
        db.create_all()

        # Lightweight migration for v1 admin flag.
        # SQLAlchemy won't add columns automatically; this keeps existing DBs working.
        try:
            insp = inspect(db.engine)
            cols = {c['name'] for c in insp.get_columns('users')}
            if 'is_admin' not in cols:
                db.session.execute(text('ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE'))
                db.session.commit()
        except Exception:
            # If this fails (e.g., permissions), the app can still run; admin features will require migration.
            db.session.rollback()

        # Register route blueprints — we'll add more as we build each feature
        from routes.auth import auth_bp
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        from routes.profiles import profiles_bp
        app.register_blueprint(profiles_bp, url_prefix='/api/profiles')
        from routes.matches import matches_bp
        app.register_blueprint(matches_bp, url_prefix='/api/matches')
        from routes.messages import messages_bp
        app.register_blueprint(messages_bp, url_prefix='/api/messages')
        from routes.milestones import milestones_bp
        app.register_blueprint(milestones_bp, url_prefix='/api/milestones')

        from routes.admin import admin_bp
        app.register_blueprint(admin_bp, url_prefix='/api/admin')

    return app


# Create the app instance at the top level so Gunicorn can find it
app = create_app()

if __name__ == '__main__':
    # This block still allows you to run locally with 'python app.py'
    app.run(debug=True, port=5001)