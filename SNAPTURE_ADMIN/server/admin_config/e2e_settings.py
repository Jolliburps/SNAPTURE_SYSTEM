from .settings import *  # noqa: F403

LOCAL.mkdir(parents=True, exist_ok=True)
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': LOCAL / 'e2e.sqlite3'}}
MEDIA_ROOT = LOCAL / 'e2e-media'
EMAIL_FILE_PATH = LOCAL / 'e2e-mail'
SESSION_COOKIE_NAME = 'snapture_cesd_e2e'
ADMIN_WEB_URL = 'http://127.0.0.1:5174'
CSRF_TRUSTED_ORIGINS = ['http://127.0.0.1:5174']
