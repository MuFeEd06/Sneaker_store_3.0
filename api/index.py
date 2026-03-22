# api/index.py — Vercel serverless entry point
# This file must live in the /api folder.
# It simply imports the Flask app from app.py in the root.

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app

# Vercel looks for a variable named `app`
# Flask app is already named `app` — nothing else needed.
