/* ════════════════════════════════════════════════════════════════════════
   ТРЕНАЖЁР «Работа с соусами» — вся курсовая логика.

   Каталог соусов — js/sauces.js. Иллюстрации — js/scenes.js.
   SCORM (прогресс, переменные, завершение) — js/ku-scorm.js, здесь он только
   вызывается: KU.vars.set / KU.progress.

   Все три режима + финальный тест — это ОДИН движок раунда с разными
   конфигами (см. MODES). Отличаются: сколько заказов, вид часов, когда
   показывать результат и перемешиваются ли ячейки.

   ГЛАВНАЯ МЕХАНИКА: этикетка соуса в руке ЗАБЛЮРЕНА. Видны только фирменные
   цвета — ровно как когда хватаешь упаковку не глядя. Прочитать название
   можно единственным способом: нажать «Приблизить». Ячейка стеллажа подписана,
   но подпись НЕ гарантия — внутри может лежать другой соус той же цветовой
   группы. Поэтому чтение этикетки и есть единственный надёжный путь.

   БАЛЛЫ ЗА РАУНД (показываются ТОЛЬКО в итогах, не заранее — чтобы сначала
   увидеть, как сотрудник работает привычным способом):
     5 — положил верный соус, прочитав его этикетку;
     1 — положил верный соус, не читая (угадал по цвету);
     0 — ошибка;
   +3 — «поймал подмену»: ячейка была подписана нужным соусом, а внутри лежал
        другой, и ты заметил это, прочитав этикетку;
   +1 — за каждые 5 верных заказов подряд («Стрик»).

   Почему нет штрафа за то, что заглянул в другую ячейку: сотрудник обязан
   иметь право проверить, и наказывать за проверку — значит учить обратному.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ══ 0. УТИЛИТЫ ═══════════════════════════════════════════════════════ */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Название соуса всегда в кавычках: иначе «Гость просил Тысяча островов»
     требует падежа, а корректно склонять 15 названий не выйдет. */
  const nm = (sauce) => "«" + esc(sauce.name) + "»";

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const secs = (ms) => (ms / 1000).toFixed(1).replace(".", ",");
  /* Обратный отсчёт больше 59 секунд обязан показывать минуты: раньше 70
     секунд печатались как «0:70». */
  const mmss = (total) =>
    Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");

  /* Слот этикетки. Фиксированная пропорция + object-fit: contain — поэтому
     круглые XXL и прямоугольные упаковки выглядят одного размера и сетка
     не съезжает ни на одном экране. */
  function slot(sauce, small, blurred, cls) {
    return '<span class="sx-slot' + (blurred ? " is-blurred" : "") +
      (sauce.placeholder ? " sx-ph" : "") + (cls ? " " + cls : "") + '">' +
      '<img src="' + window.sauceImg(sauce, small) + '" alt="' +
      (blurred ? "" : esc(sauce.name)) + '"></span>';
  }

  /* ══ 1. СОСТОЯНИЕ И ЕГО СОХРАНЕНИЕ ════════════════════════════════════
     Имена переменных короткие и латинские: cmi.suspend_data ограничен
     ~4096 символами, и часть LMS считает байты, а не символы. Человеческие
     подписи для сводки лежат в скрытых полях [data-ku-var] в index.html. */

  const V = {
    dish: "sx-dish", love: "sx-love", hate: "sx-hate",
    emo: "sx-emo", ret: "sx-ret",
    m1: "sx-m1", m2: "sx-m2", m2acc0: "sx-m2a0", m2err0: "sx-m2e0",
    m3rank: "sx-m3r", m3err: "sx-m3e", m3n: "sx-m3n",
    finAcc: "sx-fa", finErr: "sx-fe", finBlind: "sx-fb", finTime: "sx-ft",
  };

  function getVar(name, dflt) {
    const v = window.KU && window.KU.vars ? window.KU.vars.get(name) : undefined;
    return v === undefined || v === "" ? dflt : v;
  }
  function setVar(name, value) {
    if (window.KU && window.KU.vars) window.KU.vars.set(name, value);
  }
  const num = (name, dflt) => {
    const n = parseFloat(getVar(name, ""));
    return isFinite(n) ? n : dflt;
  };

  const RANK = { gold: "золото", silver: "серебро", bronze: "бронза" };
  const RANK_ORDER = { "бронза": 1, "серебро": 2, "золото": 3 };

  const ST = {
    get m1()     { return num(V.m1, 0); },
    get m2()     { return num(V.m2, 0); },
    get m3rank() { return getVar(V.m3rank, ""); },
    get m1pass() { return this.m1 >= MODES.m1.pass; },
    get m2pass() { return this.m2 >= MODES.m2.pass; },
    get m3pass() { return this.m3rank === RANK.gold; },
  };

  /* ══ 2. ЗВУК: тиканье синтезируется в браузере ═════════════════════════
     Ноль файлов в пакете. AudioContext создаём только по жесту (кнопка
     старта) — иначе автоплей-политика браузера его заглушит. */

  const Sound = {
    ctx: null, muted: false,
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    /* Мягкий тон: синус с плавной атакой и затуханием. Прежний «квадрат»
       звучал резко и дребезжал — именно он и раздражал. */
    tone(freq, dur, vol) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.05);
    },
    // Верно — короткая восходящая терция, приятная на слух
    ok()   { this.tone(660, 0.16, 0.05); setTimeout(() => this.tone(880, 0.2, 0.045), 90); },
    // Ошибка — низкий мягкий тон, без резкости
    fail() { this.tone(300, 0.26, 0.05); },
    toggleMute(btn) {
      this.muted = !this.muted;
      btn.textContent = this.muted ? "Звук выкл." : "Звук вкл.";
      btn.setAttribute("aria-pressed", String(this.muted));
    },
  };

  /* ══ 3. КОНФИГИ РЕЖИМОВ ═══════════════════════════════════════════════
     feedback: instant — красный/зелёный экран, закрывает человек (режим 1);
               none    — никакой реакции до конца (режим 2, вся его соль);
               mark    — мгновенная галочка/крест в полосе отметок.
     clock:    stopwatch — секундомер на заказ, ничего не обрывает;
               countdown — обратный отсчёт, по нулю режим закрывается.
     trapRate — с какой вероятностью ячейка, подписанная нужным соусом,
                содержит другой. Это и есть сложность: без подмен подпись
                ячейки решала бы всё и читать этикетку было бы незачем.

     Порог режима 2 — 20 из 25: сценарные «40 баллов» при 5 заказах
     недостижимы (максимум 25), взяты те же 80%, что 40 из 50. */

  const MODES = {
    m1: {
      key: "m1", host: "#sx-play", out: "#sx-result",
      orders: 10, max: 50, pass: 40, feedback: "instant",
      clock: "stopwatch", reshuffle: false, sound: true, trapRate: 0.35,
      title: "Режим 1 · Тренировка осознанности",
      say: "Завтра приду с друзьями!",
    },
    m2: {
      key: "m2", host: "#sx-play", out: "#sx-result",
      orders: 5, max: 25, pass: 20, feedback: "none",
      clock: "stopwatch", reshuffle: false, sound: false, trapRate: 0.4,
      title: "Режим 2 · Режим реальной смены",
      say: "Теперь буду заказывать только у вас!",
    },
    m3: {
      key: "m3", host: "#sx-play", out: "#sx-result",
      orders: 15, max: 75, pass: 0, feedback: "mark",
      // Было 60 секунд. Действий в раунде много (нажать ячейку, приблизить,
      // прочитать, положить), поэтому времени добавлено.
      clock: "countdown", seconds: 70,
      reshuffle: true, sound: true, trapRate: 0.45,
      title: "Режим 3 · Экзамен",
      goldMinOrders: 10,   // чтобы «золото» нельзя было взять одним заказом
      say: "Теперь буду заказывать только у вас!",
    },
    fin: {
      key: "fin", host: "#sx-play-fin", out: "#sx-result-fin",
      // 10 заказов. Финал никого не блокирует — он измеряет, а не пускает.
      orders: 10, max: 50, pass: 0, feedback: "mark",
      clock: "stopwatch", reshuffle: true, sound: true, trapRate: 0.4,
      title: "Финальный тест",
      say: "Теперь буду заказывать только у вас!",
    },
  };

  /* ══ 4. ДВИЖОК РАУНДА ═════════════════════════════════════════════════ */

  const G = {
    cfg: null,
    layout: [],       // стабильные позиции ячеек (какой соус ПОДПИСАН где)
    bins: [],         // [{show, real, taken}] — содержимое на текущий заказ
    orders: [],
    i: 0,
    hand: null,       // {binIdx, sauce}
    opened: false,    // прочитал ли этикетку соуса, который сейчас в руке
    trapSeen: false,  // ячейка «обманула» в этом раунде
    results: [],
    streak: 0,
    bonus: 0,
    endsAt: 0,
    orderStart: 0,
    tick: null,
    streakTimer: null,
    running: false,
  };

  const el = {};

  /* Раскладка стеллажа: какой соус ПОДПИСАН в какой ячейке. Стабильна на весь
     режим (кроме экзамена и финала, где ячейки перемешиваются между заказами). */
  function buildLayout() { return shuffled(window.SAUCES); }

  /* Содержимое ячеек под текущий заказ. Каждый соус на полке ровно один раз.
     С вероятностью trapRate ячейка, подписанная нужным соусом, содержит другой
     из той же цветовой группы — а нужный прячется в ячейке этого «двойника». */
  function buildBins(target, trapRate) {
    const bins = G.layout.map((s) => ({ show: s, real: s, taken: false }));
    const swap = (a, b) => { const t = bins[a].real; bins[a].real = bins[b].real; bins[b].real = t; };

    const home = bins.findIndex((b) => b.show.slug === target.slug);
    if (home !== -1 && Math.random() < trapRate) {
      const mates = bins
        .map((b, i) => ({ b, i }))
        .filter((x) => x.i !== home && x.b.show.group === target.group);
      if (mates.length) swap(home, pick(mates).i);
    }

    // Ещё одна подмена в стороне — чтобы ловушка не читалась как «всегда там же»
    const groups = {};
    bins.forEach((b, i) => { (groups[b.show.group] = groups[b.show.group] || []).push(i); });
    const big = shuffled(Object.keys(groups).filter((g) => groups[g].length > 1));
    if (big.length) {
      const idxs = shuffled(groups[big[0]]);
      if (idxs[0] !== home && idxs[1] !== home) swap(idxs[0], idxs[1]);
    }
    return bins;
  }

  function buildOrders(count) {
    const out = [];
    let prev = null;
    while (out.length < count) {
      const s = pick(window.SAUCES);
      if (s === prev) continue;
      out.push(s);
      prev = s;
    }
    return out;
  }

  /* ── Разметка поля ────────────────────────────────────────────────────── */

  /* Поле рендерится в ДВУХ местах курса (модуль 4 и финальный тест), поэтому
     внутри никаких id: были бы дубли, и querySelector попадал бы в чужое поле.
     Узлы ищем по data-el в пределах своего host. */
  function buildField(host) {
    host.innerHTML =
      '<div class="sx-field" data-el="field">' +
        '<div class="sx-status">' +
          '<span class="ku-badge" data-el="mode-name"></span>' +
          '<span class="ku-badge" data-el="counter"></span>' +
          '<span class="sx-status__spacer"></span>' +
          '<span class="ku-badge sx-timer" data-el="timer" hidden></span>' +
          '<span class="ku-badge" data-el="score"></span>' +
        '</div>' +
        '<div class="sx-order">' +
          '<span class="sx-order__label">К заказу:</span>' +
          '<span class="sx-order__name" data-el="target">—</span>' +
        '</div>' +
        '<div class="sx-marks" data-el="marks" aria-live="polite"></div>' +
        '<div class="sx-shelf" data-el="shelf" role="group" ' +
          'aria-label="Стеллаж с подписанными ячейками"></div>' +
        '<div class="sx-hand is-empty" data-el="hand"></div>' +
        '<div class="sx-bag" data-el="bag">' +
          '<span class="sx-bag__label">Пакет заказа</span>' +
        '</div>' +
        '<div class="sx-zoom" data-el="zoom" role="dialog" aria-modal="true" ' +
          'aria-label="Этикетка крупным планом"></div>' +
        '<div class="sx-flash" data-el="flash" role="alert"></div>' +
        '<div class="sx-streak" data-el="streak" aria-hidden="true">' +
          '<span class="sx-streak__word">ИДЕАЛЬНО!</span>' +
          '<span class="sx-streak__sub">5 верных подряд · +1 балл</span>' +
        '</div>' +
      '</div>';

    ["field", "mode-name", "counter", "timer", "score", "target", "marks",
     "shelf", "hand", "bag", "zoom", "flash", "streak"].forEach((k) => {
      el[k] = $('[data-el="' + k + '"]', host);
    });
    el.marks.hidden = G.cfg.feedback !== "mark";
    el.bag.addEventListener("click", () => { if (G.hand) commit(); });
  }

  /* Стеллаж собирается один раз на раунд (и заново при перемешивании).
     Дальше правим только классы: пересборка innerHTML на каждое действие
     теряла бы фокус клавиатуры и рвала ссылки на узлы. */
  function renderShelf() {
    el.shelf.innerHTML = G.bins.map((b, idx) =>
      '<button type="button" class="sx-bin' +
        (b.show.shape === "round" ? " is-round" : "") +
        '" data-bin="' + idx + '" style="--c1:' + b.show.c1 + ';--c2:' + b.show.c2 + '"' +
        ' aria-label="Ячейка: ' + esc(b.show.short) + '">' +
        '<span class="sx-bin__corner"></span>' +
        '<span class="sx-bin__tag">' + esc(b.show.short) + '</span>' +
      '</button>').join("");
    updateShelf();
  }

  function updateShelf() {
    $$("[data-bin]", el.shelf).forEach((btn) => {
      const bin = G.bins[+btn.dataset.bin];
      btn.classList.toggle("is-taken", !!(bin && bin.taken));
    });
  }

  function renderHand() {
    if (!G.hand) {
      el.hand.className = "sx-hand is-empty";
      el.hand.innerHTML = '<p class="sx-hand__hint">Нажми на ячейку — и выбери: ' +
        '<b>«Положить в пакет»</b>, чтобы соус сразу ушёл в заказ, ' +
        '<b>«Приблизить»</b>, чтобы увидеть этикетку, ' +
        '<b>«Другой соус»</b>, чтобы вернуться к выбору.</p>';
      return;
    }
    const s = G.hand.sauce;
    el.hand.className = "sx-hand";
    // Этикетка заблюрена: название читается только после «Приблизить».
    el.hand.innerHTML =
      '<button type="button" class="sx-cup" data-el="cup" ' +
        'aria-label="Соус в руке. Нажми, чтобы приблизить этикетку">' +
        slot(s, true, !G.opened) + '</button>' +
      '<div class="sx-hand__actions">' +
        '<button type="button" class="ku-btn primary s" data-act="put">Положить в пакет</button>' +
        '<button type="button" class="ku-btn soft s" data-act="zoom">Приблизить</button>' +
        '<button type="button" class="ku-btn ghost s" data-act="other">Другой соус</button>' +
      '</div>';

    $$("[data-act]", el.hand).forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "zoom") openZoom();
      else if (a === "put") commit();
      else returnToShelf();
    }));
    bindDrag($('[data-el="cup"]', el.hand));
  }

  function renderMarks() {
    if (!el.marks || el.marks.hidden) return;
    el.marks.innerHTML = G.results.map((r, i) =>
      '<span class="sx-mark ' + (r.correct ? "correct" : "wrong") +
        '" role="img" aria-label="Заказ ' + (i + 1) +
        (r.correct ? ": верно" : ": ошибка") + '">' +
        '<svg class="ku-ico s"><use href="#i-' + (r.correct ? "check" : "close") +
        '"/></svg></span>').join("");
  }

  function renderStatus() {
    el["mode-name"].textContent = G.cfg.title.split(" · ")[0];
    el.counter.textContent = "Заказ " + Math.min(G.results.length + 1, G.cfg.orders) +
                             " / " + G.cfg.orders;
    el.score.textContent = totalPoints() + " б.";
    el.target.textContent = G.orders[G.i] ? G.orders[G.i].name : "—";
  }

  /* Бонусы складываются с базой, поэтому сумма могла бы превысить «из 50».
     Показываем и сравниваем с порогом капнутое значение. */
  const totalPoints = () => Math.min(
    G.results.reduce((sum, r) => sum + r.points, 0) + G.bonus,
    G.cfg ? G.cfg.max : Infinity);

  /* ── Действия игрока ─────────────────────────────────────────────────── */

  function takeFromBin(idx) {
    if (!G.running) return;
    const bin = G.bins[idx];
    if (!bin) return;
    if (G.hand) {
      if (G.hand.binIdx === idx) return;
      // Выбрала не тот соус — можно сразу нажать другую ячейку, без «Другой соус»
      G.bins[G.hand.binIdx].taken = false;
      G.opened = false;                 // новый соус — этикетку читать заново
    }
    G.hand = { binIdx: idx, sauce: bin.real };
    // Ловушка сработала: ячейка подписана нужным соусом, а внутри другой.
    if (bin.show.slug === G.orders[G.i].slug && bin.real.slug !== G.orders[G.i].slug) {
      G.trapSeen = true;
    }
    bin.taken = true;
    closeZoom();
    updateShelf();
    renderHand();
  }

  /* Вернуть соус на полку. Стоит НОЛЬ баллов: проверка — правильное
     поведение, наказывать за неё нельзя. */
  function returnToShelf() {
    if (!G.hand) return;
    G.bins[G.hand.binIdx].taken = false;
    G.hand = null;
    G.opened = false;
    closeZoom();
    updateShelf();
    renderHand();
  }

  function openZoom() {
    if (!G.hand) return;
    G.opened = true;
    const s = G.hand.sauce;
    el.zoom.innerHTML =
      '<div class="sx-zoom__card">' +
        slot(s, false, false) +
        '<span class="sx-zoom__name">' + esc(s.name) + '</span>' +
        '<span class="sx-zoom__brand">' + esc(s.full) + '</span>' +
        '<div class="sx-zoom__actions">' +
          '<button type="button" class="ku-btn primary s" data-act="put">Положить в пакет</button>' +
          '<button type="button" class="ku-btn soft s" data-act="other">Другой соус</button>' +
          '<button type="button" class="ku-btn ghost s" data-act="close">Назад</button>' +
        '</div>' +
      '</div>';
    $$("[data-act]", el.zoom).forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "put") { closeZoom(); commit(); }
      else if (a === "other") returnToShelf();
      else { closeZoom(); renderHand(); }
    }));
    el.zoom.classList.add("show");
    // preventScroll обязателен: иначе фокус прокручивает страницу и раскладка
    // уезжает под пальцем посреди раунда.
    const first = $(".ku-btn", el.zoom);
    if (first) first.focus({ preventScroll: true });
  }
  function closeZoom() { el.zoom.classList.remove("show"); el.zoom.innerHTML = ""; }

  function commit() {
    if (!G.running || !G.hand) return;
    const target = G.orders[G.i];
    const put = G.hand.sauce;
    const correct = put.slug === target.slug;
    const base = !correct ? 0 : (G.opened ? 5 : 1);
    const trap = correct && G.opened && G.trapSeen ? 3 : 0;
    const points = base + trap;
    const ms = G.orderStart ? (performance.now() - G.orderStart) : 0;

    G.results.push({ target, put, correct, points, trap: !!trap,
                     opened: G.opened, trapSeen: G.trapSeen, ms });

    G.streak = correct ? G.streak + 1 : 0;
    if (correct && G.streak % 5 === 0) { G.bonus += 1; showStreak(); }

    if (G.cfg.feedback === "mark") {
      renderMarks();
      if (correct) Sound.ok(); else Sound.fail();
    }

    const binIdx = G.hand.binIdx;
    G.hand = null;
    closeZoom();
    G.bins[binIdx].taken = false;

    if (G.cfg.feedback === "instant") showFlash(correct, target, put, points);
    else nextOrder();
  }

  /* Плашка «ИДЕАЛЬНО!». Класс .show снимаем по animationend, иначе плашка
     остаётся на экране артефактом. setTimeout — страховка на случай, когда
     анимации нет вообще (prefers-reduced-motion обнуляет длительности). */
  function showStreak() {
    const s = el.streak;
    if (!s) return;
    clearTimeout(G.streakTimer);
    s.classList.remove("show");
    void s.offsetWidth;
    s.classList.add("show");
    const off = () => s.classList.remove("show");
    s.addEventListener("animationend", off, { once: true });
    G.streakTimer = setTimeout(off, 2200);
  }
  function hideStreak() {
    clearTimeout(G.streakTimer);
    if (el.streak) el.streak.classList.remove("show");
  }

  /* «Красный экран» / «зелёный экран» режима 1. Закрывает человек кнопкой —
     никаких автопереходов по таймеру (правило ДС). */
  function showFlash(correct, target, put, points) {
    el.flash.className = "sx-flash show " + (correct ? "correct" : "wrong");
    el.flash.innerHTML = correct
      ? '<span class="sx-flash__title">Верно!</span>' +
        '<p class="sx-flash__text"><b>' + nm(put) + '</b> в заказе. ' +
        '+' + points + " " + plural(points, "балл", "балла", "баллов") +
        ' к внимательности.</p>' +
        '<button type="button" class="ku-btn l" data-next>Дальше</button>'
      : '<span class="sx-flash__title">Стоп!</span>' +
        '<p class="sx-flash__text">Ты положил <b>' + nm(put) + '</b>. ' +
        'Но Гость ждёт <b>' + nm(target) + '</b>. ' +
        'Читай название на этикетке!</p>' +
        '<button type="button" class="ku-btn l" data-next>Понял, дальше</button>';
    if (correct) Sound.ok(); else Sound.fail();
    const btn = $("[data-next]", el.flash);
    btn.addEventListener("click", () => {
      el.flash.className = "sx-flash";
      el.flash.innerHTML = "";
      nextOrder();
    });
    btn.focus({ preventScroll: true });
  }

  function nextOrder() {
    G.i++;
    G.opened = false;
    G.trapSeen = false;
    hideStreak();
    if (G.i >= G.cfg.orders) { finish(); return; }
    if (G.cfg.reshuffle) {
      // «Соусы в ячейках начинают меняться местами» — перемешиваем МЕЖДУ
      // заказами, а не под пальцем: дёргать DOM во время драга нельзя.
      G.layout = buildLayout();
    }
    G.bins = buildBins(G.orders[G.i], G.cfg.trapRate);
    renderShelf();
    renderHand();
    renderStatus();
    G.orderStart = performance.now();
  }

  /* ── Часы ────────────────────────────────────────────────────────────── */

  function startClock() {
    const cfg = G.cfg;
    el.timer.hidden = false;
    if (cfg.clock === "countdown") {
      G.endsAt = Date.now() + cfg.seconds * 1000;
      const paint = () => {
        const left = Math.max(0, Math.ceil((G.endsAt - Date.now()) / 1000));
        el.timer.textContent = mmss(left);
        el.timer.classList.toggle("is-hot", left <= 10);
        if (left <= 0) { stopClock(); finish(true); }
      };
      paint();
      G.tick = setInterval(paint, 250);
    } else {
      // Секундомер на заказ: он ничего не обрывает, просто показывает время.
      const paint = () => {
        const t = G.orderStart ? (performance.now() - G.orderStart) / 1000 : 0;
        el.timer.textContent = "⏱ " + t.toFixed(1).replace(".", ",") + " с";
      };
      paint();
      G.tick = setInterval(paint, 100);
    }
  }
  function stopClock() { clearInterval(G.tick); G.tick = null; }

  /* ── Старт и финиш режима ────────────────────────────────────────────── */

  function start(modeKey) {
    const cfg = MODES[modeKey];
    if (!cfg) return;
    const host = $(cfg.host);
    const out = $(cfg.out);
    if (!host || !out) return;
    out.innerHTML = "";
    out.hidden = true;
    host.hidden = false;

    G.cfg = cfg;
    G.layout = buildLayout();
    G.orders = buildOrders(cfg.orders);
    G.i = 0; G.hand = null; G.opened = false; G.trapSeen = false;
    G.results = []; G.streak = 0; G.bonus = 0; G.running = true;
    G.bins = buildBins(G.orders[0], cfg.trapRate);

    buildField(host);
    el.shelf.addEventListener("click", (e) => {
      const b = e.target.closest("[data-bin]");
      if (b) takeFromBin(+b.dataset.bin);
    });
    renderShelf();
    renderHand();
    renderStatus();

    if (cfg.sound) {
      Sound.ensure();                   // жест уже есть — кнопка старта
      const mute = document.createElement("button");
      mute.type = "button";
      mute.className = "ku-btn ghost s sx-mute";
      mute.textContent = "Звук вкл.";
      mute.setAttribute("aria-pressed", "false");
      mute.addEventListener("click", () => Sound.toggleMute(mute));
      $(".sx-status", host).appendChild(mute);
    }
    G.orderStart = performance.now();
    startClock();

    host.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function finish() {
    if (!G.running) return;
    G.running = false;
    stopClock();
    hideStreak();
    closeZoom();

    const done = G.results.length;
    const correct = G.results.filter((r) => r.correct).length;
    const r = {
      done, correct,
      errors: done - correct,
      points: totalPoints(),
      acc: done ? Math.round((correct / done) * 100) : 0,
      pct: G.cfg.max ? Math.round((totalPoints() / G.cfg.max) * 100) : 0,
      blind: G.results.filter((x) => x.correct && !x.opened).length,
      read: G.results.filter((x) => x.correct && x.opened).length,
      avgMs: avgCorrectMs(),
    };

    const host = $(G.cfg.host);
    host.hidden = true;
    host.innerHTML = "";               // не оставляем отыгранное поле в DOM
    const out = $(G.cfg.out);
    out.hidden = false;
    out.innerHTML = resultHtml(G.cfg, r);
    bindResultButtons(out);
    saveModeResult(G.cfg, r);
    applyGates();
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function avgCorrectMs() {
    const ok = G.results.filter((x) => x.correct && x.ms > 0);
    if (!ok.length) return 0;
    return ok.reduce((s, x) => s + x.ms, 0) / ok.length;
  }

  /* ══ 5. ИТОГИ РЕЖИМОВ ═════════════════════════════════════════════════ */

  /* Механика подсчёта показывается ЗДЕСЬ, а не во вступлении: сначала мы
     смотрим, как человек работает привычным способом, и только потом
     объясняем, почему получилось столько. */
  function rulesBlock() {
    const rows = [
      ["5", "положил верный соус, <b>прочитав его этикетку</b>"],
      ["1", "положил верный соус, не читая — просто угадал по цвету"],
      ["0", "ошибка: в заказ ушёл не тот соус"],
      ["+3", "поймал подмену: ячейка была подписана нужным соусом, а внутри лежал другой"],
      ["+1", "за каждые 5 верных заказов подряд"],
    ];
    return '<div class="sx-rules"><div class="ku-exercise__label">Как считались баллы</div>' +
      rows.map((x) => '<div class="sx-rules__row"><span class="sx-rules__pts">' +
        x[0] + '</span><span>' + x[1] + "</span></div>").join("") +
      "</div>";
  }

  function scoreTable(res, bonus, total, max) {
    const kinds = [
      ["Прочитал этикетку и положил верно", 5, (r) => r.correct && r.opened],
      ["Положил верно, но не читая", 1, (r) => r.correct && !r.opened],
      ["Ошибка", 0, (r) => !r.correct],
      ["Поймал подмену в ячейке", 3, (r) => r.trap],
    ];
    let html = '<div class="sx-score">';
    kinds.forEach(([label, pts, test]) => {
      const n = res.filter(test).length;
      if (!n) return;
      html += '<div class="sx-score__row"><span>' + label + " × " + n +
        '</span><span class="dots"></span><b>' + (n * pts) + " б.</b></div>";
    });
    if (bonus) {
      html += '<div class="sx-score__row"><span>Бонус за серии «Идеально» × ' + bonus +
        '</span><span class="dots"></span><b>' + bonus + " б.</b></div>";
    }
    html += '<div class="sx-score__row is-total"><span>Итого</span>' +
      '<span class="dots"></span><b>' + total + " из " + max + "</b></div></div>";
    return html;
  }

  /* Три цифры, которые просил методист: сколько ушло в пакет прямо из ячейки,
     сколько — после чтения этикетки, и сколько времени уходит на верный соус. */
  function countsBlock(r) {
    return '<div class="ku-grid cols-3">' +
      stat(r.read, "верно · <b>после чтения</b> этикетки") +
      stat(r.blind, "верно · <b>прямо из ячейки</b>, не читая") +
      stat(r.avgMs ? secs(r.avgMs) + " с" : "—", "среднее время на верный соус") +
      "</div>";
  }

  /* Оценка Гостя. Шкала из брифа задана в баллах (менее 40 / 60–80 / 100), но
     максимумы режимов разные (50, 25, 75), а «100 баллов» не существует нигде.
     Поэтому шкала переведена в ПРОЦЕНТЫ от максимума режима — только так она
     работает во всех четырёх прогонах. Пробелы 40–59 и 81–99 заполнены. */
  function guestVerdict(pct, cfg) {
    if (pct >= 100) return { level: 5, stars: 5, mood: "Гость очень доволен", say: cfg.say };
    if (pct >= 81)  return { level: 4, stars: 4, mood: "Гость доволен" };
    if (pct >= 60)  return { level: 4, stars: 4, mood: "Гость равнодушен" };
    if (pct >= 40)  return { level: 2, stars: 2, mood: "Гость расстроен" };
    return { level: 1, stars: 1, mood: "Гость недоволен" };
  }

  function guestBlock(cfg, r) {
    const v = guestVerdict(r.pct, cfg);
    return '<div class="sx-guest">' +
      '<div class="sx-guest__art">' + window.SCENES.guest(v.level) + "</div>" +
      window.SCENES.stars(v.stars, 5) +
      '<p class="sx-guest__cap">' + esc(v.mood) + " · " + r.pct + "% от максимума</p>" +
      (v.say ? '<p class="sx-guest__say">' + esc(v.say) + "</p>" : "") +
      "</div>";
  }

  const stat = (n, label) =>
    '<div class="ku-stat"><div class="ku-stat__num">' + n +
    '</div><div class="ku-stat__label">' + label + "</div></div>";

  function resultHead(title, sub) {
    return '<div class="ku-center"><span class="ku-eyebrow">' + esc(title) + "</span>" +
      '<div class="ku-space s"></div><h3 class="ku-h2">' + sub + "</h3></div>" +
      '<div class="ku-space s"></div>';
  }

  function resultHtml(cfg, r) {
    if (cfg.key === "m1") return resultM1(cfg, r);
    if (cfg.key === "m2") return resultM2(cfg, r);
    if (cfg.key === "m3") return resultM3(cfg, r);
    return resultFin(cfg, r);
  }

  function resultM1(cfg, r) {
    const passed = r.points >= cfg.pass;
    return resultHead("Итог режима 1",
        r.points + " " + plural(r.points, "балл", "балла", "баллов") + " из " + cfg.max) +
      guestBlock(cfg, r) +
      '<div class="ku-space m"></div>' + countsBlock(r) +
      '<div class="ku-space m"></div>' + rulesBlock() +
      '<div class="ku-space s"></div>' + scoreTable(G.results, G.bonus, r.points, cfg.max) +
      '<div class="ku-space m"></div>' +
      '<div class="ku-feedback show ' + (passed ? "correct" : "incorrect") + '">' +
        (passed
          ? "<strong>Проходной балл взят.</strong> Режим 2 «Режим реальной смены» открыт."
          : "<strong>Проходной балл — " + cfg.pass + ".</strong> Пока " + r.points +
            ". Пройди режим заново: каждый соус, который ты положил не читая, " +
            "стоит 1 балл вместо 5.") +
      "</div>" +
      '<div class="ku-space m"></div>' +
      '<div class="ku-row center">' +
        '<button type="button" class="ku-btn primary" data-start="m1">Пройти ещё раз</button>' +
        (passed ? '<button type="button" class="ku-btn soft" data-start="m2">К режиму 2</button>' : "") +
        '<button type="button" class="ku-btn ghost" data-back>К режимам</button>' +
      "</div>";
  }

  function resultM2(cfg, r) {
    const rows = G.results.map((res, i) =>
      '<div class="sx-check__row' + (res.correct ? "" : " wrong") + '">' +
        '<span class="sx-check__num">Заказ №' + (i + 1) + "</span>" +
        "<span>" + (res.correct
          ? "Ты положил <b>" + nm(res.put) + "</b> — верно."
          : "Ты положил <b>" + nm(res.put) + "</b>, а Гость просил <b>" +
            nm(res.target) + "</b>.") +
        "</span></div>").join("");

    const verdict = r.errors
      ? '<div class="ku-callout danger"><div><div class="ku-callout__title">' +
          "Обрати внимание</div><p>Ты был уверен, что всё сделал идеально. Но ошибся в " +
          r.errors + " " + plural(r.errors, "заказе", "заказах", "заказах") + " из " +
          r.done + ".<br>Именно так это происходит и в реальной жизни. Ты не замечаешь " +
          "ошибку, а Гость не получает свой любимый вкус. Будь внимательнее!</p></div></div>"
      : '<div class="ku-callout success"><div><div class="ku-callout__title">' +
          "Круто!</div><p>Ты справился идеально! Теперь Гости будут довольны заказом " +
          "и смогут насладиться любимым соусом!</p></div></div>";

    const passed = r.points >= cfg.pass;
    return resultHead("Чек-лист ошибок · режим 2",
        r.points + " из " + cfg.max + " · точность " + r.acc + "%") +
      guestBlock(cfg, r) +
      '<div class="ku-space m"></div>' +
      '<div class="sx-check">' + rows + "</div>" +
      '<div class="ku-space m"></div>' + verdict +
      '<div class="ku-space m"></div>' + countsBlock(r) +
      '<div class="ku-space m"></div>' + rulesBlock() +
      '<div class="ku-space s"></div>' + scoreTable(G.results, G.bonus, r.points, cfg.max) +
      '<div class="ku-space m"></div>' +
      '<div class="ku-feedback show ' + (passed ? "correct" : "incorrect") + '">' +
        (passed
          ? "<strong>Порог взят (" + cfg.pass + " из " + cfg.max +
            ").</strong> Режим 3 «Экзамен» открыт."
          : "<strong>Порог — " + cfg.pass + " из " + cfg.max + ".</strong> Пока " +
            r.points + ". Режим 3 не откроется, пока не наберёшь порог.") +
      "</div>" +
      '<div class="ku-space m"></div>' +
      '<div class="ku-row center">' +
        '<button type="button" class="ku-btn primary" data-start="m2">Пройти ещё раз</button>' +
        (passed ? '<button type="button" class="ku-btn soft" data-start="m3">К экзамену</button>' : "") +
        '<button type="button" class="ku-btn ghost" data-back>К режимам</button>' +
      "</div>";
  }

  function resultM3(cfg, r) {
    const rank = rankOf(cfg, r);
    const texts = {
      gold:   "Ты — мастер внимания! Твои Гости всегда будут сыты и довольны.",
      silver: "Хороший результат, но есть куда расти. Перечитай этикетки ещё раз.",
      bronze: "Провал. Ты потерял этих Гостей навсегда. Рекомендуем вернуться " +
              "к Режиму №1 «Тренировка осознанности».",
    };
    const gold = rank === "gold";

    return resultHead("Итог экзамена",
        "Собрано заказов: " + r.done + " · " +
        (r.errors ? r.errors + " " + plural(r.errors, "ошибка", "ошибки", "ошибок")
                  : "без ошибок")) +
      '<div class="sx-medal ' + rank + '">' +
        '<div class="sx-medal__disc">' + RANK[rank].toUpperCase() + "</div></div>" +
      '<div class="ku-space s"></div>' +
      '<p class="ku-lead ku-center">' + texts[rank] + "</p>" +
      '<div class="ku-space m"></div>' + guestBlock(cfg, r) +
      '<div class="ku-space m"></div>' + countsBlock(r) +
      '<div class="ku-space m"></div>' + rulesBlock() +
      '<div class="ku-space s"></div>' + scoreTable(G.results, G.bonus, r.points, cfg.max) +
      (rank !== "gold" && r.errors === 0
        ? '<p class="ku-small ku-soft ku-center">Ошибок нет, но для «золота» нужно ' +
          "собрать минимум " + cfg.goldMinOrders + " заказов за " + cfg.seconds +
          " секунд — ты собрал " + r.done + ".</p>"
        : "") +
      '<div class="ku-space m"></div>' +
      '<div class="ku-feedback show ' + (gold ? "correct" : "incorrect") + '">' +
        (gold
          ? "<strong>Экзамен сдан на золото.</strong> Модули 5 и 6 открыты."
          : "<strong>Доступ к дальнейшим разделам открывается только за «золото».</strong> " +
            "Ноль ошибок и минимум " + cfg.goldMinOrders + " собранных заказов.") +
      "</div>" +
      '<div class="ku-space m"></div>' +
      '<div class="ku-row center">' +
        '<button type="button" class="ku-btn primary" data-start="m3">Сдать заново</button>' +
        '<button type="button" class="ku-btn soft" data-start="m1">К режиму 1</button>' +
        '<button type="button" class="ku-btn ghost" data-back>К режимам</button>' +
      "</div>";
  }

  function rankOf(cfg, r) {
    if (r.errors === 0 && r.done >= cfg.goldMinOrders) return "gold";
    if (r.errors <= 2) return "silver";
    return "bronze";
  }

  /* Финальный тест: 10 заказов, никого не блокирует. На итоговом экране —
     три показателя, которые просил методист.

     База для сравнения — ПЕРВАЯ попытка режима 2. Там было 5 заказов, здесь
     10, поэтому штуки сравнивать нельзя: сравниваем проценты и показываем
     оба абсолютных числа честно. */
  function resultFin(cfg, r) {
    const base = num(V.m2acc0, null);
    const baseErr = num(V.m2err0, null);
    const baseOk = baseErr === null ? null : Math.max(0, MODES.m2.orders - baseErr);

    let compare;
    if (base === null) {
      compare = '<p class="ku-lead">Точность в финальном тесте: <b>' + r.acc + "%</b>.</p>";
    } else {
      const delta = r.acc - base;
      compare =
        '<div class="ku-grid cols-2">' +
          stat(baseOk + " из " + MODES.m2.orders + " · " + base + "%",
               "было в начале — первый проход режима 2") +
          stat(r.correct + " из " + r.done + " · " + r.acc + "%",
               "сейчас — финальный тест") +
        "</div>" +
        '<div class="ku-space s"></div>' +
        '<p class="ku-lead ku-center">' + (
          delta > 0
            ? "Твоя точность выросла на <b>" + delta + " п.п.</b>"
            : delta === 0
              ? "Точность держится на прежнем уровне — <b>" + r.acc + "%</b>."
              : "Точность просела на <b>" + Math.abs(delta) + " п.п.</b> " +
                "Вернись к «Правилу трёх касаний»."
        ) + "</p>";
    }

    const blind = r.blind + G.results.filter((x) => !x.correct && !x.opened).length;
    const blindBlock = blind
      ? '<div class="ku-callout danger"><span class="ku-callout__icon">' +
          '<svg class="ku-ico l"><use href="#i-alert"/></svg></span>' +
          '<div><div class="ku-callout__title">Кажется, ты не усвоил урок</div>' +
          "<p>Соусов, отправленных в пакет прямо из ячейки, без чтения этикетки: <b>" +
          blind + "</b>. Нужно читать этикетку, а не сразу класть в пакет соус " +
          "из ячейки — подпись на ячейке может не совпадать с тем, что внутри.</p></div></div>"
      : '<div class="ku-callout success"><span class="ku-callout__icon">' +
          '<svg class="ku-ico l"><use href="#i-check"/></svg></span>' +
          '<div><div class="ku-callout__title">Урок усвоен</div>' +
          "<p>Ни одного соуса ты не отправил в пакет не глядя — перед каждым " +
          "читал этикетку. Это и есть та привычка, ради которой всё было.</p></div></div>";

    return resultHead("Финальный тест",
        r.correct + " из " + r.done + " · точность " + r.acc + "%") +
      '<div class="ku-grid cols-3">' +
        stat(blind, "положено <b>прямо из ячейки</b>, не читая") +
        stat(r.correct + " из " + r.done, "собрано <b>без ошибок</b>") +
        stat(r.avgMs ? secs(r.avgMs) + " с" : "—", "среднее время <b>на 1 соус</b>") +
      "</div>" +
      '<div class="ku-space m"></div>' + blindBlock +
      '<div class="ku-space m"></div>' + compare +
      '<div class="ku-space m"></div>' + guestBlock(cfg, r) +
      '<div class="ku-space m"></div>' +
      '<div class="ku-row center">' +
        '<button type="button" class="ku-btn soft" data-start="fin">Пройти ещё раз</button>' +
        '<button type="button" class="ku-btn primary" data-go="finish">К завершению курса</button>' +
      "</div>";
  }

  function bindResultButtons(root) {
    $$("[data-start]", root).forEach((b) =>
      b.addEventListener("click", () => start(b.dataset.start)));
    $$("[data-back]", root).forEach((b) => b.addEventListener("click", () => {
      const modes = $("#sx-modes");
      $("#sx-result").hidden = true;
      if (modes) modes.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-go]", root).forEach((b) =>
      b.addEventListener("click", () => window.SX.go(b.dataset.go)));
  }

  function saveModeResult(cfg, r) {
    if (cfg.key === "m1") {
      setVar(V.m1, Math.max(num(V.m1, 0), r.points));
      if (r.points >= cfg.pass) window.KU.progress.markDone("m4-mode1");
    } else if (cfg.key === "m2") {
      setVar(V.m2, Math.max(num(V.m2, 0), r.points));
      // ПЕРВЫЙ результат режима 2 — база для сравнения на финале, не перезаписываем
      if (getVar(V.m2acc0, "") === "") {
        setVar(V.m2acc0, r.acc);
        setVar(V.m2err0, r.errors);
      }
      if (r.points >= cfg.pass) window.KU.progress.markDone("m4-mode2");
    } else if (cfg.key === "m3") {
      const rank = rankOf(cfg, r);
      // Не понижаем уже полученный рейтинг: «золото» однажды — золото навсегда
      if ((RANK_ORDER[RANK[rank]] || 0) >= (RANK_ORDER[getVar(V.m3rank, "")] || 0)) {
        setVar(V.m3rank, RANK[rank]);
        setVar(V.m3err, r.errors);
        setVar(V.m3n, r.done);
      }
      if (rank === "gold") window.KU.progress.markDone("m4-mode3");
    } else {
      setVar(V.finAcc, r.acc);
      setVar(V.finErr, r.errors);
      setVar(V.finBlind, r.blind);
      setVar(V.finTime, r.avgMs ? secs(r.avgMs) : "—");
      window.KU.progress.markDone("m6-final");
    }
  }

  /* ══ 6. DRAG НА POINTER EVENTS ════════════════════════════════════════
     Один код на мышь, палец и стилус. HTML5 drag-and-drop не годится: на
     тач-экранах он не работает, а курс проходят с телефона. Короткий тап без
     смещения = «приблизить этикетку». */

  function bindDrag(cup) {
    if (!cup) return;
    let active = false, moved = false, sx = 0, sy = 0;

    cup.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      active = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      // Часть браузеров бросает NotFoundError, если указатель уже не активен.
      // Захват — оптимизация (палец может уйти за пределы соуса), не обязателен.
      try { cup.setPointerCapture(e.pointerId); } catch (err) { /* переживём */ }
      cup.classList.add("dragging");
    });

    cup.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      cup.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.06)";
      el.bag.classList.toggle("drag-over", inRect(e, el.bag));
    });

    const end = (e) => {
      if (!active) return;
      active = false;
      cup.classList.remove("dragging");
      cup.style.transform = "";
      el.bag.classList.remove("drag-over");
      if (!moved) { openZoom(); return; }      // это был тап, не драг
      if (inRect(e, el.bag)) commit();
    };
    cup.addEventListener("pointerup", end);
    cup.addEventListener("pointercancel", () => {
      active = false;
      cup.classList.remove("dragging");
      cup.style.transform = "";
      el.bag.classList.remove("drag-over");
    });

    cup.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openZoom(); }
    });
  }

  function inRect(e, node) {
    const r = node.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right &&
           e.clientY >= r.top && e.clientY <= r.bottom;
  }

  /* ══ 7. ГЕЙТЫ ═════════════════════════════════════════════════════════
     Блокировки как в сценарии: режим 2 — только после проходного балла в
     режиме 1, режим 3 — после режима 2, модули 5–6 — только за «золото».
     Финальный тест не блокирует ничего: он измеряет, а не пускает. */

  const GATES = {
    m2: () => ST.m1pass,
    m3: () => ST.m2pass,
    ch5: () => ST.m3pass,
    ch6: () => ST.m3pass,
  };
  const GATE_MSG = {
    m2: "Режим 2 откроется, когда наберёшь " + MODES.m1.pass + " баллов в режиме 1.",
    m3: "Экзамен откроется, когда наберёшь " + MODES.m2.pass + " из " + MODES.m2.max +
        " в режиме 2.",
    ch5: "Дальнейшие разделы откроются, когда сдашь экзамен на «золото» " +
         "(ноль ошибок, минимум " + MODES.m3.goldMinOrders + " заказов).",
  };
  GATE_MSG.ch6 = GATE_MSG.ch5;

  function applyGates() {
    $$("[data-mode-card]").forEach((card) => {
      const key = card.dataset.modeCard;
      const open = !GATES[key] || GATES[key]();
      card.classList.toggle("locked", !open);
      card.setAttribute("aria-disabled", String(!open));
      const done = { m1: ST.m1pass, m2: ST.m2pass, m3: ST.m3pass }[key];
      card.classList.toggle("done", !!done);
      const badge = $("[data-mode-state]", card);
      if (badge) badge.textContent = !open ? "Закрыто" : done ? "Пройден" : "Открыт";
    });
    $$("[data-chapter-card]").forEach((card) => {
      const key = card.dataset.chapterCard;
      const open = !GATES[key] || GATES[key]();
      card.classList.toggle("locked", !open);
    });
    const sum = $("#sx-progress-note");
    if (sum) {
      sum.innerHTML =
        "Режим 1: <b>" + ST.m1 + " / " + MODES.m1.max + "</b> · " +
        "Режим 2: <b>" + ST.m2 + " / " + MODES.m2.max + "</b> · " +
        "Экзамен: <b>" + (ST.m3rank || "не сдан") + "</b>";
    }
  }

  /* ══ 8. ПУБЛИЧНОЕ API КУРСА ═══════════════════════════════════════════ */

  window.SX = {
    start(mode) {
      if (GATES[mode] && !GATES[mode]()) { alertGate(mode); return; }
      start(mode);
    },
    go(chapter) {
      if (GATES[chapter] && !GATES[chapter]()) { alertGate(chapter); return; }
      window.kuNavigate(chapter);
    },
    applyGates,
    MODES,
  };

  function alertGate(key) {
    const box = $("#sx-gate-msg");
    if (!box) return;
    box.className = "ku-feedback show incorrect";
    box.innerHTML = "<strong>Пока закрыто.</strong> " + GATE_MSG[key];
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ══ 9. МОДУЛЬ 1 · «ПОСТАВЬ СЕБЯ НА МЕСТО ГОСТЯ» ══════════════════════ */

  const M1 = { dish: null, love: [], hate: [] };

  function initModule1() {
    // Рисунки закусок из scenes.js — в разметке остаются только data-атрибуты
    $$("[data-dish]").forEach((btn) => {
      const art = $("[data-dish-art]", btn);
      if (art) art.innerHTML = window.SCENES.dish(btn.dataset.dish);
    });
    // Иллюстрации эмоций: текстом их мало кто читает
    $$("[data-emotion]").forEach((btn) => {
      const art = $("[data-emotion-art]", btn);
      if (art) art.innerHTML = window.SCENES.emotion(btn.dataset.emotion);
    });

    const dishes = $$("[data-dish]");
    dishes.forEach((btn) => btn.addEventListener("click", () => {
      dishes.forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      M1.dish = btn.dataset.dish;
      setVar(V.dish, btn.dataset.dishName || btn.dataset.dish);
      $("#m1-step-love").hidden = false;
      renderChoose("#m1-love", 3, "is-on", () => {
        $("#m1-step-hate").hidden = false;
        renderChoose("#m1-hate", 2, "is-bad", () => { $("#m1-step-box").hidden = false; });
      });
      $("#m1-step-love").scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    const openBtn = $("#m1-open-bag");
    if (openBtn) openBtn.addEventListener("click", openBag);
    const bagNext = $("#m1-bag-next");
    if (bagNext) bagNext.addEventListener("click", toEmotionStep);

    $$("[data-emotion]").forEach((btn) => btn.addEventListener("click", () => {
      $$("[data-emotion]").forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      setVar(V.emo, btn.dataset.emotion);
      $("#m1-step-final").hidden = false;
      $("#m1-step-final").scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    $$("[data-return]").forEach((btn) => btn.addEventListener("click", () => {
      $$("[data-return]").forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      setVar(V.ret, btn.dataset.return);
      // Вывод под ответ: «умножь эту эмоцию» после «Да» звучит как упрёк
      $$("[data-outro]").forEach((t) => { t.hidden = t.dataset.outro !== btn.dataset.return; });
      $("#m1-outro").hidden = false;
      window.KU.progress.markDone("m1-empathy");
      $("#m1-outro").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function renderChoose(sel, need, onClass, onComplete) {
    const host = $(sel);
    if (!host || host.dataset.built) return;
    host.dataset.built = "1";
    host.innerHTML = window.SAUCES.map((s) =>
      '<button type="button" class="sx-choose__btn" data-slug="' + s.slug + '">' +
        slot(s, true, false) +
        "<figcaption>" + esc(s.name) + "</figcaption></button>").join("");

    const counter = $(sel + "-count");
    const chosen = [];
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-slug]");
      if (!btn) return;
      const slug = btn.dataset.slug;
      const at = chosen.indexOf(slug);
      if (at !== -1) { chosen.splice(at, 1); btn.classList.remove(onClass); }
      else if (chosen.length < need) { chosen.push(slug); btn.classList.add(onClass); }
      if (counter) counter.textContent = chosen.length + " из " + need;
      if (chosen.length === need) {
        $$("[data-slug]", host).forEach((b) => { b.disabled = !chosen.includes(b.dataset.slug); });
        const names = chosen.map((s) => window.sauceBySlug(s).name).join(", ");
        if (onClass === "is-on") { M1.love = chosen.slice(); setVar(V.love, names); }
        else { M1.hate = chosen.slice(); setVar(V.hate, names); }
        onComplete();
      }
    });
  }

  /* «Система специально кладёт тот соус, который сотрудник только что назвал
     неподходящим» — в этом весь смысл симуляции. Заказ на вынос приезжает
     в фирменном бумажном пакете, а не в коробке. */
  function openBag() {
    const wrong = window.sauceBySlug(M1.hate[0] || "ketchup");
    const chosen = $("[data-dish].is-on");
    const dishKey = chosen ? chosen.dataset.dish : "fries";
    const dishAcc = chosen ? chosen.dataset.dishAcc : "своё блюдо";

    const scene = $("#m1-bag");
    $("#m1-bag-art").innerHTML = window.SCENES.bag(dishKey, { glow: true });
    $("#m1-bag-sauce").innerHTML = slot(wrong, true, false);
    scene.classList.add("is-open");
    $("#m1-bag-caption").innerHTML =
      "Ты заказал <b>" + esc(dishAcc) + "</b>. А в пакете лежит <b>" +
      nm(wrong) + "</b> — тот самый соус, который ты только что назвал " +
      "неподходящим.";
    // К шагу 5 человек переходит сам, кнопкой «Дальше», когда рассмотрел
    // пакет. Раньше шаг 5 открывался и прокручивался сам через 0,6 с — пакет
    // уезжал вверх раньше, чем его успевали увидеть.
    $("#m1-open-bag").hidden = true;
    $("#m1-bag-next").hidden = false;
    // Шаг 4 последний на странице, и рисунок пакета появляется только сейчас:
    // он выталкивает подпись и «Дальше» за нижний край. Докручиваем ровно
    // настолько, чтобы пакет был виден целиком (nearest — не дальше). Высота
    // рисунка известна сразу, ещё до загрузки картинки: её держит
    // aspect-ratio в css/course.css, раздел 13.
    scene.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function toEmotionStep() {
    $("#m1-bag-next").hidden = true;
    $("#m1-step-emotion").hidden = false;
    $("#m1-step-emotion").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ══ 10. МОДУЛЬ 3 · СЕКРЕТ ЭТИКЕТКИ ══════════════════════════════════ */

  /* Полноэкранный просмотр этикетки. Увеличение на 6% задачу «прочитай
     название» не решает, поэтому здесь настоящий полный экран. */
  const LB = { node: null, prevFocus: null };

  function lightbox(sauce, actions) {
    if (!LB.node) {
      LB.node = document.createElement("div");
      LB.node.className = "sx-lightbox";
      LB.node.setAttribute("role", "dialog");
      LB.node.setAttribute("aria-modal", "true");
      document.body.appendChild(LB.node);
      LB.node.addEventListener("click", (e) => {
        if (e.target === LB.node) closeLightbox();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && LB.node.classList.contains("show")) closeLightbox();
      });
    }
    LB.prevFocus = document.activeElement;
    LB.node.innerHTML =
      '<div class="sx-lightbox__card">' +
        slot(sauce, false, false) +
        '<span class="sx-lightbox__name">' + esc(sauce.name) + "</span>" +
        '<span class="sx-lightbox__brand">' + esc(sauce.full) + "</span>" +
        '<div class="sx-lightbox__actions">' +
          actions.map((a, i) => '<button type="button" class="ku-btn ' +
            (a.style || "soft") + '" data-lb="' + i + '">' + esc(a.label) +
            "</button>").join("") +
        "</div>" +
      "</div>";
    $$("[data-lb]", LB.node).forEach((b) => b.addEventListener("click", () => {
      const a = actions[+b.dataset.lb];
      if (a && a.run) a.run();
    }));
    LB.node.classList.add("show");
    const first = $(".ku-btn", LB.node);
    if (first) first.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!LB.node) return;
    LB.node.classList.remove("show");
    LB.node.innerHTML = "";
    if (LB.prevFocus && LB.prevFocus.focus) LB.prevFocus.focus({ preventScroll: true });
  }

  /* Цель — «Горчичный»: жёлтая группа самая большая (5 соусов), поэтому по
     цвету его не вычислить и приходится открывать этикетки. */
  const FIND = { target: "mustard", t0: 0, on: false };

  function initModule3() {
    const map = $("#m3-map");
    if (map) {
      renderMap(map, false);
      const openItem = (fig) => {
        const s = window.sauceBySlug(fig.dataset.slug);
        if (!s) return;
        if (FIND.on) {
          // Задание на скорость: соус можно выбрать или вернуться к сетке
          lightbox(s, [
            { label: "Выбрать", style: "primary", run: () => { closeLightbox(); checkFind(s.slug); } },
            { label: "К выбору соуса", style: "soft", run: closeLightbox },
          ]);
        } else {
          lightbox(s, [{ label: "Закрыть", style: "soft", run: closeLightbox }]);
        }
      };
      map.addEventListener("click", (e) => {
        const fig = e.target.closest(".sx-map__item");
        if (fig) openItem(fig);
      });
      map.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const fig = e.target.closest(".sx-map__item");
        if (fig) { e.preventDefault(); openItem(fig); }
      });
    }

    const findBtn = $("#m3-find-start");
    if (findBtn) findBtn.addEventListener("click", startFind);

    // Блок «0,5 секунды на слово» — только после верного ответа на экране 1
    const q = $("#ku-page-ch3 .ku-quiz-q");
    if (q) {
      q.addEventListener("click", (e) => {
        const btn = e.target.closest(".ku-choice");
        if (btn && btn.dataset.correct === "1") {
          const note = $("#m3-halfsecond");
          if (note) note.hidden = false;
        }
      });
    }
  }

  /* blurred=true — режим задания: только цвета, названий не видно и подписей
     под этикетками нет. */
  function renderMap(map, blurred) {
    map.classList.toggle("is-task", !!blurred);
    map.innerHTML = shuffled(window.SAUCES).map((s) =>
      '<figure class="sx-map__item" tabindex="0" role="button" ' +
        'data-slug="' + s.slug + '" aria-label="' +
        (blurred ? "Соус, этикетка скрыта" : esc(s.name)) + '">' +
        slot(s, true, blurred) +
        "<figcaption>" + esc(s.name) + "</figcaption></figure>").join("");
  }

  /* «Найди соус за 3 секунды» — измеряем время и всегда даём успех: это
     доказательство «читать быстро», а не наказание за медлительность. */
  function startFind() {
    FIND.t0 = Date.now();
    FIND.on = true;
    FIND.tries = 0;
    $("#m3-find-start").hidden = true;
    $("#m3-find-intro").hidden = true;
    setPlan("find");
    const fb = $("#fb-m3-find");
    fb.className = "ku-feedback";
    fb.innerHTML = "";
    $("#m3-find-task").hidden = false;
    renderMap($("#m3-map"), true);       // всё заблюрено, подписей нет
    $("#m3-find-task").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function checkFind(slug) {
    if (!FIND.on) return;
    FIND.tries = (FIND.tries || 0) + 1;
    const fb = $("#fb-m3-find");
    if (slug !== FIND.target) {
      fb.className = "ku-feedback show incorrect";
      fb.innerHTML = "<strong>Это другой соус.</strong> Ищи «Горчичный» — " +
        "открывай этикетки и читай названия.";
      return;
    }
    FIND.on = false;
    const sec = ((Date.now() - FIND.t0) / 1000).toFixed(1).replace(".", ",");
    renderMap($("#m3-map"), false);      // блюр снимаем, подписи возвращаем
    const found = $('#m3-map [data-slug="' + FIND.target + '"]');
    if (found) found.classList.add("correct");
    fb.className = "ku-feedback show correct";
    fb.innerHTML = "<strong>Ты искал " + sec + " с</strong> и открыл " + FIND.tries +
      " " + plural(FIND.tries, "этикетку", "этикетки", "этикеток") + ".<br>" +
      "Вот сколько времени уходит, когда название не прочитать сразу: по одному " +
      "цвету нужный соус не находится — жёлтых этикеток пять, и они похожи. " +
      "На стеллаже будет так же, если хватать упаковку не глядя.";
    $("#m3-find-task").hidden = true;    // «Время пошло» уже неправда
    $("#m3-find-label").textContent = "Пройти задание ещё раз";
    $("#m3-find-start").hidden = false;
    setPlan("done");
    window.KU.progress.markDone("m3-find");
  }

  /* Шаги над сеткой: study — изучает, find — идёт задание, done — оба пройдены */
  function setPlan(stage) {
    $$("#m3-plan [data-plan]").forEach((li) => {
      const isFind = li.dataset.plan === "find";
      li.classList.toggle("is-now", stage === "study" ? !isFind : stage === "find" && isFind);
      li.classList.toggle("is-done", stage === "done" || (stage === "find" && !isFind));
    });
  }

  /* ══ 11. ПРЕВЬЮ ТРЕНАЖЁРА (вступление модуля 4) ══════════════════════ */

  function renderPreview() {
    const host = $("#sx-preview");
    if (!host) return;
    const demo = shuffled(window.SAUCES).slice(0, 10);
    const order = demo[3];
    // Выноски привязаны к трём зонам поля: человек сразу видит, что где,
    // и не собирает картинку из текста.
    host.innerHTML =
      '<div class="sx-preview__stage">' +
        '<div class="sx-field" aria-hidden="true">' +
          '<div class="sx-order" data-zone="order">' +
            '<span class="sx-order__label">К заказу:</span>' +
            '<span class="sx-order__name">' + esc(order.name) + "</span></div>" +
          '<div class="sx-shelf" data-zone="shelf">' + demo.map((s2) =>
            '<span class="sx-bin' + (s2.shape === "round" ? " is-round" : "") +
              '" style="--c1:' + s2.c1 + ";--c2:" + s2.c2 + '">' +
              '<span class="sx-bin__corner"></span>' +
              '<span class="sx-bin__tag">' + esc(s2.short) + "</span></span>").join("") +
          "</div>" +
          '<div class="sx-bag" data-zone="bag">' +
            '<span class="sx-bag__label">Пакет заказа</span></div>' +
        "</div>" +
        '<span class="sx-callout" data-for="order">Заказ Гостя</span>' +
        '<span class="sx-callout" data-for="shelf">Соусы</span>' +
        '<span class="sx-callout" data-for="bag">Пакет с заказом</span>' +
      "</div>" +
      '<p class="sx-preview__cap">Так будет выглядеть рабочая зона. Этикетка в руке ' +
        "размыта — прочитать название можно, только нажав «Приблизить».</p>";
  }

  /* ══ 11b. СЦЕНЫ И ШАГИ АЛГОРИТМА ════════════════════════════════════ */

  function renderScenes() {
    const street = $("#m1-scene-street");
    if (street) street.insertAdjacentHTML("afterbegin", window.SCENES.street());
    const home = $("#m1-scene-home");
    if (home) home.insertAdjacentHTML("afterbegin", window.SCENES.home());

    // Модуль 5: «Правило трёх касаний» горизонтальным рядом кадров
    const steps = $("#m5-steps");
    if (steps) {
      const sub = [
        "Одно касание. Пока ничего не решаешь.",
        "Так, чтобы было видно текст, а не только цвет.",
        "Убедился, что это «Барбекю», а не «Кетчуп».",
      ];
      let html = "";
      for (let i = 0; i < window.SCENES.stepCount(); i++) {
        html += '<figure class="sx-step">' +
          '<span class="sx-step__num">' + (i + 1) + "</span>" +
          '<span class="sx-step__art">' + window.SCENES.step(i) + "</span>" +
          "<figcaption><b>" + esc(window.SCENES.stepTitle(i)) + "</b>" +
          "<span>" + esc(sub[i] || "") + "</span></figcaption></figure>";
      }
      steps.innerHTML = html;
    }
  }

  /* ══ 12. МОДУЛЬ 6 · СВОДКА НА ФИНАЛЕ ═════════════════════════════════ */

  function renderFinishSummary() {
    const box = $("#sx-finish-summary");
    if (!box) return;
    box.innerHTML =
      '<div class="ku-grid cols-3">' +
        stat(ST.m1 + " / " + MODES.m1.max, "режим 1") +
        stat(ST.m2 + " / " + MODES.m2.max, "режим 2") +
        stat(ST.m3rank || "—", "экзамен") +
      "</div>";
  }

  /* ══ 13. ИНИЦИАЛИЗАЦИЯ ═══════════════════════════════════════════════ */

  function init() {
    initModule1();
    initModule3();
    renderPreview();
    renderScenes();

    $$("[data-mode-card]").forEach((card) => card.addEventListener("click", () => {
      if (card.classList.contains("locked")) { alertGate(card.dataset.modeCard); return; }
      window.SX.start(card.dataset.modeCard);
    }));

    // Роутер ДС снимает .locked с глав по факту «посетил предыдущую». Наши
    // гейты строже, поэтому после каждой навигации пересчитываем их поверх.
    const navBase = window.kuNavigate;
    window.kuNavigate = function () { navBase.apply(this, arguments); applyGates(); };

    applyGates();
    renderFinishSummary();
  }

  // ku-scorm.js стреляет ku:ready на window load, когда состояние прочитано
  // из LMS/localStorage. Только после этого гейты знают правду о прогрессе.
  document.addEventListener("ku:ready", () => { applyGates(); renderFinishSummary(); });
  document.addEventListener("ku:done", () => { applyGates(); renderFinishSummary(); });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
