#!/usr/bin/env bash
# Render Start Script — arranca gunicorn en producción
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
