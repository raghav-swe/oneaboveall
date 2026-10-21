"""OAA LLM factory — per-node model routing + lazy, mock-aware clients.

Quad-model routing (ARCHITECTURE.md §2 / CONTEXT.md §2):

    Node 2 (Forensics)  llama-3.3-70b-versatile
                        (backup: meta-llama/llama-4-scout-17b-16e-instruct)   [Groq]
    Node 3 (FinOps)     openai/gpt-oss-120b                                   [Groq]
    Node 4 (Arbiter)    gemini-2.5-flash (temperature=0.0)                    [Google]
    Node 8 (GitOps PR)  qwen/qwen3-32b (fallback: gemini-2.5-flash)          [Groq/Google]
    Node 9 (Reporting)  gemini-2.5-flash                                      [Google]

Clients are *lazy*: the langchain constructors (`ChatGroq`,
`ChatGoogleGenerativeAI`) run only when a getter is called, and the graph never
calls them under `MOCK_ENV=true` (Locked Decision 6). In live mode a missing
API key raises an explicit, actionable error.
"""

from app.core.config import get_settings

# --------------------------------------------------------------------------- #
# Per-node model constants (ARCHITECTURE §2)                                   #
# --------------------------------------------------------------------------- #

FORENSICS_PRIMARY = "llama-3.3-70b-versatile"
FORENSICS_BACKUP = "meta-llama/llama-4-scout-17b-16e-instruct"
FINOPS = "openai/gpt-oss-120b"
ARBITER = "gemini-2.5-flash"
ARBITER_TEMPERATURE = 0.0
GITOPS = "qwen/qwen3-32b"
GITOPS_FALLBACK = "gemini-2.5-flash"
REPORTING = "gemini-2.5-flash"


# --------------------------------------------------------------------------- #
# Lazy constructors (never instantiated under MOCK_ENV=true)                   #
# --------------------------------------------------------------------------- #

def _ensure_live(provider: str) -> None:
    if get_settings().mock_env:
        raise RuntimeError(
            f"{provider} LLM client is dormant under MOCK_ENV=true — "
            "graph nodes read scenarios.json fixtures instead of LLM clients "
            "(Locked Decision 6)."
        )


def _require_key(env_var: str, settings_attr: str) -> str:
    key = getattr(get_settings(), settings_attr)
    if not key:
        raise RuntimeError(
            f"{env_var} is not set. Live mode (MOCK_ENV=false) requires this API key. "
            f"Set {env_var} in the root .env (see .env.example) or export it, "
            "or keep MOCK_ENV=true for the offline mock build."
        )
    return key


def _groq_client(model: str, temperature: float = 0.0):
    _ensure_live("Groq")
    key = _require_key("GROQ_API_KEY", "groq_api_key")
    from langchain_groq import ChatGroq  # lazy import

    return ChatGroq(model_name=model, groq_api_key=key, temperature=temperature)


def _gemini_client(model: str, temperature: float = 0.0):
    _ensure_live("Google")
    key = _require_key("GOOGLE_API_KEY", "google_api_key")
    from langchain_google_genai import ChatGoogleGenerativeAI  # lazy import

    return ChatGoogleGenerativeAI(model=model, google_api_key=key, temperature=temperature)


# --------------------------------------------------------------------------- #
# Per-node role getters                                                        #
# --------------------------------------------------------------------------- #

def get_forensics_llm():
    """Node 2 primary: llama-3.3-70b-versatile on Groq."""
    return _groq_client(FORENSICS_PRIMARY)


def get_forensics_backup_llm():
    """Node 2 backup: meta-llama/llama-4-scout-17b-16e-instruct on Groq."""
    return _groq_client(FORENSICS_BACKUP)


def get_finops_llm():
    """Node 3: openai/gpt-oss-120b on Groq."""
    return _groq_client(FINOPS)


def get_arbiter_llm():
    """Node 4: gemini-2.5-flash, temperature=0.0 (deterministic consensus)."""
    return _gemini_client(ARBITER, temperature=ARBITER_TEMPERATURE)


def get_gitops_llm():
    """Node 8 primary: qwen/qwen3-32b on Groq."""
    return _groq_client(GITOPS)


def get_gitops_fallback_llm():
    """Node 8 fallback: gemini-2.5-flash."""
    return _gemini_client(GITOPS_FALLBACK)


def get_reporting_llm():
    """Node 9: gemini-2.5-flash (post-mortem markdown formatting)."""
    return _gemini_client(REPORTING)
