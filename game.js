// --- CONFIG & CONSTANTS -------------------------------------------------
const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
};

const CONFIG = {
    canvasMaxWidth: 800,
    canvasMaxHeight: 600,
    player: {
        size: 20,
        baseSpeed: 3,
        maxHp: 5,
        dashSpeed: 9,
        dashDurationMs: 220,
        dashCooldownMs: 900,
        hitInvulnMs: 650,
    },
    zombie: {
        size: 20,
        speedIntervalSec: 60,
        speedPerStage: 0.12,
        hpIntervalSec: 60,
    },
    spawn: {
        baseRatePerSec: 0.6,
        rateStepSec: 15,
        ratePerStep: 0.2,
    },
    weapons: {
        pistol: {
            name: 'Pistol',
            fireRateMs: 200,
            bulletSpeed: 12,
            bulletSize: 6,
            damage: 1,
            spread: 0,
            knockback: 0.4,
        },
        shotgun: {
            name: 'Shotgun',
            fireRateMs: 400,
            bulletSpeed: 12,
            bulletSize: 6,
            damage: 1,
            pellets: 8,
            spread: 0.6,
            knockback: 1.2,
            unlockScore: 25,
        },
    },
    pickups: {
        dropChance: 0.15,
        healAmount: 1,
        ammoAmount: 12,
    },
    camera: {
        shakeDecay: 0.9,
        maxShake: 10,
    },
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const finalScoreElement = document.getElementById('finalScore');
const timerElement = document.getElementById('timer');
const hudOverlay = document.getElementById('hudOverlay');
const hudHealthBar = document.getElementById('healthBar');
const hudDashBar = document.getElementById('dashBar');
const weaponInfoElement = document.getElementById('weaponInfo');
const hintInfoElement = document.getElementById('hintInfo');
const pauseMenu = document.getElementById('pauseMenu');
const gameOverMenu = document.getElementById('gameOverMenu');
const mainMenu = document.getElementById('mainMenu');
const startButton = document.getElementById('startButton');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');
const pauseRestartButton = document.getElementById('pauseRestartButton');
const pauseMainMenuButton = document.getElementById('pauseMainMenuButton');
const gameOverMainMenuButton = document.getElementById('gameOverMainMenuButton');

let gameState = GAME_STATE.MENU;

function resizeCanvas() {
    const maxWidth = CONFIG.canvasMaxWidth;
    const maxHeight = CONFIG.canvasMaxHeight;
    const containerWidth = document.getElementById('gameContainer').clientWidth;
    const containerHeight = document.getElementById('gameContainer').clientHeight - document.getElementById('scoreBoard').clientHeight - 20;

    let newWidth = Math.min(containerWidth, maxWidth);
    let newHeight = Math.min(containerHeight, maxHeight);

    if (newWidth / newHeight > maxWidth / maxHeight) {
        newWidth = newHeight * (maxWidth / maxHeight);
    } else {
        newHeight = newWidth / (maxWidth / maxHeight);
    }

    canvas.width = newWidth;
    canvas.height = newHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: CONFIG.player.size,
    speed: CONFIG.player.baseSpeed,
    vx: 0,
    vy: 0,
    hp: CONFIG.player.maxHp,
    maxHp: CONFIG.player.maxHp,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    invulnTimer: 0,
    color: '#00BFFF'
};

const bullets = [];
const zombies = [];
const pickups = [];

let currentWeaponKey = 'pistol';
let unlockedWeapons = { pistol: true, shotgun: false };
let shotgunAmmo = 0;

const bulletColor = '#FFA500';

let score = 0;
let highScore = 0;
let isPaused = false;
let keys = {};
let mouseX = 0;
let mouseY = 0;
let clientMouseX = 0;
let clientMouseY = 0;
let elapsedTime = 0;
let lastFrameTime = 0;

let cameraShake = 0;
let cameraShakeX = 0;
let cameraShakeY = 0;

function resetState() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.hp = player.maxHp;
    player.isDashing = false;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.invulnTimer = 0;

    bullets.length = 0;
    zombies.length = 0;
    pickups.length = 0;

    score = 0;
    elapsedTime = 0;
    cameraShake = 0;
    cameraShakeX = 0;
    cameraShakeY = 0;

    currentWeaponKey = 'pistol';
    unlockedWeapons = { pistol: true, shotgun: false };
    shotgunAmmo = 0;

    updateScore();
    updateHud();
    hintInfoElement.textContent = '';
    updateTimer();
}

function spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -CONFIG.zombie.size; break;
        case 1: x = canvas.width + CONFIG.zombie.size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + CONFIG.zombie.size; break;
        case 3: x = -CONFIG.zombie.size; y = Math.random() * canvas.height; break;
    }

    const speedStage = Math.floor(elapsedTime / CONFIG.zombie.speedIntervalSec);
    const hpStage = Math.floor(elapsedTime / CONFIG.zombie.hpIntervalSec);

    let type;
    const r = Math.random();
    if (elapsedTime < 15) {
        type = r < 0.9 ? 'walker' : 'runner';
    } else if (elapsedTime < 30) {
        type = r < 0.7 ? 'walker' : 'runner';
    } else {
        if (r < 0.6) type = 'walker';
        else if (r < 0.9) type = 'runner';
        else type = 'tank';
    }

    const playerSpeed = CONFIG.player.baseSpeed;

    let baseSpeed;
    let maxSpeed;
    let baseHp;
    let size;
    let color;

    if (type === 'walker') {
        baseSpeed = playerSpeed * 0.6;
        maxSpeed = playerSpeed * 0.9;
        baseHp = 2;
        size = CONFIG.zombie.size * 1.0;
        color = '#008000';
    } else if (type === 'runner') {
        baseSpeed = playerSpeed * 0.7;
        maxSpeed = playerSpeed * 0.95;
        baseHp = 1;
        size = CONFIG.zombie.size * 0.75;
        color = '#66FF66';
    } else {
        baseSpeed = playerSpeed * 0.5;
        maxSpeed = playerSpeed * 0.85;
        baseHp = 3;
        size = CONFIG.zombie.size * 1.25;
        color = '#8A2BE2';
    }

    const typeSpeedFactor = type === 'runner' ? 1.15 : type === 'tank' ? 0.85 : 1;
    const speedIncrease = speedStage * CONFIG.zombie.speedPerStage * typeSpeedFactor;
    const finalSpeed = Math.min(baseSpeed + speedIncrease, maxSpeed);
    const hp = baseHp + hpStage;

    zombies.push({ x, y, size, speed: finalSpeed, hp, maxHp: hp, color, type });
}

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawBullets() {
    ctx.fillStyle = bulletColor;
    bullets.forEach(bullet => {
        const radius = (bullet.size || CONFIG.weapons.pistol.bulletSize) / 2;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawZombies() {
    zombies.forEach(zombie => {
        ctx.fillStyle = zombie.color;
        ctx.beginPath();
        ctx.arc(zombie.x, zombie.y, zombie.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCrosshair() {
    const size = 10;
    const gap = 5;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(mouseX, mouseY - gap - size);
    ctx.lineTo(mouseX, mouseY - gap);
    ctx.moveTo(mouseX, mouseY + gap);
    ctx.lineTo(mouseX, mouseY + gap + size);
    ctx.moveTo(mouseX - gap - size, mouseY);
    ctx.lineTo(mouseX - gap, mouseY);
    ctx.moveTo(mouseX + gap, mouseY);
    ctx.lineTo(mouseX + gap + size, mouseY);
    ctx.stroke();
}

function updateScore() {
    scoreElement.textContent = `Score: ${score}`;
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = `High Score: ${highScore}`;
    }
}

function updateTimer() {
    const totalSeconds = Math.floor(elapsedTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const padded = seconds.toString().padStart(2, '0');
    timerElement.textContent = `${minutes}:${padded}`;
}

function updateHud() {
    const healthPercent = player.hp / player.maxHp;
    hudHealthBar.style.width = `${Math.max(0, Math.min(1, healthPercent)) * 100}%`;
    hudHealthBar.style.background = healthPercent > 0.5
        ? 'linear-gradient(90deg, #4CAF50, #8BC34A)'
        : healthPercent > 0.25
            ? 'linear-gradient(90deg, #FFC107, #FF9800)'
            : 'linear-gradient(90deg, #F44336, #E53935)';

    const dashCooldownPercent = 1 - Math.min(player.dashCooldown / CONFIG.player.dashCooldownMs, 1);
    hudDashBar.style.width = `${dashCooldownPercent * 100}%`;
    hudDashBar.style.background = 'linear-gradient(90deg, #2196F3, #64B5F6)';

    const weaponDef = CONFIG.weapons[currentWeaponKey];
    let weaponText = `Weapon: ${weaponDef.name}`;
    if (currentWeaponKey === 'shotgun') {
        weaponText += ` (Ammo: ${shotgunAmmo})`;
    }
    weaponInfoElement.textContent = weaponText;
}

function applyCameraShake() {
    if (cameraShake > 0.2) {
        cameraShakeX = (Math.random() - 0.5) * cameraShake;
        cameraShakeY = (Math.random() - 0.5) * cameraShake;
    } else {
        cameraShakeX = 0;
        cameraShakeY = 0;
    }
    cameraShake *= CONFIG.camera.shakeDecay;
}

function updatePlaying(dt, timestamp) {
    const rect = canvas.getBoundingClientRect();
    mouseX = clientMouseX - rect.left;
    mouseY = clientMouseY - rect.top;

    if (isPaused) return;

    elapsedTime += dt;
    updateTimer();

    let inputX = 0;
    let inputY = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp']) inputY -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown']) inputY += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) inputX -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) inputX += 1;

    let length = Math.hypot(inputX, inputY);
    if (length > 0) {
        inputX /= length;
        inputY /= length;
    }

    let currentSpeed = player.speed;
    if (player.isDashing) {
        currentSpeed = CONFIG.player.dashSpeed;
    }

    player.vx = inputX * currentSpeed;
    player.vy = inputY * currentSpeed;

    player.x += player.vx;
    player.y += player.vy;

    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

    if (player.isDashing) {
        player.dashTimer -= dt * 1000;
        if (player.dashTimer <= 0) {
            player.isDashing = false;
        }
    }
    if (player.dashCooldown > 0) {
        player.dashCooldown -= dt * 1000;
        if (player.dashCooldown < 0) player.dashCooldown = 0;
    }
    if (player.invulnTimer > 0) {
        player.invulnTimer -= dt * 1000;
        if (player.invulnTimer < 0) player.invulnTimer = 0;
    }

    bullets.forEach(bullet => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
    });

    bullets.splice(0, bullets.length, ...bullets.filter(bullet =>
        bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height
    ));

    for (let i = zombies.length - 1; i >= 0; i--) {
        const zombie = zombies[i];
        const dx = player.x - zombie.x;
        const dy = player.y - zombie.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        zombie.x += (dx / dist) * zombie.speed;
        zombie.y += (dy / dist) * zombie.speed;

        if (dist < (player.size + zombie.size) / 2) {
            if (player.invulnTimer <= 0) {
                player.hp -= 1;
                player.invulnTimer = CONFIG.player.hitInvulnMs;
                cameraShake = Math.min(CONFIG.camera.maxShake, cameraShake + 5);

                if (player.hp <= 0) {
                    updateScore();
                    finalScoreElement.textContent = `Final Score: ${score}`;
                    gameState = GAME_STATE.GAME_OVER;
                    gameOverMenu.style.display = 'block';
                }
                updateHud();
            }
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const bulletDist = Math.sqrt((bullet.x - zombie.x) ** 2 + (bullet.y - zombie.y) ** 2);
            const bulletRadius = (bullet.size || CONFIG.weapons.pistol.bulletSize) / 2;
            if (bulletDist < (bulletRadius + zombie.size / 2)) {
                zombie.hp -= bullet.damage || 1;
                bullets.splice(j, 1);
                cameraShake = Math.min(CONFIG.camera.maxShake, cameraShake + 2);

                if (zombie.hp <= 0) {
                    if (Math.random() < CONFIG.pickups.dropChance) {
                        pickups.push({
                            x: zombie.x,
                            y: zombie.y,
                            size: 12,
                            type: Math.random() < 0.5 ? 'health' : 'ammo',
                        });
                    }

                    zombies.splice(i, 1);
                    score++;
                    updateScore();

                    if (!unlockedWeapons.shotgun && score >= CONFIG.weapons.shotgun.unlockScore) {
                        unlockedWeapons.shotgun = true;
                        shotgunAmmo += CONFIG.pickups.ammoAmount * 2;
                        hintInfoElement.textContent = 'Shotgun Unlocked!';
                    }

                    break;
                }
            }
        }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (player.size + p.size) / 2) {
            if (p.type === 'health') {
                if (player.hp < player.maxHp) {
                    player.hp = Math.min(player.maxHp, player.hp + CONFIG.pickups.healAmount);
                }
            } else if (p.type === 'ammo') {
                shotgunAmmo += CONFIG.pickups.ammoAmount;
            }
            pickups.splice(i, 1);
            updateHud();
        }
    }

    const spawnConfig = CONFIG.spawn;
    const steps = elapsedTime / spawnConfig.rateStepSec;
    const spawnRatePerSec = spawnConfig.baseRatePerSec + steps * spawnConfig.ratePerStep;
    const spawnProbThisFrame = spawnRatePerSec * dt;
    if (Math.random() < spawnProbThisFrame) spawnZombie();

    updateHud();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cameraShakeX, cameraShakeY);

    if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.PAUSED || gameState === GAME_STATE.GAME_OVER) {
        ctx.strokeStyle = '#1b1b1b';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        pickups.forEach(p => {
            const radius = p.size / 2;
            ctx.beginPath();
            ctx.fillStyle = p.type === 'health' ? '#F44336' : '#FFC107';
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 2;

            if (p.type === 'health') {
                const crossHalf = radius * 0.7;
                ctx.strokeStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - crossHalf);
                ctx.lineTo(p.x, p.y + crossHalf);
                ctx.moveTo(p.x - crossHalf, p.y);
                ctx.lineTo(p.x + crossHalf, p.y);
                ctx.stroke();
            } else if (p.type === 'ammo') {
                const h = radius * 1.3;
                const w = radius * 0.4;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(p.x - w, p.y + h / 2);
                ctx.lineTo(p.x - w, p.y - h / 4);
                ctx.lineTo(p.x, p.y - h / 2);
                ctx.lineTo(p.x + w, p.y - h / 4);
                ctx.lineTo(p.x + w, p.y + h / 2);
                ctx.closePath();
                ctx.fill();
            }
        });

        drawZombies();
        drawBullets();
        drawPlayer();
        drawCrosshair();
    }

    ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    applyCameraShake();

    if (gameState === GAME_STATE.PLAYING) {
        updatePlaying(dt, timestamp);
    }

    draw();
    requestAnimationFrame(gameLoop);
}

