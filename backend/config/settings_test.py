"""
Test settings — usa SQLite en memoria para evitar dependencia de PostgreSQL
en entornos de CI o desarrollo local sin BD disponible.
"""
from .settings import *  # noqa: F401, F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
