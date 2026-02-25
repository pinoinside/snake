const touchArrows = document.getElementById("touchArrows");
const touchControls = document.getElementById("touchControls");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const powerBar = document.getElementById("powerBar");
const cooldownBar = document.getElementById("cooldownBar");
const obstacleOptionContainer = document.getElementById("obstacleOptionContainer");
const noObstaclesCheckbox = document.getElementById("noObstaclesCheckbox");

let startTime, elapsedTime = 0, timerInterval;
let gridSize = 20, box = 20, canvasSize = canvas.width;
let gameSpeed = 100, level = 1;
let snake = [], direction = "RIGHT", score = 0, comboCount = 0;
let foods = [], obstacles = [], powerUps = [];
let game, isPaused = false, animationTick = 0;
let darkMode = false, timeAttack = false;
let nextFoodMultiplier = 1; // se >1, moltiplica il punteggio del prossimo cibo


let foodTypes = [
    { color:"#ff5252", value:1, type:"common" },
    { color:"#1e90ff", value:3, type:"rare" },
    { color:"#ff00ff", value:5, type:"epic" },
    { color:"#ffa500", value:0, type:"grow" },
    { color:"#00ffff", value:0, type:"multiplier" }
];

let comboTypeCount = 0;       // conta cibi dello stesso tipo consecutivi
let comboTypeCurrent = null;  // tipo corrente della combo
let comboTimeCount = 0;       // conta quanti cibi in un intervallo
let comboTimeStart = 0;       // timestamp di inizio combo temporale
const comboTimeWindow = 10000; // 10 secondi per la combo temporale

let specialActive = false;       // se il potere è attivo
let specialDuration = 3000;      // durata del potere in ms
let specialStartTime = 0;        // timestamp di inizio
let specialEnding = false;
let specialCooldownActive = false;
let specialCooldownDuration = 5000; // 5 secondi
let specialCooldownStart = 0;
let plasmaTrail = [];
let dragonFlame = []; // array di celle della fiammata per effetto visivo
let neonTimeActive = false;      // il potere è attivo
let neonTimeStart = 0;           // timestamp di inizio potere
let neonTimeDuration = 5000;     // durata in millisecondi (5 secondi)
let rainbowStormActive = false;
let rainbowStormStart = 0;
let rainbowStormDuration = 5000; // 5 secondi
let icePowerActive = false;
let icePowerStart = 0;
const icePowerDuration = 5000; // durata in ms
let iceParticles = [];
let lavaPowerActive = false;
let lavaTrail = [];
const lavaTrailDuration = 2000; // ogni traccia dura 2 secondi
let goldPowerActive = false;
const goldMultiplier = 4;

const scoreSpan = document.getElementById("score");
const scoreContainer = document.getElementById("score-container");
const overlay = document.getElementById("overlay");
const menuSkinSelect = document.getElementById("menuSkinSelect");
const inGameSkinSelect = document.getElementById("skinSelect");

let currentSkin = localStorage.getItem("snakeSkin") || "classic";
inGameSkinSelect.value = currentSkin;
menuSkinSelect.value = currentSkin;

// ===================================
// SKINS
// ===================================
const skins = {
  classic: { head: "#4CAF50", body: "#81C784", glow: false },
  ice: { head: "#a0f0ff", body: "#60d0ff", glow: true },
  lava: { head: "#ff4500", body: "#ff7f50", glow: true },
  gold: { head: "#ffd700", body: "#ffec8b", glow: true },
  neon: { head: "#00ff88", body: "#00cc66", glow: true },
  dragon: {},
  rainbow: {},
  ghost: {},
  plasma: {}
};

Object.keys(skins).forEach(key => {
const option = document.createElement("option");
option.value = key;
option.textContent = key.toUpperCase();
menuSkinSelect.appendChild(option);
});

// ===================================
// UTILS
// ===================================
function getRandomGridPosition(){
return { x: Math.floor(Math.random()*gridSize)*box, y: Math.floor(Math.random()*gridSize)*box };
}

function collision(x, y, array){
    // Se il fantasma è attivo, ignora collisione con il serpente
    if(currentSkin === "ghost" && specialActive) return false;

    return array.some(s => Math.abs(s.x - x) < 0.1 && Math.abs(s.y - y) < 0.1);
}

function collisionWithObstacles(x, y){
    for(let i = obstacles.length - 1; i >= 0; i--){
        const o = obstacles[i];
        if(o.x === x && o.y === y){
          if(currentSkin === "ice" && icePowerActive){
              createIceExplosion(o.x, o.y);
              obstacles.splice(i, 1);
              return false;
            }
            if(currentSkin === "ghost" && specialActive){
                return false; // fantasma ignora ostacoli
            }
            return true; // collisione normale
        }
    }
    return false; // nessun ostacolo in quella cella
}

function collisionWithFood(headX, headY, foodX, foodY){
return headX === foodX && headY === foodY;
}

