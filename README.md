# SupplyWise AI

**Predict Early. Source Smarter. Purchase with Confidence.**

AI-powered inventory forecasting and supplier procurement for Malaysian SMEs — a frontend prototype for the
Alpha Red Solutions — Orbyte Smart SME Challenge. The demo business is the fictional **Brew & Co. Café**.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm test           # forecasting and supplier matching tests (Vitest)
```

## Configuration & Environment Variables

To configure environment variables for local testing, copy the template:

```bash
cp .env.example .env.local
```

### AI Inference Configuration (RunPod Serverless)
SupplyWise AI interfaces with an OpenAI-compatible vLLM endpoint hosted on **RunPod Serverless (NVIDIA RTX 4090)** running `Qwen/Qwen2.5-7B-Instruct`.

Testers should specify their RunPod credentials in `.env.local`:
```env
VITE_RUNPOD_ENDPOINT_ID=s3yoz365sju59f
VITE_RUNPOD_MODEL=Qwen/Qwen2.5-7B-Instruct
VITE_RUNPOD_API_KEY=your_runpod_api_key_here
```
*(On hosted environments like Replit, configure these credentials under **Tools → Secrets**).*

State is synchronized in `localStorage`; use **Settings → Reset Demo** (or the user menu) to restore the starting scenario at any time.

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

- **Average daily usage** = mean of valid non-negative daily usage observations. With at least 7 observations, forecast usage blends the overall mean (70%) with the latest 7-day mean (30%); with at least 14 observations, the displayed trend compares the latest 7-day mean with the preceding 7-day mean.
- **Demand variability** = sample standard deviation when at least 7 valid observations exist. **Safety stock** is the greater of the configured safety quantity and `1.65 × standard deviation × √(supplier lead days)`; otherwise the configured safety quantity is used.
- **Days to stockout** = projected depletion under forecast daily usage with open purchase orders applied once at their expected arrival dates. A date is omitted when usage is zero.
- **Reorder point** = forecast daily usage × supplier lead time + safety stock.
- **Suggested quantity** = forecast usage × (lead time + configured coverage days) + safety stock − current stock − open orders expected within that window, rounded up to the order multiple. If the preferred supplier has a catalogue MOQ, a positive recommendation is raised to that minimum and rounded to the product's order multiple.
- Risk is **Critical** when stock is at or below safety stock or projected stockout is on or before supplier lead time, **Reorder Soon** when stock reaches its reorder point or has at most 7 extra days of cover, and **Healthy** otherwise. Open-order arrival timing is included in depletion estimates.
- Seeded usage history is labeled **simulated**; a new product's single entered value is labeled **baseline**, and older saved records without provenance remain **unverified**. Forecasts are deterministic decision-support estimates, not an ML model or live supplier data.
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
