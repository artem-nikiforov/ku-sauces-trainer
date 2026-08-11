/* ════════════════════════════════════════════════════════════════════════
   ТРЕНАЖЁР «Работа с соусами» — вся курсовая логика.

   Каталог соусов — js/sauces.js. SCORM (прогресс, переменные, завершение) —
   js/ku-scorm.js, здесь он только вызывается: KU.vars.set / KU.progress.

   Все три режима + финальный тест — это ОДИН движок раунда с разными
   конфигами (см. MODES). Отличаются только: сколько заказов, есть ли таймер,
   когда показывать результат и перемешиваются ли корзинки.

   БАЛЛЫ ЗА РАУНД. Собирают все три числа сценария (5, 1, 3) и сохраняют
   «макс. 50 при 10 заказах» с проходным 40:
     5 — положил верный соус, прочитав его этикетку крупным планом;
     1 — положил верный соус, не читая этикетку (угадал по цвету);
     0 — ошибка;
   +3 — «поймал подмену»: открыл корзинку, чей уголок соответствовал заказу,
        а внутри лежал другой соус, прочитал этикетку и всё равно собрал верно.
   Плюс 1 бонусный балл за каждые 5 верных подряд (система «Стрик»).

   ВАЖНО, почему нет тарифа «минус за то, что заглянул в другую корзинку»:
   в корзинке виден только ЦВЕТ, а цвет делят до 5 соусов (жёлтая группа), так
   что добросовестному сотруднику приходится открыть в среднем 2,33 корзинки
   на заказ. Если брать за это баллы, проходной 40 из 50 становится
   недостижимым именно для того, кто ведёт себя правильно. Поэтому осмотр
   корзинок бесплатен — платится только за то, читал ли ты этикетку соуса,
   который в итоге положил.
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

  /* Название соуса всегда в кавычках. Иначе фраза «гость просил Тысяча
     островов» требует падежа («Тысячу островов»), а склонять 15 названий
     («Кисло-сладкий», «XXL 4 сыра», «Цезарь») корректно не выйдет. */
  const nm = (sauce) => "«" + esc(sauce.name) + "»";

  // Склонение: «2 ошибки», «5 ошибок»
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  /* ══ 1. СОСТОЯНИЕ И ЕГО СОХРАНЕНИЕ ════════════════════════════════════
     Имена переменных короткие и латинские: cmi.suspend_data ограничен
     ~4096 символами, и часть LMS считает байты, а не символы. Человеческие
     подписи для сводки наставнику лежат в скрытых полях [data-ku-var]
     в index.html — оттуда их берёт рантайм ДС. */

  const V = {
    dish: "sx-dish", love: "sx-love", hate: "sx-hate",
    emo: "sx-emo", ret: "sx-ret",
    m1: "sx-m1", m2: "sx-m2", m2acc0: "sx-m2a0", m2err0: "sx-m2e0",
    m3rank: "sx-m3r", m3err: "sx-m3e", m3n: "sx-m3n",
    finAcc: "sx-fa", finErr: "sx-fe",
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

  /* Рейтинг экзамена хранится по-русски: эта переменная попадает в сводку
     наставнику, и «gold» там выглядел бы как недоделка. */
  const RANK = { gold: "золото", silver: "серебро", bronze: "бронза" };
  const RANK_ORDER = { "бронза": 1, "серебро": 2, "золото": 3 };

  const ST = {
    get m1()      { return num(V.m1, 0); },
    get m2()      { return num(V.m2, 0); },
    get m3rank()  { return getVar(V.m3rank, ""); },
    get m1pass()  { return this.m1 >= MODES.m1.pass; },
    get m2pass()  { return this.m2 >= MODES.m2.pass; },
    get m3pass()  { return this.m3rank === RANK.gold; },
  };

  /* ══ 2. ЗВУК: тиканье таймера синтезируется в браузере ════════════════
     Ноль файлов в пакете. AudioContext создаём только по жесту (нажатию
     кнопки старта) — иначе автоплей-политика браузера его заглушит. */

  const Sound = {
    ctx: null, timer: null, muted: false,
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    click(freq, dur, vol) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    },
    tickOn() {
      this.tickOff();
      this.timer = setInterval(() => this.click(1250, 0.04, 0.05), 1000);
    },
    tickOff() { clearInterval(this.timer); this.timer = null; },
    ok()   { this.click(880, 0.09, 0.06); },
    fail() { this.click(180, 0.18, 0.07); },
    toggleMute(btn) {
      this.muted = !this.muted;
      btn.textContent = this.muted ? "Звук выкл." : "Звук вкл.";
      btn.setAttribute("aria-pressed", String(this.muted));
    },
  };

  /* ══ 3. КОНФИГИ РЕЖИМОВ ═══════════════════════════════════════════════
     feedback: instant — красный/зелёный экран, закрывает человек (режим 1);
               none    — никакой реакции до конца (режим 2, вся его соль);
               mark    — мгновенная галочка/крест на корзинке (экзамен).
     Порог режима 2 — 20 из 25: сценарные «40 баллов» при 5 заказах
     недостижимы физически (максимум 25), взяты те же 80%, что 40 из 50. */

  const MODES = {
    m1: {
      key: "m1", host: "#sx-play", out: "#sx-result",
      orders: 10, max: 50, pass: 40, feedback: "instant",
      seconds: 0, reshuffle: false, sound: false, mismatch: 1,
      title: "Режим 1 · Тренировка осознанности",
      hint: "Без времени, с мгновенными подсказками. Читай название на этикетке.",
    },
    m2: {
      key: "m2", host: "#sx-play", out: "#sx-result",
      orders: 5, max: 25, pass: 20, feedback: "none",
      seconds: 0, reshuffle: false, sound: true, mismatch: 2,
      title: "Режим 2 · Режим реальной смены",
      hint: "Заказы идут пачкой. Реакции не будет до самого конца — как в жизни.",
    },
    m3: {
      key: "m3", host: "#sx-play", out: "#sx-result",
      orders: 15, max: 75, pass: 0, feedback: "mark",
      seconds: 60, reshuffle: true, sound: true, mismatch: 3,
      title: "Режим 3 · Экзамен",
      hint: "60 секунд. Соусы меняются местами. Собери как можно больше — без ошибок.",
      goldMinOrders: 10,   // чтобы «золото» нельзя было взять, собрав 1 заказ
    },
    fin: {
      key: "fin", host: "#sx-play-fin", out: "#sx-result-fin",
      orders: 5, max: 25, pass: 0, feedback: "mark",
      seconds: 30, reshuffle: true, sound: false, mismatch: 2,
      title: "Финальный тест",
      hint: "Механика экзамена, 5 заказов. Показываем, насколько ты вырос.",
    },
  };

  /* ══ 4. ДВИЖОК РАУНДА ═════════════════════════════════════════════════ */

  const G = {
    cfg: null,        // активный конфиг режима
    bins: [],         // [{show, real, taken}] — 15 корзинок стеллажа
    orders: [],       // очередь заказов (соусы)
    i: 0,             // индекс текущего заказа
    hand: null,       // {binIdx, sauce}
    opened: false,    // прочитал ли этикетку соуса, который сейчас в руке
    trapSeen: false,  // корзинка «обманула»: уголок по заказу, внутри другое
    results: [],      // [{target, put, points}]
    streak: 0,
    bonus: 0,
    endsAt: 0,
    tick: null,
    running: false,
  };

  const el = {};   // ссылки на узлы поля, заполняются в buildField()

  /* Стеллаж. Каждый соус лежит на полке ровно один раз, но часть корзинок
     «переставлена»: уголок показывает один соус, а внутри — другой из ТОЙ ЖЕ
     цветовой группы. Это и есть ловушка сценария («корзинка с кетчупом, а
     появился сырный»): по цвету не отличишь, спасает только чтение. */
  function buildBins(swaps) {
    const bins = shuffled(window.SAUCES).map((s) => ({ show: s, real: s, taken: false }));
    const byGroup = {};
    bins.forEach((b, idx) => {
      (byGroup[b.show.group] = byGroup[b.show.group] || []).push(idx);
    });
    const groups = shuffled(Object.keys(byGroup).filter((g) => byGroup[g].length > 1));
    for (let n = 0; n < swaps && n < groups.length; n++) {
      const idxs = shuffled(byGroup[groups[n]]);
      const [a, b] = idxs;
      [bins[a].real, bins[b].real] = [bins[b].real, bins[a].real];
    }
    return bins;
  }

  function buildOrders(count) {
    const out = [];
    let prev = null;
    while (out.length < count) {
      const s = pick(window.SAUCES);
      if (s === prev) continue;          // два одинаковых заказа подряд — скучно
      out.push(s);
      prev = s;
    }
    return out;
  }

  /* ── Разметка поля ────────────────────────────────────────────────────── */

  /* Поле рендерится в ДВУХ местах курса (модуль 4 и финальный тест модуля 6),
     поэтому внутри — никаких id: были бы дубли, и document.querySelector
     попадал бы в чужое поле. Узлы ищем по data-el в пределах своего host. */
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
          'aria-label="Стеллаж с соусами"></div>' +
        '<div class="sx-hand is-empty" data-el="hand"></div>' +
        '<div class="sx-bag" data-el="bag">' +
          '<span class="sx-bag__label">Пакет для заказа</span>' +
          '<span class="ku-caption">Перетащи сюда соус или нажми «Положить в пакет»</span>' +
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
    // Полоса отметок нужна только там, где результат видно сразу
    el.marks.hidden = G.cfg.feedback !== "mark";
    el.bag.addEventListener("click", () => { if (G.hand) commit(); });
  }

  /* Стеллаж собирается ОДИН раз на раунд (и заново при перемешивании).
     Дальше только правим классы: пересборка innerHTML на каждое действие
     теряла бы фокус клавиатуры и рвала ссылки на узлы. */
  function renderShelf() {
    el.shelf.innerHTML = G.bins.map((b, idx) =>
      '<button type="button" class="sx-bin' +
        (b.show.shape === "round" ? " is-round" : "") +
        '" data-bin="' + idx + '" style="--c1:' + b.show.c1 + ';--c2:' + b.show.c2 + '"' +
        ' aria-label="Корзинка ' + (idx + 1) + '">' +
        '<span class="sx-bin__corner"></span><span class="sx-bin__lip"></span>' +
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
      el.hand.innerHTML = '<p class="sx-hand__hint">Нажми на корзинку — достанешь соус. ' +
        'Затем нажми на сам соус, чтобы приблизить этикетку и прочитать название.</p>';
      return;
    }
    const s = G.hand.sauce;
    el.hand.className = "sx-hand";
    el.hand.innerHTML =
      '<button type="button" class="sx-cup' + (s.placeholder ? " sx-ph" : "") +
        '" id="sx-cup" aria-label="Соус в руке. Нажми, чтобы приблизить этикетку">' +
        '<img src="' + window.sauceImg(s, true) + '" alt=""></button>' +
      '<div class="sx-hand__actions">' +
        '<button type="button" class="ku-btn soft s" data-act="zoom">Приблизить этикетку</button>' +
        '<button type="button" class="ku-btn primary s" data-act="put">Положить в пакет</button>' +
        '<button type="button" class="ku-btn ghost s" data-act="other">Другой соус</button>' +
      '</div>';

    $$("[data-act]", el.hand).forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "zoom") openZoom();
      else if (a === "put") commit();
      else returnToShelf();
    }));
    bindDrag($("#sx-cup", el.hand));
  }

  function renderMarks() {
    if (!el.marks || el.marks.hidden) return;
    el.marks.innerHTML = G.results.map((r, i) =>
      '<span class="sx-mark ' + (r.correct ? "correct" : "wrong") +
        '" title="Заказ ' + (i + 1) + ": " + esc(r.put.name) + '" role="img" ' +
        'aria-label="Заказ ' + (i + 1) + (r.correct ? ": верно" : ": ошибка") + '">' +
        '<svg class="ku-ico s"><use href="#i-' + (r.correct ? "check" : "close") +
        '"/></svg></span>').join("");
  }

  function renderStatus() {
    const done = G.results.length;
    el["mode-name"].textContent = G.cfg.title.split(" · ")[0];
    el.counter.textContent = "Заказ " + Math.min(done + 1, G.cfg.orders) +
                             " / " + G.cfg.orders;
    el.score.textContent = totalPoints() + " б.";
    el.target.textContent = G.orders[G.i] ? G.orders[G.i].name : "—";
  }

  /* Бонусы («поймал подмену», стрик) складываются с базой, поэтому теоретически
     сумма может превысить заявленные «из 50». Показываем и сравниваем с порогом
     капнутое значение — чтобы «42 из 50» никогда не выглядело как «53 из 50». */
  const totalPoints = () => Math.min(
    G.results.reduce((sum, r) => sum + r.points, 0) + G.bonus,
    G.cfg ? G.cfg.max : Infinity);

  /* ── Действия игрока ─────────────────────────────────────────────────── */

  function takeFromBin(idx) {
    if (!G.running || G.hand) return;
    const bin = G.bins[idx];
    if (!bin || bin.taken) return;
    G.hand = { binIdx: idx, sauce: bin.real };
    // Ловушка сработала: уголок корзинки — как раз того соуса, что просит
    // гость, а внутри лежит другой. Поймать это можно только чтением.
    if (bin.show.slug === G.orders[G.i].slug && bin.real.slug !== G.orders[G.i].slug) {
      G.trapSeen = true;
    }
    bin.taken = true;
    updateShelf();
    renderHand();
  }

  /* Вернуть соус на полку. Стоит НОЛЬ баллов: осмотр корзинок — это и есть
     правильное поведение, наказывать за него нельзя (см. шапку файла). */
  function returnToShelf() {
    if (!G.hand) return;
    G.bins[G.hand.binIdx].taken = false;
    G.hand = null;
    G.opened = false;          // этикетку следующего соуса надо читать заново
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
        '<img class="sx-zoom__img' + (s.placeholder ? " sx-ph" : "") +
          '" src="' + window.sauceImg(s) + '" alt="Этикетка: ' + esc(s.name) + '">' +
        '<span class="sx-zoom__name">' + esc(s.name) + '</span>' +
        '<span class="sx-zoom__brand">' + esc(s.full) + '</span>' +
        '<div class="sx-zoom__actions">' +
          '<button type="button" class="ku-btn primary s" data-act="put">Положить в пакет</button>' +
          '<button type="button" class="ku-btn soft s" data-act="other">Выбрать другой соус</button>' +
          '<button type="button" class="ku-btn ghost s" data-act="close">Назад</button>' +
        '</div>' +
      '</div>';
    $$("[data-act]", el.zoom).forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "put") { closeZoom(); commit(); }
      else if (a === "other") returnToShelf();
      else closeZoom();
    }));
    el.zoom.classList.add("show");
    // preventScroll обязателен: без него фокус прокручивает страницу и вся
    // раскладка уезжает под пальцем посреди раунда.
    const first = $(".ku-btn", el.zoom);
    if (first) first.focus({ preventScroll: true });
  }
  function closeZoom() { el.zoom.classList.remove("show"); el.zoom.innerHTML = ""; }

  /* Фиксация выбора: соус уехал в пакет. */
  function commit() {
    if (!G.running || !G.hand) return;
    const target = G.orders[G.i];
    const put = G.hand.sauce;
    const correct = put.slug === target.slug;
    const base = !correct ? 0 : (G.opened ? 5 : 1);
    const trap = correct && G.opened && G.trapSeen ? 3 : 0;
    const points = base + trap;

    G.results.push({ target, put, correct, points, trap: !!trap,
                     opened: G.opened, trapSeen: G.trapSeen });

    // Стрик: 5 верных подряд — «ИДЕАЛЬНО!» и бонусный балл
    G.streak = correct ? G.streak + 1 : 0;
    if (correct && G.streak % 5 === 0) {
      G.bonus += 1;
      el.streak.classList.remove("show");
      void el.streak.offsetWidth;              // перезапуск анимации
      el.streak.classList.add("show");
    }

    if (G.cfg.feedback === "mark") {
      // «Напротив каждого собранного заказа мгновенно появляется зелёная
      // галочка или красный крест». Отметки живут отдельной полосой, а не на
      // корзинках: корзинки в экзамене перемешиваются, отметки бы поехали.
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
        'Но гость ждёт <b>' + nm(target) + '</b>. ' +
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
    if (G.i >= G.cfg.orders) { finish(); return; }
    if (G.cfg.reshuffle) {
      // «Соусы в корзинках начинают меняться местами» — перемешиваем МЕЖДУ
      // заказами, а не под пальцем: дёргать DOM во время драга нельзя.
      G.bins = buildBins(G.cfg.mismatch);
      renderShelf();
    } else {
      updateShelf();
    }
    renderHand();
    renderStatus();
  }

  /* ── Таймер ──────────────────────────────────────────────────────────── */

  function startTimer(seconds) {
    el.timer.hidden = false;
    G.endsAt = Date.now() + seconds * 1000;
    const paint = () => {
      const left = Math.max(0, Math.ceil((G.endsAt - Date.now()) / 1000));
      el.timer.textContent = "0:" + String(left).padStart(2, "0");
      el.timer.classList.toggle("is-hot", left <= 10);
      if (left <= 0) { stopTimer(); finish(true); }
    };
    paint();
    G.tick = setInterval(paint, 250);
  }
  function stopTimer() { clearInterval(G.tick); G.tick = null; Sound.tickOff(); }

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
    G.bins = buildBins(cfg.mismatch);
    G.orders = buildOrders(cfg.orders);
    G.i = 0; G.hand = null; G.opened = false; G.trapSeen = false;
    G.results = []; G.streak = 0; G.bonus = 0; G.running = true;

    buildField(host);
    el.shelf.addEventListener("click", (e) => {
      const b = e.target.closest("[data-bin]");
      if (b) takeFromBin(+b.dataset.bin);
    });
    renderShelf();
    renderHand();
    renderStatus();

    if (cfg.sound) {
      Sound.ensure();                     // жест уже есть — кнопка старта
      Sound.tickOn();                     // «имитация очереди из гостей»
      const mute = document.createElement("button");
      mute.type = "button";
      mute.className = "ku-btn ghost s sx-mute";
      mute.textContent = "Звук вкл.";
      mute.setAttribute("aria-pressed", "false");
      mute.addEventListener("click", () => Sound.toggleMute(mute));
      $(".sx-status", host).appendChild(mute);
    }
    if (cfg.seconds) startTimer(cfg.seconds);

    host.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function finish(byTimer) {
    if (!G.running) return;
    G.running = false;
    stopTimer();
    closeZoom();

    const done = G.results.length;
    const correct = G.results.filter((r) => r.correct).length;
    const errors = done - correct;
    const points = totalPoints();
    const acc = done ? Math.round((correct / done) * 100) : 0;

    const host = $(G.cfg.host);
    host.hidden = true;
    host.innerHTML = "";        // не оставляем отыгранное поле висеть в DOM
    const out = $(G.cfg.out);
    out.hidden = false;
    out.innerHTML = resultHtml(G.cfg, { done, correct, errors, points, acc, byTimer });
    bindResultButtons(out);
    saveModeResult(G.cfg, { done, correct, errors, points, acc });
    applyGates();
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ══ 5. ИТОГИ РЕЖИМОВ ═════════════════════════════════════════════════ */

  function scoreTable(res) {
    const kinds = [
      ["Прочитал этикетку и положил верно", 5, (r) => r.correct && r.opened],
      ["Положил верно, но не читая", 1, (r) => r.correct && !r.opened],
      ["Ошибка", 0, (r) => !r.correct],
      ["Поймал подмену в корзинке", 3, (r) => r.trap],
    ];
    return '<div class="sx-score">' + kinds.map(([label, pts, test]) => {
      const n = res.filter(test).length;
      if (!n) return "";
      return '<div class="sx-score__row"><span>' + label + " × " + n +
        '</span><span class="dots"></span><b>' + (n * pts) + " б.</b></div>";
    }).join("") + "</div>";
  }

  function resultHtml(cfg, r) {
    if (cfg.key === "m1") return resultM1(cfg, r);
    if (cfg.key === "m2") return resultM2(cfg, r);
    if (cfg.key === "m3") return resultM3(cfg, r);
    return resultFin(cfg, r);
  }

  function resultHead(title, sub) {
    return '<div class="ku-center"><span class="ku-eyebrow">' + esc(title) + "</span>" +
      '<div class="ku-space s"></div><h3 class="ku-h2">' + sub + "</h3></div>" +
      '<div class="ku-space s"></div>';
  }

  function resultM1(cfg, r) {
    const passed = r.points >= cfg.pass;
    return resultHead("Итог режима 1",
        r.points + " " + plural(r.points, "балл", "балла", "баллов") +
        " из " + cfg.max) +
      scoreTable(G.results) +
      (G.bonus ? '<p class="ku-small ku-soft">Бонус за серии по 5 верных подряд: +' +
        G.bonus + " б.</p>" : "") +
      '<div class="ku-space s"></div>' +
      '<div class="ku-feedback show ' + (passed ? "correct" : "incorrect") + '">' +
        (passed
          ? "<strong>Проходной балл взят.</strong> Режим 2 «Режим реальной смены» открыт."
          : "<strong>Проходной балл — " + cfg.pass + ".</strong> Пока " + r.points +
            ". Пройди режим заново: чем чаще ты приближаешь этикетку перед тем, " +
            "как положить соус, тем выше балл.") +
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
          : "Ты положил <b>" + nm(res.put) + "</b>, а гость просил <b>" +
            nm(res.target) + "</b>.") +
        "</span></div>").join("");

    const verdict = r.errors
      ? '<div class="ku-callout danger"><div><div class="ku-callout__title">' +
          "Обрати внимание</div><p>Ты был уверен, что всё сделал идеально. Но ошибся в " +
          r.errors + " " + plural(r.errors, "заказе", "заказах", "заказах") + " из " +
          r.done + ".<br>Именно так это происходит и в реальной жизни. Ты не замечаешь " +
          "ошибку, а Гость не получает свой любимый вкус. Будь внимательнее!</p></div></div>" +
        guestHtml("upset", "Гость, которому достался не тот соус")
      : '<div class="ku-callout success"><div><div class="ku-callout__title">' +
          "Круто!</div><p>Ты справился идеально! Теперь Гости будут довольны заказом " +
          "и смогут насладиться любимым соусом!</p></div></div>" +
        guestHtml("happy", "Гость, который получил именно то, что просил");

    const passed = r.points >= cfg.pass;
    return resultHead("Чек-лист ошибок · режим 2",
        r.points + " из " + cfg.max + " · точность " + r.acc + "%") +
      '<div class="sx-check">' + rows + "</div>" +
      '<div class="ku-space m"></div>' + verdict +
      '<div class="ku-space m"></div>' +
      '<div class="ku-feedback show ' + (passed ? "correct" : "incorrect") + '">' +
        (passed
          ? "<strong>Порог взят (" + cfg.pass + " из " + cfg.max +
            ").</strong> Режим 3 «Экзамен» открыт."
          : "<strong>Порог — " + cfg.pass + " из " + cfg.max + ".</strong> Пока " +
            r.points + ". Режим 3 не откроется, пока не наберёшь порог. Пройди заново.") +
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
      gold:   "Ты — мастер внимания! Твои гости всегда будут сыты и довольны.",
      silver: "Хороший результат, но есть куда расти. Перечитай этикетки ещё раз.",
      bronze: 'Провал. Ты потерял этих гостей навсегда. Рекомендуем вернуться ' +
              'к Режиму №1 «Тренировка осознанности».',
    };
    const gold = rank === "gold";

    return resultHead("Итог экзамена",
        "Собрано заказов: " + r.done + " · " +
        (r.errors ? r.errors + " " + plural(r.errors, "ошибка", "ошибки", "ошибок")
                  : "без ошибок")) +
      '<div class="sx-medal ' + rank + '">' +
        '<div class="sx-medal__disc">' + RANK[rank].toUpperCase() + "</div>" +
      "</div>" +
      '<div class="ku-space s"></div>' +
      '<p class="ku-lead ku-center">' + texts[rank] + "</p>" +
      (rank !== "gold" && r.errors === 0
        ? '<p class="ku-small ku-soft ku-center">Ошибок нет, но для «золота» нужно ' +
          "собрать минимум " + cfg.goldMinOrders + " заказов за 60 секунд — " +
          "ты собрал " + r.done + ".</p>"
        : "") +
      '<div class="ku-space m"></div>' +
      '<div class="ku-feedback show ' + (gold ? "correct" : "incorrect") + '">' +
        (gold
          ? "<strong>Экзамен сдан на золото.</strong> Модули 5 и 6 открыты."
          : "<strong>Доступ к дальнейшим разделам открывается только за «золото».</strong> " +
            "Ноль ошибок и минимум " + cfg.goldMinOrders + " собранных заказов. " +
            "Если тяжело — вернись к режиму 1 и потренируй чтение этикеток.") +
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

  /* Финальный тест: сравнение с ПЕРВЫМ результатом режима 2.
     Экономика взята из модуля 2 и нигде не выдумана заново:
     120 000 ₽ в месяц / 480 ошибок = 250 ₽ за одну ошибку;
     смена = 100 заказов с соусами на одного сотрудника. */
  const RUB_PER_ERROR = 250;
  const ORDERS_PER_SHIFT = 100;

  function resultFin(cfg, r) {
    const base = num(V.m2acc0, null);
    const grew = base === null ? null : r.acc - base;
    const errRateBefore = base === null ? null : (100 - base) / 100;
    const errRateNow = (100 - r.acc) / 100;
    const saved = errRateBefore === null ? null :
      Math.max(0, Math.round((errRateBefore - errRateNow) * ORDERS_PER_SHIFT));
    const rub = saved === null ? null : saved * RUB_PER_ERROR;

    let body;
    if (base === null) {
      body = '<p class="ku-lead">Точность в финальном тесте: <b>' + r.acc + "%</b>.</p>";
    } else if (grew > 0) {
      body =
        '<p class="ku-lead">Твой уровень внимательности вырос на <b>' + grew +
          " п.п.</b> — с " + base + "% в режиме 2 до " + r.acc + "% сейчас.</p>" +
        '<div class="ku-space s"></div>' +
        '<div class="ku-grid cols-3">' +
          stat(grew + " п.п.", "рост внимательности") +
          stat(rub.toLocaleString("ru-RU") + " ₽", "сохранено за смену") +
          stat(saved + "", plural(saved, "гость получил", "гостя получили",
                                  "гостей получили") + " свой соус") +
        "</div>" +
        '<p class="ku-caption">Расчёт от цифр модуля 2: смена — ' + ORDERS_PER_SHIFT +
          " заказов с соусами, одна ошибка стоит ресторану " + RUB_PER_ERROR + " ₽.</p>";
    } else if (r.acc === 100) {
      body = '<p class="ku-lead">Ты собрал всё без ошибок — как и в режиме 2. ' +
        "Держи планку: <b>100%</b> точности и есть та привычка, ради которой " +
        "всё это было.</p>";
    } else {
      body = '<p class="ku-lead">Точность сейчас — <b>' + r.acc + "%</b>, в режиме 2 была " +
        base + "%. Прогресса пока нет: вернись к «Правилу трёх касаний» и пройди " +
        "финальный тест ещё раз.</p>";
    }

    return resultHead("Финальный тест",
        r.correct + " из " + r.done + " · точность " + r.acc + "%") +
      body +
      '<div class="ku-space m"></div>' +
      '<div class="ku-row center">' +
        '<button type="button" class="ku-btn soft" data-start="fin">Пройти ещё раз</button>' +
        '<button type="button" class="ku-btn primary" data-go="finish">К завершению курса</button>' +
      "</div>";
  }

  const stat = (n, label) =>
    '<div class="ku-stat"><div class="ku-stat__num">' + n +
    '</div><div class="ku-stat__label">' + label + "</div></div>";

  /* Гость: сейчас плоская SVG-заглушка (шаблоны в index.html).
     КАК ПОДКЛЮЧИТЬ НАСТОЯЩИЕ КАРТИНКИ: положить assets/scene/guest-happy.webp
     и guest-upset.webp (промты — в assets/ASSETS.md) и поставить здесь true.
     Флаг, а не проба через onerror: иначе курс на каждом показе стучится за
     несуществующим файлом и сыпет 404 в консоль LMS. */
  const SCENE_IMAGES = false;

  function guestHtml(kind, caption) {
    const tpl = $("#scene-guest-" + kind);
    const art = SCENE_IMAGES
      ? '<img src="assets/scene/guest-' + kind + '.webp" alt="' + esc(caption) + '">'
      : (tpl ? tpl.innerHTML : "");
    return '<div class="sx-guest"><div class="sx-guest__art">' + art + "</div>" +
      '<p class="sx-guest__cap">' + esc(caption) + "</p></div>";
  }

  function bindResultButtons(root) {
    $$("[data-start]", root).forEach((b) =>
      b.addEventListener("click", () => start(b.dataset.start)));
    $$("[data-back]", root).forEach((b) => b.addEventListener("click", () => {
      $("#sx-result").hidden = true;
      $("#sx-modes").scrollIntoView({ behavior: "smooth", block: "start" });
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
      window.KU.progress.markDone("m6-final");
    }
  }

  /* ══ 6. DRAG НА POINTER EVENTS ════════════════════════════════════════
     Один код на мышь, палец и стилус. HTML5 drag-and-drop не годится:
     на тач-экранах он не работает вообще, а курс проходят с телефона.
     Короткий тап без смещения = «приблизить этикетку». */

  function bindDrag(cup) {
    if (!cup) return;
    let active = false, moved = false, sx = 0, sy = 0;

    cup.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      active = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      // В части браузеров бросает NotFoundError, если указатель уже не активен.
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
      if (!moved) { openZoom(); return; }        // это был тап, не драг
      if (inRect(e, el.bag)) commit();
    };
    cup.addEventListener("pointerup", end);
    cup.addEventListener("pointercancel", () => {
      active = false;
      cup.classList.remove("dragging");
      cup.style.transform = "";
      el.bag.classList.remove("drag-over");
    });

    // Клавиатура: Enter/Space на самом соусе — приблизить этикетку
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
     Блокировки как в сценарии: режим 2 — только после проходного балла
     в режиме 1, режим 3 — после режима 2, модули 5–6 — только за «золото». */

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
    ch6: "Дальнейшие разделы откроются, когда сдашь экзамен на «золото» " +
         "(ноль ошибок, минимум " + MODES.m3.goldMinOrders + " заказов).",
  };

  function applyGates() {
    $$("[data-mode-card]").forEach((card) => {
      const key = card.dataset.modeCard;
      const open = !GATES[key] || GATES[key]();
      card.classList.toggle("locked", !open);
      card.setAttribute("aria-disabled", String(!open));
      const done = { m1: ST.m1pass, m2: ST.m2pass, m3: ST.m3pass }[key];
      card.classList.toggle("done", !!done);
      const badge = $("[data-mode-state]", card);
      if (badge) {
        badge.textContent = !open ? "Закрыто" : done ? "Пройден" : "Открыт";
      }
    });
    $$("[data-chapter-card]").forEach((card) => {
      const key = card.dataset.chapterCard;
      const open = !GATES[key] || GATES[key]();
      card.classList.toggle("locked", !open);
    });
    // Сводка прогресса на экране режимов
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
    modes: () => MODES,
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

    const openBtn = $("#m1-open-box");
    if (openBtn) openBtn.addEventListener("click", openBox);

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
      $("#m1-outro").hidden = false;
      window.KU.progress.markDone("m1-empathy");
      $("#m1-outro").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  // Сетка соусов с ограничением «выбери ровно N»
  function renderChoose(sel, need, onClass, onComplete) {
    const host = $(sel);
    if (!host || host.dataset.built) return;
    host.dataset.built = "1";
    host.innerHTML = window.SAUCES.map((s) =>
      '<button type="button" class="sx-choose__btn' + (s.placeholder ? " sx-ph" : "") +
        '" data-slug="' + s.slug + '">' +
        '<img src="' + window.sauceImg(s, true) + '" alt="">' +
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
     неподходящим» — в этом весь смысл симуляции. */
  function openBox() {
    const wrong = window.sauceBySlug(M1.hate[0] || "ketchup");
    const chosen = $("[data-dish].is-on");
    const dishAcc = chosen ? chosen.dataset.dishAcc : "своё блюдо";
    const box = $("#m1-box");
    const slot = $("#m1-box-sauce");
    slot.innerHTML = '<img src="' + window.sauceImg(wrong, true) + '" alt="Соус ' +
      esc(wrong.name) + '">';
    box.classList.add("is-open");
    $("#m1-box-caption").innerHTML =
      "Ты заказал <b>" + esc(dishAcc) + "</b>. А в коробке лежит <b>" +
      nm(wrong) + "</b> — тот самый соус, который ты только что назвал " +
      "неподходящим.";
    $("#m1-step-emotion").hidden = false;
    $("#m1-open-box").disabled = true;
    setTimeout(() => $("#m1-step-emotion").scrollIntoView({
      behavior: "smooth", block: "start" }), 600);
  }

  /* ══ 10. МОДУЛЬ 3 · СЕКРЕТ ЭТИКЕТКИ ══════════════════════════════════ */

  function initModule3() {
    // Карта соусов: тап увеличивает и выделяет название жирным.
    const map = $("#m3-map");
    if (map) {
      map.innerHTML = shuffled(window.SAUCES).map((s) =>
        '<figure class="sx-map__item' + (s.placeholder ? " sx-ph" : "") +
          '" tabindex="0" data-slug="' + s.slug + '">' +
          '<img src="' + window.sauceImg(s, true) + '" alt="">' +
          "<figcaption>" + esc(s.name) + "</figcaption></figure>").join("");

      const open = (fig) => {
        $$(".sx-map__item", map).forEach((f) => f.classList.remove("is-open"));
        fig.classList.add("is-open");
        checkFind(fig.dataset.slug);
      };
      map.addEventListener("click", (e) => {
        const fig = e.target.closest(".sx-map__item");
        if (fig) open(fig);
      });
      map.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const fig = e.target.closest(".sx-map__item");
        if (fig) { e.preventDefault(); open(fig); }
      });
    }

    const findBtn = $("#m3-find-start");
    if (findBtn) findBtn.addEventListener("click", startFind);
  }

  // «Найди соус "1000 островов" за 3 секунды» — измеряем время и всегда даём
  // успех: это доказательство «читать быстро», а не наказание за медлительность.
  const FIND = { target: "thousand-islands", t0: 0, on: false };

  function startFind() {
    FIND.t0 = Date.now();
    FIND.on = true;
    $("#m3-find-start").disabled = true;
    const fb = $("#fb-m3-find");
    fb.className = "ku-feedback";
    fb.innerHTML = "";
    $("#m3-find-task").hidden = false;
    $("#m3-map").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function checkFind(slug) {
    if (!FIND.on) return;
    const fb = $("#fb-m3-find");
    if (slug !== FIND.target) {
      fb.className = "ku-feedback show incorrect";
      fb.innerHTML = "<strong>Это другой соус.</strong> Ищи название " +
        "«Тысяча островов» — читай подписи, не цвета.";
      return;
    }
    FIND.on = false;
    const sec = ((Date.now() - FIND.t0) / 1000).toFixed(1).replace(".", ",");
    $$(".sx-map__item", $("#m3-map")).forEach((f) => {
      if (f.dataset.slug === FIND.target) f.classList.add("correct");
    });
    fb.className = "ku-feedback show correct";
    fb.innerHTML = "<strong>Нашёл за " + sec + " с.</strong> Отлично! Ты только что " +
      "доказал сам себе, что это быстро и удобно. На чтение одного слова уходит " +
      "0,5 секунды — быстрее, чем ты моргаешь.";
    $("#m3-find-start").disabled = false;
    window.KU.progress.markDone("m3-find");
  }

  /* ══ 11. МОДУЛЬ 6 · ФИНАЛЬНЫЕ ЦИФРЫ В СВОДКЕ ═════════════════════════ */

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

  /* ══ 12. ИНИЦИАЛИЗАЦИЯ ═══════════════════════════════════════════════ */

  function init() {
    initModule1();
    initModule3();

    $$("[data-mode-card]").forEach((card) => card.addEventListener("click", () => {
      if (card.classList.contains("locked")) { alertGate(card.dataset.modeCard); return; }
      window.SX.start(card.dataset.modeCard);
    }));

    // Роутер ДС снимает .locked с глав по факту «посетил предыдущую». Наши
    // гейты строже, поэтому после каждой навигации пересчитываем их поверх.
    const navBase = window.kuNavigate;
    window.kuNavigate = function (id) { navBase.apply(this, arguments); applyGates(); };

    applyGates();
    renderFinishSummary();
  }

  // ku-scorm.js стреляет ku:ready на window load, когда состояние уже прочитано
  // из LMS/localStorage. Только после этого гейты знают правду о прогрессе.
  document.addEventListener("ku:ready", () => { applyGates(); renderFinishSummary(); });
  document.addEventListener("ku:done", () => { applyGates(); renderFinishSummary(); });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
