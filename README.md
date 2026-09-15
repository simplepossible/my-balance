# My Balance Sheet

A simple local app for tracking money in, money out, and the net result for a chosen month.

Open `index.html` in a browser, or run `serve.ps1` and go to [http://127.0.0.1:8765/](http://127.0.0.1:8765/). Entries are stored in that browser’s local storage.

## Screens

Three buttons at the bottom:

- **Inflows** (left): record money coming in
- **Net** (middle): totals and mix for a selected month and year
- **Outflows** (right): record money going out

## Inflows

Each inflow has a description, amount, date, and type:

- **Earned Income** -- salaries, wages, and performance bonuses (counts every month)
- **Investment Income** -- dividends, stock gains, and rental income (one-off, or recurring monthly)
- **Extraordinary Income** -- tax refunds, gift money, or selling personal items (counts only in the month of the date)

## Outflows

Each outflow has a description, amount, date, and type:

- **Fixed Expenses** -- rent/mortgage, phone contracts, insurance premiums (counts every month)
- **Subscriptions** -- Netflix, Spotify, gym memberships (weekly, monthly, or yearly until deleted)
- **Variable Expenses** -- car repair, flight tickets, medical bills (counts only in the month of the date)

Weekly subscriptions are converted to a monthly figure as amount × 52 ÷ 12. 
Yearly subscriptions are amount ÷ 12.

## Net

The period defaults to today's month and year. You can change both on one row.

For the selected period it shows:

- **Gross Income** -- all inflows that apply that month
- **Total Expenses** -- all outflows that apply that month
- **Net Income** -- Gross Income − Total Expenses

**Inflow mix** and **Outflow mix** break those totals down by type.

## Appearance

All wording and numbers use Inter. Amount fields on Inflows and Outflows show a euro sign on the right. On Net, Gross Income, Total Expenses, and Net Income figures are slightly smaller than their labels and bold.

## Files

- `index.html` -- shell and bottom navigation
- `styles.css` -- layout and type
- `app.js` -- recording, totals, and local storage
- `serve.ps1` -- optional local server on port 8765
