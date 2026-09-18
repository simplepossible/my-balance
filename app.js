const STORAGE_KEY = "my-balance-sheet-v2";

const TITLES = {
  income: { eyebrow: "Money in", title: "Inflows" },
  finance: { eyebrow: "This month", title: "Net" },
  expenses: { eyebrow: "Money out", title: "Outflows" },
};

const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function nowLocal() {
  return new Date();
}

function defaultCategories() {
  return [
    { id: "rent", name: "Rent", kind: "fixed", custom: false },
    { id: "insurance", name: "Insurance", kind: "fixed", custom: false },
    { id: "phone", name: "Phone", kind: "fixed", custom: false },
    { id: "food", name: "Food", kind: "flexible", custom: false },
    { id: "leisure", name: "Leisure", kind: "flexible", custom: false },
    { id: "other", name: "Other", kind: "flexible", custom: false },
  ];
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyState() {
  return {
    blockedMonthly: 0,
    extrasByPeriod: {},
    flexibleBudgetByPeriod: {},
    fixedById: {},
    spentByPeriod: {},
    categories: defaultCategories(),
  };
}

function normalizeExtra(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: String(item.id || uid()),
    note: String(item.note || ""),
    amount: Number(item.amount) || 0,
  };
}

function migrateExtras(parsed) {
  const extrasByPeriod = {};
  const incoming = parsed.extrasByPeriod && typeof parsed.extrasByPeriod === "object" ? parsed.extrasByPeriod : {};
  Object.entries(incoming).forEach(([key, list]) => {
    extrasByPeriod[key] = Array.isArray(list) ? list.map(normalizeExtra).filter(Boolean) : [];
  });

  const oldAmounts = parsed.extraByPeriod && typeof parsed.extraByPeriod === "object" ? parsed.extraByPeriod : {};
  const oldNotes = parsed.extraNoteByPeriod && typeof parsed.extraNoteByPeriod === "object" ? parsed.extraNoteByPeriod : {};
  const oldKeys = new Set([...Object.keys(oldAmounts), ...Object.keys(oldNotes)]);
  oldKeys.forEach((key) => {
    if (extrasByPeriod[key] && extrasByPeriod[key].length) return;
    const amount = Number(oldAmounts[key]) || 0;
    const note = String(oldNotes[key] || "").trim();
    if (!amount && !note) return;
    extrasByPeriod[key] = [{ id: uid(), note, amount }];
  });

  return extrasByPeriod;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return {
      blockedMonthly: Number(parsed.blockedMonthly) || 0,
      extrasByPeriod: migrateExtras(parsed),
      flexibleBudgetByPeriod:
        parsed.flexibleBudgetByPeriod && typeof parsed.flexibleBudgetByPeriod === "object"
          ? parsed.flexibleBudgetByPeriod
          : {},
      fixedById: parsed.fixedById && typeof parsed.fixedById === "object" ? parsed.fixedById : {},
      spentByPeriod: parsed.spentByPeriod && typeof parsed.spentByPeriod === "object" ? parsed.spentByPeriod : {},
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : base.categories,
    };
  } catch {
    return emptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let tab = "finance";
const now = nowLocal();
let period = { year: now.getFullYear(), month: now.getMonth() };

function periodKey() {
  return `${period.year}-${String(period.month + 1).padStart(2, "0")}`;
}

function periodLabel() {
  return `${MONTH_NAMES[period.month]} ${period.year}`;
}

function yearOptions() {
  const currentYear = nowLocal().getFullYear();
  const years = [];
  for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
    years.push(year);
  }
  return years
    .map((year) => `<option value="${year}" ${year === period.year ? "selected" : ""}>${year}</option>`)
    .join("");
}

function monthOptions() {
  return MONTH_NAMES.map(
    (name, index) => `<option value="${index}" ${index === period.month ? "selected" : ""}>${name}</option>`
  ).join("");
}

function extrasThisMonth() {
  const list = state.extrasByPeriod[periodKey()];
  return Array.isArray(list) ? list : [];
}

