(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const rnd = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let state = 'ready', score = 0, lives = 3, wave = 10, player;
  let bullets = [], enemies = [], blocks = [], effects = [], pickups = [];
  let rapidFire = 0, last = 0, sound = true, audio, spawnCooldown = 0;
  let joystickInput = { x: 0, y: 0 };
  let best = Number(localStorage.getItem('wave-edge-best') || 0);
  const agentNames = { chaser: '追击型', sniper: '狙击型', flanker: '绕后型', defender: '防守型', boss: '精英指挥官' };
  const agentMarks = { chaser: '追', sniper: '狙', flanker: '绕', defender: '守', boss: 'B' };
  const agentColors = { chaser: '#ff665c', sniper: '#59c7ff', flanker: '#ff9d43', defender: '#55d68b', boss: '#a96cff' };

  function makeMap() {
    blocks = [];
    const w = 34, h = 24, lanes = [105, W / 2, W - 105];
    for (let row = 0; row < 5; row += 1) for (let lane = 0; lane < 3; lane += 1) {
      const offset = (row % 2 ? 18 : -18) * (lane === 1 ? 1 : 0);
      blocks.push({ x: lanes[lane] - w / 2 + offset, y: 70 + row * 72, w, h, steel: (row + lane) % 7 === 0 });
    }
    const cell = 16, gap = 4, ox = W / 2 - (10 * cell + gap) / 2, oy = H / 2 - 2.5 * cell;
    const letters = [['10001', '10001', '11111', '10001', '10001'], ['11110', '10001', '10001', '10001', '11110']];
    letters.forEach((pattern, letter) => pattern.forEach((row, r) => [...row].forEach((value, col) => {
      if (value === '1') blocks.push({ x: ox + col * cell + (letter ? 5 * cell + gap : 0), y: oy + r * cell, w: cell - 2, h: cell - 2, initial: true });
    })));
  }

  function reset() {
    score = 0; lives = 3; wave = 10; bullets = []; enemies = []; effects = []; pickups = []; rapidFire = 0; spawnCooldown = 0;
    player = { x: W / 2, y: H - 92, a: -Math.PI / 2, r: 14, cd: 0, inv: 0, hp: 3, maxHp: 3 };
    makeMap();
    blocks = blocks.filter((block, index) => !blocks.slice(0, index).some((other) => block.x < other.x + other.w && block.x + block.w > other.x && block.y < other.y + other.h && block.y + block.h > other.y) && Math.hypot(block.x + block.w / 2 - player.x, block.y + block.h / 2 - player.y) > 24 + Math.max(block.w, block.h) / 2);
    for (let i = 0; i < 4; i += 1) spawn();
  }

  function findSpawnPoint(radius) {
    const points = [35, W * 0.25, W / 2, W * 0.75, W - 35].map((x) => ({ x, y: 32 }));
    const offset = Math.floor(rnd(0, points.length));
    for (let index = 0; index < points.length; index += 1) {
      const point = points[(index + offset) % points.length];
      const blocked = blocks.some((block) => point.x + radius > block.x && point.x - radius < block.x + block.w && point.y + radius > block.y && point.y - radius < block.y + block.h);
      const occupied = enemies.some((enemy) => enemy.hp > 0 && Math.hypot(point.x - enemy.x, point.y - enemy.y) < radius + enemy.r + 16);
      const nearPlayer = player && Math.hypot(point.x - player.x, point.y - player.y) < radius + player.r + 40;
      if (!blocked && !occupied && !nearPlayer) return point;
    }
    return null;
  }

  function spawn() {
    if (wave <= 0) return false;
    const nextWave = wave - 1;
    const boss = nextWave === 5;
    const scout = !boss && Math.random() < 0.38;
    const hp = boss ? 6 : scout ? 1 : 2;
    const radius = boss ? 21 : scout ? 11 : 14;
    const point = findSpawnPoint(radius);
    if (!point) return false;
    wave = nextWave;
    const agentTypes = ['chaser', 'sniper', 'flanker', 'defender'];
    const agentType = boss ? 'boss' : agentTypes[(9 - wave) % agentTypes.length];
    enemies.push({
      x: point.x, y: point.y, a: Math.PI / 2,
      r: radius, cd: rnd(30, 100),
      speed: boss ? 0.38 : scout ? 1.25 : rnd(0.55, 0.9), hp, maxHp: hp, turn: rnd(20, 80),
      kind: boss ? 'boss' : scout ? 'scout' : 'standard',
      agentType, aiState: '扫描战场', decisionTimer: 0, strafe: Math.random() < 0.5 ? -1 : 1,
      color: agentColors[agentType], value: boss ? 160 : scout ? 55 : 40
    });
    return true;
  }

  const hit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < (a.r || 4) + (b.r || 4) + 6;
  const overlaps = (px, py, tank, block) => px + tank.r > block.x && px - tank.r < block.x + block.w && py + tank.r > block.y && py - tank.r < block.y + block.h;

  function shoot(tank, owner) {
    if (tank.cd > 0) return;
    tank.cd = owner === 'p' ? (rapidFire > 0 ? 7 : 15) : rnd(55, 100);
    bullets.push({ x: tank.x + Math.cos(tank.a) * (tank.r + 6), y: tank.y + Math.sin(tank.a) * (tank.r + 6), a: tank.a, owner, life: 100, r: 4 });
    beep(180, owner === 'p' ? '.06' : '.12');
  }

  function beep(frequency, duration) {
    if (!sound) return;
    try {
      audio ??= new AudioContext();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.frequency.value = frequency; oscillator.type = 'square';
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + parseFloat(duration));
      oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + parseFloat(duration));
    } catch {}
  }

  function move(tank, dx, dy) {
    const nx = clamp(tank.x + dx * tank.speed, 20, W - 20), ny = clamp(tank.y + dy * tank.speed, 35, H - 28);
    const occupied = (tx, ty) => blocks.some((block) => overlaps(tx, ty, tank, block)) || enemies.some((enemy) => enemy !== tank && enemy.hp && Math.hypot(tx - enemy.x, ty - enemy.y) < tank.r + enemy.r + 5) || (tank !== player && Math.hypot(tx - player.x, ty - player.y) < tank.r + player.r + 5);
    let moved = false;
    if (!occupied(nx, tank.y)) { tank.x = nx; moved = true; }
    if (!occupied(tank.x, ny)) { tank.y = ny; moved = true; }
    return moved;
  }

  function dropPickup(enemy) {
    if (enemy.kind !== 'boss' && Math.random() >= 0.28) return;
    pickups.push({ x: enemy.x, y: enemy.y, r: 10, type: enemy.kind === 'boss' || Math.random() < 0.55 ? 'rapid' : 'heal', life: 650 });
  }

  function hasLineOfSight(enemy) {
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const steps = Math.max(1, Math.ceil(distance / 14));
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const x = enemy.x + (player.x - enemy.x) * ratio;
      const y = enemy.y + (player.y - enemy.y) * ratio;
      if (blocks.some((block) => x > block.x && x < block.x + block.w && y > block.y && y < block.y + block.h)) return false;
    }
    return true;
  }

  function steerEnemy(enemy, targetX, targetY, stateLabel) {
    const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    enemy.a = angle;
    enemy.aiState = stateLabel;
    if (!move(enemy, Math.cos(angle), Math.sin(angle))) {
      enemy.a += enemy.strafe * Math.PI / 2;
      move(enemy, Math.cos(enemy.a), Math.sin(enemy.a));
      enemy.aiState = '绕开障碍';
    }
  }

  function runAgent(enemy, dt) {
    enemy.cd -= dt;
    enemy.decisionTimer -= dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const visible = hasLineOfSight(enemy);
    const aimAtPlayer = () => { enemy.a = Math.atan2(dy, dx); };

    if (enemy.agentType === 'chaser') {
      steerEnemy(enemy, player.x, player.y, distance < 150 ? '近距压制' : '锁定追击');
      if (visible && distance < 280 && enemy.cd < 0) { aimAtPlayer(); shoot(enemy, 'e'); enemy.aiState = '瞄准开火'; }
      return;
    }

    if (enemy.agentType === 'sniper') {
      if (distance < 165) steerEnemy(enemy, enemy.x - dx, enemy.y - dy, '拉开距离');
      else if (distance > 310 || !visible) steerEnemy(enemy, player.x, player.y, visible ? '进入射程' : '寻找视野');
      else {
        enemy.a = Math.atan2(dy, dx) + enemy.strafe * Math.PI / 2;
        move(enemy, Math.cos(enemy.a) * 0.45, Math.sin(enemy.a) * 0.45);
        enemy.aiState = '侧移瞄准';
      }
      if (visible && distance >= 145 && enemy.cd < 0) { aimAtPlayer(); shoot(enemy, 'e'); enemy.aiState = '远程狙击'; }
      return;
    }

    if (enemy.agentType === 'flanker') {
      const flankDistance = 105;
      const length = Math.max(1, distance);
      const targetX = player.x + (-dy / length) * flankDistance * enemy.strafe;
      const targetY = player.y + (dx / length) * flankDistance * enemy.strafe;
      steerEnemy(enemy, targetX, targetY, distance < 135 ? '切入侧翼' : '绕后机动');
      if (visible && distance < 230 && enemy.cd < 0) { aimAtPlayer(); shoot(enemy, 'e'); enemy.aiState = '侧翼开火'; }
      return;
    }

    if (enemy.agentType === 'defender') {
      if (enemy.hp <= 1 && distance < 230) steerEnemy(enemy, enemy.x - dx, enemy.y - dy, '低血撤退');
      else if (visible) { aimAtPlayer(); enemy.aiState = '守位监视'; }
      else steerEnemy(enemy, W / 2, H * 0.34, '回防阵地');
      if (visible && enemy.cd < 0) { aimAtPlayer(); shoot(enemy, 'e'); enemy.aiState = '防守反击'; }
      return;
    }

    steerEnemy(enemy, player.x, player.y, enemy.hp <= 2 ? '狂暴突击' : '指挥推进');
    if (visible && enemy.cd < 0) { aimAtPlayer(); shoot(enemy, 'e'); enemy.aiState = '火力压制'; }
  }

  function update(dt) {
    if (state !== 'play') return;
    player.cd = Math.max(0, player.cd - dt); player.inv = Math.max(0, player.inv - dt); rapidFire = Math.max(0, rapidFire - dt); spawnCooldown = Math.max(0, spawnCooldown - dt);
    let dx = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
    let dy = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
    if (!dx && !dy) ({ x: dx, y: dy } = joystickInput);
    if (dx || dy) { player.a = Math.atan2(dy, dx); player.speed = 2.6; move(player, dx, dy); }
    if (keys.has(' ') || keys.has('j')) shoot(player, 'p');
    enemies.forEach((enemy) => runAgent(enemy, dt));
    bullets.forEach((bullet) => {
      bullet.x += Math.cos(bullet.a) * 5 * dt; bullet.y += Math.sin(bullet.a) * 5 * dt; bullet.life -= dt;
      blocks.forEach((block) => { if (bullet.x > block.x && bullet.x < block.x + block.w && bullet.y > block.y && bullet.y < block.y + block.h) bullet.life = 0; });
      if (bullet.owner === 'p') enemies.forEach((enemy) => {
        if (!enemy.hp || !hit(bullet, enemy)) return;
        enemy.hp -= 1; bullet.life = 0;
        if (enemy.hp <= 0) { score += enemy.value; dropPickup(enemy); burst(enemy.x, enemy.y); } else beep(110, '.08');
      });
      else if (player.inv <= 0 && hit(bullet, player)) {
        bullet.life = 0; player.hp -= 1; player.inv = 70;
        if (player.hp <= 0) { lives -= 1; burst(player.x, player.y); if (lives <= 0) end('GAME OVER'); else { player.hp = player.maxHp; player.x = W / 2; player.y = H - 92; } }
      }
    });
    pickups.forEach((pickup) => {
      pickup.life -= dt;
      if (!hit(pickup, player)) return;
      if (pickup.type === 'heal') player.hp = Math.min(player.maxHp, player.hp + 1); else rapidFire = 480;
      pickup.life = 0; beep(pickup.type === 'heal' ? 520 : 760, '.12');
    });
    pickups = pickups.filter((pickup) => pickup.life > 0);
    bullets = bullets.filter((bullet) => bullet.life > 0 && bullet.x > 0 && bullet.x < W && bullet.y > 0 && bullet.y < H);
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    if (enemies.length < 4 && wave > 0 && spawnCooldown <= 0) spawnCooldown = spawn() ? 28 : 12;
    if (!wave && !enemies.length) end('胜利！');
    effects.forEach((effect) => { effect.t -= dt; effect.r += dt * 1.5; });
    effects = effects.filter((effect) => effect.t > 0);
  }

  function burst(x, y) {
    for (let i = 0; i < 14; i += 1) effects.push({ x, y, r: 2, t: 25 });
    beep(70, '.18');
  }

  function drawTank(tank, color) {
    ctx.save(); ctx.translate(tank.x, tank.y); ctx.rotate(tank.a);
    ctx.fillStyle = color; ctx.fillRect(-tank.r, -tank.r, tank.r * 2, tank.r * 2);
    ctx.fillStyle = '#0a161b'; ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = color; ctx.fillRect(0, -3, tank.r + 9, 6); ctx.restore();
    ctx.fillStyle = '#071014'; ctx.fillRect(tank.x - 15, tank.y - tank.r - 10, 30, 4);
    ctx.fillStyle = tank === player ? '#55d68b' : '#ff665c'; ctx.fillRect(tank.x - 15, tank.y - tank.r - 10, 30 * Math.max(0, tank.hp / tank.maxHp), 4);
    if (tank !== player) {
      ctx.fillStyle = color;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(agentMarks[tank.agentType] || 'AI', tank.x, tank.y - tank.r - 13);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#10282a'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#1b3c3b';
    for (let col = 0; col < W; col += 32) { ctx.beginPath(); ctx.moveTo(col, 0); ctx.lineTo(col, H); ctx.stroke(); }
    for (let row = 0; row < H; row += 32) { ctx.beginPath(); ctx.moveTo(0, row); ctx.lineTo(W, row); ctx.stroke(); }
    blocks.forEach((block) => { ctx.fillStyle = block.base ? '#b57b2b' : block.steel ? '#72868a' : '#9b5234'; ctx.fillRect(block.x, block.y, block.w, block.h); ctx.strokeStyle = '#d89b51'; ctx.strokeRect(block.x, block.y, block.w, block.h); });
    drawTank(player, rapidFire > 0 ? '#65d6c0' : '#e2a342');
    enemies.forEach((enemy) => drawTank(enemy, enemy.color));
    pickups.forEach((pickup) => { ctx.fillStyle = pickup.type === 'heal' ? '#55d68b' : '#65d6c0'; ctx.beginPath(); ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#071014'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pickup.type === 'heal' ? '+' : '⚡', pickup.x, pickup.y); });
    bullets.forEach((bullet) => { ctx.fillStyle = bullet.owner === 'p' ? '#ffe08a' : '#ff7160'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2); ctx.fill(); });
    effects.forEach((effect) => { ctx.fillStyle = `rgba(255,${80 + effect.t * 4},30,${effect.t / 25})`; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2); ctx.fill(); });
  }

  function end(title) {
    state = 'end'; best = Math.max(best, score); localStorage.setItem('wave-edge-best', String(best));
    document.querySelector('#overlay').hidden = false; document.querySelector('#overlay h2').textContent = title;
    document.querySelector('#overlay p').textContent = `最终分数 ${score} · 最高 ${best} · 点击下方重新开始`;
    document.querySelector('#start').textContent = '重新开始';
  }

  function loop(time) { const dt = Math.min(2, (time - last) / 16.67 || 1); last = time; update(dt); draw(); requestAnimationFrame(loop); }

  function bindJoystick() {
    const pad = document.querySelector('.joystick'), knob = pad && pad.querySelector('span');
    if (!pad || !knob) return;
    let active = null;
    const resetStick = () => { active = null; joystickInput = { x: 0, y: 0 }; knob.style.transform = 'translate(-50%,-50%)'; pad.classList.remove('active'); };
    const moveStick = (event) => {
      if (active !== event.pointerId) return;
      event.preventDefault();
      const rect = pad.getBoundingClientRect(), max = Math.max(18, rect.width * 0.32);
      const rawX = event.clientX - rect.left - rect.width / 2, rawY = event.clientY - rect.top - rect.height / 2;
      const distance = Math.hypot(rawX, rawY), scale = distance > max ? max / distance : 1;
      const px = rawX * scale, py = rawY * scale, nx = px / max, ny = py / max;
      joystickInput = Math.hypot(nx, ny) < 0.14 ? { x: 0, y: 0 } : { x: nx, y: ny };
      knob.style.transform = `translate(calc(-50% + ${px}px),calc(-50% + ${py}px))`;
    };
    pad.addEventListener('pointerdown', (event) => { event.preventDefault(); active = event.pointerId; pad.setPointerCapture?.(event.pointerId); pad.classList.add('active'); moveStick(event); });
    pad.addEventListener('pointermove', moveStick);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => pad.addEventListener(name, resetStick));
    window.addEventListener('blur', resetStick); document.addEventListener('visibilitychange', () => { if (document.hidden) resetStick(); });
  }

  document.addEventListener('keydown', (event) => { keys.add(event.key); if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault(); });
  document.addEventListener('keyup', (event) => keys.delete(event.key));
  document.querySelectorAll('[data-key]').forEach((button) => {
    const key = button.dataset.key === 'Space' ? ' ' : button.dataset.key, release = () => keys.delete(key);
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); keys.add(key); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => button.addEventListener(name, release));
  });
  window.addEventListener('blur', () => keys.clear()); bindJoystick();
  document.querySelector('#start').onclick = () => { reset(); state = 'play'; document.querySelector('#overlay').hidden = true; beep(440, '.08'); };
  document.querySelector('#pause').onclick = () => { if (state === 'play') { state = 'pause'; document.querySelector('#pause').textContent = '继续'; } else if (state === 'pause') { state = 'play'; document.querySelector('#pause').textContent = '暂停'; } };
  document.querySelector('#sound').onclick = () => { sound = !sound; document.querySelector('#sound').textContent = sound ? '🔊 音效' : '🔇 静音'; };
  setInterval(() => {
    document.querySelector('#score').textContent = score; document.querySelector('#best').textContent = best;
    document.querySelector('#lives').textContent = lives; document.querySelector('#remaining').textContent = wave + enemies.length;
    document.querySelector('#buff').textContent = rapidFire > 0 ? `快速火力 ${Math.ceil(rapidFire / 60)}s` : '标准火力';
    const activeAgents = enemies.filter((enemy) => enemy.hp > 0);
    const focus = activeAgents.slice().sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    document.querySelector('#aiFocus').textContent = focus ? `${agentNames[focus.agentType]} · ${focus.aiState}` : '等待下一目标';
    const counts = activeAgents.reduce((result, enemy) => { result[enemy.agentType] = (result[enemy.agentType] || 0) + 1; return result; }, {});
    document.querySelector('#aiSummary').textContent = Object.entries(counts).map(([type, count]) => `${agentNames[type]} ${count}`).join(' · ') || '战场已清空';
  }, 100);
  reset(); requestAnimationFrame(loop);
})();
