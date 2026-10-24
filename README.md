# SupplyWise AI

> **Predict Early. Source Smarter. Purchase with Confidence.**  
> Autonomous Procurement Intelligence and Inventory Synchronization designed specifically for Malaysian Food & Beverage (F&B) SMEs.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | LetUsCook                                   |
| **Team Domain**        | Domain 2: Orbyte Smart SME Challenge        |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (Targets 8.2 & 8.3) |
| **Team Leader**        | Chew Jee Syuen                              |
| **University**         | Universiti Malaya (UM)                      |
| **Number of Members**  | 5                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/Jeesyuen/LetUsCook          |
| Live Demo         | https://supplywiseai.replit.app                |
| RunPod Endpoint   | https://api.runpod.ai/v2/s3yoz365sju59f/runsync|
| Slide Deck        | https://canva.link/g63loj5yv6eatd6             |
| Demo Video        | https://youtu.be/example-demo-video            |

---

## Overview

### Problem
Independent Food & Beverage (F&B) micro, small, and medium enterprises (MSMEs) in Malaysia operate on razor-thin net profit margins of just 5% to 8%, where raw ingredients consume 35% to 45% of total revenue. Today, kitchen procurement is plagued by fragmented WhatsApp chats, informal voice notes, and handwritten lists. Managers spend an estimated 4 to 6 hours weekly reconciling unstructured supplier quotes, leaving them vulnerable to hidden delivery surcharges, unexpected stockouts, rushed spot-buying, and high food spoilage.

### Solution
SupplyWise AI bridges this gap with an autonomous procurement intelligence platform engineered for independent kitchens. By pairing local deterministic decision engines with serverless Generative AI (`Qwen/Qwen2.5-7B-Instruct` on RunPod), SupplyWise AI predicts inventory depletion, normalizes unstructured WhatsApp quotations, models true landed costs (accounting for distance, fuel surcharges, and MOQs), and offers Explainable AI recommendations—all governed by a 1-click human manager approval gate before dispatching purchase orders directly via WhatsApp API.

### Key Features

- **Predictive Inventory Forecasting & Stockout Alerts** — Tracks daily ingredient burn rates using weighted rolling averages, establishing dynamic safety stock buffers and proactive stockout warnings.
- **True Landed Cost & Proximity Engine** — Ingests wholesale catalogs and calculates true landed unit cost based on road distance (km), fuel surcharges, volume discount tiers, and strict Minimum Order Quantities (MOQ).
- **Explainable AI Multi-Vector Supplier Matching** — Ranks suppliers across *Cheapest, Fastest, Nearest, and Best Overall* dimensions, generating plain-language trade-off explanations (e.g., warning if a cheaper supplier delivers too late to prevent a stockout).
- **1-Click Manager Approval & Automated PO Dispatch** — Generates standardized purchase orders (`SW-PO-2048.pdf`) upon manager approval and simulates instant automated dispatch to the supplier’s WhatsApp via Model Context Protocol (MCP) connectors.
- **Dual-Layer Silent Fault Tolerance** — Features client-side in-memory caching and deterministic rule-based fallbacks to guarantee 100% UI stability even during GPU cold starts or network dropouts.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| **Frontend**  | React 19, TypeScript 5, Vite 8, Tailwind CSS v4, Zustand, Framer Motion, Recharts |
| **Backend**   | Python 3.11, FastAPI, Pydantic v2 (REST API & validation) |
| **Database**  | PostgreSQL (Supabase) — Relational schema with transactional audit logging |
| **AI / Compute** | RunPod Serverless GPU (NVIDIA RTX 4090, `Qwen/Qwen2.5-7B-Instruct` via vLLM) |
| **Hosting / Dev** | Replit (Collaborative development & live staging) |

---

## Project Structure

