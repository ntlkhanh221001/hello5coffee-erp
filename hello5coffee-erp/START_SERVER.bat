@echo off
echo ========================================
echo    Hello 5 Coffee ERP - Dang khoi dong
echo ========================================
echo.
echo Server dang chay tai: http://localhost:8080/dashboard.html
echo De dung server: nhan Ctrl+C
echo.
start "" "http://localhost:8080/dashboard.html"
python -m http.server 8080
pause