function updateTimer(){
const now = Date.now();
const diff = elapsedTime + (now - startTime);
const seconds = Math.floor(diff / 1000) % 60;
const minutes = Math.floor(diff / 1000 / 60);
document.getElementById("timer").textContent =
  `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}

// ===================================
// GAME CONTROL
// ===================================
function startGame(){
  startTime = Date.now(); elapsedTime=0; clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 100);

  gameSpeed = parseInt(document.getElementById("speedSelect").value);
  box = canvasSize / gridSize;

  currentSkin = menuSkinSelect.value;
  localStorage.setItem("snakeSkin", currentSkin);
  inGameSkinSelect.value = currentSkin;

  snake = [{x:9*box,y:9*box},{x:8*box,y:9*box},{x:7*box,y:9*box}];
  direction = "RIGHT"; score=0; comboCount=0;
  foods=[]; obstacles=[]; powerUps=[];
  level = 1; darkMode=false; timeAttack=false;

  spawnFood(); spawnObstacles();

  document.getElementById("mainMenu").style.display = "none";
  touchArrows.classList.remove("hidden");
  touchControls.classList.remove("hidden");

  clearInterval(game);
  game = setInterval(gameLoop, gameSpeed);
  isPaused=false;
}

function gameLoop(){
  update();
  render();
  updatePowerBar();
  updateCooldownBar();
}

function update(){
  moveSnake();

  if(checkWallCollision()){
    gameOver(); return;
  }

  handleFood();
  handlePowerUps();
  handleLevelSpeed();
}

function render(){
  clearCanvas();
  drawGrid();
  drawObstacles();
  drawIceParticles();
  drawPlasmaTrail();
  drawDragonFlame();
  drawLavaTrail();
  drawSnake();
  drawFoods();
  drawPowerUps();
}

// ===================================
// MOVEMENT & COLLISION
// ===================================
function moveSnake(){
  let headX = snake[0].x;
  let headY = snake[0].y;

  if(direction==="LEFT") headX -= box;
  if(direction==="UP") headY -= box;
  if(direction==="RIGHT") headX += box;
  if(direction==="DOWN") headY += box;

  // Plasma: passaggio bordi opposti
  if(currentSkin === "plasma" && specialActive){
      if(headX < 0) headX = canvasSize - box;
      if(headX >= canvasSize) headX = 0;
      if(headY < 0) headY = canvasSize - box;
      if(headY >= canvasSize) headY = 0;
      plasmaTrail.push({
        x: headX + box/2,
        y: headY + box/2,
        size: box,
        alpha: 0.6
      });
  }
  else if(currentSkin === "lava" && lavaPowerActive){
      lavaTrail.push({
          x: headX,
          y: headY,
          created: Date.now()
      });
  }
  else {
      // collisione bordi normali
      if(headX < 0 || headY < 0 || headX >= canvasSize || headY >= canvasSize){
          gameOver();
          return;
      }
  }
  snake.unshift({x:headX,y:headY});
}

function checkWallCollision(){
    const head = snake[0];

    // collisione con i bordi
    if(head.x < 0 || head.y < 0 || head.x >= canvasSize || head.y >= canvasSize) return true;

    // collisione con se stessa
    if(collision(head.x, head.y, snake.slice(1))) return true;

    // collisione con ostacoli
    if(collisionWithObstacles(head.x, head.y)) return true;

    return false;
}

function gameOver(){
    clearInterval(game);
    overlay.style.opacity = 1;
    overlay.innerText = "GAME OVER";
    gameSpeed = parseInt(document.getElementById("speedSelect").value); // velocità iniziale
    clearInterval(timerInterval);
    elapsedTime += Date.now() - startTime;
    updateTimer();

    comboTypeCount = 0;
    comboTypeCurrent = null;
    comboTimeCount = 0;
    comboTimeStart = 0;
    updateComboBar(); // aggiorna la barra visiva
}

// ===================================
// FOOD
// ===================================
function spawnFood(){
let rand = Math.random();
let type;

if(neonTimeActive){
    // Neon attivo → tutti cibi rari
    type = { color: "#1e90ff", value: 3, type: "rare" };
} else {
    // logica normale
    if(rand < 0.55){
        type = { color: "#ff5252", value: 1, type: "common" };
    } else if(rand < 0.8){
        type = { color: "#1e90ff", value: 3, type: "rare" };
    } else if(rand < 0.9){
        type = { color: "#ff00ff", value: 5, type: "epic" };
    } else if(rand < 0.95){
        type = { color: "#aaaaaa", value: -2, type: "malus" };
    } else if(rand < 0.975){
        type = { color: "#ffa500", value: 0, type: "grow" };
    } else {
        type = { color: "#00ffff", value: 0, type: "multiplier" };
    }
}

let newFood;
do {
    newFood = {
        x: Math.floor(Math.random()*gridSize)*box,
        y: Math.floor(Math.random()*gridSize)*box,
        color: type.color,
        value: type.value,
        type: type.type,
        createdAt: Date.now()
    };
} while (
    collision(newFood.x, newFood.y, snake) ||             // non sul serpente
    foods.some(f => f.x === newFood.x && f.y === newFood.y) || // non su altri cibi
    obstacles.some(o => o.x === newFood.x && o.y === newFood.y) // non sugli ostacoli
);

foods.push(newFood);

// se è malus, spawn immediato di un cibo positivo
if(type.type === "malus" || type.type === "grow" || type.type === "multiplier" ){
    spawnPositiveFood();
}
}

function spawnPositiveFood(){
const positiveTypes = [{color:"#ff5252",value:1,type:"common"},{color:"#00e5ff",value:3,type:"rare"},{color:"#ff00ff",value:5,type:"epic"}];
let type=positiveTypes[Math.floor(Math.random()*positiveTypes.length)];
let newFood; do{
  const pos=getRandomGridPosition();
  newFood={x:pos.x,y:pos.y,color:type.color,value:type.value,type:type.type,createdAt:Date.now()};
} while(collision(newFood.x,newFood.y,snake) || foods.some(f=>f.x===newFood.x && f.y===newFood.y));
foods.push(newFood);
}

function handleFood(){
let ateFood = false;
const now = Date.now();

foods = foods.filter(f => {
    // scadenza malus
    if(f.type === "malus" && now - f.createdAt > 5000) return false;

    if(collisionWithFood(snake[0].x, snake[0].y, f.x, f.y)){

        // ===== Gestione cibi speciali =====
        if(f.type === "grow"){
            snake.push({...snake[snake.length-1]}); // aumenta lunghezza senza punti
        } else if(f.type === "multiplier"){
            nextFoodMultiplier = 2;
        } else {
            // punteggio normale, con eventuale moltiplicatore
            if(!goldPowerActive) {
              score += f.value * nextFoodMultiplier;
            } else {
              score += f.value * nextFoodMultiplier * goldMultiplier;
            }
            nextFoodMultiplier = 1;
        }

        // Evidenzia legenda
        highlightLegend(f.type);

        // ===== Combo di tipo =====
        if(f.type !== "malus" && f.type !== "grow" && f.type !== "multiplier"){
            if(comboTypeCurrent === f.type){
                comboTypeCount++;
            } else {
                comboTypeCurrent = f.type;
                comboTypeCount = 1;
            }

            if(comboTypeCount >= 3){
                applyComboBonus("type", f.type);
                comboTypeCount = 0;
                comboTypeCurrent = null;
            }
        }

        // ===== Combo temporale =====
        if(comboTimeStart === 0 || now - comboTimeStart > comboTimeWindow){
            comboTimeStart = now;
            comboTimeCount = 1;
        } else {
            comboTimeCount++;
            updateComboBar();
            if(comboTimeCount >= 10){
                applyComboBonus("time");
                comboTimeStart = 0;
                comboTimeCount = 0;
                updateComboBar();
            }
        }

        // Aggiorna punteggio
        scoreSpan.innerText = score;
        scoreContainer.classList.add("increment");
        setTimeout(()=>scoreContainer.classList.remove("increment"), 200);

        ateFood = true;
        return false;
    }

    return true;
});

if(!ateFood) snake.pop();
else spawnFood();
}

// ===== Evidenzia legenda con flash =====
function highlightLegend(type){
const legendItem = document.querySelector(`#legend .legend-item[data-type="${type}"]`);
if(!legendItem) return;
legendItem.classList.add("highlight");
setTimeout(()=>legendItem.classList.remove("highlight"), 500);
}

