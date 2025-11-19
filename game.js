// ===== Game Configuration =====
const CONFIG = {
    canvas: {
        width: 900,
        height: 600
    },
    paddle: {
        width: 15,
        height: 100,
        speed: 8,
        aiSpeed: 4  // Reduced from 6 to make AI slower
    },
    ai: {
        reactionDelay: 150,  // milliseconds before AI reacts
        errorMargin: 35,     // pixels of prediction error
        trackingDeadZone: 40 // pixels where AI won't move
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

// ===== Game State =====
const gameState = {
    current: 'start', // 'start', 'playing', 'paused', 'gameOver'
    playerScore: 0,
    aiScore: 0
};

// ===== Canvas Setup =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

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

    // Handle game state changes
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState.current === 'playing') {
            pauseGame();
        } else if (gameState.current === 'paused') {
            resumeGame();
        }
    }

    if (e.key.toLowerCase() === 'r') {
        restartGame();
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
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('scoreDisplay');

const startButton = document.getElementById('startButton');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');

const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');
const winnerText = document.getElementById('winnerText');
const finalScore = document.getElementById('finalScore');

// ===== Button Event Listeners =====
startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', restartGame);

// ===== Game Functions =====
function startGame() {
    gameState.current = 'playing';
    startScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    resetBall();
    gameLoop();
}

function pauseGame() {
    gameState.current = 'paused';
    pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    gameState.current = 'playing';
    pauseScreen.classList.add('hidden');
    gameLoop();
}

function restartGame() {
    gameState.current = 'start';
    gameState.playerScore = 0;
    gameState.aiScore = 0;
    updateScoreDisplay();

    player.y = CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2;
    ai.y = CONFIG.canvas.height / 2 - CONFIG.paddle.height / 2;

    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');

    particles.length = 0;
    ball.trail.length = 0;
}

function gameOver(winner) {
    gameState.current = 'gameOver';
    gameOverScreen.classList.remove('hidden');

    if (winner === 'player') {
        winnerText.textContent = 'YOU WIN!';
        winnerText.style.background = 'linear-gradient(135deg, #00d9ff, #00ff88)';
        winnerText.style.webkitBackgroundClip = 'text';
        winnerText.style.webkitTextFillColor = 'transparent';
        playSound(523, 0.2);
        setTimeout(() => playSound(659, 0.2), 100);
        setTimeout(() => playSound(784, 0.3), 200);
    } else {
        winnerText.textContent = 'AI WINS!';
        winnerText.style.background = 'linear-gradient(135deg, #ff006e, #ff4d00)';
        winnerText.style.webkitBackgroundClip = 'text';
        winnerText.style.webkitTextFillColor = 'transparent';
        playSound(392, 0.2);
        setTimeout(() => playSound(330, 0.2), 100);
        setTimeout(() => playSound(262, 0.3), 200);
    }

    finalScore.textContent = `Final Score: ${gameState.playerScore} - ${gameState.aiScore}`;
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
    playerScoreEl.textContent = gameState.playerScore;
    aiScoreEl.textContent = gameState.aiScore;
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
    draw(); // Draw initial state
}

init();
