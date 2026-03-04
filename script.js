const DIRECTIONS = {
    UP:    { x: 0,  y: -1 },
    DOWN:  { x: 0,  y: 1 },
    LEFT:  { x: -1, y: 0 },
    RIGHT: { x: 1,  y: 0 }
};

function getDirectionName(dir) {
    for (let name in DIRECTIONS) {
        if (DIRECTIONS[name].x === dir.x && DIRECTIONS[name].y === dir.y) {
            return name;
        }
    }
    return null;
}

class Timer {
    constructor() {
        this.elapsed = 0;       // tempo in ms
        this.running = false;
        this.lastTimeStamp = null;
        this.timerUI = document.getElementById("timer");
    }

    start() {
        this.running = true;
        this.lastTimeStamp = performance.now();
    }

    stop() {
        this.running = false;
    }

    reset() {
        this.elapsed = 0;
        this.lastTimeStamp = null;
    }

    update() {
        if (!this.running) return;

        const now = performance.now();

        if (this.lastTimeStamp === null) this.lastTimeStamp = now;

        const delta = now - this.lastTimeStamp;
        this.lastTimeStamp = now;
        this.elapsed += delta;

        const seconds = Math.floor(this.elapsed / 1000) % 60;
        const minutes = Math.floor(this.elapsed / 1000 / 60);
        this.timerUI.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    }

    getSeconds() {
        return Math.floor(this.elapsed / 1000);
    }
}

class SnakeSkin {
    constructor() {
        this.specialActive = false;
    }

    activateSpecial(snake, game) {
        this.specialActive = true;
    }

    deactivateSpecial() {
        this.specialActive = false;
    }

    // Hook opzionale chiamato durante l'update
    onSnakeMove(snake, game) {
        // default: non fa nulla
    }

    onSnakeEat(snake, food, game) {
        // default: non fa nulla
    }

    onObstacleCollision(obstacle, snake, game) {
        // default: ritorna false se collide normalmente, true se ignorata
        return false;
    }

    onWallCollision(snake, game) {
        // default: true = collisione = gameover
        return true;
    }

    // default: nessuna interazione speciale
    handleCollision(target, snake, game) {
        return false;
    }

    // default: aggiornamenti periodici
    update(game, snake) {}

    draw(renderContext, snake) {
        throw new Error("draw() must be implemented");
    }

    drawSegment(renderContext, segment, radius, color) {
        const { ctx, cellSize } = renderContext;
        this.drawRoundedRect(
            ctx,
            segment.x,
            segment.y,
            cellSize,
            radius,
            color,
            true
        );
    }

    drawRoundedRect(ctx, x,y,size,radius,color,glow=false){
      ctx.fillStyle=color;
      ctx.shadowColor=glow?color:"transparent";
      ctx.shadowBlur=glow?12:0;
      ctx.beginPath();
      ctx.roundRect(x+2,y+2,size-4,size-4,radius);
      ctx.fill();
      ctx.shadowBlur=0;
    }

    getCooldownColor() {
      return "#000000";
    }
}

class ClassicSnakeSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "classic";
        this.displayName = "Classic";
        this.icon = "icons/classic.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize } = renderContext;

        snake.segments.forEach((segment, i) => {
            ctx.save();

            const isHead = i === 0;

            ctx.shadowColor = isHead ?  "#00ff88" : "green";
            ctx.shadowBlur = 4;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                isHead ? 8 : 5,
                isHead ? "#2ecc40" : "#27ae60",
                true
            );

            ctx.restore();
        });
    }
}

class IceSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "ice";
        this.displayName = "Ice";
        this.icon = "icons/ice.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize, getTime } = renderContext;
        const time = getTime();

        snake.segments.forEach(segment => {
            ctx.save();

            ctx.shadowColor = "#a0f0ff";
            ctx.shadowBlur = 5 + Math.sin(time * 0.003) * 2;

            this.drawRoundedRect(ctx, segment.x, segment.y, cellSize, 6, "#60d0ff", true);

            // Effetto cristalli
            for (let j = 0; j < 3; j++) {
                ctx.fillStyle = `rgba(160,240,255,${0.3 + Math.random()*0.3})`;

                ctx.beginPath();
                ctx.moveTo(
                    segment.x + cellSize/2,
                    segment.y + cellSize/2
                );

                ctx.lineTo(
                    segment.x + Math.random()*cellSize,
                    segment.y + Math.random()*cellSize/2
                );

                ctx.lineTo(
                    segment.x + Math.random()*cellSize,
                    segment.y - Math.random()*cellSize/2
                );

                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "#00e5ff";
    }

    onObstacleCollision(target, snake, game) {
        // distrugge ostacoli se special attivo
        if (this.specialActive && target instanceof Obstacle) {
            target.break();
            // game.removeObstacle(target);
            return true; // collisione “gestita”
        }
        return false;
    }
}

class LavaSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "lava";
        this.displayName = "Lava";
        this.icon = "icons/lava.png";
        this.locked = false;
        this.fireTrail = [];
        this.fireDuration = 5000;
    }

    update(snake, game) {
        if (!this.specialActive) return;
        const head = snake.head;

        this.fireTrail.push({
            x: head.x,
            y: head.y,
            createdAt: Date.now()
        });

        const now = Date.now();
        this.fireTrail = this.fireTrail.filter(f => {
            return (now - f.createdAt) < this.fireDuration;
        });
    }

    draw(renderContext, snake) {
        const { ctx, cellSize, getTime } = renderContext;
        const time = getTime() * 0.01;
        const now = Date.now();

        this.fireTrail.forEach(f => {
            const age = now - f.createdAt;
            const life = age / this.fireDuration;
            if(life > 1) return;

            const offset = f.offset ?? (f.offset = Math.random() * 0.3);
            const adjustedLife = Math.min(1, life + offset);
            const intensity = 1 - adjustedLife;

            const flicker = 0.9 + Math.sin(time + f.x + f.y) * 0.1;
            const jitterX = (Math.random() - 0.5) * cellSize * 0.15;
            const jitterY = (Math.random() - 0.5) * cellSize * 0.15;
            const alpha = intensity * flicker;

            ctx.save();

            ctx.shadowColor = `rgba(255,140,0,${alpha})`;
            ctx.shadowBlur = 25 * intensity;

            const maxRadius = cellSize * 0.7 * intensity;
            const gradient = ctx.createRadialGradient(
                f.x + cellSize/2 + jitterX,
                f.y + cellSize/2 + jitterY,
                cellSize * 0.1 * intensity,
                f.x + cellSize/2 + jitterX,
                f.y + cellSize/2 + jitterY,
                maxRadius
            );

            gradient.addColorStop(0, `rgba(255,255,220,${alpha})`);
            gradient.addColorStop(0.3, `rgba(255,200,0,${alpha})`);
            gradient.addColorStop(0.6, `rgba(255,100,0,${alpha})`);
            gradient.addColorStop(0.9, `rgba(180,40,0,${alpha})`);
            gradient.addColorStop(1, `rgba(50,10,0,${alpha})`);

            ctx.fillStyle = gradient;
            ctx.fillRect(f.x, f.y, cellSize, cellSize);

            const particleCount = Math.floor((3 + Math.random() * 3) * intensity);
            for (let i = 0; i < particleCount; i++) {
                const px = f.x + Math.random() * cellSize;
                const py = f.y + Math.random() * cellSize * 0.5;
                const pSize = Math.random() * 2 * intensity + 1;
                ctx.fillStyle = `rgba(255,${150 + Math.random()*50},0,${alpha})`;
                ctx.beginPath();
                ctx.arc(px, py, pSize, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        snake.segments.forEach(segment => {
            ctx.save();

            const glow = 15 + Math.sin(time * 0.003) * 5;
            ctx.shadowColor = "#ff4500";
            ctx.shadowBlur = glow;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                6,
                "#ff7f50",
                true
            );

            for (let j = 0; j < 4; j++) {
                const size = 2 + Math.random()*3;
                ctx.fillStyle = `rgba(255,${69 + Math.random()*50},0,0.7)`;
                ctx.beginPath();
                ctx.arc(
                    segment.x + Math.random()*cellSize,
                    segment.y + Math.random()*cellSize,
                    size,
                    0,
                    Math.PI*2
                );
                ctx.fill();
            }

            ctx.restore();
        });
    }

    onObstacleSpawn(obstacle, game) {
        if (!this.specialActive) return;

        const melts = this.fireTrail.some(f =>
            f.x === obstacle.x && f.y === obstacle.y
        );

        if (melts) {
            return true; // true = distruggi ostacolo
        }

        return false;
    }

    getCooldownColor() {
      return "#ff4500";
    }

    deactivatePower() {
        super.deactivatePower();
        this.fireTrail = [];
    }
}

class GoldSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "gold";
        this.displayName = "Gold";
        this.icon = "icons/classic.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize } = renderContext;

        snake.segments.forEach(segment => {
            ctx.save();

            ctx.shadowColor = "#ffd700";
            ctx.shadowBlur = 12;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                6,
                "#ffec8b",
                true
            );

            for (let j = 0; j < 3; j++) {
                const cx = segment.x + Math.random()*cellSize;
                const cy = segment.y + Math.random()*cellSize;
                const size = 2 + Math.random()*3;
                const sides = 3 + Math.floor(Math.random()*3);
                const angleStep = (Math.PI*2)/sides;

                ctx.fillStyle = "rgba(255,215,0,0.6)";
                ctx.beginPath();

                for (let k=0;k<sides;k++){
                    const angle = k*angleStep;
                    const px = cx + size*Math.cos(angle);
                    const py = cy + size*Math.sin(angle);
                    k===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
                }

                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "#ffd700";
    }

    onSnakeEat(snake, food, game) {
        if (this.specialActive) {
            // moltiplica i punti raccolti x3
            food.points *= 3;
        }
    }
}

class NeonSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "neon";
        this.displayName = "Neon";
        this.icon = "icons/neon.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize } = renderContext;

        snake.segments.forEach(segment => {
            ctx.save();

            ctx.shadowColor = "#00ffff";
            ctx.shadowBlur = 5;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                6,
                "#00ff88",
                true
            );

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "#00ff88";
    }

    onSnakeEat(snake, food, game) {
        if (this.specialActive) {
            // forza il cibo ad essere raro
            food.type = "rare";
            food.points = 3; // punti del cibo raro
            food.color = "#1e90ff";
        }
    }

    handleFoodSpawned(food, foodManager) {
        if (this.specialActive) {
            const rareType = foodManager.getFoodType("rare");

            food.type = rareType.type // "rare";
            food.points = rareType.points // 3;
            food.color = rareType.color // "#1e90ff";
        }
    }
}

class DragonSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "dragon";
        this.displayName = "Dragon";
        this.icon = "icons/dragon.png";
        this.locked = false;
        this.dragonFlame = [];
    }

    draw(renderContext, snake) {
        const { ctx, cellSize, getTime } = renderContext;
        const time = getTime();

        snake.segments.forEach((segment, i) => {
            ctx.save();
            ctx.shadowColor = "#00ff00";
            ctx.shadowBlur = 5 + Math.sin(time * 0.2) * 5;

            if (i === 0) { // testa
                ctx.save();
                ctx.shadowColor = "#00ff00";
                ctx.shadowBlur = 8;
                ctx.fillStyle = "#00cc00";
                ctx.beginPath();

                const dirName = getDirectionName(snake.direction);
                // forma testa in base alla direzione
                switch (dirName) {
                    case "RIGHT":
                        ctx.moveTo(segment.x, segment.y);
                        ctx.lineTo(segment.x + cellSize * 0.7, segment.y + cellSize * 0.2);
                        ctx.lineTo(segment.x + cellSize, segment.y + cellSize / 2);
                        ctx.lineTo(segment.x + cellSize * 0.7, segment.y + cellSize * 0.8);
                        ctx.lineTo(segment.x, segment.y + cellSize);
                        break;
                    case "LEFT":
                        ctx.moveTo(segment.x + cellSize, segment.y);
                        ctx.lineTo(segment.x + cellSize * 0.3, segment.y + cellSize * 0.2);
                        ctx.lineTo(segment.x, segment.y + cellSize / 2);
                        ctx.lineTo(segment.x + cellSize * 0.3, segment.y + cellSize * 0.8);
                        ctx.lineTo(segment.x + cellSize, segment.y + cellSize);
                        break;
                    case "UP":
                        ctx.moveTo(segment.x, segment.y + cellSize);
                        ctx.lineTo(segment.x + cellSize * 0.2, segment.y + cellSize * 0.3);
                        ctx.lineTo(segment.x + cellSize / 2, segment.y);
                        ctx.lineTo(segment.x + cellSize * 0.8, segment.y + cellSize * 0.3);
                        ctx.lineTo(segment.x + cellSize, segment.y + cellSize);
                        break;
                    case "DOWN":
                        ctx.moveTo(segment.x, segment.y);
                        ctx.lineTo(segment.x + cellSize * 0.2, segment.y + cellSize * 0.7);
                        ctx.lineTo(segment.x + cellSize / 2, segment.y + cellSize);
                        ctx.lineTo(segment.x + cellSize * 0.8, segment.y + cellSize * 0.7);
                        ctx.lineTo(segment.x + cellSize, segment.y);
                        break;
                }
                ctx.closePath();
                ctx.fill();

                // occhio luminoso
                ctx.fillStyle = "lime";
                ctx.shadowBlur = 15;
                ctx.beginPath();
                switch (dirName) {
                    case "RIGHT":
                        ctx.arc(segment.x + cellSize * 0.65, segment.y + cellSize * 0.35, cellSize * 0.08, 0, Math.PI * 2); break;
                    case "LEFT":
                        ctx.arc(segment.x + cellSize * 0.35, segment.y + cellSize * 0.35, cellSize * 0.08, 0, Math.PI * 2); break;
                    case "UP":
                        ctx.arc(segment.x + cellSize * 0.65, segment.y + cellSize * 0.35, cellSize * 0.08, 0, Math.PI * 2); break;
                    case "DOWN":
                        ctx.arc(segment.x + cellSize * 0.65, segment.y + cellSize * 0.65, cellSize * 0.08, 0, Math.PI * 2); break;
                }
                ctx.fill();
                ctx.restore();
            } else { // corpo
                // let shade = 100 + Math.sin(i * 0.5 + time * 0.1) * 50;
                let shade = 120 + (i % 2) * 30;
                let scaleX = cellSize * 0.8;
                let scaleY = cellSize * 0.6;

                ctx.save();
                ctx.fillStyle = `rgb(0,${shade},0)`;
                ctx.shadowColor = "#00ff00";
                ctx.shadowBlur = 8 + Math.sin(time * 0.2) * 4;

                // pattern a scaglie: rettangoli sfalsati
                let offset = (i % 2 === 0) ? 0 : scaleY / 2;
                ctx.fillRect(segment.x, segment.y + offset, scaleX, scaleY);
                ctx.restore();
            }
            ctx.restore();
        });

        // flame shot
        for (let i = this.dragonFlame.length-1; i >= 0; i--) {
            const f = this.dragonFlame[i];
            if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.size)) {
                this.dragonFlame.splice(i, 1);
                continue;
            }

            ctx.save();

            // glow pulsante
            ctx.shadowColor = f.color;
            ctx.shadowBlur = 10 + 5 * Math.sin(renderContext.getTime() * 0.005);

            // alpha variabile
            ctx.globalAlpha = f.alpha;

            // gradient radiale
            const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size/2);
            gradient.addColorStop(0, f.color);
            gradient.addColorStop(0.7, "rgba(255,140,0,0.5)");
            gradient.addColorStop(1, "rgba(255,0,0,0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size/2, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();

            // aggiornamento particella
            f.alpha -= 0.04;
            f.size *= 0.95;
            f.x += f.dx;
            f.y += f.dy;

            if (f.alpha <= 0 || f.size <= 0) {
                this.dragonFlame.splice(i, 1);
            }
        }
    }

    drawHead(ctx, segment, cellSize, direction) {
        ctx.fillStyle = "#00cc00";
        ctx.fillRect(
            segment.x,
            segment.y,
            cellSize,
            cellSize
        );
    }

    getCooldownColor() {
      return "#00cc00";
    }

    activateSpecial(snake, game) {
        const head = snake.head;
        const dirName = getDirectionName(snake.direction);
        const dx = dirName === "RIGHT" ? 1 : dirName === "LEFT" ? -1 : 0;
        const dy = dirName === "DOWN" ? 1 : dirName === "UP" ? -1 : 0;

        // 5 caselle davanti
        for (let i = 1; i <= 5; i++) {
            const cellX = head.x + i * dx * snake.box;
            const cellY = head.y + i * dy * snake.box;

            game.obstacleManager.obstacles = game.obstacleManager.obstacles.filter(o => !(o.x * snake.box === cellX && o.y * snake.box === cellY));

            for (let p = 0; p < 6; p++) {
                this.dragonFlame.push({
                    x: cellX + snake.box/2,
                    y: cellY + snake.box/2,
                    size: 8 + Math.random()*6,
                    color: "orange",
                    alpha: 1,
                    dx: (Math.random()-0.5) * 2,
                    dy: (Math.random()-0.5) * 2
                });
            }
        }
        this.specialActive = true;

        snake.cooldownStartTime = game.animationTime;
    }

    updatePower(currentTime) {
        if (this.activePower && (currentTime - this.powerStartTime) >= this.powerDuration) {
            this.activePower = null;
            this.skin.deactivateSpecial();
            this.cooldownStartTime = currentTime;
        }
    }
}

class RainbowSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "rainbow";
        this.displayName = "Rainbow";
        this.icon = "icons/rainbow.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize, getTime } = renderContext;
        const time = getTime();

        snake.segments.forEach((segment, i) => {
            ctx.save();

            const hue = (time * 0.05 + i * 20) % 360;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                6,
                `hsl(${hue},100%,50%)`,
                true
            );

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "fuchsia";
      // return "hsl(" + (animationTick * 5 % 360) + ",100%,50%)";
    }

    handleFoodSpawned(food, foodManager) {
        // se power attivo, iniziamo subito a cambiare il tipo
        if (this.specialActive) {
            const randomType = foodManager.getRandomFoodType();
            food.type = randomType.type;
            food.category = randomType.category;
            food.points = randomType.points;
            food.color = randomType.color;
        }
    }

    handleFoodCollected(food, game) {
        if (!this.specialActive) return;
        const now = Date.now();
        if (!food._lastChange) food._lastChange = now;
        if (now - food._lastChange >= 200) {
            const randomType = game.foodManager.getRandomFoodType();
            food.type = randomType.type;
            food.category = randomType.category;
            food.points = randomType.points;
            food.color = randomType.color;
            food._lastChange = now;
        }
    }
}

class GhostSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "ghost";
        this.displayName = "Ghost";
        this.icon = "icons/ghost.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize } = renderContext;

        snake.segments.forEach(segment => {
            ctx.save();

            ctx.globalAlpha = 0.6;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                8,
                "#ffffff",
                true
            );

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "#ffffff";
    }

    onObstacleCollision(target, snake, game) {
      if (this.specialActive && target instanceof Obstacle) {
        return true; // mai collisione
      }
    }
}

class PlasmaSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "plasma";
        this.displayName = "Plasma";
        this.icon = "icons/plasma.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize, getTime } = renderContext;
        const time = getTime();

        snake.segments.forEach((segment, i) => {
            ctx.save();

            const pulse = 150 + Math.sin(time*0.003 + i) * 100;

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                6,
                `rgb(${pulse},0,255)`,
                true
            );

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "#7f00ff";
    }

    onWallCollision(snake, game) {
    if (this.specialActive) {
        const head = snake.segments[0];
        const max = game.board.canvasSize;
        const box = snake.box;

        if (head.x < 0) head.x = max - box;
        if (head.x >= max) head.x = 0;
        if (head.y < 0) head.y = max - box;
        if (head.y >= max) head.y = 0;

        return false; // ignora la collisione
    }
    return true;
}
}

class CarnivalSkin extends SnakeSkin {
    constructor() {
        super();
        this.name = "carnival";
        this.displayName = "Carnival";
        this.icon = "icons/carnival.png";
        this.locked = false;
    }

    draw(renderContext, snake) {
        const { ctx, cellSize } = renderContext;
        const colors = ["#d40000", "#ffffff", "#000000"];

        snake.segments.forEach((segment, i) => {
            ctx.save();

            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(255,255,255,0.6)";

            this.drawRoundedRect(
                ctx,
                segment.x,
                segment.y,
                cellSize,
                i === 0 ? 8 : 6,
                colors[i % 3],
                true
            );

            ctx.restore();
        });
    }

    getCooldownColor() {
      return "darkred";
    }
}

class SkinManager {
    constructor(selectElementId, onSkinChangeCallback) {
        this.skins = new Map();       // nome -> classe skin
        this.selectElement = document.getElementById("menuSkinSelect");

        this.onSkinChange = onSkinChangeCallback; // callback
        this.currentSkin = null;
    }

    // Registrazione skin
    register(skinClass) {
        const instance = new skinClass();
        this.skins.set(instance.name, skinClass);
    }

    // Ritorna tutte le skin disponibili come array di istanze
    getAvailableSkins() {
        return Array.from(this.skins.values()).map(cls => new cls(null));
    }

    // Crea istanza di skin dal nome
    create(name) {
        const SkinClass = this.skins.get(name);
        if (!SkinClass) return new ClassicSnakeSkin();
        return new SkinClass();
    }

