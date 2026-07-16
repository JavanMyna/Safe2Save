# Safe-to-Save

A personal finance tracker for people with irregular income — built because I didn't want to hand my spending data to a subscription app just to see where my money goes.

**Live demo:** https://javanmyna.github.io/Safe2Save/

---

## Why I built this

Most budgeting apps assume you have a fixed payday and lock the good features behind a subscription. I wanted something simpler and mine: a way to log spending without being tied to a paid app, and — the part I actually cared about — a way to know how much of my current bank balance is actually *safe* to move into savings, based on how I actually spend, not a rigid monthly budget I'd abandon in a week.

Safe-to-Save is the result. It's a static site backed by Supabase, so there's no vendor lock-in, no subscription, and the data model is simple enough that I (or anyone else) can read straight through the code.

---
## Recommended Device
** Mobile Recommended **
This project was designed primarily for mobile devices. While it works on desktop, the intended experience is on a phone.

---
## Features

**Dashboard**
<img width="1366" height="634" alt="image" src="https://github.com/user-attachments/assets/a21bef94-6e27-47ab-a154-d2137c52260a" />
- Spending vs. savings overview over 7 days / 30 days / 12 months
- Bar chart of daily spend and a category breakdown donut chart
- Projected month-end balance based on your latest check-in plus recurring items
- Searchable, filterable transaction history


**Log**
<img width="1366" height="634" alt="image" src="https://github.com/user-attachments/assets/e5b4ca96-6915-4624-9ea5-26cfc2cc2787" />
- Quick expense/income entry with category tagging (Food, Transport, Bills, Shopping, Entertainment, Health, Other, and custom categories you add yourself)
- Optional recurring transactions
- Same-day transaction summary as you log

**Check Balance (the core feature)**
<img width="1366" height="634" alt="image" src="https://github.com/user-attachments/assets/f343130e-ffb9-41be-bc38-eca9c27c1e33" />
- Enter your current bank balance and get a calculated "safe to save" amount — how much you can move into savings without eating into your near-term runway
- Full check-in history so you can see how that number has moved over time

**Settings**
<img width="1366" height="635" alt="image" src="https://github.com/user-attachments/assets/6573f5c6-2dc2-41fc-ac55-1fda5fa2bbf1" />
- Configurable runway (days of expenses to keep as a buffer) and starting daily spend estimate
- Optional monthly budget pacing
- Export all transactions to CSV or JSON — your data, your file, any time
- Dark mode

---

## How "Safe to Save" works

Instead of counting down to a fixed payday, the app looks at your actual spending pattern (or a starting estimate, until you've logged ~5 days of history) and your configured runway in days. It uses that to work out how much of your current balance needs to stay liquid to cover upcoming spending, and treats the rest as safe to move into savings. The runway length and starting estimate are both adjustable in Settings, so it adapts to how conservative or aggressive you want to be.

---

## Tech stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- [Chart.js](https://www.chartjs.org/) for the dashboard charts
- [Supabase](https://supabase.com/) (Postgres + Auth) for the backend, with PL/pgSQL for the check-in / safe-to-save calculations
- Hosted on GitHub Pages

---

## Project structure

```
Safe2Save/
├── index.html        # Landing page
├── login.html         # Auth
├── dashboard.html      # Overview, charts, recent transactions
├── log.html            # Log a transaction
├── checkin.html         # Balance check-in / safe-to-save calculator
├── settings.html        # Preferences, budget, export, sign out
├── css/                  # Styles
├── js/
│   ├── supabase.js       # Supabase client init (URL + anon key)
│   ├── auth.js            # Auth handling
│   ├── categories.js       # Default + custom category definitions
│   └── utils.js             # Shared helpers
├── favicon/
└── supabase/              # SQL schema / functions for the Supabase backend
```

---

## Running it yourself

1. Clone the repo
   ```bash
   git clone https://github.com/JavanMyna/Safe2Save.git
   ```
2. Create a [Supabase](https://supabase.com/) project and run the SQL in `supabase/` against it to set up the tables and functions.
3. Open `js/supabase.js` and swap in your own project's URL and anon key:
   ```js
   const SUPABASE_URL = "your-project-url";
   const SUPABASE_ANON_KEY = "your-anon-key";
   ```
4. Serve the folder statically (e.g. the VS Code Live Server extension, `npx serve`, or just push to GitHub Pages). No build step needed.

---

## Status

Currently at v1.5 and actively evolving as I use it day to day. It's a personal tool first, but it's public in case it's useful to anyone else who wants a subscription-free way to track spending.

---

## License

Not yet licensed — all rights reserved by default until a LICENSE file is added. Get in touch if you'd like to use or fork this.

---

## Author

Built by [JavanMyna](https://github.com/JavanMyna).
