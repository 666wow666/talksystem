@echo off
chcp 65001 >nul
title CloudPolice 启动器

echo.
echo ========================================
echo   CloudPolice 智能审讯系统
echo ========================================
echo.

echo [1/3] 检查依赖安装...

if exist "node_modules" (
    echo       依赖已存在，跳过安装
) else (
    echo       正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] npm install 安装失败！
        echo 请检查网络连接或 npm 配置
        echo.
        pause
        exit /b 1
    )
    echo       依赖安装完成
)

echo.
echo [2/3] 正在启动服务...
echo       服务地址: http://localhost:5000
echo.

:: 启动服务并等待
start "CloudPolice 服务" cmd /k "npm start"

:: 等待服务启动
echo       正在等待服务启动...
timeout /t 5 /nobreak >nul

:: 检查服务是否启动
set /a retries=0
:check_service
set /a retries+=1
if %retries% GTR 12 (
    echo.
    echo [错误] 服务启动失败！
    echo 请检查端口 5000 是否被占用，或查看终端错误信息
    echo.
    echo 常见解决方法：
    echo   1. 检查端口: netstat -ano ^| findstr 5000
    echo   2. 关闭占用程序或修改 .env 中的 PORT
    echo   3. 检查 .env 配置文件
    echo.
    pause
    exit /b 1
)

curl -s -o nul -w "%%{http_code}" http://localhost:5000 >temp.txt 2>nul
set /p status=<temp.txt
del temp.txt

if "%status%"=="200" (
    goto service_ready
) else (
    echo       等待中... (%retries%/12)
    timeout /t 2 /nobreak >nul
    goto check_service
)

:service_ready
echo.
echo [3/3] 服务启动成功！
echo.
echo ========================================
echo   服务已就绪！
echo   访问地址: http://localhost:5000
echo ========================================
echo.
echo 正在打开浏览器...
start http://localhost:5000

echo.
echo 提示：关闭此窗口不会停止服务
echo 如需停止服务，请在 "CloudPolice 服务" 窗口中按 Ctrl+C
echo.
pause