// ===== Combo bonus con effetti visivi =====
function applyComboBonus(comboType, foodType){
overlay.innerText = comboType === "type" ? "COMBO x3!" : "COMBO RAPIDA!";
overlay.style.opacity = 1;
setTimeout(()=>{ if(!isPaused) overlay.style.opacity = 0; }, 800);

if(comboType === "type"){
    score += 5;
    // Flash sulla legenda del tipo di cibo
    const legendItem = document.querySelector(`#legend .legend-item[data-type="${foodType}"]`);
    if(legendItem){
        legendItem.classList.add("combo-flash");
        setTimeout(()=>legendItem.classList.remove("combo-flash"), 500);
    }
} else if(comboType === "time"){
    score += 10;
    adjustGameSpeed(gameSpeed - 20, 3000);
}

scoreSpan.innerText = score;
}

// ===== Aggiorna barra progressione combo temporale =====
function updateComboBar(){
const bar = document.getElementById("combo-bar");
const percent = Math.min((comboTimeCount / 10) * 100, 100);
bar.style.width = percent + "%";
}

function activateSpecial(){
    if(specialActive || specialCooldownActive) return;
    specialActive = true;
    specialStartTime = Date.now();
    if(currentSkin === "dragon"){
        shootDragonFlame();
    }
    else if(currentSkin === "neon") {
        activateNeonTime();
        if(neonTimeActive){
            foods.forEach(f => {
                f.type = "rare";
                f.color = "#1e90ff";
                f.value = 3;
            });
        }
    }
    else if(currentSkin === "rainbow"){
      activateRainbowStorm();
    }
    else if(currentSkin === "ice") {
        icePowerActive = true;
        icePowerStart = Date.now();
    }
    else if(currentSkin === "lava"){
        lavaPowerActive = true;
    }
    else if(currentSkin === "gold"){
        goldPowerActive = true;
    }
    setTimeout(() => {
        endSpecial();
    }, specialDuration);
}

function endSpecial(){
    specialActive = false;
    specialEnding = true;

    // termina effetti
    if(currentSkin === "rainbow") rainbowStormActive = false;
    else if(currentSkin === "ice") icePowerActive = false;
    else if(currentSkin === "lava") lavaPowerActive = false;
    else if(currentSkin === "gold") goldPowerActive = false;

    // attiva cooldown
    specialCooldownActive = true;
    specialCooldownStart = Date.now();

    setTimeout(() => {
        specialCooldownActive = false;
    }, specialCooldownDuration);
}

