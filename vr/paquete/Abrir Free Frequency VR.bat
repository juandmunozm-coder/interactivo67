@echo off
rem Abre Free Frequency VR en el navegador (Windows). No hay que instalar nada.
rem Importante: primero descomprime el ZIP (clic derecho > Extraer todo) y luego haz doble clic en este archivo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
