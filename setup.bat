@echo off
setlocal
pushd %~dp0

echo [1/3] Upgrading pip...
python -m pip install --upgrade pip

echo [2/3] Installing Python dependencies...
python -m pip install -r requirements.txt

echo [3/3] Installing frontend dependencies and building...
cd frontend
npm install
npm run build
cd ..

echo Done. You can now run start.bat to launch backend + proxy.
popd
endlocal
