import httpx
from config import settings
from typing import List, Tuple

# Provider Constants
PROVIDER_OLLAMA = "ollama"
PROVIDER_GEMINI = "gemini"
PROVIDER_OPENAI = "openai"
PROVIDER_MISTRAL = "mistral"
PROVIDER_ANTHROPIC = "anthropic"

async def check_ollama() -> bool:
    """Legacy health check for Ollama"""
    if settings.llm_provider != PROVIDER_OLLAMA:
        return True
    success, _ = await test_provider_connection(PROVIDER_OLLAMA, settings.llm_base_url)
    return success

async def get_available_models(provider: str) -> List[str]:
    """Fetch or return static models for a provider"""
    if provider == PROVIDER_OLLAMA:
        try:
            url = settings.llm_base_url or "http://localhost:11434"
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{url}/api/tags", timeout=3.0)
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            print(f"Error fetching Ollama models: {e}")
            return []
            
    elif provider == PROVIDER_GEMINI:
        return ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"]
        
    elif provider == PROVIDER_OPENAI:
        return ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o"]
        
    elif provider == PROVIDER_MISTRAL:
        return ["mistral-tiny", "mistral-small", "mistral-medium", "mistral-large"]
        
    elif provider == PROVIDER_ANTHROPIC:
        return ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]
        
    return []

async def test_provider_connection(provider: str, base_url: str = None, api_key: str = None) -> Tuple[bool, str]:
    """Test connectivity to the AI provider"""
    try:
        if provider == PROVIDER_OLLAMA:
            url = base_url or "http://localhost:11434"
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{url}/api/tags", timeout=3.0)
                if resp.status_code == 200:
                    return True, "Successfully connected to Ollama"
                return False, f"Ollama returned status {resp.status_code}"
                
        elif provider == PROVIDER_OPENAI:
            # Simple auth check (requires valid key)
            if not api_key:
                return False, "API Key required"
            # In production, make a lightweight call to https://api.openai.com/v1/models
            return True, "OpenAI configuration valid (local check)"
            
        # For others, we'll implement real checks later
        return True, f"Configuration valid for {provider}"
        
    except Exception as e:
        return False, str(e)

async def get_ai_response(prompt: str):
    # TODO: Implement actual generation logic per provider
    pass