    // Popola il select e gestisce il cambio skin
    init() {
        if (!this.selectElement) return;

        // popola il menu
        this.getAvailableSkins().forEach(skin => {
            const option = document.createElement("option");
            option.value = skin.name;
            option.textContent = skin.displayName || skin.name;
            if (skin.locked) option.disabled = true;
            this.selectElement.appendChild(option);
        });

        // listener cambio skin
        this.selectElement.addEventListener("change", () => {
            const chosenSkin = this.create(this.selectElement.value);
            this.applySkin(chosenSkin);
        });

        // imposta skin iniziale
        const initialSkin = this.create(this.selectElement.value || "ClassicSnakeSkin");
        this.applySkin(initialSkin);
    }

    // Applica la skin al gioco
    applySkin(skin) {
        this.currentSkin = skin;
        if (this.onSkinChange) this.onSkinChange(skin);
    }
}

class Snake {
    constructor(box, skin) {
        this.box = box;
        this.segments = [
            { x: 9 * box, y: 9 * box },
            { x: 8 * box, y: 9 * box },
            { x: 7 * box, y: 9 * box }
        ];
        this.direction = this.randomDirection();
        this.skin = skin;
        this.activePower = null;      // nome del potere attivo
        this.powerStartTime = 0;      // timestamp in ms dell'inizio
        this.powerDuration = 5000;    // durata in ms
        this.cooldownStartTime = -Infinity;
        this.cooldownDuration = 5000;    // cooldown in ms
        this.lastPowerTime = -Infinity;
    }

    randomDirection() {
        const dirs = Object.values(DIRECTIONS);
        return dirs[Math.floor(Math.random() * dirs.length)];
    }


    get head() {
        return this.segments[0];
    }

    move() {
        const headX = this.head.x + this.direction.x * this.box;
        const headY = this.head.y + this.direction.y * this.box;
        this.segments.unshift({ x: headX, y: headY });
    }

    correctHeadPosition(game) {
        if (this.skin?.onWallCollision) {
            this.skin.onWallCollision(this, game);
        }
    }

    removeTail() {
        this.segments.pop();
    }

    occupiesCell(x, y) {
        return this.segments.some(s => s.x === x && s.y === y);
    }

    collidesWithSelf() {
        return this.segments.slice(1).some(s =>
            s.x === this.head.x && s.y === this.head.y
        );
    }

    draw(renderContext) {
        this.skin.draw(renderContext, this);
    }

    canActivatePower(currentTime) {
      if (this.isPowerActive(currentTime)) return false;
      if (this.isOnCooldown(currentTime)) return false;
      return true;
    }

    activatePower(currentTime, game) {
        if (!this.canActivatePower(currentTime)) return false;
        this.skin.activateSpecial(this, game);
        this.activePower = this.skin.name;
        this.powerStartTime = currentTime;
        this.lastPowerTime = currentTime;
        return true;
    }

    updatePower(currentTime) {
        if (this.activePower && (currentTime - this.powerStartTime) >= this.powerDuration) {
            this.activePower = null; // power expired
            this.skin.deactivateSpecial();
            this.cooldownStartTime = currentTime;
        }
    }

    hasPower(powerName) {
        return this.activePower === powerName;
    }

    isPowerActive() {
        return this.activePower != null;
    }

    isOnCooldown(currentTime) {
        return (
            currentTime - this.cooldownStartTime < this.cooldownDuration
        );
    }

    getPowerProgress(currentTime) {
        if (!this.isPowerActive(currentTime)) return 0;
        const elapsed = currentTime - this.powerStartTime;
        return 1 - (elapsed / this.powerDuration); // da 1 a 0
    }

    getCooldownProgress(currentTime) {
        if (!this.isOnCooldown(currentTime)) return 0;
        const elapsed = currentTime - this.cooldownStartTime;
        return 1 - (elapsed / this.cooldownDuration); // da 1 a 0
    }
}

class Board {

    constructor(gridSize = 20) {
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");

        this.gridSize = gridSize;
        this.canvasSize = this.canvas.width;
        this.cellSize = this.canvasSize / this.gridSize;

        this.theme = {
            background: "#1b1b1b",
            grid: "#222"
        };
    }

    clear() {
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    }

    drawGrid() {
        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.lineWidth = 1;

        for (let i = 0; i <= this.canvasSize; i += this.cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.canvasSize);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.canvasSize, i);
            this.ctx.stroke();
        }
    }

    drawBase() {
        this.clear();
        this.drawGrid();
    }

    setTheme(theme) {
        this.theme = { ...this.theme, ...theme };
    }
}

class FoodManager {
    constructor(box, canvasSize, getLevelCallback) {
      this.box = box;
      this.canvasSize = canvasSize;
      this.getLevel = getLevelCallback;
      this.foods = [];
      this.foodTypes = [
          { type:"common",     color:"#ff5252", category:"classic", points:1,  weight: 55  },
          { type:"rare",       color:"#1e90ff", category:"classic", points:3,  weight: 25  },
          { type:"epic",       color:"#ff00ff", category:"classic", points:5,  weight: 10  },
          { type:"malus",      color:"#aaaaaa", category:"special", points:-2, weight: 5   },
          { type:"grow",       color:"#ffa500", category:"special", points:0,  weight: 2.5 },
          { type:"multiplier", color:"#00ffff", category:"special", points:0,  weight: 2.5 }
      ];
    }

    occupiesCell(x, y) {
      return this.foods.some(f => f.x === x && f.y === y);
    }

    getRandomFoodType() {
        const level = this.getLevel();

        // Aggiorna i pesi dinamicamente
        const dynamicTypes = this.foodTypes.map(food => {
            let newWeight = food.weight;
            if (food.type === "bonus") newWeight += level * 2;
            if (food.type === "rare") newWeight += level;
            return { ...food, weight: newWeight };
        });

        // Somma dei pesi totali
        const totalWeight = dynamicTypes.reduce((sum, f) => sum + f.weight, 0);

        // Genera un numero casuale tra 0 e totalWeight
        let random = Math.random() * totalWeight;

        for (let food of dynamicTypes) {
            if (random < food.weight) return food;
            random -= food.weight;
        }

        // Safety fallback: se per qualche motivo non è stato restituito nulla, prendi il primo cibo
        return dynamicTypes[0];
    }

    getFoodType(type) {
      const matchingTypes = this.foodTypes.filter(f => f.type === type);
      if (matchingTypes.length == 1)
          return matchingTypes[0];
    }

    getRandomClassicFood() {
        const classicFoods = this.foodTypes.filter(f => f.category === "classic");
        if (classicFoods.length === 0) return null;
        const index = Math.floor(Math.random() * classicFoods.length);
        return classicFoods[index];
    }

    isFarFromSnake(x, y, snakeSegments) {
        const minDistance = this.box * 2;
        return snakeSegments.every(segment => {
            const dx = segment.x - x;
            const dy = segment.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance >= minDistance;
        });
    }

