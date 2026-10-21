# SupplyWise AI

**Predict Early. Source Smarter. Purchase with Confidence.**

AI-powered inventory forecasting and supplier procurement for Malaysian SMEs — a frontend prototype for the
Alpha Red Solutions — Orbyte Smart SME Challenge. The demo business is the fictional **Brew & Co. Café**.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm test           # supplier matching engine tests (Vitest)
```

No backend, API keys or external services are needed. Demo state is saved in `localStorage`;
use **Settings → Reset Demo** (or the user menu) to restore the starting scenario.

## Demo walkthrough

1. Landing page → **Launch Dashboard**
2. Overview → coffee bean alert → **Review Restock**
3. Forecasting → **Find Best Supplier**
4. Supplier Comparison → switch **Best Overall / Cheapest / Nearest / Fastest** → **Request Manager Approval**
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
    matching/   supplier compatibility scoring, ranking and explanations
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
- **Supplier compatibility** — `src/services/matching/`. Each criterion is normalised to 0–100:
  price = 100 − 3 pts per 1% above the lowest total price; delivery = (fastest + 1) ÷ (days + 1);
  distance = (nearest + 10 km) ÷ (km + 10); reliability and product suitability as supplied (0–100).
  Best Overall weights: price 30, delivery 25, reliability 20, distance 15, suitability 10. Cheapest, Nearest and
  Fastest rank by their own measure first, then by a score that puts 60% weight on that measure.
  Missing data is not scored (weights rescaled, supplier flagged "unverified"); suppliers that cannot fulfil the order
  are excluded. It is a decision-support score, not a probability.
- **AI Procurement Advisor** — `src/services/matching/advisor.ts`. Shows the top pick plus two
  alternatives with labels earned from the data (Best Overall on the balanced score, Best Budget Choice, Fastest Delivery,
  Nearest Supplier, Most Reliable — ties share a label, nothing is forced). Urgency compares the forecast's days of
  cover with each supplier's delivery time: when stock is short it prefers a supplier that arrives before the stockout
  and warns if the cheapest one cannot; when stock is healthy it points out cheaper, slower options.
- **Legacy quotation score** (Approvals modify dialog, Settings weights) = price 35, delivery 30, reliability 20, quality 10, order fit 5.
- No purchase order exists before manager approval; supplier term changes require re-approval; inventory only increases on goods receipt.

## Simulated

Supplier data for matching comes from sample data (`src/data/sampleSupplierData.ts`) and is labelled as such.
Email, WhatsApp, MCP and Orbyte are shown as "Demo Mode — Not Connected". Supplier quotations,
messages and replies are generated locally — nothing is sent anywhere.
