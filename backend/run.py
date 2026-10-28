"""Start Iris International:  .\.venv\Scripts\python.exe run.py  -> http://localhost:8020"""
import uvicorn

from app.config import load_settings

if __name__ == "__main__":
    s = load_settings()
    uvicorn.run("app.main:app", host=s.server_host, port=s.server_port)
