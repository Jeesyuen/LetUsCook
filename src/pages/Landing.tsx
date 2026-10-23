import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Boxes, ChartLine, Check, ClipboardCheck, FileClock, GitCompareArrows, LayoutDashboard, Menu, MessageCircle, PackageCheck, Scale, Send, ShieldCheck, ShoppingCart, Sparkles, Truck, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { HeroSculpture } from '@/components/landing/HeroSculpture'
import { ProductThumb, StockStatusBadge, SupplierLogo } from '@/components/common'
import { ForecastChart } from '@/components/charts/ForecastChart'
import { useForecasts, useOpenPOsFor, useRiskRanking } from '@/hooks/useDerived'
import { buildForecastSeries } from '@/services/forecasting'
import { buildQuotations, scoreQuotations, weightsFor } from '@/services/scoring'
import { defaultSettings } from '@/data/mockData'
import { useAppStore } from '@/store/useAppStore'
import { cn, formatQty, formatRM, formatRM0 } from '@/utils/format'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

function Nav() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links = [
    ['About', '#about'],
    ['Features', '#features'],
    ['How It Works', '#how'],
    ['Benefits', '#benefits'],
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[#f0f1ff]/75 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="SupplyWise AI home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-9 md:flex">
          {links.map(([l, h]) => (
            <a key={l} href={h} className="text-[14.5px] font-medium text-[#4d5470] transition hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/app')} className="hidden h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white transition hover:bg-[#23274a] sm:inline-flex">
            Launch Dashboard <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-ink md:hidden" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-white px-5 py-4 md:hidden">
          {links.map(([l, h]) => (
            <a key={l} href={h} onClick={() => setOpen(false)} className="block py-2.5 text-[15px] font-medium text-ink">
              {l}
            </a>
          ))}
          <button onClick={() => navigate('/app')} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-white">
            Launch Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  )
}

function Hero() {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f0f1ff] via-[#f0f1ff] to-[#f7f8ff]">
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pt-12 pb-24 sm:px-8 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[1.05fr_1fr] lg:pt-6 lg:pb-28">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#cfd7ff] bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[#2a3591] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-violet" />
            AI-Powered Procurement for Malaysian SMEs
          </span>
          <h1 className="mt-6 text-[48px] leading-[1.02] font-bold tracking-[-0.035em] text-ink sm:text-[64px] xl:text-[76px]">
            Never Run Out.
            <br />
            <span className="text-gradient">Never Overpay.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-[#4d5470] sm:text-[18px]">
            Predict inventory shortages before they happen, compare suppliers intelligently, and automate procurement — all from one powerful workspace.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <button onClick={() => navigate('/app')} className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-deep px-7 text-[15px] font-semibold text-white shadow-[0_12px_28px_-10px_rgba(21,29,164,0.7)] transition hover:-translate-y-0.5 hover:bg-[#10178a]">
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#features" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              Explore Features <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13.5px] text-muted">
            {['Built for cafés & F&B SMEs', 'Prices in RM', 'Manager approval on every PO'].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}>
          <HeroSculpture />
        </motion.div>
      </div>
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[1100px] max-w-[160%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(65,105,255,0.28),rgba(155,92,255,0.12)_45%,transparent_70%)] blur-2xl" />
    </section>
  )
}

function About() {
  const items = [
    { icon: ChartLine, title: 'Forecast from your own usage', text: 'Daily consumption from your POS drives stock-out dates and reorder points.' },
    { icon: MessageCircle, title: 'Works the way suppliers do', text: 'Send POs by email or WhatsApp — the channels Malaysian suppliers already use.' },
    { icon: ShieldCheck, title: 'You stay in control', text: 'AI recommends; managers approve. Nothing is purchased without a decision.' },
  ]
  return (
    <section id="about" className="scroll-mt-20 bg-page py-20">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <motion.div {...fadeUp} className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <div>
            <p className="text-[14px] font-semibold text-primary">About SupplyWise AI</p>
            <h2 className="mt-3 text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-ink sm:text-[42px]">Inventory forecasting meets supplier procurement.</h2>
          </div>
          <p className="text-[17px] leading-relaxed text-muted">
            Most SMEs track stock in one place and buy from suppliers in another. SupplyWise connects the two: it predicts what you'll run out of, finds the best supplier for the job, and turns an approved decision into a purchase order — with every step on record.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div key={it.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="rounded-[20px] border border-line bg-white p-6">
              <it.icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
              <h3 className="mt-4 text-[17px] font-semibold text-ink">{it.title}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{it.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ title, text, children, i }: { title: string; text: string; children: ReactNode; i: number }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="group flex flex-col overflow-hidden rounded-[24px] border border-line bg-[#fafbff] transition-shadow duration-300 hover:shadow-lift">
      <div className="relative h-[260px] overflow-hidden border-b border-line bg-gradient-to-b from-[#f2f4ff] to-white p-6">{children}</div>
      <div className="p-7">
        <h3 className="text-[21px] font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
      </div>
    </motion.div>
  )
}

function MiniForecast() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">Arabica Coffee Beans</span>
        <span className="rounded-full bg-critical-soft px-2 py-0.5 text-[11px] font-medium text-[#c23f48]">3 days left</span>
      </div>
      <svg viewBox="0 0 300 130" className="mt-3 w-full flex-1">
        <defs>
          <linearGradient id="mf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3154DF" stopOpacity="0.2" />
            <stop offset="1" stopColor="#3154DF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="96" x2="300" y2="96" stroke="#E5A23B" strokeDasharray="5 4" strokeWidth="1.5" />
        <path d="M0 40 L30 50 L60 60 L90 72 L105 30 L135 42 L165 55 L190 78" fill="none" stroke="#3154DF" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M0 40 L30 50 L60 60 L90 72 L105 30 L135 42 L165 55 L190 78 L190 130 L0 130Z" fill="url(#mf)" />
        <path d="M190 78 L230 100 L270 122" fill="none" stroke="#9B5CFF" strokeWidth="2.5" strokeDasharray="6 5" />
        <circle cx="190" cy="78" r="5" fill="#fff" stroke="#3154DF" strokeWidth="2.5" />
        <text x="196" y="70" fontSize="11" fill="#11142d" fontWeight="600">
          Today
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-primary" /> Stock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-violet" /> Forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-warning" /> Safety
        </span>
      </div>
    </div>
  )
}

function MiniCompare() {
  const ranked = useMemo(() => scoreQuotations(buildQuotations('p-coffee', 100), weightsFor('balanced', defaultSettings.balancedWeights)), [])
  return (
    <div className="space-y-2.5">
      {ranked.map((r) => (
        <div key={r.supplier.id} className={cn('flex items-center gap-3 rounded-xl border bg-white p-3', r.rank === 1 ? 'border-primary/40 shadow-[0_0_0_3px_rgba(49,84,223,0.08)]' : 'border-line')}>
          <SupplierLogo supplier={r.supplier} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ink">{r.supplier.name}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0f7]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet" style={{ width: `${r.score}%` }} />
            </div>
          </div>
          <span className={cn('text-[14px] font-semibold tabular', r.rank === 1 ? 'text-primary' : 'text-ink')}>{Math.round(r.score)}%</span>
        </div>
      ))}
    </div>
  )
}

function MiniApproval() {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <ProductThumb product={{ icon: 'coffee', name: 'Coffee' }} size="sm" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-ink">Arabica Coffee Beans · 100 kg</div>
            <div className="text-[12px] text-muted">BeanCraft Wholesale · {formatRM(1950)}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex h-8 flex-1 items-center justify-center rounded-lg border border-line text-[12px] font-medium text-[#c23f48]">Reject</span>
          <span className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-success text-[12px] font-medium text-white">
            <Check className="h-3.5 w-3.5" /> Approve
          </span>
        </div>
      </div>
      <div className="ml-6 flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-card">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lavender text-primary">
          <Send className="h-3.5 w-3.5" />
        </span>
        <span className="text-[12.5px] text-ink">
          <span className="font-semibold">PO-2026-0142</span> sent via WhatsApp
        </span>
        <span className="ml-auto rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-[#17794f]">Confirmed</span>
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-[720px] text-center">
          <h2 className="text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-ink sm:text-[52px]">Smarter Procurement. Less Busywork.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">Everything your business needs to stay stocked, source smarter, and purchase with confidence.</p>
        </motion.div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <FeatureCard i={0} title="Predict Before You Run Out" text="Know which products need replenishment before stock shortages disrupt your business.">
            <MiniForecast />
          </FeatureCard>
          <FeatureCard i={1} title="Find the Right Supplier" text="Compare quotations, delivery times, reliability, and quality in one intelligent workspace.">
            <MiniCompare />
          </FeatureCard>
          <FeatureCard i={2} title="Approve. Order. Done." text="Turn recommendations into approved purchase orders and track supplier confirmations.">
            <MiniApproval />
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

function DashboardPreview() {
  const navigate = useNavigate()
  const all = useForecasts()
  const ranking = useRiskRanking()
  const pending = useAppStore((s) => s.approvals.filter((a) => a.status === 'Pending').length)
  const top = ranking[0]
  const openPOs = useOpenPOsFor(top?.product.id)
  const series = useMemo(() => (top ? buildForecastSeries(top.product, top.forecast, openPOs) : null), [top, openPOs])
  const value = all.reduce((s, x) => s + x.product.currentStock * x.product.unitCost, 0)
  const side = [LayoutDashboard, Boxes, ChartLine, Truck, GitCompareArrows, Sparkles, ClipboardCheck, ShoppingCart]

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f0f1ff] py-24">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-[680px] text-center">
          <h2 className="text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-ink sm:text-[52px]">Everything Under Control.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">One workspace for stock levels, forecasts, supplier quotes, approvals and purchase orders.</p>
        </motion.div>
        <motion.div {...fadeUp} className="relative mt-14">
          <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[48px] bg-[radial-gradient(ellipse_at_top,rgba(65,105,255,0.18),transparent_60%)]" />
          <div className="relative overflow-hidden rounded-[22px] border border-[#d9def0] bg-white shadow-[0_40px_100px_-30px_rgba(21,29,164,0.35)]">
            <div className="flex h-10 items-center gap-2 bg-ink px-4">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto hidden rounded-md bg-white/10 px-16 py-1 text-[11.5px] text-white/60 sm:block">app.supplywise.ai/overview</span>
            </div>
            <div className="flex">
              <div className="hidden w-[180px] shrink-0 border-r border-line p-4 md:block">
                <Logo className="scale-90 origin-left" />
                <div className="mt-6 space-y-1">
                  {side.map((Icon, i) => (
                    <div key={i} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2', i === 0 ? 'bg-lavender text-primary' : 'text-[#9aa1b5]')}>
                      <Icon className="h-4 w-4" />
                      <span className={cn('h-2 rounded-full', i === 0 ? 'w-16 bg-primary/40' : 'w-14 bg-[#e6e9f2]')} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1 bg-page p-5 sm:p-6">
                <div className="text-[20px] font-semibold tracking-tight text-ink">Good morning, Alex.</div>
                <div className="text-[13px] text-muted">Brew & Co. Café · Bangsar</div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['Inventory Items', all.length],
                    ['At-Risk Products', all.filter((x) => x.forecast.status !== 'Healthy').length],
                    ['Pending Approvals', pending],
                    ['Inventory Value', formatRM0(value)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-white p-3.5">
                      <div className="text-[11.5px] text-muted">{k}</div>
                      <div className="mt-1 text-[20px] font-semibold text-ink tabular">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="min-w-0 rounded-xl border border-line bg-white p-4">
                    <div className="text-[13px] font-semibold text-ink">Inventory Forecast · {top?.product.name}</div>
                    {series && top && <ForecastChart points={series.points} unit={top.product.unit} safety={top.forecast.safetyStock} replenishDay={series.replenishDay} replenishQty={series.replenishQty} replenishFromPO={series.replenishFromPO} height={200} />}
                  </div>
                  <div className="space-y-2.5">
                    {ranking.slice(0, 3).map((x) => (
                      <div key={x.product.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
                        <ProductThumb product={x.product} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-semibold text-ink">{x.product.name}</div>
                          <div className="text-[11.5px] text-muted">{formatQty(x.product.currentStock, x.product.unit)} · {x.forecast.daysRemaining} days</div>
                        </div>
                        <StockStatusBadge status={x.forecast.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="relative mt-8 text-center">
            <button onClick={() => navigate('/app')} className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary hover:underline">
              Open the live demo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { icon: ChartLine, title: 'Predict', text: 'Forecast stock-out dates from daily usage.' },
    { icon: GitCompareArrows, title: 'Compare', text: 'Score supplier quotes on cost, speed and reliability.' },
    { icon: ClipboardCheck, title: 'Approve', text: 'Managers approve, modify or reject in one click.' },
    { icon: Send, title: 'Order', text: 'Send the PO by email or WhatsApp and track replies.' },
    { icon: PackageCheck, title: 'Restock', text: 'Record delivery; inventory and forecasts update.' },
  ]
  return (
    <section id="how" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-[640px] text-center">
          <p className="text-[14px] font-semibold text-primary">How It Works</p>
          <h2 className="mt-3 text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-ink sm:text-[48px]">From forecast to fully stocked.</h2>
        </motion.div>
        <div className="relative mt-16 grid gap-8 md:grid-cols-5 md:gap-4">
          <div className="absolute top-7 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-primary/10 via-primary/40 to-violet/20 md:block" />
          {steps.map((s, i) => (
            <motion.div key={s.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="relative flex flex-col items-center text-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d6ddff] bg-white text-primary shadow-card">
                <s.icon className="h-6 w-6" strokeWidth={1.8} />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-[18px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 max-w-[200px] text-[14px] leading-relaxed text-muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Benefits() {
  const items = [
    { icon: Boxes, title: 'Fewer stockouts', text: 'See shortages days ahead, with the reorder date and quantity worked out for you.' },
    { icon: Scale, title: 'Better-value purchasing', text: 'Transparent compatibility scores weigh landed cost against delivery speed and reliability.' },
    { icon: FileClock, title: 'Faster decisions', text: 'Recommendations arrive ready to approve — no spreadsheets or chasing quotes.' },
    { icon: ShieldCheck, title: 'Full audit trail', text: 'Every recommendation, approval, message and delivery is logged with who and when.' },
  ]
  return (
    <section id="benefits" className="scroll-mt-20 bg-page py-24">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <motion.div {...fadeUp}>
          <p className="text-[14px] font-semibold text-primary">Why SupplyWise</p>
          <h2 className="mt-3 text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-ink sm:text-[48px]">Built for owners who wear every hat.</h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">SupplyWise does the counting, comparing and chasing — so you only make the decisions that matter.</p>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((it, i) => (
            <motion.div key={it.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="rounded-[20px] border border-line bg-white p-6 transition-shadow hover:shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender text-primary">
                <it.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold text-ink">{it.title}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{it.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const navigate = useNavigate()
  return (
    <section className="px-5 pb-20 sm:px-8">
      <motion.div {...fadeUp} className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] border border-[#dfe3ff] bg-gradient-to-br from-[#eef0ff] via-[#f3efff] to-[#e9edff] px-6 py-20 text-center">
        <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <h2 className="relative mx-auto max-w-[760px] text-[36px] leading-[1.08] font-bold tracking-[-0.03em] text-ink sm:text-[52px]">Make Every Purchase a Smarter Decision.</h2>
        <p className="relative mx-auto mt-5 max-w-[520px] text-[17px] text-muted">Predict Early. Source Smarter. Purchase with Confidence.</p>
        <button onClick={() => navigate('/app')} className="relative mt-9 inline-flex h-[52px] items-center gap-2 rounded-xl bg-deep px-7 text-[15px] font-semibold text-white shadow-[0_12px_28px_-10px_rgba(21,29,164,0.7)] transition hover:-translate-y-0.5 hover:bg-[#10178a]">
          Launch SupplyWise AI <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-8">
        <div>
          <Logo />
          <p className="mt-2 text-[13px] text-muted">Predict Early. Source Smarter. Purchase with Confidence.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-[13.5px] text-muted">
          <a href="#features" className="hover:text-ink">
            Features
          </a>
          <a href="#how" className="hover:text-ink">
            How It Works
          </a>
          <a href="#benefits" className="hover:text-ink">
            Benefits
          </a>
          <Link to="/app" className="hover:text-ink">
            Dashboard
          </Link>
        </div>
        <p className="w-full text-[12.5px] text-[#9aa1b5]">Hackathon prototype for the Alpha Red Solutions — Orbyte Smart SME Challenge. All businesses, suppliers and data shown are fictional.</p>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-page">
      <Nav />
      <Hero />
      <About />
      <Features />
      <DashboardPreview />
      <HowItWorks />
      <Benefits />
      <FinalCTA />
      <Footer />
    </div>
  )
}