    getValidSpawnPosition(isCellValid) {
        const gridSize = this.canvasSize / this.box;
        const freeCells = [];

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = i * this.box;
                const y = j * this.box;

                if (isCellValid(x, y)) {
                    freeCells.push({ x, y });
                }
            }
        }

        if (freeCells.length === 0) {
            return null
        };

        return freeCells[Math.floor(Math.random() * freeCells.length)];
    }

    spawn(snakeSegments, isCellValid, activeSkin) {
        const foodType = this.getRandomFoodType();
        const now = Date.now();
        const position = this.getValidSpawnPosition(isCellValid);
        if (!position) return;
        const food = {
            x: position.x,
            y: position.y,
            type: foodType.type,
            category: foodType.category,
            points: foodType.points,
            color: foodType.color,
            createdAt: now
        };

        if (activeSkin?.handleFoodSpawned) {
            activeSkin.handleFoodSpawned(food, this);
        }

        this.foods.push(food);

        // Se è speciale → spawn anche classic
        if (foodType.category !== "classic") {
            const classicType = this.getRandomClassicFood();
            if (classicType) {
                const position = this.getValidSpawnPosition(isCellValid);
                const classicFood = {
                    x: position.x,
                    y: position.y,
                    type: classicType.type,
                    category: classicType.category,
                    points: classicType.points,
                    color: classicType.color,
                    createdAt: now
                };

                if (activeSkin?.handleFoodSpawned) {
                    activeSkin.handleFoodSpawned(classicFood, this);
                }

                this.foods.push(classicFood);
            }
        }
    }

    removeExpiredFoods() {
        const now = Date.now();
        this.foods = this.foods.filter(food => {
            // I classic non scadono
            if (food.category === "classic") return true;
            // Gli altri scadono dopo 5 secondi
            return now - food.createdAt < 5000;
        });
    }

    checkCollision(head) {
        for (let i = 0; i < this.foods.length; i++) {
            const food = this.foods[i];

            if (head.x === food.x && head.y === food.y) {
                this.foods.splice(i, 1);
                return food; // <-- ritorniamo il cibo intero
            }
        }
        return null;
    }

    draw(ctx, box) {
        this.foods.forEach(food => {
            let shouldDraw = true;
            if (food.category !== "classic") {
                const elapsed = Date.now() - food.createdAt;
                const remaining = 5000 - elapsed;
                if (remaining <= 2000) {
                    shouldDraw = Math.floor(Date.now() / 200) % 2 === 0;
                }
            }
            if (!shouldDraw) return;
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(
                food.x + box / 2,
                food.y + box / 2,
                box * 0.3,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.closePath();
        });
    }
}

class Obstacle {
    constructor(x, y, size, box) {
        this.x = x;
        this.y = y;
        this.size = size; // dimensione in caselle
        this.box = box;
        this.state = "normal"; // normal | ice

        this.cracks = this.generateCracks();
        this.isBreaking = false;
        this.destroyed = false;
        this.fragments = [];
    }

    generateCracks() {
        this.cracks = [];
        const crackCount = 3;

        for (let i = 0; i < crackCount; i++) {
            const segments = [];
            let angle = Math.random() * Math.PI * 2;
            let length = 0.3;
            let steps = 4;

            let cx = 0.5;
            let cy = 0.5;

            for (let j = 0; j < steps; j++) {
                let nx = cx + Math.cos(angle) * length / steps;
                let ny = cy + Math.sin(angle) * length / steps;

                // 🔒 Clamp dentro il quadrato
                nx = Math.max(0.05, Math.min(0.95, nx));
                ny = Math.max(0.05, Math.min(0.95, ny));

                segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });

                cx = nx;
                cy = ny;

                angle += (Math.random() - 0.5) * 0.6;
            }

            this.cracks.push(segments);
        }
    }

    drawClassicObstacle(ctx) {
        const x = this.x * this.box;
        const y = this.y * this.box;
        const s = this.size * this.box;

        const gradient = ctx.createLinearGradient(x, y, x + s, y + s);
        gradient.addColorStop(0, "#1a1a2e");   // blu scuro
        gradient.addColorStop(0.5, "#162447"); // blu intermedio
        gradient.addColorStop(1, "#1f4068");   // blu acceso
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + s - 2, y + 2);
        ctx.lineTo(x + s - 2, y + s - 2);
        ctx.lineTo(x + 2, y + s - 2);
        ctx.closePath();
        ctx.fill();

        // bordo luminoso stabile
        ctx.save();
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 6;
        ctx.strokeStyle = "rgba(0,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        ctx.restore();

        // linee geometriche interne, basate su ostacolo
        ctx.strokeStyle = "rgba(0,255,255,0.2)";
        ctx.lineWidth = 1;
        const numLines = 4;
        for (let i = 1; i < numLines; i++) {
            // linee orizzontali
            ctx.beginPath();
            ctx.moveTo(x + 2, y + (s / numLines) * i);
            ctx.lineTo(x + s - 2, y + (s / numLines) * i);
            ctx.stroke();

            // linee verticali
            ctx.beginPath();
            ctx.moveTo(x + (s / numLines) * i, y + 2);
            ctx.lineTo(x + (s / numLines) * i, y + s - 2);
            ctx.stroke();
        }

        // piccoli punti luminosi distribuiti uniformemente sull’ostacolo
        ctx.fillStyle = "rgba(0,255,255,0.25)";
        const numDotsPerRow = 3;
        const spacing = s / (numDotsPerRow + 1); // distanza tra i puntini
        for (let row = 1; row <= numDotsPerRow; row++) {
            for (let col = 1; col <= numDotsPerRow; col++) {
                const px = x + col * spacing - 1; // -1 per centrare il puntino di 2px
                const py = y + row * spacing - 1;
                ctx.fillRect(px, py, 2, 2);
            }
        }
    }

    drawIceObstacle(ctx) {
        const x = this.x * this.box;
        const y = this.y * this.box;
        const s = this.size * this.box;

        // gradiente freddo base
        const gradient = ctx.createLinearGradient(x, y, x + s, y + s);
        gradient.addColorStop(0, "#a0e9ff"); // azzurro chiaro
        gradient.addColorStop(0.5, "#7ed6f5"); // azzurro intermedio
        gradient.addColorStop(1, "#4da6ff"); // azzurro intenso
        ctx.fillStyle = gradient;

        // rettangolo principale leggermente arrotondato
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + s - 2, y + 2);
        ctx.lineTo(x + s - 2, y + s - 2);
        ctx.lineTo(x + 2, y + s - 2);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;

        if (this.cracks && this.cracks.length) {
            this.cracks.forEach(crack => {
                ctx.beginPath();

                for (let i = 0; i < crack.length; i++) {
                    const px = x + crack[i].x * s;
                    const py = y + crack[i].y * s;

                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }

                ctx.stroke();
            });
        }

        ctx.restore();

        // bordo luminoso stabile
        ctx.save();
        ctx.shadowColor = "#99f6ff";
        ctx.shadowBlur = 6;
        ctx.strokeStyle = "rgba(153,246,255,0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        ctx.restore();

        // linee geometriche interne, basate su ostacolo
        ctx.strokeStyle = "rgba(153,246,255,0.2)";
        ctx.lineWidth = 1;
        const numLines = 4;
        for (let i = 1; i < numLines; i++) {
            // linee orizzontali
            ctx.beginPath();
            ctx.moveTo(x + 2, y + (s / numLines) * i);
            ctx.lineTo(x + s - 2, y + (s / numLines) * i);
            ctx.stroke();

            // linee verticali
            ctx.beginPath();
            ctx.moveTo(x + (s / numLines) * i, y + 2);
            ctx.lineTo(x + (s / numLines) * i, y + s - 2);
            ctx.stroke();
        }

        // piccoli punti luminosi distribuiti uniformemente sull’ostacolo
        ctx.fillStyle = "rgba(0,255,255,0.25)";
        const numDotsPerRow = 3;
        const spacing = s / (numDotsPerRow + 1);
        for (let row = 1; row <= numDotsPerRow; row++) {
            for (let col = 1; col <= numDotsPerRow; col++) {
                const px = x + col * spacing - 1;
                const py = y + row * spacing - 1;
                ctx.fillRect(px, py, 2, 2);
            }
        }

        // --- FRAMMENTI IN DISTRUZIONE ---
        if (this.isBreaking) {
            for (let i = this.fragments.length - 1; i >= 0; i--) {
                const f = this.fragments[i];

                ctx.save();
                ctx.globalAlpha = f.alpha;

                const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
                grad.addColorStop(0, "#ffffff");
                grad.addColorStop(1, "#4da6ff");

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // aggiornamento
                f.x += f.dx;
                f.y += f.dy;
                f.alpha -= 0.05;
                f.size *= 0.95;

                if (f.alpha <= 0) {
                    this.fragments.splice(i, 1);
                }

                if (this.fragments.length === 0) {
                    this.destroyed = true;
                }

            }
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.state === "ice") {
            this.drawIceObstacle(ctx);
        } else {
            this.drawClassicObstacle(ctx);
        }
        // ctx.fillRect(this.x * this.box, this.y * this.box, this.box, this.box);
        ctx.restore();
    }

    collidesWith(x, y) {
        return this.x * this.box === x && this.y * this.box === y;
    }

    collidesWithCell(x, y) {
        return this.x === x && this.y === y;
    }

    break() {
        this.isBreaking = true;

        const fragmentCount = 12;

        for (let i = 0; i < fragmentCount; i++) {
            this.fragments.push({
                x: (this.x + this.size / 2) * this.box,
                y: (this.y + this.size / 2) * this.box,
                dx: (Math.random() - 0.5) * 6,
                dy: (Math.random() - 0.5) * 6,
                size: 4 + Math.random() * 4,
                alpha: 1
            });
        }
    }
}

