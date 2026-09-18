# My Balance

A one-screen-per-tab money overview, built to fit an iPhone without scrolling.

Open `index.html` or run `serve.ps1` and go to [http://127.0.0.1:8765/](http://127.0.0.1:8765/). Data stays in the browser’s local storage.

## Screens

- **Inflows**: monthly payout, plus extras added one by one for the selected month
- **Outflows**: monthly fixed costs, a flexible budget, and spent totals per main part (not day-by-day receipts)
- **Net**: Gross Income, Total Expenses, Net Income, and whether flexible spending is over budget

## How it counts

Income = monthly payout + extras this month.  
Expenses = fixed monthly costs + flexible spent this month.  
If flexible spent is higher than the flexible budget, Net and Outflows show an over-budget warning. If you do not set a flexible budget, it defaults to income minus fixed costs.

## Files

- `index.html` — shell and bottom navigation
- `styles.css` — compact layout
- `app.js` — totals and local storage
- `serve.ps1` — optional local server on port 8765
