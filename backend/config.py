# config.py
# Reads environment variables from .env and makes them available to the Flask app.
# Think of this like a Java Properties or @Configuration class — one place that
# holds all app-wide settings so nothing is hardcoded elsewhere.

import os
from dotenv import load_dotenv

# Load the .env file so os.environ can read it
load_dotenv()

class Config:
    # Secret key used to sign JWT login tokens — never hardcode this
    SECRET_KEY = os.environ.get('SECRET_KEY', 'fallback-dev-key')

    # SQLAlchemy database connection string
    # sqlite:///buckeye_match.db creates a file called buckeye_match.db
    # inside the backend folder when the app first runs
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///buckeye_match.db')

    # Disables a SQLAlchemy feature we don't need (saves memory)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Email settings for OSU verification emails
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')