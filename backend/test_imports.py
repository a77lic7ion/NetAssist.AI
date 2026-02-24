try:
    import fastapi
    import uvicorn
    import sqlalchemy
    import aiosqlite
    import pydantic
    import networkx
    import ciscoconfparse2
    import textfsm
    import ntc_templates
    import paramiko
    import keyring
    import httpx
    import python_multipart
    import jinja2
    print("Imports successful")
except ImportError as e:
    print(f"Import failed: {e}")
