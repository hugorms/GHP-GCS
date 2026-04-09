"""Conftest for unit tests that don't need Django/Celery set up.

_SocialCaseParser is a pure Python class using html.parser only.
We load it by directly importing the source file with importlib, bypassing
the Django / Celery package initialisation that would normally run.
"""
import sys
import types
import importlib.util
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# 1. Stub every heavy dependency so that issue.py can be loaded as a module
#    without a live Django / Celery environment.
# ---------------------------------------------------------------------------
_STUB_MODULES = [
    "celery",
    "celery.schedules",
    "django",
    "django.conf",
    "django.contrib",
    "django.contrib.postgres",
    "django.contrib.postgres.fields",
    "django.core",
    "django.core.exceptions",
    "django.core.validators",
    "django.db",
    "django.db.models",
    "django.db.models.signals",
    "django.utils",
    "django.utils.timezone",
    "plane.utils",
    "plane.utils.html_processor",
    "plane.utils.exception_logger",
    "plane.utils.uuid",
    "plane.db",
    "plane.db.mixins",
]
for _mod in _STUB_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# Django apps mock needs a special 'get_model' attribute
sys.modules["django"].apps = MagicMock()

# ---------------------------------------------------------------------------
# 2. Create a minimal `plane` package stub so sub-module imports work.
# ---------------------------------------------------------------------------
_plane = types.ModuleType("plane")
_plane.__path__ = []
sys.modules["plane"] = _plane

# ---------------------------------------------------------------------------
# 3. Load plane/db/models/issue.py directly via importlib so we get
#    _SocialCaseParser without triggering plane/__init__.py → celery.
# ---------------------------------------------------------------------------
import os as _os

_issue_path = _os.path.join(
    _os.path.dirname(__file__),
    "..", "plane", "db", "models", "issue.py"
)
_issue_path = _os.path.abspath(_issue_path)

_spec = importlib.util.spec_from_file_location("plane.db.models.issue", _issue_path)
_issue_mod = importlib.util.module_from_spec(_spec)
sys.modules["plane.db.models.issue"] = _issue_mod

try:
    _spec.loader.exec_module(_issue_mod)
except Exception:
    # The module will fail after _SocialCaseParser is defined because
    # later imports (SoftDeletionManager etc.) hit stubs — that's fine.
    pass