function extraThisMonth() {
  return extrasThisMonth().reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function extraNotesThisMonth() {
  return extrasThisMonth()
    .map((item) => String(item.note || "").trim())
    .filter(Boolean)
    .join(", ");
}

function flexibleBudgetThisMonth() {
  const key = periodKey();
  if (state.flexibleBudgetByPeriod[key] === "" || state.flexibleBudgetByPeriod[key] == null) {
    return null;
  }
  return Number(state.flexibleBudgetByPeriod[key]) || 0;
}

function spentThisMonth(id) {
  const bag = state.spentByPeriod[periodKey()] || {};
  return Number(bag[id]) || 0;
}

function fixedAmount(id) {
  return Number(state.fixedById[id]) || 0;
}

function summarize() {
  const income = (Number(state.blockedMonthly) || 0) + extraThisMonth();
  const fixedCats = state.categories.filter((item) => item.kind === "fixed");
  const flexCats = state.categories.filter((item) => item.kind === "flexible");
  const fixedTotal = fixedCats.reduce((sum, item) => sum + fixedAmount(item.id), 0);
  const flexibleSpent = flexCats.reduce((sum, item) => sum + spentThisMonth(item.id), 0);
  const expenses = fixedTotal + flexibleSpent;
  const leftover = income - fixedTotal;
  const flexBudget = flexibleBudgetThisMonth();
  const budget = flexBudget == null ? Math.max(leftover, 0) : flexBudget;
  const overBudget = flexibleSpent > budget && budget >= 0;

  return {
    income,
    extra: extraThisMonth(),
    blocked: Number(state.blockedMonthly) || 0,
    fixedTotal,
    flexibleSpent,
    expenses,
    net: income - expenses,
    leftover,
    budget,
    remainingFlexible: budget - flexibleSpent,
    overBudget,
    fixedCats,
    flexCats,
  };
}

function formatMoney(value) {
  return `<span class="num">${money.format(value)}</span>`;
}

function amountField(name, value, extra = "") {
  return `
    <span class="amount-field">
      <input name="${name}" type="number" min="0" step="1" inputmode="decimal" value="${value || 0}" ${extra} />
      <span class="amount-suffix" aria-hidden="true">€</span>
    </span>
  `;
}

function render() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });
  const heading = TITLES[tab];
  document.getElementById("top-eyebrow").textContent = heading.eyebrow;
  document.getElementById("screen-title").textContent = heading.title;
  const root = document.getElementById("screen");
  if (tab === "income") root.innerHTML = incomeScreen();
  if (tab === "expenses") root.innerHTML = expensesScreen();
  if (tab === "finance") root.innerHTML = financeScreen();
  bindScreenEvents();
}

function extraRow(item) {
  return `
    <div class="cat-row extra-row">
      <input class="cat-name" data-extra-note="${item.id}" maxlength="40" placeholder="e.g. parents, job" value="${escapeHtml(item.note)}" />
      ${amountField(`extra-${item.id}`, item.amount, `data-extra-amount="${item.id}"`)}
      <button class="btn-remove" type="button" data-remove-extra="${item.id}" aria-label="Remove extra">×</button>
    </div>
  `;
}

function incomeScreen() {
  const s = summarize();
  const extras = extrasThisMonth();
  return `
    <section class="card fill">
      <form id="income-form">
        <div class="cat-row">
          <span class="cat-label title">Monthly payout</span>
          ${amountField("blockedMonthly", state.blockedMonthly)}
          <span class="btn-remove-spacer"></span>
        </div>
        <div class="block">
          <div class="section-head">
            <h2>Extra this month</h2>
            <button class="btn-add" type="button" data-add-extra>+ Add</button>
          </div>
          ${extras.length ? extras.map(extraRow).join("") : `<p class="lead">No extras yet.</p>`}
        </div>
      </form>
      <div class="summary-line">
        <span class="positive available">Available in ${periodLabel()}</span>
        <strong class="positive">${formatMoney(s.income)}</strong>
      </div>
    </section>
  `;
}

