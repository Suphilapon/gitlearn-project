(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const speedEl = document.getElementById("speed");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const btnStart = document.getElementById("btnStart");

  // ===== 游戏参数 =====
  const gridSize = 20; // 每格 20px，400/20 = 20格
  const cols = canvas.width / gridSize;
  const rows = canvas.height / gridSize;

  const initialSpeed = 8; // 每秒步数
  const speedStep = 0.35; // 每吃到若干食物后增加速度
  const speedEvery = 5; // 每吃 N 分增加速度

  const COLORS = {
    bg: "#0b1020",
    panel: "rgba(255,255,255,.04)",
    grid: "rgba(255,255,255,.06)",
    food: "#ff4d6d",
    snake: "#39ff88",
    snakeHead: "#00e676",
    dead: "rgba(255,77,109,.25)",
  };

  const dir = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // ===== 状态 =====
  let snake = [];
  let food = { x: 10, y: 10 };
  let currentDirection = dir.right;
  let nextDirection = dir.right;

  let score = 0;
  let speed = initialSpeed;
  let timer = null;
  let running = false;
  let paused = false;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function eqCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function wrapCell(c) {
    return {
      x: (c.x + cols) % cols,
      y: (c.y + rows) % rows,
    };
  }

  function resetGame() {
    score = 0;
    speed = initialSpeed;
    scoreEl.textContent = String(score);
    speedEl.textContent = String(speed);

    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);

    // 初始长度 3，朝右
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    currentDirection = dir.right;
    nextDirection = dir.right;

    placeFood();

    running = false;
    paused = false;
    clearInterval(timer);
    timer = null;

    overlayTitle.textContent = "开始游戏";
    overlay.hidden = false;
    btnStart.textContent = "开始";

    // 先渲染一帧静态画面
    render(true);
  }

  function placeFood() {
    // 食物不能出现在蛇身上
    for (let i = 0; i < 500; i++) {
      const candidate = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
      if (!snake.some((s) => eqCell(s, candidate))) {
        food = candidate;
        return;
      }
    }
    // 极端情况下兜底
    food = { x: 0, y: 0 };
  }

  function canTurn(from, to) {
    // 不允许“掉头”：nextDirection 不能是 currentDirection 的反方向
    return !(from.x === -to.x && from.y === -to.y);
  }

  function setDirection(newDir) {
    // 每次只允许在“下一步”生效
    if (!canTurn(currentDirection, newDir)) return;
    nextDirection = newDir;
  }

  function tick() {
    if (!running || paused) return;

    currentDirection = nextDirection;
    const head = snake[0];
    const newHead = wrapCell({
      x: head.x + currentDirection.x,
      y: head.y + currentDirection.y,
    });

    // 撞到自身：
    // - 允许移动到“将要被移除的尾巴位置”这种情况（不然规则会过严）
    const willGrow = eqCell(newHead, food);
    const hitsBody = snake.some((s, idx) => {
      if (idx === snake.length - 1 && !willGrow) return false; // 尾巴会被移除
      return eqCell(s, newHead);
    });
    if (hitsBody) {
      return gameOver();
    }

    // 吃到食物
    snake.unshift(newHead);
    if (willGrow) {
      score += 1;
      scoreEl.textContent = String(score);

      // 速度随分数提升
      if (score % speedEvery === 0) {
        speed = +(speed + speedStep).toFixed(2);
        speedEl.textContent = String(speed);
        restartTimerWithNewSpeed();
      }

      placeFood();
    } else {
      // 正常前进：移除尾巴
      snake.pop();
    }

    render(false);
  }

  function restartTimerWithNewSpeed() {
    if (!running || paused) return;
    clearInterval(timer);
    const intervalMs = Math.max(40, Math.floor(1000 / speed));
    timer = setInterval(tick, intervalMs);
  }

  function start() {
    if (running) return;
    running = true;
    paused = false;
    overlay.hidden = true;

    // 启动计时器
    restartTimerWithNewSpeed();
  }

  function pauseToggle() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      overlay.hidden = false;
      overlayTitle.textContent = "已暂停";
      btnStart.textContent = "继续";
      clearInterval(timer);
      timer = null;
    } else {
      overlay.hidden = true;
      overlayTitle.textContent = "已暂停";
      btnStart.textContent = "暂停";
      restartTimerWithNewSpeed();
    }
  }

  function gameOver() {
    running = false;
    paused = false;
    clearInterval(timer);
    timer = null;

    overlayTitle.textContent = "游戏结束";
    btnStart.textContent = "重开";
    overlay.hidden = false;
    render(true);
  }

  function handleKeyDown(e) {
    const key = e.key.toLowerCase();

    if (key === " " || key === "spacebar") {
      e.preventDefault();
      pauseToggle();
      return;
    }

    if (!running) {
      // 未开始时任意方向键也能开局
      const map = {
        arrowup: dir.up,
        w: dir.up,
        arrowdown: dir.down,
        s: dir.down,
        arrowleft: dir.left,
        a: dir.left,
        arrowright: dir.right,
        d: dir.right,
      };
      if (map[key]) {
        setDirection(map[key]);
        start();
      }
      return;
    }

    const mapping = {
      arrowup: dir.up,
      w: dir.up,
      arrowdown: dir.down,
      s: dir.down,
      arrowleft: dir.left,
      a: dir.left,
      arrowright: dir.right,
      d: dir.right,
    };
    if (mapping[key]) {
      e.preventDefault();
      setDirection(mapping[key]);
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 1; x < cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * gridSize, 0);
      ctx.lineTo(x * gridSize, canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * gridSize);
      ctx.lineTo(canvas.width, y * gridSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFood() {
    const px = food.x * gridSize;
    const py = food.y * gridSize;

    // 食物用一个圆角方块
    ctx.save();
    ctx.fillStyle = COLORS.food;
    const r = 6;
    roundedRect(px + 3, py + 3, gridSize - 6, gridSize - 6, r);
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const px = s.x * gridSize;
      const py = s.y * gridSize;

      ctx.save();
      const isHead = i === 0;
      ctx.fillStyle = isHead ? COLORS.snakeHead : COLORS.snake;

      // 稍微做圆角和内阴影
      const pad = 3;
      const r = 6;
      roundedRect(px + pad, py + pad, gridSize - pad * 2, gridSize - pad * 2, r);
      ctx.fill();

      if (isHead) {
        ctx.fillStyle = "rgba(0,0,0,.18)";
        const eyeX = px + gridSize * 0.68;
        const eyeY = py + gridSize * 0.36;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function render(showDeadEffect) {
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawFood();
    drawSnake();

    if (showDeadEffect) {
      ctx.save();
      ctx.fillStyle = COLORS.dead;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // ===== 事件 =====
  document.addEventListener("keydown", handleKeyDown, { passive: false });

  btnStart.addEventListener("click", () => {
    if (!running) {
      // 如果在暂停 overlay 里点按钮，也当作继续
      if (overlayTitle.textContent === "已暂停") {
        paused = false;
        overlay.hidden = true;
        btnStart.textContent = "暂停";
        restartTimerWithNewSpeed();
        return;
      }
      // 未开始/游戏结束：直接开始新局
      resetGame();
      start();
      return;
    }
    // 正在游戏中：按钮当“暂停/继续”
    pauseToggle();
  });

  // ===== 初始化 =====
  resetGame();
  render(false);
})();

