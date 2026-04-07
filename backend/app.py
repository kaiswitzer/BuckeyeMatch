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

def create_app():
    app = Flask(__name__)

    # Load all settings from config.py (which reads from .env)
    app.config.from_object(Config)

    # Allow the React frontend (running on port 5173) to talk to this server.
    # Without this, the browser blocks cross-origin requests — like a firewall rule.
    CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173", 
    "https://buckeyematch-frontend.onrender.com"
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

    return app


# This block only runs when you execute app.py directly (python app.py).
# It won't run if another file imports create_app — same as Java's main() pattern.
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5001)