function categoryRow(item, mode) {
  const value = mode === "fixed" ? fixedAmount(item.id) : spentThisMonth(item.id);
  const field = mode === "fixed" ? "fixed" : "spent";
  const nameCell = item.custom
    ? `<input class="cat-name" data-name="${item.id}" maxlength="24" value="${escapeHtml(item.name)}" />`
    : `<span class="cat-label">${escapeHtml(item.name)}</span>`;
  const remove = item.custom
    ? `<button class="btn-remove" type="button" data-remove="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">×</button>`
    : `<span class="btn-remove-spacer"></span>`;
  return `
    <div class="cat-row">
      ${nameCell}
      ${amountField(`${field}-${item.id}`, value, `data-${field}="${item.id}"`)}
      ${remove}
    </div>
  `;
}

function expensesScreen() {
  const s = summarize();
  const budgetValue = flexibleBudgetThisMonth();
  const statusClass = s.overBudget ? "negative" : "positive";
  const statusText = s.overBudget
    ? `Over budget by ${money.format(Math.abs(s.remainingFlexible))}`
    : `${money.format(s.remainingFlexible)} left in flexible budget`;

  return `
    <section class="card fill">
      <form id="expense-form">
        <div class="block">
          <div class="section-head">
            <h2>Fixed</h2>
            <button class="btn-add" type="button" data-add="fixed">+ Add</button>
          </div>
          ${s.fixedCats.map((item) => categoryRow(item, "fixed")).join("")}
        </div>
        <div class="block">
          <div class="section-head">
            <h2>Flexible</h2>
            <button class="btn-add" type="button" data-add="flexible">+ Add</button>
          </div>
          <div class="cat-row">
            <span class="cat-label">Flexible budget</span>
            ${amountField("flexibleBudget", budgetValue == null ? s.budget : budgetValue)}
            <span class="btn-remove-spacer"></span>
          </div>
          ${s.flexCats.map((item) => categoryRow(item, "flexible")).join("")}
        </div>
      </form>
      <div class="summary-line">
        <span class="title">Total outflows</span>
        <strong class="negative">${formatMoney(s.expenses)}</strong>
      </div>
      <p class="status ${statusClass}">${statusText}</p>
    </section>
  `;
}

