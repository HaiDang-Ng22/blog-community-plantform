@echo off
set ASPNETCORE_ENVIRONMENT=Development
cd /d E:\Project\Social\Blog.API
start "" /b "E:\Project\Social\Blog.API\bin\Debug\net9.0\Blog.API.exe" --urls http://localhost:7000 1>"E:\Project\Social\.codex-runtime\api.out.log" 2>"E:\Project\Social\.codex-runtime\api.err.log"
