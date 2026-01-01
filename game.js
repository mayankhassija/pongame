// ===== Game Configuration =====
const CONFIG = {
    canvas: {
        width: window.innerWidth,
        height: window.innerHeight - 80 // Approximate header height
    },
    paddle: {
        width: 15,
        height: 100,
        speed: 8,
        aiSpeed: 4
    },
    // ... (rest of config unchanged until game objects)
    ai: {
        reactionDelay: 150,
        errorMargin: 35,
        trackingDeadZone: 40
    },
    ball: {
        size: 12,
        initialSpeed: 5,
        maxSpeed: 12,
        speedIncrease: 0.3
    },
    game: {
        winScore: 5,
        fps: 60
    },
    colors: {
        paddle: '#00d9ff',
        ball: '#ff006e',
        trail: 'rgba(255, 0, 110, 0.3)',
        particle: '#00d9ff'
    }
};

// ...

// ===== Canvas Setup =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    // 1. Get the layout size (CSS size)
    // We need to ensure the canvas attributes match the CSS size to avoid scaling 
    // and to ensure the coordinate system matches the visible area.
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    CONFIG.canvas.width = canvas.width;
    CONFIG.canvas.height = canvas.height;

    // Reposition AI on resize
    ai.x = CONFIG.canvas.width - 30 - CONFIG.paddle.width;
    ai.y = Math.min(ai.y, CONFIG.canvas.height - ai.height);
    player.y = Math.min(player.y, CONFIG.canvas.height - player.height);
}

window.addEventListener('resize', resizeCanvas);
// Initial resize called in init


// ===== Game Objects =====
// ===== Game Objects =====
const player = {
    x: 30,
    y: CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2,
    width: CONFIG.paddle.width,
    height: CONFIG.paddle.height,
    dy: 0,
    speed: CONFIG.paddle.speed
};

const ai = {
    x: CONFIG.canvas.width - 30 - CONFIG.paddle.width,
    // ... rest initialized in resize or loop
    y: CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2,
    width: CONFIG.paddle.width,
    height: CONFIG.paddle.height,
    speed: CONFIG.paddle.aiSpeed,
    lastReactionTime: 0,
    targetY: CONFIG.canvas.height / 2,
    predictionOffset: 0
};

const ball = {
    x: CONFIG.canvas.width / 2,
    y: CONFIG.canvas.height / 2,
    size: CONFIG.ball.size,
    dx: CONFIG.ball.initialSpeed,
    dy: CONFIG.ball.initialSpeed,
    speed: CONFIG.ball.initialSpeed,
    trail: []
};

// ===== Game State =====
const gameState = {
    current: 'start', // 'start', 'playing', 'paused', 'gameOver'
    playerScore: 0,
    aiScore: 0
};

// ===== Particles System =====
const particles = [];

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.96;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = CONFIG.colors.particle;
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.colors.particle;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ===== Audio System (Web Audio API) =====
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// ===== Input Handling =====
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    // Handle game state changes (Button shortcuts)
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleControlClick();
    }

    if (e.key.toLowerCase() === 'r') {
        restartGame();
        controlButton.textContent = 'PAUSE'; // Ensure button updates if R is used
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Touch controls for mobile
let touchY = null;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchY = e.touches[0].clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (touchY !== null && gameState.current === 'playing') {
        const rect = canvas.getBoundingClientRect();
        const scaleY = canvas.height / rect.height;
        const newTouchY = e.touches[0].clientY;
        const canvasY = (newTouchY - rect.top) * scaleY;

        player.y = canvasY - player.height / 2;
        player.y = Math.max(0, Math.min(CONFIG.canvas.height - player.height, player.y));

        touchY = newTouchY;
    }
});

canvas.addEventListener('touchend', () => {
    touchY = null;
});

// ===== UI Elements =====
const controlButton = document.getElementById('controlButton');
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');


// ===== Button Event Listeners =====
controlButton.addEventListener('click', handleControlClick);

