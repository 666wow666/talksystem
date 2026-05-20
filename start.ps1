# CloudPolice 启动脚本
# 功能：自动安装依赖、启动服务、打开浏览器

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CloudPolice 智能审讯系统启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "[1/3] 正在检查依赖安装..." -ForegroundColor Yellow

# 检查 node_modules 是否存在
if (Test-Path "node_modules") {
    Write-Host "      依赖已存在，跳过安装" -ForegroundColor Green
} else {
    Write-Host "      正在安装依赖，请稍候..." -ForegroundColor Yellow
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[错误] npm install 安装失败！" -ForegroundColor Red
        Write-Host "请检查网络连接或 npm 配置" -ForegroundColor Red
        Write-Host ""
        Read-Host "按回车键退出"
        exit 1
    }
    Write-Host "      依赖安装完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/3] 正在启动服务..." -ForegroundColor Yellow
Write-Host "      服务地址: http://localhost:5000" -ForegroundColor Gray
Write-Host ""

# 启动 npm start 并在后台运行
$npmProcess = Start-Process -FilePath "npm" -ArgumentList "start" -NoNewWindow -PassThru -WindowStyle Normal

# 等待服务启动
Write-Host "      正在等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查服务是否成功启动
$maxRetries = 12
$retryCount = 0
$serviceReady = $false

while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serviceReady = $true
            break
        }
    } catch {
        # 继续等待
    }
    
    $retryCount++
    Write-Host "      等待中... ($retryCount/$maxRetries)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if ($serviceReady) {
    Write-Host ""
    Write-Host "[3/3] 服务启动成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  服务已就绪！" -ForegroundColor Cyan
    Write-Host "  访问地址: http://localhost:5000" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 自动打开浏览器
    Write-Host "正在打开浏览器..." -ForegroundColor Yellow
    Start-Process -FilePath "http://localhost:5000"
    
    Write-Host ""
    Write-Host "提示：" -ForegroundColor Yellow -NoNewline
    Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Gray
    Write-Host ""
    
    # 等待服务进程结束
    $npmProcess.WaitForExit()
} else {
    Write-Host ""
    Write-Host "[错误] 服务启动失败！" -ForegroundColor Red
    Write-Host "请检查端口 5000 是否被占用，或查看终端错误信息" -ForegroundColor Red
    Write-Host ""
    Write-Host "常见解决方法：" -ForegroundColor Yellow
    Write-Host "  1. 检查端口: netstat -ano | findstr 5000" -ForegroundColor Gray
    Write-Host "  2. 关闭占用程序或修改 .env 中的 PORT" -ForegroundColor Gray
    Write-Host "  3. 检查 .env 配置文件" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}