```
.
├── main.py                  # Optional FastAPI backend service over Supabase
├── requirements.txt         # Python backend dependencies
├── schema.sql               # PostgreSQL / Supabase relational schema
├── src/
│   ├── components/          # Reusable UI primitives, charts, modals, comparison cards
│   ├── data/                # Mock datasets, supplier registry, automation fixtures
│   ├── hooks/               # Derived state hooks (forecasts, recommendations, matching)
│   ├── layouts/             # AppLayout, navigation header, sidebar
│   ├── pages/               # Landing page & /app routes (Overview, Forecasting, Recommendations, Workflow)
│   ├── services/            # Forecasting, landed cost, proximity, scoring & RunPod client
│   │   ├── discovery.ts     # Supplier discovery & landed-cost engine
│   │   ├── forecasting.ts   # Rolling burn rate & stockout prediction
│   │   ├── runpodClient.ts  # RunPod Serverless GPU client (Qwen 2.5 7B)
│   │   └── matching/        # Multi-vector scoring & Explainable AI advisor
│   ├── store/               # Zustand store with localStorage persistence
│   ├── types/               # TypeScript interfaces & domain models
│   └── utils/               # Formatting, date calculations, styling utilities
├── submission/              # Required hackathon submission proof documents
│   ├── SDC2026_LetUsCook_Preliminary.pdf      # Preliminary project proposal
│   ├── SDC2026_LetUsCook_TechDeclaration.pdf  # Technical tools declaration
│   ├── SDC2026_LetUsCook_Replit_POU.pdf       # Replit proof of use
│   └── SDC2026_LetUsCook_Runpod_POU.pdf       # RunPod proof of use
├── tests/                   # Vitest unit test suite (84 passing tests)
│   ├── src/services/discovery.test.ts
│   ├── src/services/forecasting.test.ts
│   └── src/services/runpodClient.test.ts
├── .env.example             # Example environment variables
├── .env.local               # Local development secrets (git-ignored)
├── .gitignore
├── .replit                  # Replit run configuration
├── package.json             # Frontend dependencies & scripts
├── vite.config.ts           # Vite bundler config with RunPod dev proxy
└── README.md
```

### Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Client (Vite 8 + React 19 + Zustand)                                   │
│ [Dashboard] ──► [Forecasting Engine] ──► [Landed Cost & Scorer]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Replit App Proxy Gateway (/api/runpod)                                 │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼ (Asynchronous AI Call)          ▼ (Transactional Data)
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│ RunPod Serverless GPU (RTX 4090)     │  │ FastAPI + Supabase DB        │
│ Qwen 2.5 7B Instruct (~550ms)        │  │ Relational PostgreSQL Tables │
│ • WhatsApp Quote Parser              │  │ • Orders, Suppliers, Logs    │
│ • Strategic Procurement Advice       │  └──────────────────────────────┘
└──────────────────┬───────────────────┘
                   │ 
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1-Click Human Approval Gate ──► PO Generation ──► MCP WhatsApp or email Dispatch│
└────────────────────────────────────────────────────────────────────────┘
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://supplywiseai.replit.app), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the environment variables listed in `.env.example`:
   - `RUNPOD_API_KEY`: `your_runpod_api_key_here`
   - `VITE_RUNPOD_ENABLED`: `true`
   - `VITE_RUNPOD_ENDPOINT_ID`: `s3yoz365sju59f`
   - `VITE_RUNPOD_MODEL`: `Qwen/Qwen2.5-7B-Instruct`
3. Click **Run**. Replit starts the Vite server, opening the interactive live preview automatically.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Jeesyuen/LetUsCook.git
cd LetUsCook

# 2. Install dependencies
npm install

# 3. Configure environment variables (Optional: enables live RunPod GPU advice)
cp .env.example .env.local
# Set RUNPOD_API_KEY=your_key and VITE_RUNPOD_ENABLED=true in .env.local

# 4. Start the development server
npm run dev
# The app is now running at http://localhost:5173
```

*(Optional Backend API)*:
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py                   # http://localhost:8000, docs at /docs
```

### Run Tests

All business logic, forecasting math, and RunPod client integrations are covered by automated unit tests:

```bash
npm test                         # Runs Vitest (84 passing tests)
```

---

## How We Use Replit

Replit served as our team’s central cloud development environment, live staging infrastructure, and rapid prototyping hub throughout the hackathon:

- **Hosting & Live Preview:** The prototype is hosted live via Replit Deployments, serving our full web application with sub-second page loads.