class ObstacleManager {
    constructor({ gridSize, box, canvasSize }) {
        this.gridSize = gridSize;
        this.box = box;
        this.canvasSize = canvasSize;
        this.obstacles = [];
    }

    clear() {
        this.obstacles = [];
    }

    remove(target) {
        this.obstacles = this.obstacles.filter(o => o !== target);
    }

    generate(count, snake, foodManager, skin) {
        for (let i = 0; i < count; i++) {
            let pos;
            let tries = 0;

            let tooCloseToSnake, collidesWithObstacle, collidesWithFood;

            do {
                pos = {
                    x: Math.floor(Math.random() * this.gridSize),
                    y: Math.floor(Math.random() * this.gridSize)
                };

                tooCloseToSnake = snake.segments.some(seg =>
                    Math.abs(seg.x - pos.x) <= 2 &&
                    Math.abs(seg.y - pos.y) <= 2
                );

                collidesWithObstacle = this.obstacles.some(o =>
                    o.collidesWith(pos.x, pos.y)
                );

                collidesWithFood = foodManager.foods.some(f =>
                    f.x === pos.x && f.y === pos.y
                );

                tries++;
                if (tries > 100) break;

            } while (tooCloseToSnake || collidesWithObstacle || collidesWithFood);

            const obstacle = new Obstacle(pos.x, pos.y, 1, this.box);

            if (skin?.onObstacleSpawn) {
                const destroy = skin.onObstacleSpawn(obstacle);
                if (destroy) continue;
            }

            this.obstacles.push(obstacle);
        }
    }

    checkCollision(head) {
        for (const obstacle of this.obstacles) {
            if (obstacle.destroyed) {
                this.remove(obstacle);
            }
            else if (obstacle.collidesWith(head.x, head.y)) {
                return obstacle;
            }
        }
        return null;
    }

    occupiesCell(x, y) {
        return this.obstacles.some(o => o.collidesWithCell(x, y));
    }

    updateState(hasIcePower) {
        this.obstacles.forEach(o => {
            o.state = hasIcePower ? "ice" : "normal";
        });
    }

    draw(ctx) {
        this.obstacles.forEach(o => o.draw(ctx));
    }
}

class ScoreManager {
    constructor() {
        this.score = 0;

        this.lastFoodType = null;
        this.sameFoodStreak = 0;
        this.foodTimestamps = [];
    }

    reset() {
        this.score = 0;
        this.lastFoodType = null;
        this.sameFoodStreak = 0;
        this.foodTimestamps = [];
    }

    getScore() {
        return this.score;
    }

    addBasePoints(points) {
        this.score += points;
    }

    handleCombo(foodType) {
        let bonus = 0;

        // streak stesso cibo
        if (foodType === this.lastFoodType) {
            this.sameFoodStreak++;
        } else {
            this.sameFoodStreak = 1;
            this.lastFoodType = foodType;
        }

        if (this.sameFoodStreak === 3) {
            bonus += 5;
            this.sameFoodStreak = 0;
        }

        // frenzy 10 cibi in 10 secondi
        const now = Date.now();
        this.foodTimestamps.push(now);

        this.foodTimestamps = this.foodTimestamps.filter(
            t => now - t <= 10000
        );

        if (this.foodTimestamps.length >= 10) {
            bonus += 10;
            this.foodTimestamps = [];
        }

        this.score += bonus;

        return bonus;
    }

    getComboProgress() {
        const now = Date.now();

        this.foodTimestamps = this.foodTimestamps.filter(
            t => now - t <= 10000
        );

        return {
            frenzy: Math.min(this.foodTimestamps.length / 10, 1),
            streak: Math.min(this.sameFoodStreak / 3, 1)
        };
    }
}

class InputManager {
    constructor(config) {
        this.onDirectionChange = config.onDirectionChange;
        this.onPause = config.onPause;
        this.onRestart = config.onRestart;
        this.onMenu = config.onMenu;
        this.onPower = config.onPower;

        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        document.addEventListener("keydown", (event) => {
            const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
            if (arrows.includes(event.key)) event.preventDefault();

            switch (event.key) {
                case "ArrowUp":    this.onDirectionChange?.(DIRECTIONS.UP);; break;
                case "ArrowDown":  this.onDirectionChange?.(DIRECTIONS.DOWN); break;
                case "ArrowLeft":  this.onDirectionChange?.(DIRECTIONS.LEFT); break;
                case "ArrowRight": this.onDirectionChange?.(DIRECTIONS.RIGHT); break;

                case "p":
                case "P":
                case " ":
                    this.onPause?.();
                    break;

                case "r":
                case "R":
                    this.onRestart?.();
                    break;

                case "m":
                case "M":
                    this.onMenu?.();
                    break;

                case "x":
                case "X":
                    this.onPower?.();
                    break;
            }
        });
    }

