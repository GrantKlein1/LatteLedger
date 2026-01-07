// LatteLedger Live Price Tallying (Catalog-Driven)
// Uses a built-in price catalog + DOM state to compute total price in real time,
// without relying on price text in the page. We capture the baseline (included)
// state once and charge only for user changes beyond that baseline.

(function () {
  const host = location.hostname;
  if (!/\.?(starbucks)\.com$/i.test(host)) return;

  const path = location.pathname.toLowerCase();
  const likelyOrdering = /(order|menu|product|item|drinks)/.test(path);
  if (!likelyOrdering) return;

  // --- Price Catalog (example defaults; adjust as needed) ---
  const CATALOG = {
    defaultBaseBySize: { Short: 3.65, Tall: 3.95, Grande: 4.45, Venti: 4.95, Trenta: 5.45 },
    baseByDrink: {
      'Caffè Latte': { Tall: 4.45, Grande: 4.95, Venti: 5.45 },
      'Cappuccino': { Tall: 4.45, Grande: 4.95, Venti: 5.45 },
      'Caffè Americano': { Tall: 3.45, Grande: 3.95, Venti: 4.45 },
      'Cold Brew': { Tall: 3.95, Grande: 4.45, Venti: 4.95, Trenta: 5.25 },
      'Iced Latte': { Tall: 4.45, Grande: 4.95, Venti: 5.45 }
    },
    extras: {
      extraShot: 0.80,
      syrupPump: 0.80,
      saucePump: 0.80,
      altMilk: { almond: 0.70, oat: 0.70, soy: 0.70, coconut: 0.70 },
      topping: 0.60,
      whippedCream: 0.60,
      coldFoam: 1.25
    },
    sizes: ['Short', 'Tall', 'Grande', 'Venti', 'Trenta'],
    defaultMilkNames: ['2% Milk', 'Whole Milk', 'Nonfat Milk']
  };

  // --- Utilities ---
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const $ = (sel, root = document) => root.querySelector(sel);

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function normalize(str) {
    return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function findHeadingRoot(names) {
    const roots = $all('*').filter(el => isVisible(el) && names.some(n => new RegExp(n, 'i').test(el.textContent || '')));
    // pick nearest visible parent that likely contains controls
    for (const el of roots) {
      let parent = el.closest('[role], section, div');
      if (parent && isVisible(parent)) return parent;
    }
    return null;
  }

  // --- DOM State Extraction ---
  function getProductTitle() {
    const candidates = [
      '[data-testid="product-name"]',
      '[data-e2e="product-name"]',
      'h1',
      'h2'
    ];
    for (const sel of candidates) {
      const el = $(sel);
      if (el && isVisible(el)) return (el.textContent || '').trim();
    }
    // Fallback from URL
    const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).slice(-1)[0] || '').replace(/[-_]+/g, ' ');
    return slug || 'Drink';
  }

  function getSelectedSize() {
    // 1) Prefer explicit radio in your provided structure: input[name="size"][type="radio"]:checked
    const checked = document.querySelector('input[name="size"][type="radio"]:checked');
    if (checked) {
      const raw = checked.getAttribute('data-e2e') || checked.value || checked.id || '';
      const mapping = { short: 'Short', tall: 'Tall', grande: 'Grande', venti: 'Venti', trenta: 'Trenta' };
      const norm = (raw || '').toLowerCase();
      if (mapping[norm]) return mapping[norm];
    }

    // 1.5) Header summary: e.g., "Venti  24 fl oz" near the product name
    const headerSizeEl = Array.from(document.querySelectorAll('span, div'))
      .find(el => isVisible(el) && /\b(Short|Tall|Grande|Venti|Trenta)\b/i.test(el.textContent || '') && /\bfl\s*oz\b/i.test(el.textContent || ''));
    if (headerSizeEl) {
      const m = (headerSizeEl.textContent || '').match(/Short|Tall|Grande|Venti|Trenta/i);
      if (m) return m[0][0].toUpperCase() + m[0].slice(1).toLowerCase();
    }

    // 2) Fallback: active size item container (hashed classes)
    const activeItem = document.querySelector('[class*="sizeItem"][class*="active"]') || document.querySelector('[class*="sizeItem"] .activeCircle___');
    if (activeItem) {
      const input = activeItem.querySelector('input[name="size"][type="radio"]');
      const raw = input?.getAttribute('data-e2e') || input?.value || input?.id || '';
      if (raw) {
        const mapping = { short: 'Short', tall: 'Tall', grande: 'Grande', venti: 'Venti', trenta: 'Trenta' };
        const norm = raw.toLowerCase();
        if (mapping[norm]) return mapping[norm];
      }
      const txt = (activeItem.textContent || '').trim();
      const found = ['Short','Tall','Grande','Venti','Trenta'].find(s => new RegExp(`\\b${s}\\b`, 'i').test(txt));
      if (found) return found;
    }

    // 3) Last resort: any element with size text and selected/active semantics
    const any = Array.from(document.querySelectorAll('label, button, [role="tab"], [data-e2e]')).find(el => /\b(Short|Tall|Grande|Venti|Trenta)\b/i.test(el.textContent || ''));
    if (any) {
      const m = (any.textContent || '').match(/Short|Tall|Grande|Venti|Trenta/i);
      if (m) return m[0][0].toUpperCase() + m[0].slice(1).toLowerCase();
    }

    return 'Grande';
  }

  function getSpinValue(el) {
    if (!el) return 0;
    const aria = el.getAttribute('aria-valuenow');
    if (aria != null) return parseInt(aria, 10) || 0;
    const txt = (el.textContent || '').trim();
    const m = txt.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  function getNutrition() {
    // Extract calories and sugar grams from nutrition summary block.
    // Looks like: "430 calories, 37g sugar, 8g fat"
    const container =
      document.querySelector('[data-e2e="nutrition-summary"] .nutritionSummary___XmSLG') ||
      document.querySelector('[data-e2e="nutrition-summary"]') ||
      document.querySelector('.nutritionSummary___XmSLG');
    const txt = (container?.textContent || '').trim();
    if (!txt) return { calories: 0, sugar_g: 0 };
    let calories = 0, sugar_g = 0;
    const calMatch = txt.match(/(\d+)\s*calories/i);
    if (calMatch) calories = parseInt(calMatch[1], 10) || 0;
    const sugarMatch = txt.match(/(\d+)\s*g\s*sugar/i);
    if (sugarMatch) sugar_g = parseInt(sugarMatch[1], 10) || 0;
    return { calories, sugar_g };
  }

  function getShotsCount() {
    const root = findHeadingRoot(['espresso', 'shots', 'shot options']);
    if (!root) return 0;
    // Look for a spinbutton inside
    const spin = root.querySelector('[role="spinbutton"],[aria-valuenow]');
    if (spin) return getSpinValue(spin);
    // Or a number in a selected control
    const sel = $all('[aria-pressed="true"], .selected, input[type="radio"]:checked', root).find(isVisible);
    if (sel) {
      const m = (sel.textContent || '').match(/\d+/);
      if (m) return parseInt(m[0], 10) || 0;
    }
    return 0;
  }

  function getMilkSelection() {
    // Primary Milk section (when present)
    const root = findHeadingRoot(['milk']);
    if (root) {
      const checked = root.querySelector('input[type="radio"]:checked');
      let label = checked?.closest('label');
      if (!label && checked?.id) label = root.querySelector(`label[for="${CSS.escape(checked.id)}"]`);
      const txt = (label?.textContent || root.textContent || '').trim();
      const milks = ['Almond', 'Oat', 'Soy', 'Coconut', 'Whole', '2%', 'Nonfat'];
      const found = milks.find(m => new RegExp(m, 'i').test(txt));
      if (found) return found;
    }

    // Add-ins -> Creamer select (e.g., "Splash of Oatmilk")
    const addinsRoot = findHeadingRoot(['add-ins', 'add ins']);
    if (addinsRoot) {
      const creamers = $all('select', addinsRoot).filter(sel => /creamer/i.test(sel.getAttribute('aria-label') || sel.id || ''));
      for (const sel of creamers) {
        const opt = sel.options?.[sel.selectedIndex];
        if (!opt || opt.disabled) continue;
        const txt = opt.text || '';
        const milks = ['Almond', 'Oat', 'Soy', 'Coconut', 'Whole', '2%', 'Nonfat'];
        const found = milks.find(m => new RegExp(m, 'i').test(txt));
        if (found) return found;
      }
    }

    return '';
  }

  function getSyrupsAndSauces() {
    // Return array of { name, pumps, type: 'syrup'|'sauce' }
    const result = [];
    const root = findHeadingRoot(['flavor', 'flavors', 'syrup', 'sauce']);
    if (!root) return result;

    // 1) Pump steppers (spinbuttons)
    const rows = $all('[role="group"], li, .row, .option, div', root).filter(isVisible);
    for (const row of rows) {
      const labelEl = row.querySelector('label, [aria-labelledby], [data-testid], [data-e2e]');
      const rawName = (labelEl?.textContent || row.textContent || '').trim();
      if (!rawName) continue;
      const spin = row.querySelector('[role="spinbutton"],[aria-valuenow]');
      if (!spin) continue;
      const pumps = getSpinValue(spin);
      if (pumps <= 0) continue;
      const lower = rawName.toLowerCase();
      const type = lower.includes('sauce') ? 'sauce' : 'syrup';
      result.push({ name: rawName, pumps, type });
    }

    // 2) Selects inside Flavors (treat as 1 pump)
    for (const sel of $all('select', root)) {
      if (!isVisible(sel)) continue;
      const opt = sel.options?.[sel.selectedIndex];
      const txt = (opt?.text || sel.value || '').trim();
      if (!txt || opt?.disabled) continue;
      if (opt?.value === 'NONE' || /^no\b/i.test(txt)) continue;
      const n = txt.toLowerCase();
      const type = n.includes('sauce') || n.includes('drizzle') ? 'sauce' : 'syrup';
      result.push({ name: txt, pumps: 1, type });
    }

    return result;
  }

  function getToppingsState() {
    // Return Set of topping names that are checked/selected
    const set = new Set();

    const addPick = (txt) => {
      const t = (txt || '').trim();
      if (!t) return;
      if (/^no\b/i.test(t)) return;
      if (t === 'NONE') return;
      set.add(t);
    };

    // Toppings section
    const topRoot = findHeadingRoot(['topping', 'toppings']);
    if (topRoot) {
      const checked = $all('input[type="checkbox"]:checked, input[type="radio"]:checked', topRoot);
      for (const input of checked) {
        let label = input.closest('label');
        if (!label && input.id) label = topRoot.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        addPick(label?.textContent || '');
      }
      for (const chip of $all('[aria-pressed="true"], .selected', topRoot)) addPick(chip.textContent);
      for (const sel of $all('select', topRoot)) {
        const opt = sel.options?.[sel.selectedIndex];
        if (!opt || opt.disabled) continue;
        addPick(opt.text);
      }
    }

    // Cold Foams section (include selections)
    const foamRoot = findHeadingRoot(['cold foam', 'cold foams']);
    if (foamRoot) {
      for (const sel of $all('select', foamRoot)) {
        const opt = sel.options?.[sel.selectedIndex];
        if (!opt || opt.disabled) continue;
        addPick(opt.text);
      }
    }

    // Add-ins: include Line the Cup
    const addinsRoot = findHeadingRoot(['add-ins', 'add ins']);
    if (addinsRoot) {
      for (const sel of $all('select', addinsRoot)) {
        const aria = (sel.getAttribute('aria-label') || sel.id || '').toLowerCase();
        if (!/line the cup/.test(aria)) continue;
        const opt = sel.options?.[sel.selectedIndex];
        if (!opt || opt.disabled) continue;
        addPick(opt.text);
      }
    }

    return set;
  }

  function getCurrentState() {
    return {
      drink: getProductTitle(),
      size: getSelectedSize(),
      shots: getShotsCount(),
      milk: getMilkSelection(),
      syrups: getSyrupsAndSauces(), // [{name,pumps,type}]
      toppings: Array.from(getToppingsState()),
      coldFoam: getToppingsState().has('Cold Foam') || /cold foam/i.test(getToppingsState().values?.().next?.()?.value || '')
    };
  }

  // --- Pricing from Catalog ---
  function basePriceFromCatalog(drink, size) {
    const d = Object.keys(CATALOG.baseByDrink).find(k => normalize(drink).includes(normalize(k)));
    if (d && CATALOG.baseByDrink[d] && CATALOG.baseByDrink[d][size]) {
      return CATALOG.baseByDrink[d][size];
    }
    // Fallback by size only
    return CATALOG.defaultBaseBySize[size] ?? 0;
  }

  function isAltMilk(name) {
    const n = normalize(name);
    return n.includes('almond') || n.includes('oat') || n.includes('soy') || n.includes('coconut');
  }

  function altMilkUpcharge(name) {
    const n = normalize(name);
    if (n.includes('almond')) return CATALOG.extras.altMilk.almond;
    if (n.includes('oat')) return CATALOG.extras.altMilk.oat;
    if (n.includes('soy')) return CATALOG.extras.altMilk.soy;
    if (n.includes('coconut')) return CATALOG.extras.altMilk.coconut;
    return 0;
  }

  function computeExtrasCost(baseline, current) {
    let cost = 0;
    if (!baseline) return 0;

    // Shots: charge for increases only
    const deltaShots = Math.max(0, (current.shots || 0) - (baseline.shots || 0));
    cost += deltaShots * CATALOG.extras.extraShot;

    // Syrups/Sauces: charge increased pumps per flavor
    const byName = (arr) => {
      const map = new Map();
      for (const it of arr || []) {
        const key = normalize(it.name);
        const prev = map.get(key) || { pumps: 0, type: it.type };
        prev.pumps = Math.max(prev.pumps, it.pumps || 0); // take max seen
        map.set(key, prev);
      }
      return map;
    };
    const baseMap = byName(baseline.syrups);
    const curMap = byName(current.syrups);
    const names = new Set([...baseMap.keys(), ...curMap.keys()]);
    for (const name of names) {
      const base = baseMap.get(name) || { pumps: 0, type: 'syrup' };
      const cur = curMap.get(name) || { pumps: 0, type: base.type };
      const delta = Math.max(0, (cur.pumps || 0) - (base.pumps || 0));
      const per = (cur.type === 'sauce') ? CATALOG.extras.saucePump : CATALOG.extras.syrupPump;
      cost += delta * per;
    }

    // Milk: apply alt-milk upcharge if moved from default dairy to alt milk
    const wasAlt = isAltMilk(baseline.milk);
    const isAlt = isAltMilk(current.milk);
    if (!wasAlt && isAlt) cost += altMilkUpcharge(current.milk);

    // Toppings: charge only for additions
    const baseTops = new Set((baseline.toppings || []).map(t => normalize(t)));
    const curTops = new Set((current.toppings || []).map(t => normalize(t)));
    for (const t of curTops) {
      if (!baseTops.has(t)) {
        if (t.includes('whip')) cost += CATALOG.extras.whippedCream;
        else if (t.includes('cold foam')) cost += CATALOG.extras.coldFoam;
        else cost += CATALOG.extras.topping;
      }
    }

    return round2(cost);
  }

  function calculateTotal(basePrice, extrasCost) {
    return round2((Number(basePrice) || 0) + (Number(extrasCost) || 0));
  }

  // --- UI Widget ---
  const WIDGET_ID = 'latteledger-widget';
  let shadowRoot = null;

  function ensureWidget() {
    if (document.getElementById(WIDGET_ID)) return document.getElementById(WIDGET_ID);
    const host = document.createElement('div');
    host.id = WIDGET_ID;
    host.style.position = 'fixed';
    host.style.top = '12px';
    host.style.right = '12px';
    host.style.zIndex = '2147483646';
    host.style.all = 'initial';
    document.documentElement.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      :root { --text:#3e2f1c; --green:#00704a; --foam:#e3dccb; }
      .card { font-family: Segoe UI, Arial, sans-serif; background: linear-gradient(180deg, var(--foam), #ddd4bd); color: var(--text); border:1px solid rgba(75,59,42,0.15); border-radius:12px; box-shadow:0 8px 24px rgba(75,59,42,0.15); min-width:180px; max-width:280px; display:grid; gap:6px; padding:10px 12px; }
      .row { display:flex; align-items:baseline; gap:6px; }
      .title { font-weight:700; font-size:12px; letter-spacing:.3px; opacity:.85; }
      .label { font-weight:600; color:#4b3b2a; font-size:12px; }
      .amount { color: var(--green); font-weight:800; font-size:18px; }
    `;
    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    wrapper.innerHTML = `
      <div class="title">LatteLedger Total</div>
      <div class="row"><span class="label">Total:</span> <span id="ll-amount" class="amount">$0.00</span></div>
    `;
    shadowRoot.append(style, wrapper);
    return host;
  }

  function updateWidget(total) {
    ensureWidget();
    const amt = shadowRoot.getElementById('ll-amount');
    if (amt) amt.textContent = `$${(Number(total) || 0).toFixed(2)}`;
  }

  // --- Orchestration ---
  let baseline = null; // captured for current drink+size
  let baselineKey = null; // resolved drink key + size
  let baselineBasePrice = null; // locked base price for stability across SPA/page transitions
  let lastTotal = null;
  let currentMetrics = { total: 0, calories: 0, sugar_g: 0 };

  function resolveDrinkKey(drinkName) {
    const key = Object.keys(CATALOG.baseByDrink).find(k => normalize(drinkName).includes(normalize(k)));
    return key || 'unknown';
  }

  function recalc() {
    const state = getCurrentState();
    const resolvedKey = `${resolveDrinkKey(state.drink)}|${state.size}`;

    // (Re)capture baseline when first seen or when drink/size changes
    if (!baseline || baselineKey !== resolvedKey) {
      baseline = JSON.parse(JSON.stringify(state));
      baselineKey = resolvedKey;
      baselineBasePrice = basePriceFromCatalog(state.drink, state.size);
      lastTotal = null; // force widget refresh on next compute
    }

    // Keep base price stable for this drink+size combo
    const base = Number(baselineBasePrice ?? basePriceFromCatalog(state.drink, state.size));
    const extras = computeExtrasCost(baseline, state);
    const total = calculateTotal(base, extras);
    const nutrition = getNutrition();

    // Update widget only when total changes
    if (total !== lastTotal) {
      lastTotal = total;
      updateWidget(total);
    }

    // Always expose current metrics for popup/ledger, even if price unchanged
    try {
      chrome?.storage?.session?.set?.({
        latteledger_current_total: total,
        latteledger_current_calories: nutrition.calories,
        latteledger_current_sugar_g: nutrition.sugar_g
      });
    } catch {}

    // Keep most recent metrics in-memory for quick popup requests
    currentMetrics = { total, calories: nutrition.calories, sugar_g: nutrition.sugar_g };
  }

  // Debounced observer to react to UI changes
  let t = null;
  function schedule() { if (t) clearTimeout(t); t = setTimeout(recalc, 120); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureWidget(); recalc(); });
  } else {
    ensureWidget();
    recalc();
  }

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-checked','aria-selected','aria-valuenow','aria-pressed','aria-expanded','class','value','checked']
  });

  // Also listen for direct form interactions
  document.addEventListener('change', schedule, true);
  document.addEventListener('input', schedule, true);
  document.addEventListener('click', schedule, true);

  // Respond to popup requests for the live metrics
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'latteledger:getMetrics') {
        // Return the latest computed metrics
        sendResponse({ ok: true, ...currentMetrics });
        return true;
      }
    });
  } catch {}
})();
