# SNAPTURE Django backend

This is the local Python backend for the standalone SNAPTURE Android client.
It uses Django 5.2, the built-in SQLite database for local development, and
the existing TensorFlow model in `../SNAPTURE_ML`.

## Start locally

Run these commands from `SNAPTURE_BACKEND`:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_BACKEND"
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py migrate
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
```

Create an administrator for the Django admin site:

```powershell
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py createsuperuser
```

Open `http://127.0.0.1:8000/admin/` on the computer. A phone on the same
Wi-Fi uses the computer's LAN IPv4 address instead of `127.0.0.1`.

## Switch to MySQL

SQLite is still the default until a MySQL server is installed and configured.
After creating a MySQL database and user, run the migration helper from this
folder:

```powershell
.\scripts\migrate_sqlite_to_mysql.ps1 -MysqlDatabase snapture -MysqlUser snapture
```

The helper exports the current SQLite records, runs Django migrations on
MySQL, and imports the records. It does not delete `db.sqlite3`. To use
MySQL after the migration, set `SNAPTURE_DB_ENGINE=mysql` and the `MYSQL_*`
variables from `.env.example` before starting Django.

## API modules

```text
GET  /api/health/
GET  /api/materials/
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/password-reset/request/
POST /api/auth/password-reset/confirm/
POST /api/auth/logout/
GET  /api/auth/me/
PATCH /api/auth/me/                 optional display name and barangay
POST /api/auth/me/photo/           authenticated multipart image, max 5 MB
GET  /api/projects/                started projects for current user
POST /api/projects/                start selected scan recommendation
PATCH /api/projects/<id>/steps/<index>/  mark text step complete/incomplete
GET  /api/auth/admin/overview/    administrator only
GET  /api/predictions/
GET  /api/predictions/saved/       all selected recommendations for current user
POST /api/predictions/create/      multipart image; optional context fields
GET  /api/predictions/<id>/
PATCH /api/predictions/<id>/       optional context and recommendation refresh
POST /api/predictions/<id>/recommendation/
GET  /api/predictions/questions/<label>/
GET  /api/datasets/counts/         administrator only
POST /api/datasets/upload/         administrator only
```

Dataset uploads are accepted only for the seven approved labels and are kept
pending until an administrator reviews them. Invalid, unreadable, tiny, or
oversized images are rejected. After review, export verified images into the
training folders:

```powershell
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py export_verified_dataset
```

The mobile client receives a bearer token after registration or login. The
server stores only a SHA-256 hash of each token. The in-app administrator
dashboard uses the same token and the protected overview endpoint. Django
Admin remains available for detailed user, prediction, and dataset management.

For local development (`DEBUG=True`), the password-reset request returns a
single-use reset token so the mobile app can complete the flow without an
email provider. In a production deployment, configure email delivery and do
not expose reset tokens in API responses.

## Current limitation

The existing trained model is still the six-class TrashNet baseline. Generic
`plastic` and `metal` outputs are marked **Needs verification**. The backend is
ready for the seven scope categories, but a category must have verified images
before a scope model is trained. Safety and reuse guidance is educational
decision support; it is not a chemical, microbial, structural, or food-contact
safety certification.

Project records snapshot the selected recommendation's existing text steps
when the user starts it. A saved scan alone is not an active project. Completion
and percentage are derived from stored completed steps. There is no admin
announcement API or finalized ML recommendation model yet.
The prediction list includes a total_count alongside its latest 50 entries,
so profile statistics show the actual scan count.
