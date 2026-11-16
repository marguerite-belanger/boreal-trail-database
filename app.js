/* Boreal Trail database project: trail-map case study site */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------
     Topographic contour-line decoration
  --------------------------------------------------------------- */
  function buildTopo() {
    $$('.topo').forEach((el) => {
      if (el.dataset.built) return;
      const seed = parseInt(el.dataset.seed || '1', 10);
      const rings = parseInt(el.dataset.rings || '10', 10);
      const cx = parseFloat(el.dataset.cx || '0.5') * 1000;
      const cy = parseFloat(el.dataset.cy || '0.5') * 700;
      const rand = mulberry32(seed * 7919 + 1);
      const colors = ['#1D8A73', '#FF6B35', '#FFC93C'];
      const points = 30;
      const baseAmp1 = 18 + rand() * 14;
      const baseAmp2 = 8 + rand() * 10;
      const phase1 = rand() * Math.PI * 2;
      const phase2 = rand() * Math.PI * 2;
      const freq1 = 3 + Math.floor(rand() * 2);
      const freq2 = 5 + Math.floor(rand() * 3);
      let paths = '';
      for (let r = 0; r < rings; r++) {
        const radius = 40 + r * (620 / rings);
        let d = '';
        for (let p = 0; p <= points; p++) {
          const a = (p / points) * Math.PI * 2;
          const wobble = Math.sin(a * freq1 + phase1 + r * 0.4) * baseAmp1 * (0.4 + r / rings)
                       + Math.sin(a * freq2 + phase2 - r * 0.3) * baseAmp2;
          const rr = radius + wobble;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.72;
          d += (p === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        }
        d += 'Z';
        const color = colors[r % colors.length];
        const opacity = Math.max(0.04, 0.5 - r * (0.42 / rings));
        paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" opacity="${opacity.toFixed(2)}"/>`;
      }
      el.innerHTML = `<svg viewBox="0 0 1000 700" preserveAspectRatio="none">${paths}</svg>`;
      el.dataset.built = '1';
    });
  }
  buildTopo();

  /* ---------------------------------------------------------------
     Schema data, taken from the database build script
  --------------------------------------------------------------- */
  const TABLES = {
    customer:         'One customer. Email must be unique.',
    location:         'Stores, the online store and the distribution centre are all location records.',
    category:         'Product categories such as Camping, Footwear and Apparel.',
    supplier:         'The suppliers Boreal Trail purchases from.',
    product:          'The catalogue. unit_price is the current catalogue price and must be above zero.',
    inventory:        'Quantity on hand for each product at each location (composite key). It cannot be negative.',
    customer_order:   'One order, placed by one customer at one location.',
    order_line:       'One line of an order (composite key), storing the price at the time of sale.',
    product_supplier: 'Bridge table for the many-to-many relationship between products and suppliers, with each supplier’s SKU and unit cost.'
  };

  // [table, column, referenced table]
  const FKS = [
    ['customer_order',   'customer_id', 'customer'],
    ['customer_order',   'location_id', 'location'],
    ['order_line',       'order_id',    'customer_order'],
    ['order_line',       'product_id',  'product'],
    ['product',          'category_id', 'category'],
    ['inventory',        'location_id', 'location'],
    ['inventory',        'product_id',  'product'],
    ['product_supplier', 'product_id',  'product'],
    ['product_supplier', 'supplier_id', 'supplier']
  ];

  const LAYOUTS = {
    wide: {
      w: 600, h: 470, nw: 150, nh: 44,
      pos: {
        customer: [95, 45], customer_order: [300, 45], location: [505, 45],
        order_line: [300, 165], inventory: [505, 165],
        category: [95, 285], product: [300, 285],
        product_supplier: [300, 405], supplier: [505, 405]
      }
    },
    narrow: {
      w: 360, h: 440, nw: 150, nh: 44,
      pos: {
        customer: [90, 40], customer_order: [270, 40],
        location: [90, 130], order_line: [270, 130],
        inventory: [90, 220], product: [270, 220],
        category: [90, 310], product_supplier: [270, 310],
        supplier: [270, 400]
      }
    }
  };

  /* ---------------------------------------------------------------
     Hero graph
  --------------------------------------------------------------- */
  const graphEl = $('#graph');
  const captionEl = $('#graph-caption');
  const defaultCaption = captionEl ? captionEl.innerHTML : '';

  function renderGraph() {
    if (!graphEl) return;
    const L = window.matchMedia('(max-width: 620px)').matches ? LAYOUTS.narrow : LAYOUTS.wide;

    const edges = FKS.map(([from, , to], i) => {
      const [x1, y1] = L.pos[from];
      const [x2, y2] = L.pos[to];
      return `<path class="edge" data-a="${from}" data-b="${to}" style="--i:${i}" pathLength="1" d="M${x1} ${y1}L${x2} ${y2}"/>`;
    }).join('');

    const nodes = Object.keys(TABLES).map((name) => {
      const [cx, cy] = L.pos[name];
      return `<g class="node" data-t="${name}" tabindex="0" role="button" aria-label="${name}: ${esc(TABLES[name])}">` +
        `<rect x="${cx - L.nw / 2}" y="${cy - L.nh / 2}" width="${L.nw}" height="${L.nh}" rx="10"/>` +
        `<text x="${cx}" y="${cy}">${name}</text></g>`;
    }).join('');

    graphEl.innerHTML = `<svg viewBox="0 0 ${L.w} ${L.h}" focusable="false">${edges}${nodes}</svg>`;
    clearActive();

    $$('.node', graphEl).forEach((node) => {
      const name = node.dataset.t;
      node.addEventListener('mouseenter', () => setActive(name));
      node.addEventListener('focus', () => setActive(name));
      node.addEventListener('click', () => setActive(name));
      node.addEventListener('mouseleave', clearActive);
      node.addEventListener('blur', clearActive);
    });
  }

  function setActive(name) {
    graphEl.classList.add('has-active');
    const linked = new Set();
    $$('.edge', graphEl).forEach((edge) => {
      const hit = edge.dataset.a === name || edge.dataset.b === name;
      edge.classList.toggle('on', hit);
      if (hit) { linked.add(edge.dataset.a); linked.add(edge.dataset.b); }
    });
    $$('.node', graphEl).forEach((node) => {
      node.classList.toggle('on', node.dataset.t === name);
      node.classList.toggle('link', node.dataset.t !== name && linked.has(node.dataset.t));
    });

    const out = FKS.filter((f) => f[0] === name);
    const inn = FKS.filter((f) => f[2] === name);
    const outText = out.length
      ? 'Foreign keys: ' + out.map((f) => `<code>${f[1]}</code> references <code>${f[2]}</code>`).join(', ') + '. '
      : 'No foreign keys. ';
    const inText = inn.length
      ? 'Referenced by ' + [...new Set(inn.map((f) => `<code>${f[0]}</code>`))].join(', ') + '.'
      : '';
    captionEl.innerHTML = `<strong>${name}.</strong> ${esc(TABLES[name])}<br>${outText}${inText}`;
  }

  function clearActive() {
    if (!graphEl) return;
    graphEl.classList.remove('has-active');
    $$('.edge, .node', graphEl).forEach((el) => el.classList.remove('on', 'link'));
    captionEl.innerHTML = defaultCaption;
  }

  renderGraph();
  const narrowMq = window.matchMedia('(max-width: 620px)');
  (narrowMq.addEventListener ? narrowMq.addEventListener('change', renderGraph) : narrowMq.addListener(renderGraph));

  /* ---------------------------------------------------------------
     Challenge illustration: a flat sheet with problem cells
  --------------------------------------------------------------- */
  function buildSheet() {
    const svg = $('#sheet');
    if (!svg) return;
    const cols = [['order_no', 70], ['customer', 90], ['email', 105], ['product', 90], ['price', 55], ['discount', 75], ['supplier', 75]];
    const x0 = []; cols.reduce((x, c) => (x0.push(x), x + c[1]), 0);
    const rowH = 34, headH = 34, rows = 9;
    const widths = [
      [34, 52, 74, 50, 30, 24, 34], [34, 60, 84, 44, 34, 20, 30], [34, 48, 78, 56, 28, 26, 36],
      [34, 56, 70, 48, 32, 18, 32], [34, 44, 86, 52, 30, 30, 34], [34, 58, 76, 46, 34, 22, 28],
      [34, 48, 80, 54, 28, 24, 36], [34, 52, 72, 50, 32, 20, 30], [34, 60, 82, 44, 30, 26, 34]
    ];
    const dupRows = [2, 6];
    const discountRow = 4;
    let out = `<rect x="0" y="0" width="560" height="${headH}" fill="#EAF6F1"/>`;

    cols.forEach(([label], c) => {
      out += `<text x="${x0[c] + 10}" y="21" style="font:700 11.5px var(--font-mono)" fill="#12241D">${label}</text>`;
    });
    for (let r = 0; r < rows; r++) {
      const y = headH + r * rowH;
      out += `<line x1="0" x2="560" y1="${y + rowH}" y2="${y + rowH}" stroke="#EDE6D2"/>`;
      if (dupRows.includes(r)) {
        out += `<rect x="${x0[1] + 3}" y="${y + 4}" width="${cols[1][1] + cols[2][1] - 6}" height="${rowH - 8}" rx="5" fill="rgba(255,107,53,.16)" stroke="#FF6B35" stroke-width="2"/>`;
      }
      if (r === discountRow) {
        out += `<rect x="${x0[5] + 3}" y="${y + 4}" width="${cols[5][1] - 6}" height="${rowH - 8}" rx="5" fill="rgba(255,107,53,.16)" stroke="#FF6B35" stroke-width="2"/>`;
      }
      cols.forEach((col, c) => {
        if (r === discountRow && c === 5) {
          out += `<text x="${x0[c] + 10}" y="${y + 22}" style="font:800 12px var(--font-mono)" fill="#C2491F">&gt;100%</text>`;
          return;
        }
        out += `<rect x="${x0[c] + 10}" y="${y + 13}" width="${widths[r][c]}" height="8" rx="4" fill="#D9CDA9"/>`;
      });
    }
    svg.insertAdjacentHTML('beforeend', out);
  }
  buildSheet();

  /* ---------------------------------------------------------------
     Charts (values from the P3 query results)
  --------------------------------------------------------------- */
  const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
  const money0 = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

  const revenue = [
    ['Nordic 2P Tent', 329.00],
    ['Laurentide Sandal Pro', 231.47],
    ['Boreal Down Jacket', 210.81],
    ['Glacier Base Layer Pro', 112.99],
    ['Trail Stove Mini', 64.50]
  ];
  const revEl = $('#chart-revenue');
  if (revEl) {
    const max = revenue[0][1];
    revEl.innerHTML = revenue.map(([name, v]) =>
      `<li><span class="name">${name}</span><span class="track"><span class="fill" style="--w:${(v / max * 100).toFixed(1)}%"></span></span><span class="val">${money.format(v)}</span></li>`
    ).join('');
  }

  // [product, catalogue price, cheapest supplier cost], in the order Q6 returns them
  const margins = [
    ['Trail Stove Mini', 68, 38],
    ['Glacier Base Layer Pro', 115, 65],
    ['Boreal Down Jacket', 215, 125],
    ['Laurentide Sandal Pro', 235, 140],
    ['Nordic 2P Tent', 349, 205]
  ];
  const marEl = $('#chart-margin');
  if (marEl) {
    const maxPrice = Math.max(...margins.map((m) => m[1]));
    marEl.innerHTML = margins.map(([name, price, cost]) => {
      const margin = price - cost;
      const pct = (margin / price * 100).toFixed(1);
      const wc = (cost / maxPrice * 100).toFixed(2);
      const wm = (margin / maxPrice * 100).toFixed(2);
      return `<li style="--wc:${wc}%;--wm:${wm}%" aria-label="${name}: catalogue price ${money0.format(price)}, supplier cost ${money0.format(cost)}, margin ${money0.format(margin)}, ${pct} percent of price">` +
        `<span class="name">${name}</span>` +
        `<span class="track"><span class="seg-cost"></span><span class="seg-margin"></span></span>` +
        `<span class="val">${money0.format(margin)} <small>(${pct}%)</small></span></li>`;
    }).join('');
  }

  /* ---------------------------------------------------------------
     SQL highlighting
  --------------------------------------------------------------- */
  const SQL_RE = new RegExp([
    '(--.*$)',
    "('(?:[^']|'')*')",
    '(\\b\\d+(?:\\.\\d+)?\\b)',
    '\\b(GROUP BY|ORDER BY|PRIMARY KEY|FOREIGN KEY|NOT NULL|INSERT INTO|CREATE TABLE|SELECT|FROM|JOIN|ON|WHERE|LIMIT|AS|REFERENCES|CHECK|DEFAULT|UNIQUE|VALUES|BETWEEN|AND|DESC|ASC)\\b',
    '\\b(INT|SMALLINT|DECIMAL|VARCHAR|CHAR|DATE|ENUM)\\b(?=[\\s(,])',
    '\\b(SUM|COUNT|MIN|MAX|AVG|ROUND)(?=\\()'
  ].join('|'), 'g');

  function highlightLine(line) {
    let out = '', last = 0, m;
    SQL_RE.lastIndex = 0;
    while ((m = SQL_RE.exec(line))) {
      const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'k' : m[5] ? 't' : 'f';
      out += esc(line.slice(last, m.index)) + `<span class="${cls}">${esc(m[0])}</span>`;
      last = SQL_RE.lastIndex;
    }
    return out + esc(line.slice(last));
  }

  $$('pre[data-sql]').forEach((pre) => {
    const code = $('code', pre);
    const marks = new Set((pre.dataset.hl || '').split(',').map((n) => parseInt(n, 10)).filter(Boolean));
    const lines = code.textContent.replace(/\s+$/, '').split('\n');
    code.innerHTML = lines.map((line, i) =>
      `<span class="ln${marks.has(i + 1) ? ' hl' : ''}">${highlightLine(line) || ' '}</span>`
    ).join('');
  });

  /* ---------------------------------------------------------------
     ERD pins and lightbox
  --------------------------------------------------------------- */
  const setPin = (n, on) => $$(`[data-pin="${n}"]`).forEach((el) => el.classList.toggle('is-on', on));
  $$('[data-pin]').forEach((el) => {
    const n = el.dataset.pin;
    el.addEventListener('mouseenter', () => setPin(n, true));
    el.addEventListener('mouseleave', () => setPin(n, false));
    el.addEventListener('focus', () => setPin(n, true));
    el.addEventListener('blur', () => setPin(n, false));
  });
  $$('.pin').forEach((pin) => pin.addEventListener('click', () => {
    const note = $(`.notes [data-pin="${pin.dataset.pin}"]`);
    if (note) note.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }));

  const dialog = $('#erd-dialog');
  const openErd = () => { if (dialog && dialog.showModal) dialog.showModal(); };
  const erdOpen = $('#erd-open');
  if (erdOpen) erdOpen.addEventListener('click', openErd);
  const erdImg = $('.erd-stage img');
  if (erdImg) { erdImg.style.cursor = 'zoom-in'; erdImg.addEventListener('click', openErd); }
  if (dialog) dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------------------------------------------------------------
     Navigation: menu, scroll spy, progress
  --------------------------------------------------------------- */
  const pill = $('#pill');
  const menuBtn = $('.pill-menu', pill);
  const navLinks = $$('.pill-links a', pill);

  menuBtn.addEventListener('click', () => {
    const open = pill.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  navLinks.forEach((a) => a.addEventListener('click', () => {
    pill.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pill.classList.contains('open')) {
      pill.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.focus();
    }
  });

  const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
      const link = byId.get(entry.target.id);
      if (link) { link.classList.add('is-current'); link.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['top', ...byId.keys()].forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

  let ticking = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    pill.style.setProperty('--p', p.toFixed(4));
    document.documentElement.style.setProperty('--p', p.toFixed(4));
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });
  updateProgress();

  /* ---------------------------------------------------------------
     Reveal-on-scroll
  --------------------------------------------------------------- */
  const revealTargets = $$('.steps li, .problems > div, .notes li, .rules > div, .study, .trio > article, .lessons li, .lrow, .people li, .pricepair, .aside, .sheet-fig, .erd-wrap');
  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (Math.min(i % 5, 4) * 60) + 'ms';
  });
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  revealTargets.forEach((el) => revealIO.observe(el));

  const barsIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        barsIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  $$('.bars').forEach((el) => barsIO.observe(el));
})();