    initTouch() {
        const map = {
            upBtn: DIRECTIONS.UP,
            downBtn: DIRECTIONS.DOWN,
            leftBtn: DIRECTIONS.LEFT,
            rightBtn: DIRECTIONS.RIGHT
        };

        for (let id in map) {
            const el = document.getElementById(id);
            if (!el) continue;

            el.addEventListener("touchstart", () => {
                this.onDirectionChange?.(Object.keys(DIRECTIONS).find(key => DIRECTIONS[key] === map[id]));
            });
        }

        document.getElementById("specialBtn")
            ?.addEventListener("touchstart", () => this.onPower?.());

        document.getElementById("touchPauseBtn")
            ?.addEventListener("touchstart", () => this.onPause?.());

        document.getElementById("restartBtn")
            ?.addEventListener("touchstart", () => this.onRestart?.());
    }
}

class GameUI {
    constructor(config) {
        this.startButton = document.getElementById("startBtn");
        this.onStart = config.onStart;
        this.scoreContainer = document.getElementById("score");
        this.mainMenu = document.getElementById("mainMenu");
        this.powerBar = document.getElementById("powerBar");
        this.cooldownBar = document.getElementById("cooldownBar");
        this.frenzyBar = document.getElementById("combo-frenzy");
        this.streakBar = document.getElementById("combo-streak");
        this.touchArrows = document.getElementById("touchArrows");
        this.touchControls = document.getElementById("touchControls");
        this.speedSelect = document.getElementById("speedSelect");

        this.setupStartButton();
    }

    startUI() {
        this.mainMenu.style.display = "none";
        this.touchArrows?.classList.remove("hidden");
        this.touchControls?.classList.remove("hidden");
    }

    setupStartButton() {
        if (!this.startButton) return;

        this.startButton.addEventListener("click", () => {
            this.onStart?.();
        });
    }

    showMenu() {
        this.mainMenu.style.display = "block";
    }

    getSelectedSpeed() {
        return parseInt(this.speedSelect.value);
    }

    updateScore(score) {
        this.scoreContainer.innerText = score;
    }

    updatePowerUI(powerProgress, cooldownProgress, color) {
        this.powerBar.style.width = (powerProgress * 100) + "%";
        this.powerBar.style.background = color;
        this.powerBar.style.opacity = powerProgress > 0 ? "1" : "0";

        this.cooldownBar.style.width = (cooldownProgress * 100) + "%";
        this.cooldownBar.style.background = color;
        this.cooldownBar.style.opacity = cooldownProgress > 0 ? "1" : "0";
    }

    updateComboUI(frenzyProgress, streakProgress) {
        this.frenzyBar.style.width = (frenzyProgress * 100) + "%";
        this.streakBar.style.width = (streakProgress * 100) + "%";
    }

    triggerLegendFeedback(type) {
        const item = document.querySelector(`#legend .legend-item[data-type="${type}"]`);
        if(!item) return;
        item.classList.add("active");
        setTimeout(() => item.classList.remove("active"), 500);
    }

    drawOverlay(ctx, text, canvasSize, background = true) {
        ctx.save();

        if (background) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(0, 0, canvasSize, canvasSize);
        }

        if (text) {
            ctx.fillStyle = "#00ffcc";
            ctx.font = "bold 30px 'Orbitron', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(text, canvasSize / 2, canvasSize / 2);
        }

        ctx.restore();
    }

    showBonus(text, currentTime) {
        this.bonusText = {
            text,
            startTime: currentTime,
            duration: 5000,
            yOffset: 0
        };
    }

    drawBonus(ctx, canvasWidth, currentTime) {
        if (!this.bonusText) return;

        const elapsed = currentTime - this.bonusText.startTime;
        const progress = elapsed / this.bonusText.duration;

        if (progress >= 1) {
            this.bonusText = null;
            return;
        }

        // Fade out negli ultimi 30% della durata
        let alpha = 1;
        if (progress > 0.7) {
            alpha = 1 - (progress - 0.7) / 0.3;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#00ffcc";
        ctx.font = "28px 'Orbitron', sans-serif";
        ctx.textAlign = "center";

        ctx.fillText(
            this.bonusText.text,
            canvasWidth / 2,
            80 - this.bonusText.yOffset
        );
        ctx.restore();

        this.bonusText.yOffset += 0.6;
    }
}

class Game {
    static STATES = Object.freeze({
        MENU: "menu",
        RUNNING: "running",
        PAUSED: "paused",
        GAMEOVER: "gameover"
    });

    constructor() {
        this.state = Game.STATES.MENU;
        
        this.initCore();
        this.initManagers();
        this.initSkinSystem();
        this.initInput();
    }

    initCore() {
        this.gridSize = 20;
        this.board = new Board(this.gridSize);
        this.gameSpeed = 100;
        this.level = 1;
        this.obstaclesCount = 4;
        this.animationTime = 0;
    }
    initManagers() {
        this.timer = new Timer();
        this.scoreManager = new ScoreManager();

        this.ui = new GameUI({
            onStart: () => this.start()
        });

        this.obstacleManager = new ObstacleManager({
            gridSize: this.gridSize,
            box: this.board.cellSize,
            canvasSize: this.board.canvasSize
        });
    }
    initSkinSystem() {
        const onSkinChange = (newSkin) => {
            this.snake.skin = newSkin;
        };

        this.skinManager = new SkinManager(onSkinChange);

        this.skinManager.register(ClassicSnakeSkin);
        this.skinManager.register(IceSkin);
        this.skinManager.register(LavaSkin);
        this.skinManager.register(GoldSkin);
        this.skinManager.register(NeonSkin);
        this.skinManager.register(DragonSkin);
        this.skinManager.register(RainbowSkin);
        this.skinManager.register(GhostSkin);
        this.skinManager.register(PlasmaSkin);

        this.skinManager.init();

        this.snake = new Snake(this.board.cellSize, this.skinManager.currentSkin);
    }
    initInput() {
        this.inputManager = new InputManager(this.getInputCallbacks());
    }

    start() {
        this.reset();
        this.ui.startUI();
        this.state = Game.STATES.RUNNING;
        this.timer.start();
        this.foodManager.spawn(this.snake.segments, (x, y) => this.isCellValid(x, y), this.snake.skin);
        this.obstacleManager.generate(this.obstaclesCount, this.snake, this.foodManager, this.snake.skin);
        requestAnimationFrame((t) => this.loop(t));
    }
    reset() {
        this.lastUpdateTime = -1;
        this.level = 1;
        this.baseSpeed = this.ui.getSelectedSpeed();
        this.updateSpeed();
        this.snake = new Snake(
            this.board.cellSize,
            new this.skinManager.currentSkin.constructor()
        );
        this.foodManager = new FoodManager(this.board.cellSize, this.board.canvasSize, () => this.level);
        this.scoreManager.reset();
        this.obstacleManager.clear();
        this.timer.reset();
        this.ui.updateScore(this.scoreManager.getScore());
        this.ui.updateComboUI(0, 0);
        this.ui.updatePowerUI(0, 0, this.snake.skin.getCooldownColor());
    }
    /* -------------------------------------------------------------------------
                                 INPUT MANAGEMENT
    ------------------------------------------------------------------------- */
    
    getInputCallbacks() {
        return {
            onDirectionChange: (dir) => this.handleDirection(dir),
            onPause: () => this.togglePause(),
            onRestart: () => this.start(),
            onMenu: () => this.handleMenu(),
            onPower: () => this.activatePower()
        };
    }
    
