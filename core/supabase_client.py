"""Supabase client — two keys for two purposes.

- get_supabase()     → anon key, for normal reads/writes (same permissions as the frontend)
- get_admin_client() → service_role key, for schema changes, admin operations
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()           # anon
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY", "").strip()   # service_role

_client: Client | None = None
_admin: Client | None = None


def get_supabase() -> Client:
    """Normal client (anon key) — same access as the frontend."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_admin_client() -> Client:
    """Admin client (service_role key) — full access, use for schema changes only."""
    global _admin
    if _admin is None:
        if not SUPABASE_URL or not SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env")
        _admin = create_client(SUPABASE_URL, SERVICE_KEY)
    return _admin
