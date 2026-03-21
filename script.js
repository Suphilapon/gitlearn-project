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
    heart: "#ff2d4a",
    snake: "#36d67c",
    snakeHead: "#ffd166",
    dead: "rgba(255,77,109,.25)",
  };

  const HEART_DURATION_MS = 6000;

  /** 剩余秒数（0~6）→ 分数：>5→36，>4→30… 线性递减，每档差 6 */
  function heartScoreFromRemainingSeconds(remainingSec) {
    if (remainingSec <= 0) return 0;
    const pts = 6 * (Math.floor(remainingSec) + 1);
    return Math.min(36, Math.max(6, pts));
  }

  const dir = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // ===== 状态 =====
  let snake = [];
  let food = { x: 10, y: 10 };
  /** @type {{ x: number, y: number, spawnAt: number } | null} */
  let heart = null;
  /** 每吃满 6 个普通果子触发一次红心 */
  let fruitsEatenForHeart = 0;
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

    heart = null;
    fruitsEatenForHeart = 0;

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
      if (
        !snake.some((s) => eqCell(s, candidate)) &&
        !(heart && eqCell(candidate, heart))
      ) {
        food = candidate;
        return;
      }
    }
    // 极端情况下兜底
    food = { x: 0, y: 0 };
  }

  function placeHeart() {
    for (let i = 0; i < 500; i++) {
      const candidate = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
      if (
        !snake.some((s) => eqCell(s, candidate)) &&
        !eqCell(candidate, food)
      ) {
        heart = { x: candidate.x, y: candidate.y, spawnAt: performance.now() };
        return;
      }
    }
    heart = null;
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

    if (heart && performance.now() - heart.spawnAt >= HEART_DURATION_MS) {
      heart = null;
    }

    currentDirection = nextDirection;
    const head = snake[0];
    const newHead = wrapCell({
      x: head.x + currentDirection.x,
      y: head.y + currentDirection.y,
    });

    // 撞到自身：
    // - 允许移动到“将要被移除的尾巴位置”这种情况（不然规则会过严）
    const willEatFood = eqCell(newHead, food);
    const willEatHeart = heart && eqCell(newHead, heart);
    const willGrow = willEatFood;
    const hitsBody = snake.some((s, idx) => {
      if (idx === snake.length - 1 && !willGrow && !willEatHeart) return false; // 尾巴会被移除
      return eqCell(s, newHead);
    });
    if (hitsBody) {
      return gameOver();
    }

    snake.unshift(newHead);
    if (willEatHeart) {
      const elapsed = performance.now() - heart.spawnAt;
      const remainingSec = Math.max(0, (HEART_DURATION_MS - elapsed) / 1000);
      const bonus = heartScoreFromRemainingSeconds(remainingSec);
      score += bonus;
      scoreEl.textContent = String(score);
      heart = null;

      if (score % speedEvery === 0) {
        speed = +(speed + speedStep).toFixed(2);
        speedEl.textContent = String(speed);
        restartTimerWithNewSpeed();
      }

      snake.pop();
    } else if (willGrow) {
      score += 1;
      scoreEl.textContent = String(score);

      fruitsEatenForHeart += 1;
      if (fruitsEatenForHeart >= 6) {
        fruitsEatenForHeart = 0;
        placeHeart();
      }

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
    heart = null;

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

  function drawHeart() {
    if (!heart) return;
    const cx = heart.x * gridSize + gridSize / 2;
    const cy = heart.y * gridSize + gridSize / 2;
    const s = gridSize * 0.48;
    ctx.save();

    // 主体：更大、更饱满，基本占满一格
    const bodyGrad = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
    bodyGrad.addColorStop(0, "#ff6a84");
    bodyGrad.addColorStop(0.45, COLORS.heart);
    bodyGrad.addColorStop(1, "#c90f2e");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(
      cx - s * 1.35,
      cy + s * 0.1,
      cx - s * 1.05,
      cy - s * 1.1,
      cx,
      cy - s * 0.38
    );
    ctx.bezierCurveTo(
      cx + s * 1.05,
      cy - s * 1.1,
      cx + s * 1.35,
      cy + s * 0.1,
      cx,
      cy + s * 0.9
    );
    ctx.closePath();

    // 先画柔和阴影，再画本体，增加立体层次
    ctx.shadowColor = "rgba(255, 28, 68, .42)";
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.stroke();

    // 顶部高光：玻璃感
    const topShine = ctx.createRadialGradient(
      cx - s * 0.35,
      cy - s * 0.55,
      1,
      cx - s * 0.35,
      cy - s * 0.55,
      s * 0.95
    );
    topShine.addColorStop(0, "rgba(255,255,255,.55)");
    topShine.addColorStop(0.35, "rgba(255,255,255,.24)");
    topShine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = topShine;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.14, cy - s * 0.42, s * 0.78, s * 0.58, -0.38, 0, Math.PI * 2);
    ctx.fill();

    // 小亮点：亮晶晶效果
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.beginPath();
    ctx.arc(cx - s * 0.52, cy - s * 0.48, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.beginPath();
    ctx.arc(cx + s * 0.08, cy - s * 0.22, s * 0.08, 0, Math.PI * 2);
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
      // 方形蛇身：占满整个格子，并用高光/阴影增强立体感
      ctx.fillRect(px, py, gridSize, gridSize);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(px, py, gridSize, 2);
      ctx.fillRect(px, py, 2, gridSize);
      ctx.fillStyle = "rgba(0,0,0,.16)";
      ctx.fillRect(px, py + gridSize - 2, gridSize, 2);
      ctx.fillRect(px + gridSize - 2, py, 2, gridSize);

      ctx.restore();
    }
  }

  function render(showDeadEffect) {
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawFood();
    drawHeart();
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

