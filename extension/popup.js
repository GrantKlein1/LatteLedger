console.log("LatteLedger popup loaded");

document.addEventListener("DOMContentLoaded", async () => {
  const curCost = document.getElementById("curCost");
  const curCal = document.getElementById("curCal");
  const curSugar = document.getElementById("curSugar");
  const totDrinks = document.getElementById("totDrinks");
  const totCost = document.getElementById("totCost");
  const totCal = document.getElementById("totCal");
  const totSugar = document.getElementById("totSugar");
  const addBtn = document.getElementById("addBtn");
  const resetBtn = document.getElementById("resetBtn");

  function formatMoney(n) { return `$${(Number(n) || 0).toFixed(2)}`; }

  async function loadCurrent() {
    return new Promise((resolve) => {
      try {
        chrome.storage.session.get({
          latteledger_current_total: 0,
          latteledger_current_calories: 0,
          latteledger_current_sugar_g: 0
        }, (items) => {
          resolve(items);
        });
      } catch {
        resolve({ latteledger_current_total: 0, latteledger_current_calories: 0, latteledger_current_sugar_g: 0 });
      }
    });
  }

  async function loadTotals() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({
          latteledger_total_drinks: 0,
          latteledger_total_cost: 0,
          latteledger_total_calories: 0,
          latteledger_total_sugar_g: 0
        }, (items) => resolve(items));
      } catch {
        resolve({ latteledger_total_drinks: 0, latteledger_total_cost: 0, latteledger_total_calories: 0, latteledger_total_sugar_g: 0 });
      }
    });
  }

  function renderCurrent(items) {
    curCost.textContent = formatMoney(items.latteledger_current_total || 0);
    curCal.textContent = String(items.latteledger_current_calories || 0);
    curSugar.textContent = String(items.latteledger_current_sugar_g || 0);
  }

  function renderTotals(items) {
    totDrinks.textContent = String(items.latteledger_total_drinks || 0);
    totCost.textContent = formatMoney(items.latteledger_total_cost || 0);
    totCal.textContent = String(items.latteledger_total_calories || 0);
    totSugar.textContent = String(items.latteledger_total_sugar_g || 0);
  }

  async function refreshUI() {
    // Try to fetch live metrics from the active Starbucks tab first
    let live = null;
    try {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (tabId != null) {
        live = await new Promise((resolve) => {
          try {
            chrome.tabs.sendMessage(tabId, { type: 'latteledger:getMetrics' }, (resp) => {
              if (chrome.runtime.lastError) return resolve(null);
              resolve(resp && resp.ok ? resp : null);
            });
          } catch { resolve(null); }
        });
      }
    } catch {}

    const [current, totals] = await Promise.all([loadCurrent(), loadTotals()]);

    if (live) {
      // Prefer live values from the active tab when available
      renderCurrent({
        latteledger_current_total: live.total,
        latteledger_current_calories: live.calories,
        latteledger_current_sugar_g: live.sugar_g
      });
    } else {
      renderCurrent(current);
    }
    renderTotals(totals);
  }

  addBtn.addEventListener("click", async () => {
    const current = await loadCurrent();
    chrome.storage.local.get({
      latteledger_total_drinks: 0,
      latteledger_total_cost: 0,
      latteledger_total_calories: 0,
      latteledger_total_sugar_g: 0
    }, (totals) => {
      const next = {
        latteledger_total_drinks: (totals.latteledger_total_drinks || 0) + 1,
        latteledger_total_cost: (totals.latteledger_total_cost || 0) + (current.latteledger_current_total || 0),
        latteledger_total_calories: (totals.latteledger_total_calories || 0) + (current.latteledger_current_calories || 0),
        latteledger_total_sugar_g: (totals.latteledger_total_sugar_g || 0) + (current.latteledger_current_sugar_g || 0)
      };
      chrome.storage.local.set(next, refreshUI);
    });
  });

  resetBtn.addEventListener("click", () => {
    chrome.storage.local.set({
      latteledger_total_drinks: 0,
      latteledger_total_cost: 0,
      latteledger_total_calories: 0,
      latteledger_total_sugar_g: 0
    }, refreshUI);
  });

  // Listen to live updates from content script
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session') {
        if (changes.latteledger_current_total || changes.latteledger_current_calories || changes.latteledger_current_sugar_g) {
          loadCurrent().then(renderCurrent);
        }
      }
      if (area === 'local') {
        if (changes.latteledger_total_drinks || changes.latteledger_total_cost || changes.latteledger_total_calories || changes.latteledger_total_sugar_g) {
          loadTotals().then(renderTotals);
        }
      }
    });
  } catch {}

  await refreshUI();
});