function financeScreen() {
  const s = summarize();
  const netClass = s.net > 0 ? "positive" : s.net < 0 ? "negative" : "neutral";
  const flexClass = s.overBudget ? "negative" : "positive";

  return `
    <section class="card fill">
      <form id="period-form" class="period-row">
        <label>Month
          <select name="month">${monthOptions()}</select>
        </label>
        <label>Year
          <select name="year">${yearOptions()}</select>
        </label>
      </form>
      <div class="hero-grid">
        <div class="stat">
          <span class="label">Gross Income</span>
          <span class="value positive">${formatMoney(s.income)}</span>
        </div>
        <div class="stat">
          <span class="label">Total Expenses</span>
          <span class="value negative">${formatMoney(s.expenses)}</span>
        </div>
        <div class="stat wide">
          <span class="label">Net Income</span>
          <span class="value ${netClass}">${formatMoney(s.net)}</span>
        </div>
      </div>
      <div class="breakdown">
        <div class="row"><span>Monthly payout</span><span class="positive">${formatMoney(s.blocked)}</span></div>
        <div class="row"><span>Extra${extraNotesThisMonth() ? ` · ${escapeHtml(extraNotesThisMonth())}` : ""}</span><span class="positive">${formatMoney(s.extra)}</span></div>
        <div class="row"><span>Fixed costs</span><span class="negative">${formatMoney(s.fixedTotal)}</span></div>
        <div class="row"><span>Flexible spent</span><span class="negative">${formatMoney(s.flexibleSpent)}</span></div>
      </div>
      <p class="status ${flexClass}">${
        s.overBudget
          ? `Flexible expenses exceed budget by ${money.format(Math.abs(s.remainingFlexible))}`
          : `Flexible budget OK · ${money.format(s.remainingFlexible)} remaining`
      }</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function numberFrom(form, name) {
  return Number(new FormData(form).get(name)) || 0;
}

function bindScreenEvents() {
  const periodForm = document.getElementById("period-form");
  if (periodForm) {
    periodForm.addEventListener("change", () => {
      const data = new FormData(periodForm);
      period = {
        month: Number(data.get("month")),
        year: Number(data.get("year")),
      };
      render();
    });
  }

  const incomeForm = document.getElementById("income-form");
  if (incomeForm) {
    const persist = () => {
      state.blockedMonthly = numberFrom(incomeForm, "blockedMonthly");
      const extras = extrasThisMonth().map((item) => {
        const noteInput = incomeForm.querySelector(`[data-extra-note="${item.id}"]`);
        const amountInput = incomeForm.querySelector(`[data-extra-amount="${item.id}"]`);
        return {
          id: item.id,
          note: noteInput ? noteInput.value : item.note,
          amount: amountInput ? Number(amountInput.value) || 0 : item.amount,
        };
      });
      state.extrasByPeriod[periodKey()] = extras;
      saveState();
      const s = summarize();
      const line = incomeForm.parentElement.querySelector(".summary-line strong");
      if (line) line.innerHTML = formatMoney(s.income);
    };
    incomeForm.addEventListener("input", persist);
    const addExtra = incomeForm.querySelector("[data-add-extra]");
    if (addExtra) {
      addExtra.addEventListener("click", () => {
        persist();
        const list = extrasThisMonth();
        list.push({ id: uid(), note: "", amount: 0 });
        state.extrasByPeriod[periodKey()] = list;
        saveState();
        render();
        const notes = document.querySelectorAll("[data-extra-note]");
        const last = notes[notes.length - 1];
        if (last) last.focus();
      });
    }
    incomeForm.querySelectorAll("[data-remove-extra]").forEach((button) => {
      button.addEventListener("click", () => {
        persist();
        const id = button.dataset.removeExtra;
        state.extrasByPeriod[periodKey()] = extrasThisMonth().filter((item) => item.id !== id);
        saveState();
        render();
      });
    });
  }

  const expenseForm = document.getElementById("expense-form");
  if (expenseForm) {
    const persist = () => {
      state.flexibleBudgetByPeriod[periodKey()] = numberFrom(expenseForm, "flexibleBudget");
      expenseForm.querySelectorAll("[data-name]").forEach((input) => {
        const cat = state.categories.find((item) => item.id === input.dataset.name);
        if (cat) cat.name = input.value.trim() || "Category";
      });
      expenseForm.querySelectorAll("[data-fixed]").forEach((input) => {
        state.fixedById[input.dataset.fixed] = Number(input.value) || 0;
      });
      const spent = { ...(state.spentByPeriod[periodKey()] || {}) };
      expenseForm.querySelectorAll("[data-spent]").forEach((input) => {
        spent[input.dataset.spent] = Number(input.value) || 0;
      });
      state.spentByPeriod[periodKey()] = spent;
      saveState();
      const s = summarize();
      const total = expenseForm.parentElement.querySelector(".summary-line strong");
      if (total) total.innerHTML = formatMoney(s.expenses);
      const status = expenseForm.parentElement.querySelector(".status");
      if (status) {
        status.className = `status ${s.overBudget ? "negative" : "positive"}`;
        status.textContent = s.overBudget
          ? `Over budget by ${money.format(Math.abs(s.remainingFlexible))}`
          : `${money.format(s.remainingFlexible)} left in flexible budget`;
      }
    };
    expenseForm.addEventListener("input", persist);
    expenseForm.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => {
        persist();
        const kind = button.dataset.add;
        state.categories.push({
          id: uid(),
          name: kind === "fixed" ? "New fixed" : "New flexible",
          kind,
          custom: true,
        });
        saveState();
        render();
      });
    });
    expenseForm.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        persist();
        const id = button.dataset.remove;
        state.categories = state.categories.filter((item) => item.id !== id);
        delete state.fixedById[id];
        Object.keys(state.spentByPeriod).forEach((key) => {
          if (state.spentByPeriod[key]) delete state.spentByPeriod[key][id];
        });
        saveState();
        render();
      });
    });
  }
}

document.querySelector(".tabbar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  tab = button.dataset.tab;
  render();
});

render();
