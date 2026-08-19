/* ════════════════════════════════════════════════════════════════════════
   ИЛЛЮСТРАЦИИ КУРСА — плоская векторная графика в палитре Burger King.

   Почему SVG, а не фото: фотографии есть только для соусов. Пакет, закуски,
   эмоции, гости и фон зала нарисованы здесь — это ноль килобайт в пакете,
   масштабируется без потерь и работает офлайн.

   ЕСЛИ ПОЯВЯТСЯ ФОТО: положить файлы в assets/scene/ (имена и промты —
   в assets/ASSETS.md) и переключить нужный флаг в PHOTOS. Код сам заменит
   рисунок на снимок. Флаг, а не проба через onerror: иначе курс на каждом
   показе стучится за несуществующим файлом и сыпет 404 в консоль LMS.

   Эмоции и гости строятся ОДНОЙ параметрической функцией: брови, глаза и рот
   задаются уровнем настроения. Так пять состояний выглядят одной серией,
   а не пятью разными рисунками.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* Какие фото уже лежат в assets/scene/. Все false — работают рисунки. */
  const PHOTOS = {
    "restaurant-bg": false,   // размытый зал ресторана — фон всего курса
    "bag": false,             // фирменный бумажный пакет на вынос
    "nuggets": false, "fries": false, "wings": false,
    "guest-1": false, "guest-2": false, "guest-3": false,
    "guest-4": false, "guest-5": false,
  };

  /* Палитра бренда. Держим локально: это иллюстрации, а не компоненты, и они
     должны читаться одинаково в светлой и тёмной теме. */
  const C = {
    red: "#D62300", redDark: "#A81B00", orange: "#FF8732", amber: "#F5B411",
    brown: "#502314", brownMid: "#6E3A22", cream: "#F5EBDC",
    paper: "#E3CFAC", paperMid: "#D2B98F", paperDark: "#B99B6E",
    skin: "#F0C9A4", skinShade: "#DCA982",
    hair: "#3E2415", white: "#FFFFFF", green: "#5CB531", ink: "#2A1810",
  };

  const FONT = "'Flame','Golos Text',sans-serif";

  /* ══ 1. НАСТРОЕНИЕ: 5 уровней, одна параметрическая голова ══════════════
     1 — злость/недовольство … 5 — искренняя радость. */
  const MOOD = {
    1: { brow: "angry",  eye: "narrow", mouth: "frown-deep", accent: C.red },
    2: { brow: "sad",    eye: "open",   mouth: "frown",      accent: C.redDark },
    3: { brow: "flat",   eye: "open",   mouth: "flat",       accent: C.brownMid },
    4: { brow: "flat",   eye: "open",   mouth: "slight",     accent: C.amber },
    5: { brow: "raised", eye: "happy",  mouth: "smile-big",  accent: C.green },
  };

  function brows(kind) {
    const pair = {
      angry:  ["M60 74 L88 82", "M140 82 L112 74"],
      sad:    ["M60 82 L88 74", "M140 74 L112 82"],
      flat:   ["M60 78 L88 78", "M140 78 L112 78"],
      raised: ["M58 80 Q74 68 90 78", "M142 80 Q126 68 110 78"],
    }[kind];
    return pair.map(function (d) {
      return '<path d="' + d + '" stroke="' + C.hair +
        '" stroke-width="7" stroke-linecap="round" fill="none"/>';
    }).join("");
  }

  function eyes(kind) {
    if (kind === "happy") {
      return [64, 116].map(function (x) {
        return '<path d="M' + x + ' 98 Q' + (x + 10) + ' 87 ' + (x + 20) +
          ' 98" stroke="' + C.ink + '" stroke-width="6" fill="none" ' +
          'stroke-linecap="round"/>';
      }).join("");
    }
    const ry = kind === "narrow" ? 5 : 8;
    return [74, 126].map(function (cx) {
      return '<ellipse cx="' + cx + '" cy="97" rx="7.5" ry="' + ry +
        '" fill="' + C.white + '"/>' +
        '<circle cx="' + cx + '" cy="98" r="4.5" fill="' + C.ink + '"/>';
    }).join("");
  }

  function mouth(kind) {
    const d = {
      "frown-deep": "M74 140 Q100 118 126 140",
      "frown":      "M76 136 Q100 122 124 136",
      "flat":       "M78 131 L122 131",
      "slight":     "M76 128 Q100 139 124 128",
      "smile-big":  "M72 126 Q100 154 128 126",
    }[kind];
    const open = kind === "smile-big";
    return '<path d="' + d + '" stroke="' + C.ink + '" stroke-width="7" ' +
      'stroke-linecap="round" fill="' + (open ? C.ink : "none") + '"/>' +
      (open ? '<path d="M82 132 Q100 145 118 132 Z" fill="#C4726B"/>' : "");
  }

  /* Голова с волосами, ушами и шеей — основа и для эмоций, и для гостей. */
  function head(level) {
    const m = MOOD[level];
    return '' +
      '<ellipse cx="53" cy="112" rx="8" ry="12" fill="' + C.skinShade + '"/>' +
      '<ellipse cx="147" cy="112" rx="8" ry="12" fill="' + C.skinShade + '"/>' +
      '<path d="M100 46 c30 0 47 22 47 52 0 34-21 58-47 58 s-47-24-47-58 ' +
        'c0-30 17-52 47-52z" fill="' + C.skin + '"/>' +
      '<path d="M100 150 c-14 0-25-6-32-16 c8 6 19 9 32 9 s24-3 32-9 ' +
        'c-7 10-18 16-32 16z" fill="' + C.skinShade + '" opacity="0.45"/>' +
      '<path d="M53 84 c1-27 20-42 47-42 s46 15 47 42 c-10-15-27-22-47-22 ' +
        's-37 7-47 22z" fill="' + C.hair + '"/>' +
      brows(m.brow) + eyes(m.eye) + mouth(m.mouth) +
      '<path d="M91 155 h18 v16 h-18z" fill="' + C.skinShade + '"/>';
  }

  /* Плечи и футболка — «человечек», а не голова в вакууме. */
  function shoulders(level) {
    const m = MOOD[level];
    return '<path d="M100 166 c-31 0-54 18-60 44 h120 c-6-26-29-44-60-44z" ' +
        'fill="' + m.accent + '"/>' +
      '<path d="M100 166 c-6 0-12 1-17 3 l17 19 17-19 c-5-2-11-3-17-3z" ' +
        'fill="' + C.cream + '"/>';
  }

  /* ══ 2. ЭМОЦИИ (модуль 1, шаг 5) ═══════════════════════════════════════
     Пять состояний из сценария. Текстовая подпись остаётся рядом с рисунком:
     «Бессилие» и «Испорченный вечер» одной картинкой однозначно не передать,
     и оставлять человека угадывать нельзя. */
  const EMOTION_LEVEL = {
    "Злость": 1, "Разочарование": 2, "Грусть": 2,
    "Бессилие": 3, "Испорченный вечер": 1,
  };

  const EMOTION_EXTRA = {
    "Злость":
      '<path d="M38 68 q-11-13 0-24 M162 68 q11-13 0-24" stroke="' + C.red +
      '" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>',
    "Грусть":
      '<path d="M128 108 q6 13 0 18 q-6-5 0-18z" fill="#5AA9E6"/>',
    "Бессилие":
      '<path d="M64 60 q7-11 15-6" stroke="#5AA9E6" stroke-width="4" ' +
      'fill="none" stroke-linecap="round"/>' +
      '<path d="M136 60 q-7-11-15-6" stroke="#5AA9E6" stroke-width="4" ' +
      'fill="none" stroke-linecap="round"/>',
    "Испорченный вечер":
      '<g opacity="0.9">' +
      '<path d="M58 32 q0-13 15-13 q4-11 17-9 q11-6 19 4 q15-2 15 13 ' +
        'q0 9-11 9 H69 q-11 0-11-9z" fill="#6E7B8B"/>' +
      '<path d="M82 46 l-7 13 M100 46 l-7 13 M118 46 l-7 13" ' +
        'stroke="#6E7B8B" stroke-width="4" stroke-linecap="round"/></g>',
  };

  function emotionSvg(name) {
    const level = EMOTION_LEVEL[name] || 3;
    return '<svg viewBox="0 0 200 212" role="img" aria-label="' + name + '">' +
      (EMOTION_EXTRA[name] || "") + head(level) + shoulders(level) + "</svg>";
  }

  /* ══ 3. ГОСТЬ С КАРТОШКОЙ (итоги режимов) ══════════════════════════════ */
  function friesBox(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<rect x="10" y="6" width="10" height="36" rx="5" fill="' + C.amber + '"/>' +
      '<rect x="23" y="0" width="10" height="42" rx="5" fill="#FFD76B"/>' +
      '<rect x="36" y="8" width="10" height="34" rx="5" fill="' + C.amber + '"/>' +
      '<path d="M2 32 h54 l-7 46 a7 7 0 0 1-7 6 H16 a7 7 0 0 1-7-6z" ' +
        'fill="' + C.red + '"/>' +
      '<rect x="13" y="46" width="32" height="13" rx="5" fill="' + C.cream + '"/>' +
      '</g>';
  }

  function guestSvg(level) {
    return '<svg viewBox="0 0 270 212" role="img" ' +
        'aria-label="Реакция гостя, уровень ' + level + ' из 5">' +
      '<g transform="translate(0,0)">' + head(level) + shoulders(level) + '</g>' +
      friesBox(192, 96, 0.95) +
      '</svg>';
  }

  /* ══ 4. ЗВЁЗДЫ ОЦЕНКИ ══════════════════════════════════════════════════ */
  const STAR = "M12 2.6 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9-3.1 -5.9 3.1 " +
               "1.2-6.5 -4.8-4.6 6.6-.9z";

  function starsSvg(filled, total) {
    const n = total || 5;
    let out = '<div class="sx-stars" role="img" aria-label="Оценка гостя: ' +
      filled + ' из ' + n + '">';
    for (let i = 1; i <= n; i++) {
      out += '<svg viewBox="0 0 24 24" class="sx-star' +
        (i <= filled ? " is-on" : "") + '" aria-hidden="true">' +
        '<path d="' + STAR + '"/></svg>';
    }
    return out + '</div>';
  }

  /* ══ 5. ФИРМЕННЫЙ ПАКЕТ НА ВЫНОС (модуль 1, шаг 4) ═════════════════════
     Заказы на вынос выдаются в бумажном пакете, а не в коробке. Пакет
     открывается: створки отходят наружу, внутри видна закуска и соус. */
  function bagSvg(dishSvgInner) {
    return '<svg viewBox="0 0 320 268" role="img" aria-label="Пакет с заказом">' +
      '<ellipse cx="160" cy="252" rx="98" ry="11" fill="' + C.ink +
        '" opacity="0.14"/>' +
      // корпус пакета
      '<path d="M62 96 h196 v142 a11 11 0 0 1-11 11 H73 a11 11 0 0 1-11-11z" ' +
        'fill="' + C.paper + '"/>' +
      // боковые складки — объём
      '<path d="M62 96 h36 v153 H73 a11 11 0 0 1-11-11z" fill="' + C.paperMid +
        '" opacity="0.7"/>' +
      '<path d="M222 96 h36 v142 a11 11 0 0 1-11 11 h-25z" fill="' + C.paperMid +
        '" opacity="0.45"/>' +
      // вертикальные заломы бумаги
      '<path d="M118 100 V246 M160 100 V246 M202 100 V246" stroke="' + C.paperDark +
        '" stroke-width="1.5" opacity="0.35" fill="none"/>' +
      // тёмная «внутренность» и содержимое — видны после открытия
      '<path class="sx-bag__inside" d="M82 100 h156 v46 H82z" fill="' + C.ink +
        '" opacity="0.72"/>' +
      '<g class="sx-bag__inside">' +
        (dishSvgInner || friesBox(128, 58, 0.85)) +
      '</g>' +
      // створки: отходят наружу при открытии
      '<path class="sx-bag__flap sx-bag__flap--l" d="M62 96 h98 v36 H62z" ' +
        'fill="' + C.paper + '"/>' +
      '<path class="sx-bag__flap sx-bag__flap--r" d="M160 96 h98 v36 h-98z" ' +
        'fill="' + C.paperMid + '"/>' +
      // фирменная плашка
      '<g>' +
        '<path d="M116 156 q0-23 44-23 t44 23z" fill="' + C.amber + '"/>' +
        '<rect x="116" y="156" width="88" height="27" fill="' + C.red + '"/>' +
        '<path d="M116 183 q0 23 44 23 t44-23z" fill="' + C.amber + '"/>' +
        '<text x="160" y="174" text-anchor="middle" fill="' + C.cream +
          '" font-family="' + FONT + '" font-size="15" font-weight="700">BURGER</text>' +
        '<text x="160" y="199" text-anchor="middle" fill="' + C.red +
          '" font-family="' + FONT + '" font-size="15" font-weight="700">KING</text>' +
      '</g>' +
      '</svg>';
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
      '</svg>',
    fries:
      '<svg viewBox="0 0 120 124" role="img" aria-label="Картошка фри">' +
      '<rect x="35" y="18" width="12" height="48" rx="6" fill="' + C.amber + '"/>' +
      '<rect x="50" y="8" width="12" height="58" rx="6" fill="#FFD76B"/>' +
      '<rect x="65" y="16" width="12" height="50" rx="6" fill="' + C.amber + '"/>' +
      '<rect x="79" y="27" width="12" height="39" rx="6" fill="#FFD76B"/>' +
      '<path d="M23 58 h74 l-9 56 a8 8 0 0 1-8 7 H40 a8 8 0 0 1-8-7z" ' +
        'fill="' + C.red + '"/>' +
      '<rect x="35" y="77" width="50" height="17" rx="6" fill="' + C.cream + '"/>' +
      '</svg>',
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
      '</svg>',
  };

  /* ══ 7. РАЗМЫТЫЙ ЗАЛ РЕСТОРАНА — фон курса ═════════════════════════════
     Только намёк на среду: тёплые пятна света, панно меню, силуэт прилавка и
     гостей. Сильно размыто и притушено — фон не должен спорить с текстом,
     поэтому поверх него в CSS лежит плотная вуаль. */
  function backdropSvg() {
    const s =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" ' +
        'preserveAspectRatio="xMidYMid slice">' +
      '<defs><filter id="b" x="-15%" y="-15%" width="130%" height="130%">' +
        '<feGaussianBlur stdDeviation="28"/></filter></defs>' +
      '<rect width="1200" height="700" fill="#F6EEE4"/>' +
      '<g filter="url(#b)">' +
        '<rect width="1200" height="430" fill="#EADCC9"/>' +
        '<ellipse cx="230" cy="120" rx="155" ry="92" fill="#FFD9A0" opacity="0.85"/>' +
        '<ellipse cx="620" cy="90" rx="155" ry="82" fill="#FFD9A0" opacity="0.7"/>' +
        '<ellipse cx="1000" cy="130" rx="155" ry="92" fill="#FFD9A0" opacity="0.8"/>' +
        '<rect x="120" y="180" width="300" height="150" rx="18" fill="#8A5A28" opacity="0.5"/>' +
        '<rect x="470" y="170" width="260" height="160" rx="18" fill="#A8703A" opacity="0.45"/>' +
        '<rect x="790" y="185" width="290" height="145" rx="18" fill="#8A5A28" opacity="0.4"/>' +
        '<rect y="430" width="1200" height="120" fill="#C0392B" opacity="0.72"/>' +
        '<rect y="540" width="1200" height="160" fill="#7A4A22" opacity="0.55"/>' +
        '<circle cx="330" cy="408" r="54" fill="#6E4A34" opacity="0.5"/>' +
        '<circle cx="760" cy="398" r="60" fill="#5E3F2C" opacity="0.45"/>' +
        '<circle cx="990" cy="414" r="48" fill="#6E4A34" opacity="0.4"/>' +
        '<rect x="180" y="470" width="175" height="27" rx="13" fill="#F5B411" opacity="0.6"/>' +
        '<rect x="640" y="466" width="195" height="27" rx="13" fill="#F5B411" opacity="0.5"/>' +
      '</g></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }

  /* ══ 8. ПУБЛИЧНОЕ API ══════════════════════════════════════════════════ */

  // Фото, если оно объявлено в PHOTOS; иначе рисунок.
  function art(name, svg, alt) {
    if (PHOTOS[name]) {
      return '<img src="assets/scene/' + name + '.webp" alt="' +
        (alt || "") + '" loading="lazy">';
    }
    return svg;
  }

  window.SCENES = {
    emotion: function (name) { return emotionSvg(name); },
    guest: function (level) {
      return art("guest-" + level, guestSvg(level), "Реакция гостя");
    },
    stars: starsSvg,
    bag: function (dishKey) {
      if (PHOTOS.bag) return art("bag", "", "Пакет с заказом");
      return bagSvg(dishKey ? insetDish(dishKey) : null);
    },
    dish: function (key) { return art(key, DISH[key] || "", key); },
    hasDish: function (key) { return !!DISH[key]; },
    backdropUrl: backdropSvg,
  };

  /* Закуска внутри пакета: тот же рисунок, вложенный со сдвигом и масштабом. */
  function insetDish(key) {
    if (!DISH[key]) return friesBox(128, 58, 0.85);
    const inner = DISH[key].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return '<g transform="translate(112,44) scale(0.78)">' + inner + '</g>';
  }

  /* Фон вешаем один раз на корень документа — одна картинка на весь курс. */
  function applyBackdrop() {
    const url = PHOTOS["restaurant-bg"]
      ? "assets/scene/restaurant-bg.webp"
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
