"""Compatibility entry point for the admin scripts and isolated browser tests."""
from config.settings import *  # noqa: F403

# Only browser-test settings override database/media; normal scripts share the API.
LOCAL = BASE_DIR.parent / "SNAPTURE_ADMIN" / ".local"
