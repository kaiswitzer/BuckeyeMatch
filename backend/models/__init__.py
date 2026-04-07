# models/__init__.py
# This file makes the models folder a Python module.
# It also creates the single shared SQLAlchemy instance (db) that every
# model class will use. Think of db like a shared database connection pool.

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()