const STORAGE_KEY = "my-balance-sheet-v1";

const TITLES = {
  income: { eyebrow: "Money in", title: "Inflows" },
  finance: { eyebrow: "Balance sheet", title: "Net" },
  expenses: { eyebrow: "Money out", title: "Outflows" },
};

const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function nowLocal() {
  return new Date();
}

function todayISO() {
  const d = nowLocal();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

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

function normalizeIncome(item) {
  let category = item.category;
  if (category === "salary") category = "earned";
  if (category === "irregular") category = "extraordinary";
  const recurring =
    category === "earned" || (category === "investment" && Boolean(item.recurring));
  return { ...item, category, recurring };
}

function normalizeExpense(item) {
  let kind = item.kind;
  if (kind === "one-off") kind = "variable";
  return { ...item, kind };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes.map(normalizeIncome) : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(normalizeExpense) : [],
    };
  } catch {
    return emptyState();
  }
}

function emptyState() {
  return { incomes: [], expenses: [] };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let tab = "finance";
const now = nowLocal();
let period = { year: now.getFullYear(), month: now.getMonth() };

function monthlyFromFrequency(amount, frequency) {
  const n = Number(amount) || 0;
  if (frequency === "weekly") return (n * 52) / 12;
  if (frequency === "yearly") return n / 12;
  return n;
}

function parseISODate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inSelectedPeriod(isoDate) {
  const d = parseISODate(isoDate);
  if (!d) return false;
  return d.getFullYear() === period.year && d.getMonth() === period.month;
}

function periodLabel() {
  return `${MONTH_NAMES[period.month]} <span class="num">${period.year}</span>`;
}

function formatMoney(value) {
  return `<span class="num">${money.format(value)}</span>`;
}

function formatDate(iso) {
  return iso ? `<span class="num">${iso}</span>` : "";
}

function yearOptions() {
  const currentYear = nowLocal().getFullYear();
  const years = [];
  for (let year = currentYear - 10; year <= currentYear + 2; year += 1) {
    years.push(year);
  }
  if (!years.includes(period.year)) years.unshift(period.year);
  return years
    .map((year) => `<option value="${year}" ${year === period.year ? "selected" : ""}>${year}</option>`)
    .join("");
}

function monthOptions() {
  return MONTH_NAMES.map(
    (name, index) => `<option value="${index}" ${index === period.month ? "selected" : ""}>${name}</option>`
  ).join("");
}

function summarize(current) {
  let recurringIncome = 0;
  let thisMonthIrregular = 0;
  const incomeByCategory = { earned: 0, investment: 0, extraordinary: 0 };

  for (const item of current.incomes) {
    const amount = Number(item.amount) || 0;
    const category = item.category === "earned" || item.category === "investment" || item.category === "extraordinary"
      ? item.category
      : "extraordinary";
    if (category === "earned") {
      recurringIncome += amount;
      incomeByCategory.earned += amount;
    } else if (category === "investment" && item.recurring) {
      recurringIncome += amount;
      incomeByCategory.investment += amount;
    } else if (inSelectedPeriod(item.date)) {
      thisMonthIrregular += amount;
      if (category === "investment") incomeByCategory.investment += amount;
      else incomeByCategory.extraordinary += amount;
    }
  }

  let fixedExpenses = 0;
  let subscriptionExpenses = 0;
  let variableExpenses = 0;

  for (const item of current.expenses) {
    const amount = Number(item.amount) || 0;
    if (item.kind === "fixed") {
      fixedExpenses += amount;
    } else if (item.kind === "subscription") {
      subscriptionExpenses += monthlyFromFrequency(amount, item.frequency);
    } else if (inSelectedPeriod(item.date)) {
      variableExpenses += amount;
    }
  }

  const monthlyIncome = recurringIncome + thisMonthIrregular;
  const monthlyExpenses = fixedExpenses + subscriptionExpenses + variableExpenses;
  const monthlyNet = monthlyIncome - monthlyExpenses;

  return {
    recurringIncome,
    thisMonthIrregular,
    incomeByCategory,
    fixedExpenses,
    subscriptionExpenses,
    variableExpenses,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
  };
}

function categoryLabel(category) {
  if (category === "earned") return "Earned Income";
  if (category === "investment") return "Investment Income";
  return "Extraordinary Income";
}

function expenseMeta(item) {
  if (item.kind === "fixed") return `Fixed Expenses · ${formatDate(item.date)}`;
  if (item.kind === "subscription") return `Subscriptions · ${item.frequency}`;
  return `Variable Expenses · ${item.date ? formatDate(item.date) : "no date"}`;
}

function typePick(name, value, checked, title, description) {
  return `
    <label class="type-pick">
      <input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} />
      <span class="type-pick-copy">
        <span class="type-pick-title">${title}</span>
        <span class="type-pick-desc">${description}</span>
      </span>
    </label>
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

function incomeScreen() {
  const rows = state.incomes
    .slice()
    .reverse()
    .map(
      (item) => `
        <article class="item">
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="amount positive">${formatMoney(item.amount)}</div>
          <button class="btn btn-ghost" data-delete-income="${item.id}" type="button">Delete</button>
          <div class="meta">${categoryLabel(item.category)}${item.category === "investment" && item.recurring ? " · monthly" : ""} · ${formatDate(item.date)}</div>
        </article>
      `
    )
    .join("");

  return `
    <section class="card">
      <h2>Add inflow</h2>
      <form id="income-form">
        <label>Description
          <input name="name" required maxlength="80" placeholder="e.g. Salary, dividends, tax refund" />
        </label>
        <div class="form-row">
          <label>Amount
            <span class="amount-field">
              <input name="amount" type="number" min="0" step="0.01" required />
              <span class="amount-suffix" aria-hidden="true">€</span>
            </span>
          </label>
          <label>Date
            <input name="date" type="date" required value="${todayISO()}" />
          </label>
        </div>
        <fieldset class="type-picks">
          <legend>Type</legend>
          ${typePick("category", "earned", true, "Earned Income", "such as salaries, wages, and performance bonuses")}
          ${typePick("category", "investment", false, "Investment Income", "such as dividends, stock gains, and rental income")}
          ${typePick("category", "extraordinary", false, "Extraordinary Income", "such as tax refunds, gift money, or selling personal items")}
        </fieldset>
        <label id="investment-recurring-wrap" hidden>
          <span>Investment cadence</span>
          <select name="investmentCadence">
            <option value="one-off">One-off</option>
            <option value="monthly">Recurring monthly</option>
          </select>
        </label>
        <p class="hint">Earned income and recurring investment income count every month. Extraordinary income counts only in the month of the date.</p>
        <button class="btn btn-income" type="submit">Save inflow</button>
      </form>
    </section>
    <section class="card">
      <h2>Recorded inflows</h2>
      ${rows ? `<div class="list">${rows}</div>` : `<p class="empty">No inflows recorded yet.</p>`}
    </section>
  `;
}

function expensesScreen() {
  const rows = state.expenses
    .slice()
    .reverse()
    .map(
      (item) => `
        <article class="item">
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="amount negative">${formatMoney(item.amount)}</div>
          <button class="btn btn-ghost" data-delete-expense="${item.id}" type="button">Delete</button>
          <div class="meta">${expenseMeta(item)}</div>
        </article>
      `
    )
    .join("");

  return `
    <section class="card">
      <h2>Add outflow</h2>
      <form id="expense-form">
        <label>Description
          <input name="name" required maxlength="80" placeholder="e.g. Rent, Netflix, car repair" />
        </label>
        <div class="form-row">
          <label>Amount
            <span class="amount-field">
              <input name="amount" type="number" min="0" step="0.01" required />
              <span class="amount-suffix" aria-hidden="true">€</span>
            </span>
          </label>
          <label>Date
            <input name="date" type="date" required value="${todayISO()}" />
          </label>
        </div>
        <fieldset class="type-picks">
          <legend>Type</legend>
          ${typePick("kind", "fixed", true, "Fixed Expenses", "such as rent/mortgage, phone contracts, insurance premiums")}
          ${typePick("kind", "subscription", false, "Subscriptions", "such as Netflix, Spotify, and gym memberships")}
          ${typePick("kind", "variable", false, "Variable Expenses", "such as car repair, flight ticket, and medical bill")}
        </fieldset>
        <label id="frequency-wrap" hidden>
          Frequency
          <select name="frequency">
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <p class="hint">Fixed expenses count every month. Subscriptions stay active until you delete them. Variable expenses count only in the month of the date.</p>
        <button class="btn btn-expense" type="submit">Save outflow</button>
      </form>
    </section>
    <section class="card">
      <h2>Recorded outflows</h2>
      ${rows ? `<div class="list">${rows}</div>` : `<p class="empty">No outflows recorded yet.</p>`}
    </section>
  `;
}

function financeScreen() {
  const s = summarize(state);
  const netClass = s.monthlyNet > 0 ? "positive" : s.monthlyNet < 0 ? "negative" : "neutral";

  return `
    <section class="card">
      <h2>Period</h2>
      <form id="period-form" class="period-row">
        <label>Month
          <select name="month" id="period-month">${monthOptions()}</select>
        </label>
        <label>Year
          <select name="year" id="period-year">${yearOptions()}</select>
        </label>
      </form>
      <div class="hero-grid">
        <div class="stat">
          <span class="label">Gross Income</span>
          <span class="value positive">${formatMoney(s.monthlyIncome)}</span>
        </div>
        <div class="stat">
          <span class="label">Total Expenses</span>
          <span class="value negative">${formatMoney(s.monthlyExpenses)}</span>
        </div>
        <div class="stat wide">
          <span class="label">Net Income · ${periodLabel()}</span>
          <span class="value ${netClass}">${formatMoney(s.monthlyNet)}</span>
        </div>
      </div>
      <p class="hint">Defaults to today (${formatDate(todayISO())}). Recurring items count in every selected month; extraordinary inflows and variable outflows count only in their date’s month.</p>
    </section>
    <section class="card">
      <h2>Inflow mix</h2>
      <div class="breakdown">
        <div class="row"><span>Earned Income</span><span class="positive">${formatMoney(s.incomeByCategory.earned)}</span></div>
        <div class="row"><span>Investment Income (${periodLabel()})</span><span class="positive">${formatMoney(s.incomeByCategory.investment)}</span></div>
        <div class="row"><span>Extraordinary Income (${periodLabel()})</span><span class="positive">${formatMoney(s.incomeByCategory.extraordinary)}</span></div>
      </div>
    </section>
    <section class="card">
      <h2>Outflow mix</h2>
      <div class="breakdown">
        <div class="row"><span>Fixed Expenses</span><span class="negative">${formatMoney(s.fixedExpenses)}</span></div>
        <div class="row"><span>Subscriptions (monthly equivalent)</span><span class="negative">${formatMoney(s.subscriptionExpenses)}</span></div>
        <div class="row"><span>Variable Expenses (${periodLabel()})</span><span class="negative">${formatMoney(s.variableExpenses)}</span></div>
      </div>
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

function selectedRadioValue(form, name) {
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function bindScreenEvents() {
  const periodForm = document.getElementById("period-form");
  if (periodForm) {
    const syncPeriod = () => {
      const data = new FormData(periodForm);
      period = {
        month: Number(data.get("month")),
        year: Number(data.get("year")),
      };
      render();
    };
    periodForm.addEventListener("change", syncPeriod);
  }

  const incomeForm = document.getElementById("income-form");
  if (incomeForm) {
    const wrap = document.getElementById("investment-recurring-wrap");
    const sync = () => {
      wrap.hidden = selectedRadioValue(incomeForm, "category") !== "investment";
    };
    incomeForm.querySelectorAll('input[name="category"]').forEach((input) => {
      input.addEventListener("change", sync);
    });
    sync();
    incomeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(incomeForm);
      const categoryValue = String(data.get("category"));
      state.incomes.push({
        id: uid(),
        name: String(data.get("name")).trim(),
        amount: Number(data.get("amount")),
        date: String(data.get("date")),
        category: categoryValue,
        recurring: categoryValue === "earned" || (categoryValue === "investment" && data.get("investmentCadence") === "monthly"),
      });
      saveState(state);
      render();
    });
    document.querySelectorAll("[data-delete-income]").forEach((button) => {
      button.addEventListener("click", () => {
        state.incomes = state.incomes.filter((item) => item.id !== button.dataset.deleteIncome);
        saveState(state);
        render();
      });
    });
  }

  const expenseForm = document.getElementById("expense-form");
  if (expenseForm) {
    const wrap = document.getElementById("frequency-wrap");
    const sync = () => {
      wrap.hidden = selectedRadioValue(expenseForm, "kind") !== "subscription";
    };
    expenseForm.querySelectorAll('input[name="kind"]').forEach((input) => {
      input.addEventListener("change", sync);
    });
    sync();
    expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(expenseForm);
      const kindValue = String(data.get("kind"));
      state.expenses.push({
        id: uid(),
        name: String(data.get("name")).trim(),
        amount: Number(data.get("amount")),
        date: String(data.get("date")),
        kind: kindValue,
        frequency: kindValue === "subscription" ? String(data.get("frequency")) : null,
      });
      saveState(state);
      render();
    });
    document.querySelectorAll("[data-delete-expense]").forEach((button) => {
      button.addEventListener("click", () => {
        state.expenses = state.expenses.filter((item) => item.id !== button.dataset.deleteExpense);
        saveState(state);
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