function handleControlClick() {
    try {
        if (controlButton) controlButton.blur();
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        switch (gameState.current) {
            case 'start':
                startGame();
                controlButton.textContent = 'PAUSE';
                break;
            case 'playing':
                pauseGame();
                controlButton.textContent = 'RESUME';
                break;
            case 'paused':
                resumeGame();
                controlButton.textContent = 'PAUSE';
                break;
            case 'gameOver':
                restartGame();
                controlButton.textContent = 'PAUSE';
                break;
        }
    } catch (error) {
        console.error("Game Control Error:", error);
    }
}

// ===== Game Functions =====
function startGame() {
    gameState.current = 'playing';
    resetBall();
    gameLoop();
}

function pauseGame() {
    gameState.current = 'paused';
}

function resumeGame() {
    gameState.current = 'playing';
    gameLoop();
}

function restartGame() {
    gameState.current = 'start';
    gameState.playerScore = 0;
    gameState.aiScore = 0;

    // Reset positions
    player.y = CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2;
    ai.y = CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2;

    particles.length = 0;
    ball.trail.length = 0;

    // Auto start
    startGame();
}

function gameOver(winner) {
    gameState.current = 'gameOver';
    controlButton.textContent = 'RESTART';

    // Optional: Draw simple game over text on canvas since overlays are gone
    setTimeout(() => {
        draw(); // Force a redraw to show the "Game Over" text
    }, 100);
}

function resetBall() {
    ball.x = CONFIG.canvas.width / 2;
    ball.y = CONFIG.canvas.height / 2;
    ball.speed = CONFIG.ball.initialSpeed;

    // Random direction
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6; // -30 to 30 degrees
    const direction = Math.random() < 0.5 ? 1 : -1;

    ball.dx = Math.cos(angle) * ball.speed * direction;
    ball.dy = Math.sin(angle) * ball.speed;

    ball.trail = [];
}

function updateScoreDisplay() {
    if (playerScoreEl && aiScoreEl) {
        playerScoreEl.textContent = gameState.playerScore;
        aiScoreEl.textContent = gameState.aiScore;
    }
}

// ===== Update Functions =====
function updatePlayer() {
    // Keyboard controls (W and S only - arrow keys are for page scrolling)
    if (keys['w']) {
        player.dy = -player.speed;
    } else if (keys['s']) {
        player.dy = player.speed;
    } else {
        player.dy = 0;
    }

    player.y += player.dy;

    // Boundary check
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > CONFIG.canvas.height) {
        player.y = CONFIG.canvas.height - player.height;
    }
}

function updateAI() {
    const currentTime = Date.now();

    // Only track ball when it's moving toward the AI (positive dx)
    if (ball.dx > 0) {
        // Check if enough time has passed since last reaction (reaction delay)
        if (currentTime - ai.lastReactionTime > CONFIG.ai.reactionDelay) {
            ai.lastReactionTime = currentTime;

            // Add some random prediction error
            ai.predictionOffset = (Math.random() - 0.5) * CONFIG.ai.errorMargin;

            // Set target position with error
            ai.targetY = ball.y + ai.predictionOffset;
        }
    } else {
        // When ball is moving away, slowly return to center
        ai.targetY = CONFIG.canvas.height / 2;
    }

    // Move toward target position with dead zone
    const aiCenter = ai.y + ai.height / 2;
    const diff = ai.targetY - aiCenter;

    if (Math.abs(diff) > CONFIG.ai.trackingDeadZone) {
        if (diff > 0) {
            ai.y += ai.speed;
        } else {
            ai.y -= ai.speed;
        }
    }

    // Boundary check
    if (ai.y < 0) ai.y = 0;
    if (ai.y + ai.height > CONFIG.canvas.height) {
        ai.y = CONFIG.canvas.height - ai.height;
    }
}