function getCooldownColor(){
    switch(currentSkin){
        case "ice":
            return "#00e5ff";
        case "ghost":
            return "#ffffff";
        case "plasma":
            return "#7f00ff";
        case "rainbow":
            return "hsl(" + (animationTick * 5 % 360) + ",100%,50%)";
        case "gold":
            return "#ffd700";
        case "lava":
            return "#ff4500";
        case "neon":
            return "#00ff88";
        case "dragon":
            return "#00cc00";
        default:
            return "#ffaa00";
    }
}

// ===================================
// POWER-UPS
// ===================================
function spawnPowerUp(type){
const pos=getRandomGridPosition();
if(collision(pos.x,pos.y,snake) || obstacles.some(o=>o.x===pos.x && o.y===pos.y)) return;
powerUps.push({x:pos.x,y:pos.y,type:type,createdAt:Date.now(), duration:3000});
}

function handlePowerUps(){
powerUps=powerUps.filter(p=>{
  if(Date.now()-p.createdAt>p.duration) return false;
  if(collisionWithFood(snake[0].x,snake[0].y,p.x,p.y)){
      // effetti
      if(p.type==="speed") adjustGameSpeed(50, 3000);
      if(p.type==="invincible") {isInvincible=true; setTimeout(()=>isInvincible=false,3000);}
      if(p.type==="multiplier") multiplier=2; setTimeout(()=>multiplier=1,3000);
      return false;
  }
  return true;
});
}

function adjustGameSpeed(amount, duration){
clearInterval(game);
let oldSpeed=gameSpeed;
gameSpeed=amount;
game=setInterval(gameLoop, gameSpeed);
setTimeout(()=>{gameSpeed=oldSpeed; clearInterval(game); game=setInterval(gameLoop,gameSpeed);},duration);
}

// ===================================
// LEVEL & SPEED DYNAMIC
// ===================================
function handleLevelSpeed(){
const newLevel = Math.floor(score/5)+1;
if(newLevel>level){
  level=newLevel;
  gameSpeed = Math.max(20, gameSpeed-5);
  clearInterval(game);
  game=setInterval(gameLoop,gameSpeed);
  spawnObstacles();
}
}

// ===================================
// OBSTACLES
// ===================================

function spawnObstacles(){
  obstacles = [];
  const minDistance = 2 * box; // distanza minima dal serpente

  // Se la skin è classic e checkbox è attiva, non spawnare ostacoli
  if(currentSkin === "classic" && noObstaclesCheckbox.checked) return;

  for(let i = 0; i < level; i++){
      let valid = false;
      let pos;

      while(!valid){
          pos = getRandomGridPosition();

          // 1️⃣ Non sovrapporsi al serpente
          if(collision(pos.x, pos.y, snake)) continue;

          // 2️⃣ Distanza minima dalla testa e dai segmenti iniziali
          valid = snake.every(segment => {
              return Math.abs(segment.x - pos.x) >= minDistance ||
                     Math.abs(segment.y - pos.y) >= minDistance;
          });

          // 3️⃣ Non sovrapporsi agli altri ostacoli già piazzati
          if(valid && obstacles.some(o => o.x === pos.x && o.y === pos.y)) valid = false;
      }

      obstacles.push(pos);
  }
}

function destroyObstacles(){
    obstacles = [];
}

// ===================================
// RENDERING
// ===================================
function clearCanvas(){
  ctx.fillStyle="#1b1b1b";
  ctx.fillRect(0,0,canvasSize,canvasSize);
}

function drawGrid(){
  ctx.strokeStyle="#222"; ctx.lineWidth=1;
  for(let i=0;i<=canvasSize;i+=box){
    ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvasSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvasSize,i); ctx.stroke();
  }
}

function drawRoundedRect(x,y,size,radius,color,glow=false){
  ctx.fillStyle=color;
  ctx.shadowColor=glow?color:"transparent";
  ctx.shadowBlur=glow?12:0;
  ctx.beginPath();
  ctx.roundRect(x+2,y+2,size-4,size-4,radius);
  ctx.fill();
  ctx.shadowBlur=0;
}