function shoot(e) {
    if (gameState !== GAME_STATE.PLAYING || isPaused) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - player.x;
    const dy = y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    const weapon = CONFIG.weapons[currentWeaponKey];

    if (!shoot.lastShotTime) shoot.lastShotTime = 0;
    const now = performance.now();
    if (now - shoot.lastShotTime < weapon.fireRateMs) return;

    if (currentWeaponKey === 'shotgun') {
        if (!unlockedWeapons.shotgun || shotgunAmmo <= 0) return;
        shotgunAmmo--;

        for (let i = 0; i < weapon.pellets; i++) {
            const spreadAngle = (Math.random() - 0.5) * weapon.spread;
            const angle = Math.atan2(dy, dx) + spreadAngle;
            bullets.push({
                x: player.x,
                y: player.y,
                dx: Math.cos(angle) * weapon.bulletSpeed,
                dy: Math.sin(angle) * weapon.bulletSpeed,
                damage: weapon.damage,
                size: weapon.bulletSize,
            });
        }
    } else {
        const angle = Math.atan2(dy, dx);
        bullets.push({
            x: player.x,
            y: player.y,
            dx: (dx / dist) * weapon.bulletSpeed,
            dy: (dy / dist) * weapon.bulletSpeed,
            damage: weapon.damage,
            size: weapon.bulletSize,
        });
    }

    shoot.lastShotTime = now;
    updateHud();
}