function updateBall() {
    // Store trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) {
        ball.trail.shift();
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Top and bottom collision
    if (ball.y - ball.size < 0 || ball.y + ball.size > CONFIG.canvas.height) {
        ball.dy *= -1;
        playSound(300, 0.1, 'square');
        createParticles(ball.x, ball.y, 5);
    }

    // Player paddle collision
    if (ball.x - ball.size < player.x + player.width &&
        ball.x + ball.size > player.x &&
        ball.y > player.y &&
        ball.y < player.y + player.height) {

        // Calculate hit position for angle
        const hitPos = (ball.y - (player.y + player.height / 2)) / (player.height / 2);
        const angle = hitPos * Math.PI / 4; // Max 45 degrees

        ball.speed = Math.min(ball.speed + CONFIG.ball.speedIncrease, CONFIG.ball.maxSpeed);
        ball.dx = Math.cos(angle) * ball.speed;
        ball.dy = Math.sin(angle) * ball.speed;

        ball.x = player.x + player.width + ball.size;

        playSound(440, 0.1);
        createParticles(ball.x, ball.y, 10);
    }

    // AI paddle collision
    if (ball.x + ball.size > ai.x &&
        ball.x - ball.size < ai.x + ai.width &&
        ball.y > ai.y &&
        ball.y < ai.y + ai.height) {

        const hitPos = (ball.y - (ai.y + ai.height / 2)) / (ai.height / 2);
        const angle = hitPos * Math.PI / 4;

        ball.speed = Math.min(ball.speed + CONFIG.ball.speedIncrease, CONFIG.ball.maxSpeed);
        ball.dx = -Math.cos(angle) * ball.speed;
        ball.dy = Math.sin(angle) * ball.speed;

        ball.x = ai.x - ball.size;

        playSound(440, 0.1);
        createParticles(ball.x, ball.y, 10);
    }

    // Score detection
    if (ball.x - ball.size < 0) {
        gameState.aiScore++;
        updateScoreDisplay();
        playSound(200, 0.2, 'sawtooth');

        if (gameState.aiScore >= CONFIG.game.winScore) {
            gameOver('ai');
        } else {
            resetBall();
        }
    }

    if (ball.x + ball.size > CONFIG.canvas.width) {
        gameState.playerScore++;
        updateScoreDisplay();
        playSound(500, 0.2);

        if (gameState.playerScore >= CONFIG.game.winScore) {
            gameOver('player');
        } else {
            resetBall();
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function createParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y));
    }
}

// ===== Draw Functions =====
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawPaddle(paddle, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.restore();
}

function drawBall() {
    // Draw trail
    ctx.save();
    for (let i = 0; i < ball.trail.length; i++) {
        const alpha = (i / ball.trail.length) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = CONFIG.colors.trail;
        ctx.beginPath();
        ctx.arc(ball.trail[i].x, ball.trail[i].y, ball.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Draw ball with glow
    ctx.save();
    ctx.fillStyle = CONFIG.colors.ball;
    ctx.shadowBlur = 25;
    ctx.shadowColor = CONFIG.colors.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawCenterLine() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(CONFIG.canvas.width / 2, 0);
    ctx.lineTo(CONFIG.canvas.width / 2, CONFIG.canvas.height);
    ctx.stroke();
    ctx.restore();
}

function drawParticles() {
    particles.forEach(particle => particle.draw());
}



function draw() {
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    gradient.addColorStop(0, '#000814');
    gradient.addColorStop(1, '#001d3d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Draw game elements
    drawCenterLine();
    drawPaddle(player, CONFIG.colors.paddle);
    drawPaddle(ai, CONFIG.colors.paddle);
    drawBall();
    drawParticles();

    if (gameState.current === 'gameOver') {
        drawGameOver();
    }
}

function drawGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Winner Text
    const winner = gameState.playerScore >= CONFIG.game.winScore ? 'YOU WIN!' : 'AI WINS!';
    const color = gameState.playerScore >= CONFIG.game.winScore ? '#00d9ff' : '#ff006e';

    ctx.font = 'bold 60px Orbitron, sans-serif';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillText(winner, CONFIG.canvas.width / 2, CONFIG.canvas.height / 2 - 20);

    // Score Text
    ctx.font = '30px Orbitron, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fillText(`${gameState.playerScore} - ${gameState.aiScore}`, CONFIG.canvas.width / 2, CONFIG.canvas.height / 2 + 40);

    ctx.restore();
}

// ===== Game Loop =====
function gameLoop() {
    if (gameState.current !== 'playing') return;

    updatePlayer();
    updateAI();
    updateBall();
    updateParticles();
    draw();

    requestAnimationFrame(gameLoop);
}

// ===== Initialize =====
function init() {
    resizeCanvas(); // Ensure size is correct on load
    draw(); // Draw initial state
}

init();