function drawSnake(){
  animationTick++;
  for(let i=0;i<snake.length;i++){
    const segment=snake[i];
    if(currentSkin === "ice"){
        ctx.shadowColor = "#a0f0ff";
        ctx.shadowBlur = icePowerActive ? 20 : 5;
        drawRoundedRect(segment.x, segment.y, box, 6, "#60d0ff", true);

        // Effetto ghiaccio: piccole punte dietro la coda
        for(let j=0;j<3;j++){
            ctx.fillStyle = `rgba(160,240,255,${0.3 + Math.random()*0.3})`;
            ctx.beginPath();
            ctx.moveTo(segment.x + box/2, segment.y + box/2);
            ctx.lineTo(segment.x + Math.random()*box, segment.y + Math.random()*box/2);
            ctx.lineTo(segment.x + Math.random()*box, segment.y - Math.random()*box/2);
            ctx.closePath();
            ctx.fill();
        }
        continue;
    }
    if(currentSkin === "lava"){
        const glow = 15 + Math.sin(animationTick*0.3)*5;
        ctx.shadowColor = "#ff4500";
        ctx.shadowBlur = glow;
        drawRoundedRect(segment.x, segment.y, box, 6, "#ff7f50", true);

        // Particelle lava: cerchietti arancioni e rossi
        for(let j=0;j<4;j++){
            const size = 2 + Math.random()*3;
            ctx.fillStyle = `rgba(${255},${69 + Math.random()*50},0,${0.5 + Math.random()*0.3})`;
            ctx.beginPath();
            ctx.arc(segment.x + Math.random()*box, segment.y + Math.random()*box, size, 0, Math.PI*2);
            ctx.fill();
        }
        continue;
    }
    if(currentSkin === "gold"){
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 12;
        drawRoundedRect(segment.x, segment.y, box, 6, "#ffec8b", true);

        // Scintille dorate animate come piccoli poligoni
        for(let j=0;j<3;j++){
            const cx = segment.x + Math.random()*box;
            const cy = segment.y + Math.random()*box;
            const size = 2 + Math.random()*3;
            const sides = 3 + Math.floor(Math.random()*3); // triangolo, quadrato o pentagono
            const angleStep = (Math.PI * 2) / sides;
            ctx.fillStyle = `rgba(255,215,0,${0.4 + Math.random()*0.4})`;
            ctx.beginPath();
            for(let k=0;k<sides;k++){
                const angle = k*angleStep + Math.random()*0.3; // leggero random per irregolarità
                const radius = size * (0.8 + Math.random()*0.4);
                const px = cx + radius * Math.cos(angle);
                const py = cy + radius * Math.sin(angle);
                if(k===0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        // Aura dorata extra quando attivo
        if(goldPowerActive){
            ctx.fillStyle = "rgba(255,215,0,0.15)";
            ctx.beginPath();
            ctx.arc(
                segment.x + box/2,
                segment.y + box/2,
                box,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        continue;
    }
    if(currentSkin === "neon"){
        let glow = neonTimeActive ? 15 : 5; // più intenso se attivo
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = glow;
        drawRoundedRect(segment.x, segment.y, box, 6, "#00ff88", true);
        continue;
    }
    if(currentSkin==="dragon"){
      ctx.shadowColor = "#00ff00";
      ctx.shadowBlur = 5 + Math.sin(animationTick*0.2)*5;
      if(i===0){

            ctx.save();

            ctx.shadowColor = "#00ff00";
            ctx.shadowBlur = 8 + Math.sin(animationTick*0.2)*4;

            ctx.fillStyle = "#00cc00";

            ctx.beginPath();

            switch(direction){

                case "RIGHT":
                    ctx.moveTo(segment.x, segment.y);
                    ctx.lineTo(segment.x + box*0.7, segment.y + box*0.2);
                    ctx.lineTo(segment.x + box, segment.y + box/2);
                    ctx.lineTo(segment.x + box*0.7, segment.y + box*0.8);
                    ctx.lineTo(segment.x, segment.y + box);
                    break;

                case "LEFT":
                    ctx.moveTo(segment.x + box, segment.y);
                    ctx.lineTo(segment.x + box*0.3, segment.y + box*0.2);
                    ctx.lineTo(segment.x, segment.y + box/2);
                    ctx.lineTo(segment.x + box*0.3, segment.y + box*0.8);
                    ctx.lineTo(segment.x + box, segment.y + box);
                    break;

                case "UP":
                    ctx.moveTo(segment.x, segment.y + box);
                    ctx.lineTo(segment.x + box*0.2, segment.y + box*0.3);
                    ctx.lineTo(segment.x + box/2, segment.y);
                    ctx.lineTo(segment.x + box*0.8, segment.y + box*0.3);
                    ctx.lineTo(segment.x + box, segment.y + box);
                    break;

                case "DOWN":
                    ctx.moveTo(segment.x, segment.y);
                    ctx.lineTo(segment.x + box*0.2, segment.y + box*0.7);
                    ctx.lineTo(segment.x + box/2, segment.y + box);
                    ctx.lineTo(segment.x + box*0.8, segment.y + box*0.7);
                    ctx.lineTo(segment.x + box, segment.y);
                    break;
            }

            ctx.closePath();
            ctx.fill();

            // 👁 Occhio luminoso
            ctx.fillStyle = "lime";
            ctx.shadowBlur = 15;
            ctx.beginPath();

            if(direction === "RIGHT")
                ctx.arc(segment.x + box*0.65, segment.y + box*0.35, box*0.08, 0, Math.PI*2);
            if(direction === "LEFT")
                ctx.arc(segment.x + box*0.35, segment.y + box*0.35, box*0.08, 0, Math.PI*2);
            if(direction === "UP")
                ctx.arc(segment.x + box*0.65, segment.y + box*0.35, box*0.08, 0, Math.PI*2);
            if(direction === "DOWN")
                ctx.arc(segment.x + box*0.65, segment.y + box*0.65, box*0.08, 0, Math.PI*2);

            ctx.fill();

            ctx.restore();
            continue;
        } else {
        let shade = 100 + Math.sin(i*0.5 + animationTick*0.1)*50;
        let scaleX = box*0.8;
        let scaleY = box*0.6;

        ctx.save();
        ctx.fillStyle = `rgb(0,${shade},0)`;
        ctx.shadowColor = "#00ff00";
        ctx.shadowBlur = 8;

        // pattern a scaglie: rettangoli sfalsati
        let offset = (i%2===0) ? 0 : scaleY/2;
        ctx.fillRect(segment.x, segment.y + offset, scaleX, scaleY);

        ctx.restore();
      }
      continue;
    }
    if(currentSkin==="rainbow"){
      if(currentSkin === "rainbow"){
        let hue = (animationTick*10 + i*20) % 360;
        if(rainbowStormActive){
            hue = (animationTick*40 + i*20) % 360; // più veloce e brillante
        }
        drawRoundedRect(segment.x, segment.y, box, 6, `hsl(${hue},100%,50%)`, true);
        continue;
      }
    }
    if(currentSkin==="ghost"){
        ctx.save();
        if(specialActive){
            ctx.globalAlpha = 0.35 + Math.sin(animationTick * 0.3) * 0.1;
            ctx.shadowColor = "#ffffff";   // glow bianco
            ctx.shadowBlur = 20 + Math.sin(animationTick * 0.4) * 5;
        } else {
            ctx.globalAlpha = 0.6;         // ghost normale
            ctx.shadowBlur = 0;
        }
        drawRoundedRect(segment.x, segment.y, box, 8, "#ffffff", true);
        ctx.restore();
        continue;
    }
    if(currentSkin==="plasma"){
      ctx.save();
      let pulse = 150 + Math.sin(animationTick*0.3 + i) * 100;
      if(specialActive){
          ctx.shadowColor = "#00bfff";
          ctx.shadowBlur = 25 + Math.sin(animationTick*0.4)*5;
      }
      drawRoundedRect(
          segment.x,
          segment.y,
          box,
          6,
          `rgb(${pulse},0,255)`,
          true
      );
      ctx.restore();
      continue;
    }
    const skin = skins[currentSkin]||skins.classic;
    drawRoundedRect(segment.x,segment.y,box,i===0?8:6,i===0?skin.head:skin.body,i===0?skin.glow:skin.glow);
  }
}

function drawFoods() {
  foods.forEach(f => {

      ctx.fillStyle = f.color;

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // Effetti speciali
      if(f.type === "grow"){
          ctx.shadowColor = "#ffa500";
          ctx.shadowBlur = 15 + 5 * Math.sin(animationTick*0.3);
      } else if(f.type === "multiplier"){
          ctx.shadowColor = "#00ffff";
          ctx.shadowBlur = 10 + 10 * Math.abs(Math.sin(animationTick*0.5));
      }

      // Glow dorato se Gold attivo
      if(goldPowerActive){
          ctx.shadowColor = "#ffd700";
          ctx.shadowBlur = 12 + Math.sin(animationTick * 0.4) * 6;
      }

      ctx.beginPath();
      ctx.arc(f.x + box/2, f.y + box/2, box/2 - 3, 0, Math.PI*2);
      ctx.fill();

      ctx.shadowBlur = 0; // reset
  });
}

function drawObstacles() {
    obstacles.forEach(o => {
        ctx.save();

        let colorStart = "#555555";
        let colorEnd = "#888888";

        if(icePowerActive) {
            colorStart = "#a0ffff"; // ghiaccio chiaro
            colorEnd = "#00ffff";   // ghiaccio più intenso
        }

        const grad = ctx.createLinearGradient(o.x, o.y, o.x + box, o.y + box);
        grad.addColorStop(0, colorStart);
        grad.addColorStop(1, colorEnd);

        ctx.fillStyle = grad;

        if(icePowerActive) {
            // piccole scintille ghiaccio
            for(let i=0;i<3;i++){
                ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.6})`;
                ctx.fillRect(o.x + Math.random()*box, o.y + Math.random()*box, 2, 2);
            }
        }

        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = icePowerActive ? 8 : 6;

        ctx.beginPath();
        ctx.roundRect(o.x + 2, o.y + 2, box - 4, box - 4, 6);
        ctx.fill();

        ctx.restore();
    });
}

function drawPowerUps(){
  powerUps.forEach(p=>{
    ctx.fillStyle=p.type==="speed"?"#0ff":p.type==="invincible"?"#ff0":"#f0f";
    ctx.beginPath();
    ctx.arc(p.x+box/2,p.y+box/2,box/2-2,0,Math.PI*2);
    ctx.fill();
  });
}

function drawPlasmaTrail(){

    for(let i = plasmaTrail.length - 1; i >= 0; i--){

        const t = plasmaTrail[i];

        // sicurezza contro valori non validi
        if(!isFinite(t.x) || !isFinite(t.y) || !isFinite(t.size)){
            plasmaTrail.splice(i,1);
            continue;
        }

        ctx.save();

        ctx.globalAlpha = t.alpha;
        ctx.shadowColor = "#00bfff";
        ctx.shadowBlur = 15;

        const radius = Math.max(1, t.size / 2);

        const gradient = ctx.createRadialGradient(
            t.x, t.y, 0,
            t.x, t.y, radius
        );

        gradient.addColorStop(0, "rgba(0,191,255,0.8)");
        gradient.addColorStop(1, "rgba(0,191,255,0)");

        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // dissolvenza controllata
        t.alpha -= 0.04;
        t.size -= 0.6;

        if(t.alpha <= 0 || t.size <= 0){
            plasmaTrail.splice(i,1);
        }
    }
}

function shootDragonFlame(){
    const head = snake[0];
    let dx = 0, dy = 0;

    switch(direction){
        case "LEFT": dx=-1; break;
        case "RIGHT": dx=1; break;
        case "UP": dy=-1; break;
        case "DOWN": dy=1; break;
    }

    for(let i=1; i<=5; i++){
        const fx = head.x + dx*box*i;
        const fy = head.y + dy*box*i;

        // distruggi ostacoli solo davanti
        for(let j=obstacles.length-1; j>=0; j--){
            if(obstacles[j].x === fx && obstacles[j].y === fy){
                obstacles.splice(j,1);
            }
        }

        // crea particelle
        const nParticles = 6 + Math.floor(Math.random()*4);
        for(let p=0; p<nParticles; p++){
            dragonFlame.push({
                x: fx + Math.random()*box,
                y: fy + Math.random()*box,
                size: box * (0.2 + Math.random()*0.5),
                alpha: 1,
                color: `hsl(${Math.random()*30}, 100%, ${50 + Math.random()*20}%)`,
                dx: (Math.random()-0.5)*0.5, // piccolo movimento orizzontale
                dy: (Math.random()-0.5)*0.5  // piccolo movimento verticale
            });
        }
    }
}

function drawDragonFlame(){
    for(let i=dragonFlame.length-1; i>=0; i--){
        const f = dragonFlame[i];

        if(!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.size)){
            dragonFlame.splice(i,1);
            continue;
        }

        ctx.save();

        // glow pulsante
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10 + 5*Math.sin(animationTick*0.5);

        // alpha variabile + fade
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

        if(f.alpha <= 0 || f.size <= 0){
            dragonFlame.splice(i,1);
        }
    }
}

function activateNeonTime() {
    if(neonTimeActive) return;    // già attivo
    neonTimeActive = true;
    neonTimeStart = Date.now();

    // dopo neonTimeDuration ms, termina l’effetto
    setTimeout(() => {
        neonTimeActive = false;
    }, neonTimeDuration);
}

function activateRainbowStorm() {
    if(rainbowStormActive) return;
    rainbowStormActive = true;
    rainbowStormStart = Date.now();

    // Aggiorna i cibi ogni 300 ms
    const interval = setInterval(() => {
        if(!rainbowStormActive) return clearInterval(interval);

        foods.forEach(f => {
            const newType = foodTypes[Math.floor(Math.random()*foodTypes.length)];
            f.color = newType.color;
            f.value = newType.value;
            f.type = newType.type;
        });
    }, 300);

    // Termina potere
    setTimeout(() => {
        rainbowStormActive = false;
    }, rainbowStormDuration);
}

function createIceExplosion(x, y){
    for(let i = 0; i < 12; i++){
        iceParticles.push({
            x: x + box/2,
            y: y + box/2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: 2 + Math.random()*3,
            life: 30
        });
    }
}

function drawIceParticles(){
    for(let i = iceParticles.length - 1; i >= 0; i--){
        const p = iceParticles[i];

        ctx.fillStyle = `rgba(180,255,255,${p.life/30})`;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.size, p.y + p.size/2);
        ctx.lineTo(p.x - p.size/2, p.y + p.size);
        ctx.closePath();
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if(p.life <= 0){
            iceParticles.splice(i, 1);
        }
    }
}

function drawLavaTrail(){
    const now = Date.now();

    for(let i = lavaTrail.length - 1; i >= 0; i--){
        const t = lavaTrail[i];
        const age = now - t.created;

        for(let j = obstacles.length - 1; j >= 0; j--){
            const o = obstacles[j];
            if(o.x === t.x && o.y === t.y){
                obstacles.splice(j,1);
            }
        }

        if(age > lavaTrailDuration){
            lavaTrail.splice(i,1);
            continue;
        }

        const alpha = 1 - (age / lavaTrailDuration);

        const grad = ctx.createRadialGradient(
            t.x + box/2,
            t.y + box/2,
            2,
            t.x + box/2,
            t.y + box/2,
            box/2
        );

        grad.addColorStop(0, `rgba(255,255,0,${alpha})`);
        grad.addColorStop(0.5, `rgba(255,100,0,${alpha})`);
        grad.addColorStop(1, `rgba(150,0,0,0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(t.x, t.y, box, box);
    }
}

function drawSpecialBar(){
  if(!specialActive) return;
  const elapsed = Date.now() - specialStartTime;
  const ratio = 1 - (elapsed / specialDuration);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(10, 10, 150, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(10, 10, 150 * ratio, 8);
  ctx.restore();
}

function drawSpecialCooldownBar(){
    if(!specialCooldownActive) return;

    const now = Date.now();
    const elapsed = now - specialCooldownStart;
    const progress = Math.min(elapsed / specialCooldownDuration, 1);

    const barWidth = 150;
    const barHeight = 12;
    const x = canvasSize - barWidth - 20;
    const y = canvasSize - 25;

    // Sfondo barra
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Parte caricata
    ctx.fillStyle = getCooldownColor();
    ctx.fillRect(x, y, barWidth * progress, barHeight);

    // Bordo
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
}

function updatePowerBar(){
    if(!specialActive){
        powerBar.style.width = "0%";
        return;
    }

    const elapsed = Date.now() - specialStartTime;
    const progress = 1 - (elapsed / specialDuration);

    powerBar.style.width = (progress * 100) + "%";
    powerBar.style.background = getCooldownColor();
}

function updateCooldownBar(){
    if(!specialCooldownActive){
        cooldownBar.style.width = "0%";
        return;
    }

    const elapsed = Date.now() - specialCooldownStart;
    const progress = elapsed / specialCooldownDuration;

    cooldownBar.style.width = (progress * 100) + "%";
    cooldownBar.style.background = getCooldownColor();
}
// ===================================
// INPUT
// ===================================
document.addEventListener("keydown",(event)=>{
  if(event.key==="r"||event.key==="R"){ restartGame(); return; }
  if(event.key==="p"||event.key==="P"||event.code==="Space"){ togglePause(); return; }
  if(isPaused) return;
  if(event.key==="ArrowLeft"&&direction!=="RIGHT") direction="LEFT";
  if(event.key==="ArrowUp"&&direction!=="DOWN") direction="UP";
  if(event.key==="ArrowRight"&&direction!=="LEFT") direction="RIGHT";
  if(event.key==="ArrowDown"&&direction!=="UP") direction="DOWN";
  if(event.key === "x" || event.key === "X"){ activateSpecial(); }
});
document.getElementById("startBtn").addEventListener("click",startGame);

// Pulsanti touchscreen
// Frecce touch
document.getElementById("upBtn").addEventListener("touchstart", ()=>{ if(direction!=="DOWN") direction="UP"; });
document.getElementById("downBtn").addEventListener("touchstart", ()=>{ if(direction!=="UP") direction="DOWN"; });
document.getElementById("leftBtn").addEventListener("touchstart", ()=>{ if(direction!=="RIGHT") direction="LEFT"; });
document.getElementById("rightBtn").addEventListener("touchstart", ()=>{ if(direction!=="LEFT") direction="RIGHT"; });

// Pulsanti speciali touch
document.getElementById("specialBtn").addEventListener("touchstart", activateSpecial);
document.getElementById("touchPauseBtn").addEventListener("touchstart", togglePause);
document.getElementById("restartBtn").addEventListener("touchstart", restartGame);

// aggiorna l’opzione quando cambia la skin dal menu principale
menuSkinSelect.addEventListener("change", (e) => {
    const newSkin = e.target.value;
    currentSkin = newSkin;
    localStorage.setItem("snakeSkin", currentSkin);

    // Mostra checkbox solo se classic
    if(currentSkin === "classic") {
        obstacleOptionContainer.style.display = "block";
    } else {
        obstacleOptionContainer.style.display = "none";
        noObstaclesCheckbox.checked = false;
    }

    // Pulisci eventuali effetti speciali
    specialActive = false;
    neonTimeActive = false;
    rainbowStormActive = false;
    plasmaTrail = [];
    dragonFlame = [];
    animationTick = 0; // reset animazioni
});

inGameSkinSelect.addEventListener("change", (e) => {
    const newSkin = e.target.value;
    currentSkin = newSkin;
    localStorage.setItem("snakeSkin", currentSkin);

    // ✅ Pulisci eventuali effetti speciali attivi
    specialActive = false;
    neonTimeActive = false;
    rainbowStormActive = false;
    plasmaTrail = [];
    dragonFlame = [];

    // ✅ Aggiorna anche la snake se necessario (per alcuni skin)
    // Questo serve soprattutto se vuoi che testa/segmenti cambino immediatamente aspetto
    animationTick = 0; // reset dell’animazione
});

function togglePause(){
  if(isPaused){ game=setInterval(gameLoop,gameSpeed); startTime=Date.now()-elapsedTime; timerInterval=setInterval(updateTimer,100); overlay.style.opacity=0;}
  else{ clearInterval(game); clearInterval(timerInterval); elapsedTime+=Date.now()-startTime; overlay.innerText="PAUSA"; overlay.style.opacity=1;}
  isPaused=!isPaused;
}

function restartGame(){
    snake=[{x:9*box,y:9*box},{x:8*box,y:9*box},{x:7*box,y:9*box}];
    direction="RIGHT";
    score=0;
    comboCount=0;
    foods=[];
    obstacles=[];
    powerUps=[];
    overlay.style.opacity=0;
    clearInterval(timerInterval);
    elapsedTime=0;
    startTime=Date.now();
    updateTimer();
    timerInterval=setInterval(updateTimer,100);
    gameSpeed = parseInt(document.getElementById("speedSelect").value); // velocità iniziale
    clearInterval(game);
    game=setInterval(gameLoop,gameSpeed);
    isPaused=false;
    spawnFood(); spawnObstacles();
    comboTypeCount = 0;
    comboTypeCurrent = null;
    comboTimeCount = 0;
    comboTimeStart = 0;
    updateComboBar(); // aggiorna la barra visiva
}
