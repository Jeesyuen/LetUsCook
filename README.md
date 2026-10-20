# SupplyWise AI

**Predict Early. Source Smarter. Purchase with Confidence.**

AI-powered inventory forecasting and supplier procurement for Malaysian SMEs — a frontend prototype for the
Alpha Red Solutions — Orbyte Smart SME Challenge. The demo business is the fictional **Brew & Co. Café**.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

No backend, API keys or external services are needed. Demo state is saved in `localStorage`;
use **Settings → Reset Demo** (or the user menu) to restore the starting scenario.

## Demo walkthrough

1. Landing page → **Launch Dashboard**
2. Overview → coffee bean alert → **Review Restock**
3. Forecasting → **Find Best Supplier**
4. Supplier Comparison → try priorities → **Request Manager Approval**
5. Approvals → **Approve** (a PO is generated)
6. PO drawer → **Send via WhatsApp / Email** → **Confirm Send** (simulated)
7. **Simulate Acceptance** → **Record Delivery**
8. Inventory, Forecasting and Activity Log all reflect the update

The **?** icon in the app header shows this walkthrough.

## Structure

```
src/
  types/        domain interfaces (Product, Supplier, Quotation, ApprovalRequest, PurchaseOrder, …)
  data/         mock data + runtime supplier registry
  services/     forecasting, supplier scoring, explanations, communication templates (pure functions)
  store/        Zustand store (persisted) — every action mirrors a future API call
  hooks/        derived data (forecasts, recommendations, scored quotes)
  components/   UI primitives (ui/), charts, modals, cards
  layouts/      app shell (sidebar, header)
  pages/        landing + /app routes
```

## Business logic

- **Days remaining** = current stock ÷ 14-day average daily usage
- **Reorder point** = daily usage × lead time + safety stock
- **Suggested quantity** = usage × (lead time + coverage days) + safety stock − on hand − open orders, rounded to pack size
- **Compatibility score** = weighted sum of criteria normalised to 0–100 (price 35, delivery 30, reliability 20, quality 10, order fit 5 by default). It is a decision-support score, not a probability.
- No purchase order exists before manager approval; supplier term changes require re-approval; inventory only increases on goods receipt.

## Simulated

Email, WhatsApp, MCP and Orbyte are shown as "Demo Mode — Not Connected". Supplier quotations,
messages and replies are generated locally — nothing is sent anywhere.
