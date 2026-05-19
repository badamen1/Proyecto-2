#!/usr/bin/env bash
# Render Build Script — se ejecuta en cada deploy
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python manage.py create_default_admin
