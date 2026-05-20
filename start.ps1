# 安装依赖
Write-Host "downloading....."
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install fail" -ForegroundColor Red
    exit 1
}

# 启动服务
Write-Host "starting"
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm start'

# 等待服务启动
Start-Sleep -Seconds 5

# 打开浏览器
Write-Host "正在打开 http://localhost:5000 ..."
Start-Process "http://localhost:5000"