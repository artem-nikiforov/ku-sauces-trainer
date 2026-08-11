/* ════════════════════════════════════════════════════════════════════════
   КАТАЛОГ СОУСОВ — единственный источник правды для всего курса.

   Отсюда читают: сетка выбора (модуль 1), карта соусов (модуль 3),
   стеллаж и все три режима тренажёра (модуль 4), финальный тест (модуль 6).
   Добавить/убрать соус = правка этого массива, вёрстку трогать не нужно.

   name   — как написано на этикетке крупным шрифтом (это то, что сотрудник
            должен ПРОЧИТАТЬ; в текстах заказов и фидбэке используется оно);
   full   — полная подпись для карточки крупного плана;
   c1/c2  — доминирующие цвета этикетки, извлечены из самих картинок
            (не на глаз). c1 — цвет «уголка», который видно в корзинке;
   group  — цветовая группа. Ловушки строятся ВНУТРИ группы: в корзинке
            виден уголок нужного цвета, а соус там может лежать другой —
            ровно то, что происходит на реальном стеллаже;
   shape  — rect (25 г) | round (XXL 45 г).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  window.SAUCES = [
    // ── красная группа: главная ловушка сценария ─────────────────────────
    { slug: "ketchup",          name: "Томатный кетчуп",    brand: "Heinz",
      full: "Томатный кетчуп, Heinz",
      c1: "#D6231B", c2: "#B48454", group: "red",    shape: "rect" },
    { slug: "barbecue",         name: "Барбекю",            brand: "Heinz",
      full: "Барбекю соус классический, Heinz",
      c1: "#B0392A", c2: "#CC9C54", group: "red",    shape: "rect" },
    { slug: "thousand-islands", name: "Тысяча островов",    brand: "Heinz",
      full: "Тысяча островов соус оригинальный, Heinz",
      c1: "#EE5A50", c2: "#9C3C3C", group: "red",    shape: "rect" },

    // ── жёлто-оранжевая группа ───────────────────────────────────────────
    { slug: "syrny",            name: "Сырный",             brand: "Heinz",
      full: "Сырный соус Экстра, Heinz",
      c1: "#F5A81C", c2: "#CCB454", group: "yellow", shape: "rect" },
    { slug: "mustard",          name: "Горчичный",          brand: "Burger King",
      full: "Горчичный соус оригинальный, Burger King",
      c1: "#E4B40C", c2: "#B4840C", group: "yellow", shape: "rect" },
    { slug: "kislo-sladkiy",    name: "Кисло-сладкий",      brand: "Heinz",
      full: "Кисло-сладкий соус оригинальный, Heinz",
      c1: "#E4540C", c2: "#B49C54", group: "yellow", shape: "rect" },
    { slug: "xxl-4-cheese",     name: "XXL 4 сыра",         brand: "Burger King",
      full: "XXL соус 4 сыра, Burger King · 45 г",
      c1: "#F5B411", c2: "#3C240C", group: "yellow", shape: "round" },
    { slug: "xxl-chili-cheese", name: "XXL Чили Чиз",       brand: "Burger King",
      full: "XXL соус Чили Чиз, Burger King · 45 г",
      c1: "#F5B411", c2: "#B4240C", group: "yellow", shape: "round" },

    // ── коричневая «премиум» группа ──────────────────────────────────────
    { slug: "curry",            name: "Карри",              brand: "Burger King",
      full: "Карри соус оригинальный, Burger King",
      c1: "#843C0C", c2: "#FCB40C", group: "brown",  shape: "rect" },
    { slug: "parmesan",         name: "Сырный Пармезан",    brand: "Burger King",
      full: "Сырный Пармезан соус, Burger King Премиум",
      c1: "#6C3C0C", c2: "#9C6C3C", group: "brown",  shape: "rect" },
    { slug: "spicy",            name: "Острый",             brand: "Burger King",
      full: "Острый соус, Burger King Премиум",
      c1: "#6C240C", c2: "#E4540C", group: "brown",  shape: "rect" },
    // ЗАГЛУШКА: настоящей этикетки нет, промт — в assets/ASSETS.md
    { slug: "grill",            name: "Гриль",              brand: "Burger King",
      full: "Гриль соус, Burger King",
      c1: "#543C24", c2: "#84543C", group: "brown",  shape: "rect",
      placeholder: true },

    // ── зелёная группа ───────────────────────────────────────────────────
    { slug: "smetana-luk",      name: "Сметанно-луковый",   brand: "Burger King",
      full: "Сметанно-луковый соус, Burger King",
      c1: "#0C6C24", c2: "#E49C0C", group: "green",  shape: "rect" },
    { slug: "caesar",           name: "Цезарь",             brand: "Heinz",
      full: "Соус Цезарь для салата, Heinz",
      c1: "#549C24", c2: "#CCB454", group: "green",  shape: "rect" },

    // ── одиночка: единственный фиолетовый, спутать не с чем ──────────────
    { slug: "garlic",           name: "Чесночный",          brand: "Heinz",
      full: "Чесночный соус оригинальный, Heinz",
      c1: "#84549C", c2: "#9C8454", group: "violet", shape: "rect" },
  ];

  window.SAUCE_GROUPS = {
    red:    "Красные — их путают чаще всего",
    yellow: "Жёлто-оранжевые",
    brown:  "Коричневые",
    green:  "Зелёные",
    violet: "Фиолетовый",
  };

  /* ── Вспомогательное ──────────────────────────────────────────────────── */

  window.sauceBySlug = function (slug) {
    return window.SAUCES.find(function (s) { return s.slug === slug; }) || null;
  };

  window.sauceImg = function (sauce, small) {
    return "assets/sauces/" + sauce.slug + (small ? "-s" : "") + ".webp";
  };

  // Соусы той же цветовой группы, кроме самого соуса — из них строятся ловушки.
  window.sauceConfusable = function (sauce) {
    return window.SAUCES.filter(function (s) {
      return s.group === sauce.group && s.slug !== sauce.slug;
    });
  };
})();
