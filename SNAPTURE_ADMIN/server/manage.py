"""Run the existing Django project with the folder-contained CESD extension."""
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # Imported backend modules remain read-only.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'SNAPTURE_BACKEND'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin_config.settings')

if __name__ == '__main__':
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