    handleDirection(newDir) {
        if (this.isPaused() || this.isGameOver()) return;
        const current = this.snake.direction;
        const isOpposite = (current.x + newDir.x === 0 && current.y + newDir.y === 0);
        if (!isOpposite) this.snake.direction = newDir;
    }
    handleMenu() {
        if (this.isPaused() || this.isGameOver()) {
            this.returnToMenu();
        }
    }

    /* -------------------------------------------------------------------------
                                STATE MANAGEMENT
    ------------------------------------------------------------------------- */
    pause() {
        if (!this.isRunning()) return;
        this.state = Game.STATES.PAUSED;
        this.timer.stop();
    }
    resume() {
        if (!this.isPaused()) return;
        this.state = Game.STATES.RUNNING;
        this.timer.start();
    }
    togglePause() {
        this.isPaused() ? this.resume() : this.pause();
    }
    gameOver() {
        this.state = Game.STATES.GAMEOVER;
        this.timer.stop();
    }
    isPaused() {
        return this.state == Game.STATES.PAUSED;
    }
    isRunning() {
        return this.state == Game.STATES.RUNNING;
    }
    isGameOver() {
        return this.state == Game.STATES.GAMEOVER;
    }
    returnToMenu() {
        this.state = Game.STATES.MENU;
        this.reset();
        this.ui.showMenu();
    }
    isCellOccupied(x, y) {
        return (this.snake.occupiesCell(x, y) || this.foodManager.occupiesCell(x, y) || this.obstacleManager.occupiesCell(x, y));
    }
    isCellValid(x, y) {
        return !this.isCellOccupied(x, y);
    }

    checkWallCollision() {
        const head = this.snake.head;
        if (head.x < 0 || head.y < 0 || head.x >= this.board.canvasSize || head.y >= this.board.canvasSize) {
            if (this.snake.skin.onWallCollision?.(this.snake, this) === false) {
                return false;
            }
            return true;
        }
        return false;
    }

    /* -------------------------------------------------------------------------
                                      FOOD
    ------------------------------------------------------------------------- */
    handleFood() {
        const eatenFood = this.foodManager.checkCollision(this.snake.head);
        if (eatenFood) { // prima la skin può modificare il cibo
            if (this.snake.skin && this.snake.skin.onSnakeEat) {
                this.snake.skin.onSnakeEat(this.snake, eatenFood, this);
            }
            this.scoreManager.addBasePoints(eatenFood.points);
            const bonus = this.scoreManager.handleCombo(eatenFood.type);
            this.ui.updateScore(this.scoreManager.getScore());
            if (bonus === 5) {
                this.ui.showBonus("Combo x3! +5 pts", this.animationTime);
            } else if (bonus === 10) {
                this.ui.showBonus("Hunger Frenzy! +10 pts", this.animationTime);
            }
            this.ui.updateScore(this.scoreManager.getScore());
            this.ui.triggerLegendFeedback(eatenFood.type);
            this.foodManager.spawn(this.snake.segments, (x, y) => this.isCellValid(x, y), this.snake.skin);
        } else {
            this.snake.removeTail();
        }
    }
    /* -------------------------------------------------------------------------
                                  SPECIAL POWERS
    ------------------------------------------------------------------------- */
    activatePower() {
        if (!this.isRunning()) return;
        const now = this.animationTime;
        this.snake.activatePower(now, this);
    }
    /* -------------------------------------------------------------------------
                                      DRAWING
    ------------------------------------------------------------------------- */
    draw() {
        const renderContext = {
            ctx: this.board.ctx,
            cellSize: this.board.cellSize,
            getTime: () => this.animationTime
        };
        this.board.drawBase();
        this.snake.draw(renderContext);
        this.foodManager.draw(this.board.ctx, this.board.cellSize);
        this.obstacleManager.updateState(this.snake.hasPower("ice"));
        this.obstacleManager.draw(this.board.ctx);
        this.ui.drawBonus(this.board.ctx, this.board.canvasSize, this.animationTime);
        if (this.isPaused()) {
            this.ui.drawOverlay(this.board.ctx, "PAUSA", this.board.canvasSize);
        }
        if (this.isGameOver()) {
            this.ui.drawOverlay(this.board.ctx, "GAME OVER", this.board.canvasSize);
        }
        const now = this.animationTime;
        const powerProgress = this.snake.getPowerProgress(now);
        const cooldownProgress = this.snake.getCooldownProgress(now);
        const color = this.snake.skin.getCooldownColor();
        this.ui.updatePowerUI(powerProgress, cooldownProgress, color);
        const combo = this.scoreManager.getComboProgress();
        this.ui.updateComboUI(combo.frenzy, combo.streak);
    }
    /* -------------------------------------------------------------------------
                                  LEVEL & SPEED
    ------------------------------------------------------------------------- */
    updateLevel() {
        const newLevel = Math.floor(this.scoreManager.getScore() / 10) + 1;
        if (newLevel !== this.level) {
            this.level = newLevel;
            this.updateSpeed();
            this.obstacleManager.clear();
            this.obstaclesCount++;
            this.obstacleManager.generate(this.obstaclesCount, this.snake, this.foodManager, this.snake.skin);
        }
    }
    updateSpeed() {
        const difficultyFactor = Math.sqrt(this.level - 1) * 6;
        this.gameSpeed = Math.max(25, this.baseSpeed - difficultyFactor);
    }
    /* -------------------------------------------------------------------------
                                UPDATE & RENDER
    ------------------------------------------------------------------------- */
    update(currentTime) {
        if (!this.isRunning()) return;
        this.timer.update();
        if (this.snake.skin && this.snake.skin.handleFoodCollected) {
            this.foodManager.foods.forEach(food => {
                this.snake.skin.handleFoodCollected(food, this);
            });
        }
        this.snake.move();
        if (this.snake.skin?.update) {
            this.snake.skin.update(this.snake, this);
        }
        this.snake.updatePower(currentTime);
        if (this.checkWallCollision() || this.snake.collidesWithSelf()) {
            this.gameOver();
            return;
        }
        const obstacle = this.obstacleManager.checkCollision(this.snake.head);
        if (obstacle) { // prima di gameover, lascia alla skin decidere se può bypassare
            if (!(this.snake.skin && this.snake.skin.onObstacleCollision?.(obstacle, this.snake, this))) {
                this.gameOver();
                return;
            }
        }
        this.foodManager.removeExpiredFoods(); // fa sparire i cibi special dopo 5s
        this.handleFood(); // gestione poteri che agiscono sui cibi raccolti
        if (this.snake.skin && this.snake.skin.handleFoodCollected) {
            this.foodManager.foods.forEach(food => {
                if (food.collected) this.snake.skin.handleFoodCollected(food, this);
            });
        }
        this.updateLevel();
    }
    loop(currentTime) {
        let delta = 0
        if (this.lastUpdateTime == -1) {
            delta = this.gameSpeed;
        } else {
            delta = currentTime - this.lastUpdateTime;
        }
        if (delta >= this.gameSpeed) {
            if (!this.isPaused() && !this.isGameOver()) {
                this.update(currentTime);
                this.lastUpdateTime = currentTime;
            }
        }
        this.animationTime = currentTime;
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

let gameInstance = new Game();
