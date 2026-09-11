/* ════════════════════════════════════════════════════════════════════════
   ИЛЛЮСТРАЦИИ КУРСА — плоская векторная графика в палитре Burger King.

   Почему SVG, а не фото: фотографии есть только для соусов. Сцены, пакет,
   закуски и персонажи нарисованы здесь — ноль килобайт в пакете,
   масштабируется без потерь, работает офлайн.

   ИСТОЧНИК СТИЛЯ ДЛЯ РАСТРА — burger_king_style_2d.ru.json в корне проекта
   («Детализированная 2D-иллюстрация»). Готовое задание на генерацию всех 23
   кадров собрано из этой библии скриптом tools/build_prompts.py и лежит в
   assets/scene/prompts.json (машиночитаемо) и assets/scene/PROMPTS.md.
   Векторные рисунки ниже — рабочая заглушка до появления растра.

   СТИЛЬ ПЕРСОНАЖЕЙ (заглушек). Первая версия читалась как пугающая: острые черты,
   мелкие глаза, жёсткий контур. Здесь другой подход — «миловидная» плоская
   иллюстрация: крупная голова, большие глаза с бликом, мягкие скруглённые
   формы, румянец, тёплый тёмно-коричневый вместо чистого чёрного. Все
   состояния строит ОДНА параметрическая функция face(), поэтому пять эмоций
   и пять уровней настроения Гостя выглядят одной серией.

   ЕСЛИ ПОЯВЯТСЯ ФОТО: положить файл в assets/scene/ (имена и промты —
   в assets/ASSETS.md) и переключить флаг в PHOTOS. Флаг, а не проба через
   onerror: иначе курс на каждом показе стучится за несуществующим файлом
   и сыпет 404 в консоль LMS.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ЗАГЛУШКИ И ИХ ЗАМЕНА.
     Каждый ключ ниже — слот под сгенерированную картинку. Пока false, курс
     рисует вектор из этого файла. Стало true — показывает
     assets/scene/<ключ>.webp.

     Промт на каждый слот — в assets/scene/prompts.json по тому же ключу
     (id). Промты собраны из библии стиля burger_king_style_2d.ru.json
     скриптом tools/build_prompts.py.

     Флаг, а не проба через onerror: иначе курс на каждом показе стучится за
     несуществующим файлом и сыпет 404 в консоль LMS.

     Заглушки НЕ удалять даже после замены: курс обязан работать без
     картинок — в LMS они могут не отдаться. */
  const PHOTOS = {
    // ── среда ──────────────────────────────────────────────────────────
    "restaurant-bg": true,   // размытый зал — фон всего курса, 16:9
    "street": true,          // вечерняя улица, вдалеке светится ресторан
    "home": true,            // дома всё серое, светится только пакет
    // ── предметы ───────────────────────────────────────────────────────
    // Пакет на шаге 4 — по варианту на каждую закуску из шага 1: внутри
    // должна быть видна именно та закуска, которую выбрал Гость.
    "bag-fries": true,       // bag.webp с фри внутри — он и стал этим вариантом
    "bag-nuggets": true,     // сгенерированный пакет с наггетсами
    "bag-wings": true,       // сгенерированный пакет с крылышками
    "nuggets": true, "fries": true, "wings": true,
    // ── реакция Гостя на итогах: 1 ярость … 5 радость ──────────────────
    "guest-1": true, "guest-2": true, "guest-3": true,
    "guest-4": true, "guest-5": true,
    // ── эмоции для сетки выбора в модуле 1 ─────────────────────────────
    "emotion-anger": true, "emotion-disappointment": true,
    "emotion-sadness": true, "emotion-helpless": true,
    "emotion-ruined-evening": true,
    // ── кадры «Правила трёх касаний» ───────────────────────────────────
    "step-1": true, "step-2": true, "step-3": true,
    // Обложка курса кладётся НЕ сюда, а в assets/hero.webp — дизайн-система
    // подхватит файл сама, флаг ей не нужен.
  };

  /* Ключ слота по названию эмоции: в разметке эмоции заданы по-русски,
     а имена файлов латиницей. */
  const EMOTION_SLOT = {
    "Злость": "emotion-anger",
    "Разочарование": "emotion-disappointment",
    "Грусть": "emotion-sadness",
    "Бессилие": "emotion-helpless",
    "Испорченный вечер": "emotion-ruined-evening",
  };

  /* Палитра. Держим локально: это иллюстрации, а не компоненты, и они должны
     читаться одинаково в светлой и тёмной теме. */
  const C = {
    red: "#D62300", redDeep: "#A81B00", orange: "#FF8732", amber: "#F5B411",
    brown: "#502314", cream: "#F5EBDC",
    kraft: "#C9A579", kraftMid: "#B08E63", kraftDark: "#8E7049",
    skin: "#F6D3B0", skinShade: "#E5B98F", blush: "#F09A8C",
    hair: "#4A2C1A", hairSoft: "#5E3A24",
    ink: "#3A2318",                       // мягкий «чёрный»: не режет глаз
    night: "#1E2433", nightSoft: "#2C3446", grey: "#8A8F99",
    white: "#FFFFFF", green: "#5CB531", sky: "#7FB4E8",
  };

  const FONT = "'Flame','Golos Text',sans-serif";

  /* ══ 1. ПЕРСОНАЖ ═══════════════════════════════════════════════════════
     face(mood, opts) → внутренность SVG в системе координат 200×220.
     mood: 1 злой · 2 расстроенный · 3 равнодушный · 4 довольный · 5 радостный
     opts: { tears, steam, cloud, sweat, tilt, closed } */

  const MOOD = {
    1: { brow: "angry",  eye: "narrow", mouth: "frown-deep", shirt: C.red },
    2: { brow: "sad",    eye: "round",  mouth: "frown",      shirt: C.redDeep },
    3: { brow: "flat",   eye: "round",  mouth: "flat",       shirt: C.grey },
    4: { brow: "soft",   eye: "round",  mouth: "smile",      shirt: C.amber },
    5: { brow: "raised", eye: "joy",    mouth: "smile-open", shirt: C.green },
  };

  /* Геометрия лица. Ключевые решения после первой версии, которая читалась
     пугающе: голова стала круглой (была вытянутой), нос убран совсем — тонкая
     тёмная дуга под глазами читалась как усы, — волосы получили мягкую чёлку
     вместо плоской «шапочки», уши уменьшены и опущены к линии глаз. */
  const EYE_L = 78, EYE_R = 122, EYE_Y = 100;

  function brows(kind) {
    const d = {
      angry:  ["M60 80 Q70 80 84 90", "M140 90 Q130 80 116 80"],
      sad:    ["M60 92 Q70 82 84 84", "M140 84 Q130 82 116 92"],
      flat:   ["M62 86 Q72 83 84 86", "M138 86 Q128 83 116 86"],
      soft:   ["M61 88 Q72 80 85 86", "M139 86 Q128 80 115 88"],
      raised: ["M60 86 Q72 74 85 82", "M140 82 Q128 74 115 86"],
    }[kind];
    return d.map((x) => '<path d="' + x + '" stroke="' + C.hairSoft +
      '" stroke-width="6.5" stroke-linecap="round" fill="none"/>').join("");
  }

  function eyes(kind, closed) {
    if (closed) {
      return [EYE_L, EYE_R].map((x) =>
        '<path d="M' + (x - 12) + " " + EYE_Y + " Q" + x + " " + (EYE_Y + 10) +
        " " + (x + 12) + " " + EYE_Y + '" stroke="' + C.ink +
        '" stroke-width="5.5" fill="none" stroke-linecap="round"/>').join("");
    }
    if (kind === "joy") {
      return [EYE_L, EYE_R].map((x) =>
        '<path d="M' + (x - 13) + " " + (EYE_Y + 4) + " Q" + x + " " + (EYE_Y - 12) +
        " " + (x + 13) + " " + (EYE_Y + 4) + '" stroke="' + C.ink +
        '" stroke-width="6" fill="none" stroke-linecap="round"/>').join("");
    }
    const ry = kind === "narrow" ? 9 : 13;
    return [EYE_L, EYE_R].map((x) =>
      '<ellipse cx="' + x + '" cy="' + EYE_Y + '" rx="10.5" ry="' + ry +
        '" fill="' + C.white + '"/>' +
      '<circle cx="' + x + '" cy="' + (EYE_Y + 1) + '" r="6.8" fill="' + C.ink + '"/>' +
      '<circle cx="' + (x + 3) + '" cy="' + (EYE_Y - 3) + '" r="2.6" fill="' +
        C.white + '"/>').join("");
  }

  function mouth(kind) {
    if (kind === "smile-open") {
      return '<path d="M82 126 Q100 152 118 126 Z" fill="' + C.ink + '"/>' +
             '<path d="M89 131 Q100 143 111 131 Z" fill="#E0736B"/>';
    }
    const d = {
      "frown-deep": "M84 138 Q100 122 116 138",
      "frown":      "M85 135 Q100 124 115 135",
      "flat":       "M88 131 Q100 133 112 131",
      "smile":      "M85 127 Q100 140 115 127",
    }[kind];
    return '<path d="' + d + '" stroke="' + C.ink + '" stroke-width="5.5" ' +
      'stroke-linecap="round" fill="none"/>';
  }

  function face(mood, opts) {
    const m = MOOD[mood] || MOOD[3];
    const o = opts || {};
    const tilt = o.tilt || 0;

    const head =
      // уши: маленькие, на линии глаз
      '<ellipse cx="48" cy="104" rx="8" ry="11" fill="' + C.skinShade + '"/>' +
      '<ellipse cx="152" cy="104" rx="8" ry="11" fill="' + C.skinShade + '"/>' +
      // круглая голова — основа «миловидности»
      '<ellipse cx="100" cy="98" rx="54" ry="57" fill="' + C.skin + '"/>' +
      // волосы с мягкой чёлкой, а не плоской шапочкой
      '<path d="M46 100 C46 58 68 41 100 41 C132 41 154 58 154 100 ' +
        'C150 80 139 69 125 65 C114 77 84 79 71 70 C58 77 50 86 46 100 Z" ' +
        'fill="' + C.hair + '"/>' +
      brows(m.brow) + eyes(m.eye, o.closed) +
      // нос — едва заметное пятнышко; тонкая дуга читалась как усы
      '<ellipse cx="100" cy="116" rx="4" ry="3" fill="' + C.skinShade +
        '" opacity="0.75"/>' +
      mouth(m.mouth) +
      '<ellipse cx="68" cy="122" rx="12" ry="7" fill="' + C.blush +
        '" opacity="' + (mood === 1 ? 0.5 : 0.32) + '"/>' +
      '<ellipse cx="132" cy="122" rx="12" ry="7" fill="' + C.blush +
        '" opacity="' + (mood === 1 ? 0.5 : 0.32) + '"/>' +
      (o.tears
        ? '<path d="M' + EYE_L + ' 112 q6 16 0 21 q-6-5 0-21z" fill="' + C.sky + '"/>' +
          '<path d="M' + EYE_R + ' 112 q6 16 0 21 q-6-5 0-21z" fill="' + C.sky + '"/>'
        : "") +
      (o.sweat
        ? '<path d="M146 66 q7 12 0 16 q-7-4 0-16z" fill="' + C.sky + '"/>' : "");

    const extras =
      (o.steam
        ? '<g opacity="0.9" stroke="' + C.red + '" stroke-width="4.5" fill="none" ' +
          'stroke-linecap="round">' +
          '<path d="M44 52 q-8-11 1-19"/><path d="M156 52 q8-11-1-19"/></g>'
        : "") +
      (o.cloud
        ? '<g opacity="0.92">' +
          '<path d="M60 24 q0-13 15-13 q5-11 17-8 q11-6 19 4 q15-2 15 13 ' +
            'q0 9-11 9 H71 q-11 0-11-9z" fill="#7E8899"/>' +
          '<path d="M82 38 l-6 12 M100 38 l-6 12 M118 38 l-6 12" ' +
            'stroke="#7E8899" stroke-width="4" stroke-linecap="round"/></g>'
        : "");

    const body =
      '<path d="M91 150 h18 v18 h-18z" fill="' + C.skinShade + '"/>' +
      '<path d="M100 164 c-33 0-56 20-61 52 h122 c-5-32-28-52-61-52z" ' +
        'fill="' + m.shirt + '"/>' +
      '<path d="M100 164 c-7 0-13 1-19 4 l19 20 19-20 c-6-3-12-4-19-4z" ' +
        'fill="' + C.cream + '"/>';

    return extras +
      '<g transform="rotate(' + tilt + ' 100 110)">' + head + body + "</g>";
  }

  /* ══ 2. ЭМОЦИИ (модуль 1, шаг 5) ═══════════════════════════════════════
     Пять состояний из сценария. Подпись остаётся рядом с рисунком:
     «Бессилие» и «Испорченный вечер» одной картинкой однозначно не передать,
     и оставлять человека угадывать нельзя. */
  const EMOTIONS = {
    "Злость":            { mood: 1, steam: true },
    "Разочарование":     { mood: 2, tilt: -4 },
    "Грусть":            { mood: 2, tears: true },
    "Бессилие":          { mood: 3, closed: true, sweat: true, tilt: 7 },
    "Испорченный вечер": { mood: 2, cloud: true, closed: true, tilt: 10 },
  };

  function emotionSvg(name) {
    const cfg = EMOTIONS[name] || { mood: 3 };
    return '<svg viewBox="0 0 200 220" role="img" aria-label="' + name + '">' +
      face(cfg.mood, cfg) + "</svg>";
  }

  /* ══ 3. ГОСТЬ С КАРТОШКОЙ (итоги режимов) ══════════════════════════════ */
  function friesBox(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<rect x="10" y="6" width="11" height="38" rx="5" fill="' + C.amber + '"/>' +
      '<rect x="24" y="0" width="11" height="44" rx="5" fill="#FFD76B"/>' +
      '<rect x="38" y="8" width="11" height="36" rx="5" fill="' + C.amber + '"/>' +
      '<path d="M2 34 h56 l-7 48 a7 7 0 0 1-7 6 H16 a7 7 0 0 1-7-6z" ' +
        'fill="' + C.red + '"/>' +
      '<rect x="14" y="50" width="32" height="14" rx="5" fill="' + C.cream + '"/>' +
      "</g>";
  }

  const GUEST_OPTS = {
    1: { mood: 1, steam: true },
    2: { mood: 2, tears: true },
    3: { mood: 3 },
    4: { mood: 4 },
    5: { mood: 5 },
  };

  function guestSvg(level) {
    const cfg = GUEST_OPTS[level] || GUEST_OPTS[3];
    return '<svg viewBox="0 0 280 220" role="img" ' +
        'aria-label="Реакция Гостя, уровень ' + level + ' из 5">' +
      face(cfg.mood, cfg) +
      friesBox(200, 104, 0.95) +
      "</svg>";
  }

  /* ══ 4. ЗВЁЗДЫ ОЦЕНКИ ══════════════════════════════════════════════════ */
  const STAR = "M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9-3.1 -5.9 3.1 " +
               "1.2-6.5 -4.8-4.6 6.6-.9z";

  function starsSvg(filled, total) {
    const n = total || 5;
    let out = '<div class="sx-stars" role="img" aria-label="Оценка Гостя: ' +
      filled + " из " + n + '">';
    for (let i = 1; i <= n; i++) {
      out += '<svg viewBox="0 0 24 24" class="sx-star' +
        (i <= filled ? " is-on" : "") + '" aria-hidden="true">' +
        '<path d="' + STAR + '"/></svg>';
    }
    return out + "</div>";
  }

  /* ══ 5. ФИРМЕННЫЙ ПАКЕТ НА ВЫНОС ══════════════════════════════════════
     Крафтовая бумага с заломами и боковыми фальцами, посередине — настоящий
     логотип Burger King из assets/. Своим рисунком логотип не подменяем:
     фирменный знак должен быть фирменным. */
  function bagSvg(dishKey, opts) {
    const o = opts || {};
    return '<svg viewBox="0 0 320 280" role="img" aria-label="Пакет с заказом">' +
      (o.glow
        ? '<defs><radialGradient id="sxGlow"><stop offset="0" stop-color="#FFD9A0" ' +
          'stop-opacity="0.95"/><stop offset="1" stop-color="#FFD9A0" ' +
          'stop-opacity="0"/></radialGradient></defs>' +
          '<ellipse cx="160" cy="170" rx="158" ry="140" fill="url(#sxGlow)"/>'
        : "") +
      '<ellipse cx="160" cy="264" rx="100" ry="11" fill="' + C.ink +
        '" opacity="0.16"/>' +
      // корпус
      '<path d="M62 100 h196 v148 a12 12 0 0 1-12 12 H74 a12 12 0 0 1-12-12z" ' +
        'fill="' + C.kraft + '"/>' +
      // боковые фальцы дают объём
      '<path d="M62 100 h34 v160 H74 a12 12 0 0 1-12-12z" fill="' + C.kraftMid +
        '" opacity="0.85"/>' +
      '<path d="M224 100 h34 v148 a12 12 0 0 1-12 12 h-22z" fill="' + C.kraftMid +
        '" opacity="0.5"/>' +
      // заломы бумаги
      '<path d="M120 104 V254 M160 104 V254 M200 104 V254" stroke="' + C.kraftDark +
        '" stroke-width="1.6" opacity="0.4" fill="none"/>' +
      // тёмный зев и содержимое — проявляются при открытии
      '<path class="sx-bag__inside" d="M80 104 h160 v44 H80z" fill="' + C.ink +
        '" opacity="0.72"/>' +
      '<g class="sx-bag__inside">' +
        (dishKey ? insetDish(dishKey) : friesBox(126, 60, 0.85)) +
      "</g>" +
      // створки верха
      '<path class="sx-bag__flap sx-bag__flap--l" d="M62 100 h98 v34 H62z" ' +
        'fill="' + C.kraft + '"/>' +
      '<path class="sx-bag__flap sx-bag__flap--r" d="M160 100 h98 v34 h-98z" ' +
        'fill="' + C.kraftMid + '"/>' +
      // настоящий логотип бренда
      '<image href="assets/bk_logo_vector.svg" x="112" y="150" width="96" ' +
        'height="96" preserveAspectRatio="xMidYMid meet"/>' +
      "</svg>";
  }

  /* ══ 6. ЗАКУСКИ ════════════════════════════════════════════════════════ */
  const DISH = {
    nuggets:
      '<svg viewBox="0 0 120 124" role="img" aria-label="Наггетсы">' +
      '<path d="M20 64 h80 l-7 42 a8 8 0 0 1-8 7 H35 a8 8 0 0 1-8-7z" ' +
        'fill="' + C.red + '"/>' +
      '<path d="M28 60 c-7-13 4-26 17-24 c5-11 24-11 28 0 c15-2 24 11 17 24z" ' +
        'fill="#E8A33C"/>' +
      '<path d="M42 40 c-4-9 5-17 13-15 c7-6 17-2 17 7" fill="#F2BE63"/>' +
      '<circle cx="45" cy="52" r="2.6" fill="#B06E17"/>' +
      '<circle cx="61" cy="47" r="2.6" fill="#B06E17"/>' +
      '<circle cx="75" cy="54" r="2.6" fill="#B06E17"/>' +
      '<rect x="33" y="76" width="54" height="15" rx="6" fill="' + C.cream + '"/>' +
      "</svg>",
    fries:
      '<svg viewBox="0 0 120 124" role="img" aria-label="Картошка фри">' +
      '<rect x="35" y="18" width="12" height="48" rx="6" fill="' + C.amber + '"/>' +
      '<rect x="50" y="8" width="12" height="58" rx="6" fill="#FFD76B"/>' +
      '<rect x="65" y="16" width="12" height="50" rx="6" fill="' + C.amber + '"/>' +
      '<rect x="79" y="27" width="12" height="39" rx="6" fill="#FFD76B"/>' +
      '<path d="M23 58 h74 l-9 56 a8 8 0 0 1-8 7 H40 a8 8 0 0 1-8-7z" ' +
        'fill="' + C.red + '"/>' +
      '<rect x="35" y="77" width="50" height="17" rx="6" fill="' + C.cream + '"/>' +
      "</svg>",
    wings:
      '<svg viewBox="0 0 120 124" role="img" aria-label="Крылышки">' +
      '<path d="M22 68 h76 l-7 39 a8 8 0 0 1-8 7 H37 a8 8 0 0 1-8-7z" ' +
        'fill="' + C.red + '"/>' +
      '<path d="M33 62 c-11-11-7-29 8-34 c13-4 27 2 31 15 c3 9-2 17-10 19z" ' +
        'fill="#C05A22"/>' +
      '<path d="M41 57 c-7-8-4-19 6-22 c9-3 18 1 20 10 c2 6-2 11-7 12z" ' +
        'fill="#E08040"/>' +
      '<path d="M70 45 c9-7 21-3 24 6 c2 8-3 14-11 15 l-9 1z" fill="#C05A22"/>' +
      '<rect x="31" y="80" width="54" height="15" rx="6" fill="' + C.cream + '"/>' +
      "</svg>",
  };

  function insetDish(key) {
    if (!DISH[key]) return friesBox(126, 60, 0.85);
    const inner = DISH[key].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return '<g transform="translate(110,46) scale(0.8)">' + inner + "</g>";
  }

  /* ══ 7. СЦЕНА «ПО ДОРОГЕ ДОМОЙ» (модуль 1, вступление) ═════════════════
     Тусклая вечерняя улица, человек со спины, а вдалеке светится ресторан —
     единственное тёплое пятно в кадре. Задача сцены — эмоция, а не детали. */
  function streetSvg() {
    return '<svg viewBox="0 0 640 300" role="img" ' +
        'aria-label="Вечерняя улица, вдалеке светится ресторан Burger King">' +
      '<defs>' +
        '<linearGradient id="sxSky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#161C29"/>' +
          '<stop offset="1" stop-color="#2E3648"/></linearGradient>' +
        '<radialGradient id="sxWarm">' +
          '<stop offset="0" stop-color="#FFC46B" stop-opacity="0.95"/>' +
          '<stop offset="1" stop-color="#FFC46B" stop-opacity="0"/></radialGradient>' +
      "</defs>" +
      '<rect width="640" height="300" fill="url(#sxSky)"/>' +
      // тусклые дома по бокам
      '<g fill="' + C.night + '">' +
        '<path d="M0 60 h90 v180 H0z"/><path d="M96 100 h74 v140 H96z"/>' +
        '<path d="M470 96 h80 v144 h-80z"/><path d="M556 56 h84 v184 h-84z"/>' +
      "</g>" +
      // редкие холодные окна
      '<g fill="#4A5468" opacity="0.75">' +
        '<rect x="16" y="82" width="16" height="20" rx="3"/>' +
        '<rect x="48" y="122" width="16" height="20" rx="3"/>' +
        '<rect x="118" y="132" width="14" height="18" rx="3"/>' +
        '<rect x="492" y="120" width="16" height="20" rx="3"/>' +
        '<rect x="588" y="90" width="16" height="20" rx="3"/>' +
      "</g>" +
      // тёплое зарево ресторана
      '<ellipse cx="320" cy="180" rx="180" ry="120" fill="url(#sxWarm)"/>' +
      // сам ресторан вдалеке
      '<g>' +
        '<path d="M232 140 h176 v100 H232z" fill="#F3E4CC"/>' +
        '<path d="M224 140 h192 l-10-22 H234z" fill="' + C.red + '"/>' +
        '<rect x="252" y="164" width="46" height="52" rx="4" fill="#FFD9A0"/>' +
        '<rect x="308" y="164" width="46" height="52" rx="4" fill="#FFD9A0"/>' +
        '<rect x="364" y="164" width="30" height="52" rx="4" fill="#FFE6BF"/>' +
        '<image href="assets/bk_logo_vector.svg" x="288" y="88" width="64" ' +
          'height="64" preserveAspectRatio="xMidYMid meet"/>' +
      "</g>" +
      // мокрый асфальт с отражением
      '<rect y="240" width="640" height="60" fill="#141A26"/>' +
      '<ellipse cx="320" cy="252" rx="120" ry="12" fill="#FFC46B" opacity="0.22"/>' +
      // человек со спины: тёмный силуэт, рюкзак, руки в карманах
      '<g fill="#0F131C">' +
        '<ellipse cx="150" cy="150" rx="26" ry="29"/>' +
        '<path d="M150 176 c-30 0-50 22-53 64 h106 c-3-42-23-64-53-64z"/>' +
        '<rect x="126" y="196" width="48" height="44" rx="12" fill="#1B2230"/>' +
      "</g>" +
      '<ellipse cx="150" cy="246" rx="34" ry="7" fill="#000" opacity="0.35"/>' +
      "</svg>";
  }

  /* ══ 8. СЦЕНА «ДОМА» (модуль 1, шаг 4) ════════════════════════════════
     Всё серое и потухшее, светится только пакет с заказом. */
  function homeSvg() {
    return '<svg viewBox="0 0 640 300" role="img" ' +
        'aria-label="Дома вечером, светится пакет с заказом">' +
      '<defs><radialGradient id="sxHomeGlow">' +
        '<stop offset="0" stop-color="#FFD9A0" stop-opacity="0.9"/>' +
        '<stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient>' +
      "</defs>" +
      '<rect width="640" height="300" fill="#2A2E38"/>' +
      // серая комната: окно, картина, диван
      '<rect x="40" y="40" width="120" height="96" rx="6" fill="#3A404C"/>' +
      '<path d="M40 88 h120 M100 40 v96" stroke="#4A505C" stroke-width="4"/>' +
      '<rect x="470" y="56" width="96" height="70" rx="5" fill="#3A404C"/>' +
      '<rect y="212" width="640" height="88" fill="#22262E"/>' +
      // стол
      '<rect x="150" y="206" width="340" height="14" rx="6" fill="#4A3A2E"/>' +
      '<rect x="182" y="220" width="14" height="58" fill="#3B2E24"/>' +
      '<rect x="444" y="220" width="14" height="58" fill="#3B2E24"/>' +
      // зарево от пакета
      '<ellipse cx="320" cy="176" rx="180" ry="110" fill="url(#sxHomeGlow)"/>' +
      // сам пакет — единственное цветное пятно
      '<g transform="translate(258,96) scale(0.42)">' +
        '<path d="M62 100 h196 v148 a12 12 0 0 1-12 12 H74 a12 12 0 0 1-12-12z" ' +
          'fill="' + C.kraft + '"/>' +
        '<path d="M62 100 h34 v160 H74 a12 12 0 0 1-12-12z" fill="' + C.kraftMid + '"/>' +
        '<path d="M62 100 h98 v34 H62z" fill="' + C.kraft + '"/>' +
        '<path d="M160 100 h98 v34 h-98z" fill="' + C.kraftMid + '"/>' +
        '<image href="assets/bk_logo_vector.svg" x="112" y="150" width="96" ' +
          'height="96" preserveAspectRatio="xMidYMid meet"/>' +
      "</g>" +
      // человек за столом, со спины, ссутулился
      '<g fill="#171B22">' +
        '<ellipse cx="150" cy="150" rx="25" ry="28"/>' +
        '<path d="M150 175 c-28 0-46 18-50 42 h100 c-4-24-22-42-50-42z"/>' +
      "</g>" +
      "</svg>";
  }

  /* ══ 9. ШАГИ «ПРАВИЛА ТРЁХ КАСАНИЙ» (модуль 5) ════════════════════════
     Три кадра в ряд: взял — повернул — прочитал. Рисуем руку с упаковкой,
     чтобы алгоритм читался без текста. */
  /* Кадр «упаковка соуса»: сама банка с этикеткой. labelVisible решает,
     видно ли текст на этикетке — в первом шаге она ещё повёрнута от себя. */
  function sauceCup(x, y, scale, rot, labelVisible) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + scale +
        ') rotate(' + rot + ' 40 40)">' +
      '<rect x="0" y="0" width="80" height="80" rx="16" fill="#B0392A"/>' +
      '<rect x="6" y="6" width="68" height="68" rx="12" fill="' + C.red + '"/>' +
      (labelVisible
        ? '<rect x="14" y="18" width="52" height="16" rx="5" fill="' + C.cream + '"/>' +
          '<rect x="14" y="40" width="52" height="6" rx="3" fill="' + C.cream +
            '" opacity="0.85"/>' +
          '<rect x="14" y="52" width="34" height="6" rx="3" fill="' + C.cream +
            '" opacity="0.7"/>'
        : '<rect x="14" y="18" width="52" height="16" rx="5" fill="#C9382C"/>' +
          '<rect x="14" y="40" width="52" height="6" rx="3" fill="#C9382C"/>') +
      "</g>";
  }

  /* Рука снизу: ладонь и три пальца поверх банки — читается даже в мелком
     размере, потому что силуэт простой. */
  function hand(x, y, scale) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + scale + ')" fill="' +
        C.skin + '">' +
      '<path d="M0 22 c-4 14 4 30 20 34 c18 5 44 3 56-6 c10-8 8-22 0-28z"/>' +
      '<rect x="4" y="0" width="20" height="30" rx="10"/>' +
      '<rect x="28" y="-6" width="20" height="36" rx="10"/>' +
      '<rect x="52" y="0" width="20" height="30" rx="10"/>' +
      "</g>";
  }

  const STEPS = [
    { n: 1, title: "Взял упаковку",
      art: () =>
        // полка с ячейками, из одной достают упаковку
        '<g>' +
          '<rect x="18" y="18" width="164" height="10" rx="4" fill="#AEB7BF"/>' +
          '<rect x="18" y="28" width="50" height="34" rx="6" fill="#CBD1D6"/>' +
          '<rect x="75" y="28" width="50" height="34" rx="6" fill="#CBD1D6"/>' +
          '<rect x="132" y="28" width="50" height="34" rx="6" fill="#CBD1D6"/>' +
          '<rect x="24" y="32" width="38" height="18" rx="4" fill="#F5A81C"/>' +
          '<rect x="138" y="32" width="38" height="18" rx="4" fill="#5CB531"/>' +
        "</g>" +
        sauceCup(60, 72, 1.0, 0, false) +
        hand(58, 128, 1.0),
    },
    { n: 2, title: "Повернул этикеткой к себе",
      art: () =>
        // круговая стрелка вокруг банки — жест поворота
        '<path d="M44 96 a56 56 0 1 1 18 42" fill="none" stroke="' + C.amber +
          '" stroke-width="9" stroke-linecap="round" opacity="0.9"/>' +
        '<path d="M40 78 l6 20 l20-6z" fill="' + C.amber + '"/>' +
        sauceCup(60, 56, 1.0, 0, true) +
        hand(58, 112, 1.0),
    },
    { n: 3, title: "Прочитал название",
      art: () =>
        sauceCup(46, 52, 1.05, 0, true) +
        hand(44, 112, 1.0) +
        // глаз крупно — «прочитал»
        '<g transform="translate(126,44)">' +
          '<path d="M0 26 a34 22 0 0 1 68 0 a34 22 0 0 1-68 0z" fill="' + C.white +
            '" stroke="' + C.ink + '" stroke-width="5"/>' +
          '<circle cx="34" cy="26" r="13" fill="' + C.ink + '"/>' +
          '<circle cx="39" cy="21" r="4.5" fill="' + C.white + '"/>' +
        "</g>",
    },
  ];

  function stepSvg(i) {
    const s = STEPS[i];
    return '<svg viewBox="0 0 200 180" role="img" aria-label="' + s.title + '">' +
      '<rect width="200" height="180" rx="14" fill="#F3E8D8"/>' +
      '<ellipse cx="100" cy="168" rx="60" ry="7" fill="' + C.ink + '" opacity="0.1"/>' +
      s.art() +
      "</svg>";
  }

  /* ══ 10. ФОН: ЗАЛ РЕСТОРАНА ═══════════════════════════════════════════
     Сильно размытый интерьер: тёплые лампы, панно меню, прилавок, столики,
     силуэты Гостей. Поверх него в CSS лежит плотная вуаль — фон обязан
     читаться как атмосфера и не конкурировать с текстом. */
  function backdropSvg() {
    const s =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" ' +
        'preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
        '<filter id="b" x="-15%" y="-15%" width="130%" height="130%">' +
          '<feGaussianBlur stdDeviation="30"/></filter>' +
        '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#F6E7CF"/>' +
          '<stop offset="1" stop-color="#E7D3B6"/></linearGradient>' +
      "</defs>" +
      '<rect width="1200" height="700" fill="#F4EADD"/>' +
      '<g filter="url(#b)">' +
        '<rect width="1200" height="440" fill="url(#w)"/>' +
        // подвесные лампы
        '<ellipse cx="170" cy="70" rx="86" ry="54" fill="#FFD08A" opacity="0.95"/>' +
        '<ellipse cx="430" cy="46" rx="80" ry="46" fill="#FFD9A0" opacity="0.85"/>' +
        '<ellipse cx="760" cy="60" rx="88" ry="52" fill="#FFD08A" opacity="0.9"/>' +
        '<ellipse cx="1040" cy="44" rx="80" ry="46" fill="#FFD9A0" opacity="0.8"/>' +
        // меню-борды над прилавком
        '<rect x="150" y="150" width="250" height="140" rx="16" fill="#7A4A22" opacity="0.55"/>' +
        '<rect x="430" y="140" width="250" height="150" rx="16" fill="#8E5A2A" opacity="0.5"/>' +
        '<rect x="710" y="150" width="250" height="140" rx="16" fill="#7A4A22" opacity="0.5"/>' +
        // прилавок и фартук
        '<rect y="430" width="1200" height="110" fill="#C0392B" opacity="0.72"/>' +
        '<rect y="524" width="1200" height="176" fill="#6E4322" opacity="0.6"/>' +
        // силуэты Гостей в очереди
        '<circle cx="250" cy="404" r="52" fill="#6E4A34" opacity="0.5"/>' +
        '<circle cx="470" cy="392" r="58" fill="#5A3D2B" opacity="0.45"/>' +
        '<circle cx="720" cy="400" r="50" fill="#6E4A34" opacity="0.42"/>' +
        '<circle cx="960" cy="410" r="56" fill="#5A3D2B" opacity="0.4"/>' +
        // подносы и стаканы на прилавке
        '<rect x="150" y="466" width="180" height="26" rx="13" fill="#F5B411" opacity="0.6"/>' +
        '<rect x="560" y="462" width="200" height="26" rx="13" fill="#F5B411" opacity="0.5"/>' +
        '<rect x="880" y="450" width="46" height="60" rx="12" fill="#D62300" opacity="0.5"/>' +
        // зелень для тёплого пятна
        '<circle cx="1120" cy="330" r="70" fill="#5CB531" opacity="0.3"/>' +
      "</g></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }

  /* ══ 11. ПУБЛИЧНОЕ API ════════════════════════════════════════════════ */

  function photo(name, alt) {
    return '<img src="assets/scene/' + name + '.webp" alt="' + (alt || "") +
      '" loading="lazy">';
  }

  window.SCENES = {
    emotion: (name) => {
      const slot = EMOTION_SLOT[name];
      return slot && PHOTOS[slot] ? photo(slot, name) : emotionSvg(name);
    },
    guest: (level) => PHOTOS["guest-" + level]
      ? photo("guest-" + level, "Реакция Гостя")
      : guestSvg(level),
    stars: starsSvg,
    /* Раньше тут был один общий пакет, и в нём на картинке всегда лежала
       картошка фри — даже если Гость выбрал наггетсы. Теперь слот зависит от
       выбранной закуски. Нет фото нужного варианта — рисуем вектор С ТОЙ ЖЕ
       закуской: чужая закуска на фото хуже, чем честная заглушка. */
    bag: (dishKey, opts) => {
      const key = DISH[dishKey] ? dishKey : "fries";
      const slot = "bag-" + key;
      return PHOTOS[slot] ? photo(slot, "Пакет с заказом") : bagSvg(key, opts);
    },
    dish: (key) => PHOTOS[key] ? photo(key, key) : (DISH[key] || ""),
    street: () => PHOTOS.street
      ? photo("street", "Вечерняя улица, вдалеке светится ресторан Burger King")
      : streetSvg(),
    home: () => PHOTOS.home
      ? photo("home", "Дома вечером, светится пакет с заказом")
      : homeSvg(),
    step: (i) => PHOTOS["step-" + (i + 1)]
      ? photo("step-" + (i + 1), STEPS[i].title)
      : stepSvg(i),
    stepTitle: (i) => STEPS[i].title,
    stepCount: () => STEPS.length,
    backdropUrl: backdropSvg,
  };

  /* Фон вешаем один раз на корень документа — одна картинка на весь курс. */
  function applyBackdrop() {
    /* Адрес обязан быть АБСОЛЮТНЫМ. Относительный url() внутри CSS-переменной
       браузер разрешает от файла стилей, где переменная используется
       (css/course.css), а не от страницы. Итог был запрос
       /css/assets/scene/restaurant-bg.webp → 404, и фото зала не грузилось
       вообще. Пока фоном был встроенный SVG (data-URI, он и так абсолютный),
       ошибка не проявлялась — вылезла, как только включили фото. */
    const url = PHOTOS["restaurant-bg"]
      ? new URL("assets/scene/restaurant-bg.webp", document.baseURI).href
      : backdropSvg();
    document.documentElement.style.setProperty(
      "--sx-backdrop", 'url("' + url + '")');
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBackdrop);
  } else {
    applyBackdrop();
  }
})();
