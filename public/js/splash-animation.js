/* 开屏动画效果 */
(function() {
    // 创建 canvas 元素
    const canvas = document.createElement('canvas');
    canvas.id = 'splash-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 1s ease;';
    document.body.insertBefore(canvas, document.body.firstChild);
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    
    // 设置画布大小
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    // 粒子类
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 1.5;
            this.speedY = (Math.random() - 0.5) * 1.5;
            this.opacity = Math.random() * 0.4 + 0.15;
            this.hue = Math.random() * 40 + 200; // 柔和的蓝色到青色范围
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            // 边界检测
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            
            // 闪烁效果
            this.opacity += (Math.random() - 0.5) * 0.05;
            this.opacity = Math.max(0.1, Math.min(0.7, this.opacity));
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`;
            ctx.fill();
        }
    }
    
    // 初始化粒子
    function initParticles() {
        particles = [];
        const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    // 绘制连接线
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(180, 220, 255, ${0.15 * (1 - distance / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }
    
    // 动画循环
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 更新和绘制粒子
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        // 绘制连接线
        drawConnections();
        
        animationId = requestAnimationFrame(animate);
    }
    
    // 启动动画
    function start() {
        canvas.style.opacity = '1';
        resizeCanvas();
        initParticles();
        animate();
        
        // 3秒后淡出
        setTimeout(() => {
            canvas.style.opacity = '0';
            setTimeout(() => {
                cancelAnimationFrame(animationId);
                canvas.remove();
            }, 1000);
        }, 3000);
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', resizeCanvas);
    
    // 暴露启动函数
    window.startSplashAnimation = start;
})();