function tryDash() {
    if (player.dashCooldown > 0 || player.isDashing) return;

    let inputX = 0;
    let inputY = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp']) inputY -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown']) inputY += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) inputX -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) inputX += 1;

    let length = Math.hypot(inputX, inputY);
    if (length === 0) {
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        length = Math.hypot(dx, dy);
        if (length === 0) return;
        inputX = dx / length;
        inputY = dy / length;
    } else {
        inputX /= length;
        inputY /= length;
    }

    player.isDashing = true;
    player.dashTimer = CONFIG.player.dashDurationMs;
    player.dashCooldown = CONFIG.player.dashCooldownMs;
    player.invulnTimer = Math.max(player.invulnTimer, CONFIG.player.dashDurationMs);
    cameraShake = Math.min(CONFIG.camera.maxShake, cameraShake + 3);

    updateHud();
}

function restartGame() {
    resetState();
    gameOverMenu.style.display = 'none';
    mainMenu.style.display = 'none';
    hudOverlay.style.display = 'flex';
    gameState = GAME_STATE.PLAYING;
}

function returnToMainMenu() {
    resetState();
    isPaused = false;
    gameState = GAME_STATE.MENU;
    pauseMenu.style.display = 'none';
    gameOverMenu.style.display = 'none';
    mainMenu.style.display = 'block';
    hudOverlay.style.display = 'none';
}

