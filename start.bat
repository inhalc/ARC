@echo off
setlocal
pushd %~dp0

echo Starting backend (uvicorn on port 8000)...
start "ARC-backend" cmd /c "python -m uvicorn paper_agent.api:app --host 0.0.0.0 --port 8000 --app-dir src"

echo Starting front proxy (port 3000)...
start "ARC-proxy" cmd /c "python -m uvicorn scripts.front_proxy:app --host 0.0.0.0 --port 3000"

echo Launching complete. Visit http://localhost:3000/
popd
endlocal