- **Secrets Management:** Sensitive keys (`RUNPOD_API_KEY`) are managed strictly inside Replit Secrets, ensuring zero secrets are committed to GitHub or bundled into the client bundle.

📄 Proof of use: [`submission/SDC2026_LetUsCook_Replit_POU.pdf`](submission/SDC2026_LetUsCook_Replit_POU.pdf)

## How We Use RunPod

RunPod provided the dedicated serverless GPU infrastructure required to run high-throughput LLM workloads without overloading client edge devices:

- **Workload:** We run `Qwen/Qwen2.5-7B-Instruct` on an **NVIDIA RTX 4090 GPU** to perform low-latency quotation extraction from unstructured  WhatsApp texts and generate plain-language Explainable AI advice for the procurement advisor.
- **Setup:** Deployed as a dedicated **RunPod Serverless Endpoint** (`s3yoz365sju59f`) using the official vLLM container worker.
- **Integration:** The application connects via the synchronous `/runsync` route through a Vite development proxy, achieving verified ~550ms inference latency.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/s3yoz365sju59f/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "Extract price and MOQ: Arabica Beans RM104/kg, min 10kg, delivery 2 days."}]}}'
```

📄 Proof of use: [`submission/SDC2026_LetUsCook_Runpod_POU.pdf`](submission/SDC2026_LetUsCook_Runpod_POU.pdf)

---

## Challenges & Learnings

- **Browser CORS vs. Serverless GPU APIs**: Direct browser calls to RunPod's API triggered cross-origin resource sharing (CORS) blocks. We resolved this by engineering a secure Vite development reverse proxy (`/api/runpod` ➔ `https://api.runpod.ai`) that attaches the secret authorization token on the fly without leaking it to the client bundle.
- **Unstructured Multilingual Chat Parsing**: Malaysian wholesale communication frequently mixes English, Bahasa Malaysia, and colloquial terms (e.g., *"Ambil 10kg dapat RM104"*). Selecting `Qwen 2.5 7B` allowed high extraction accuracy across multilingual WhatsApp formats compared to standard English-only small language models.

## Future Improvements

- **AI Price Trend Intelligence** — Analyze historical supplier quotations to detect seasonal price fluctuations and recommend whether to forward-buy or delay reordering.
- **Supplier Reliability Intelligence** — Score suppliers based on delivery punctuality, quotation accuracy, and fulfillment records to prevent low-reliability suppliers from winning bids.
- **Intelligent Order Consolidation** — Batch compatible ingredient orders across neighboring restaurants in the Orbyte ecosystem to satisfy supplier MOQs and unlock tier discounts.

## Team

| Name                 | Role                                   | GitHub                                         |
| -------------------- | -------------------------------------- | ---------------------------------------------- |
| **Chew Jee Syuen**   | Team Lead / AI Matching & Scoring      | [@Jeesyuen](https://github.com/Jeesyuen)       |
| **Lim Jie Xin**      | Cost Engine & Proximity Modeling| [@jiexin2006](https://github.com/jiexin2006)   |
| **Janice Lim Pei Yin**| UI/UX Design & PO Generator            | [@janicelpy](https://github.com/janicelpy)     |
| **Ng Jin Ru**        | Inventory Forecasting & Depletion Logic| [@JinRu1121](https://github.com/JinRu1121)     |
| **Lim Yi-En**        | Backend Architecture & Supabase DB     | [@limyien-0819](https://github.com/limyien-0819)|

---

## Submission Checklist

- [x] Team name, domain (Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/` (`SDC2026_LetUsCook_Replit_POU.pdf`)
- [x] RunPod used, with proof of use in `submission/` (`SDC2026_LetUsCook_Runpod_POU.pdf`)
- [x] Preliminary submission completed (`SDC2026_LetUsCook_Preliminary.pdf`)
- [x] Technology declaration completed (`SDC2026_LetUsCook_TechDeclaration.pdf`)
- [x] Submission files renamed with your team name (`LetUsCook`)
- [x] "How to Run" steps verified with 84/84 passing tests
- [x] No API keys or secrets committed to the repository (verified in `.gitignore`)

## License

This project is licensed under the [Apache License 2.0](LICENSE).