function togglePause() {
    if (gameState !== GAME_STATE.PLAYING && gameState !== GAME_STATE.PAUSED) return;
    isPaused = !isPaused;
    if (isPaused) {
        gameState = GAME_STATE.PAUSED;
        pauseMenu.style.display = 'block';
    } else {
        gameState = GAME_STATE.PLAYING;
        pauseMenu.style.display = 'none';
    }
}

canvas.addEventListener('click', shoot);
window.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
    }

    if (e.key === 'Shift') {
        e.preventDefault();
        if (gameState === GAME_STATE.PLAYING) {
            tryDash();
        }
    }

    if (e.key === 'q' || e.key === 'Q') {
        if (unlockedWeapons.shotgun) {
            currentWeaponKey = currentWeaponKey === 'pistol' ? 'shotgun' : 'pistol';
            if (hintInfoElement.textContent === 'Shotgun Unlocked!') {
                hintInfoElement.textContent = '';
            }
            updateHud();
        }
    }
});
window.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('mousemove', (e) => {
    clientMouseX = e.clientX;
    clientMouseY = e.clientY;
});
resumeButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', restartGame);
pauseRestartButton.addEventListener('click', restartGame);
pauseMainMenuButton.addEventListener('click', returnToMainMenu);
gameOverMainMenuButton.addEventListener('click', returnToMainMenu);
startButton.addEventListener('click', () => {
    resetState();
    mainMenu.style.display = 'none';
    gameOverMenu.style.display = 'none';
    pauseMenu.style.display = 'none';
    hudOverlay.style.display = 'flex';
    gameState = GAME_STATE.PLAYING;
});

resetState();
mainMenu.style.display = 'block';
hudOverlay.style.display = 'none';
lastFrameTime = performance.now();
gameLoop(lastFrameTime);
