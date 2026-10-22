import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  FileCheck2,
  FileText,
  Mail,
  MessageCircle,
  PackageCheck,
  Printer,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import {
  initialAutomationAudit,
  initialAutomationWorkflow,
  supplierResponseDetails,
  type AutomationAuditEntry,
  type AutomationWorkflowData,
  type DispatchChannel,
  type SupplierResponse,
} from '@/data/automationData'
import { cn } from '@/utils/format'

const approvalTone = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'critical',
} as const

const documentTone = {
  'Awaiting approval': 'warning',
  Generated: 'success',
  'Not generated': 'neutral',
} as const

const dispatchTone = {
  'Not sent': 'neutral',
  'Awaiting response': 'primary',
  Accepted: 'success',
  Rejected: 'critical',
  'Changed terms': 'warning',
} as const

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function parseCurrency(value: string) {
  return Number.parseFloat(value.replace(/[^\d.-]/g, ''))
}

export default function AutomationWorkflow() {
  const [workflow, setWorkflow] = useState<AutomationWorkflowData>(initialAutomationWorkflow)
  const [audit, setAudit] = useState<AutomationAuditEntry[]>(initialAutomationAudit)
  const [highlightedAuditId, setHighlightedAuditId] = useState<string | null>(null)
  const latestAuditRef = useRef<HTMLLIElement>(null)
  const previousAuditCountRef = useRef(initialAutomationAudit.length)
  const highlightTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (audit.length > previousAuditCountRef.current) {
      latestAuditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    previousAuditCountRef.current = audit.length
  }, [audit.length])

  useEffect(() => {
    if (!highlightedAuditId) return
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedAuditId(null), 1600)
    return () => {
      if (highlightTimeoutRef.current !== null) window.clearTimeout(highlightTimeoutRef.current)
    }
  }, [highlightedAuditId])

  const record = (actor: string, event: string, detail: string, tone: AutomationAuditEntry['tone'] = 'neutral') => {
    const entry: AutomationAuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor,
      event,
      detail,
      tone,
    }
    setAudit((entries) => [entry, ...entries])
    setHighlightedAuditId(entry.id)
  }

  const approve = () => {
    setWorkflow((current) => ({
      ...current,
      approvalStatus: 'Approved',
      documentStatus: 'Generated',
    }))
    record(`${workflow.managerName} · Manager`, 'Purchase request approved', `${workflow.requestId} approved.`, 'success')
    record('Workflow engine', 'PO document generated', `${workflow.poNumber}.pdf generated and ready to send.`, 'success')
  }

  const reject = () => {
    setWorkflow((current) => ({
      ...current,
      approvalStatus: 'Rejected',
      documentStatus: 'Not generated',
    }))
    record(`${workflow.managerName} · Manager`, 'Purchase request rejected', `${workflow.requestId} was rejected. No purchase order document was generated.`, 'critical')
  }

  const dispatch = (channel: DispatchChannel) => {
    setWorkflow((current) => ({
      ...current,
      dispatchStatus: 'Awaiting response',
      channel,
      response: null,
    }))
    record(
      'MCP dispatch simulator',
      `PO dispatched via ${channel}`,
      `${workflow.poNumber}.pdf queued for ${workflow.supplierContact} at ${channel === 'WhatsApp' ? workflow.whatsapp : workflow.email}. Simulation only; nothing was sent.`,
      'success',
    )
  }

  const simulateResponse = (response: SupplierResponse) => {
    const details = supplierResponseDetails[response]
    const status = response === 'accept' ? 'Accepted' : response === 'reject' ? 'Rejected' : 'Changed terms'
    setWorkflow((current) => ({ ...current, response, dispatchStatus: status }))
    record(workflow.supplier, details.label, details.message, response === 'accept' ? 'success' : response === 'reject' ? 'critical' : 'warning')
  }

  const resolveRevisedTerms = (accepted: boolean) => {
    setWorkflow((current) => ({
      ...current,
      response: accepted ? 'accept' : 'reject',
      dispatchStatus: accepted ? 'Accepted' : 'Rejected',
      ...(accepted && {
        total: current.revisedTotal,
        expectedDelivery: current.revisedDelivery,
        unitPrice: parseCurrency(current.revisedTotal) / Number.parseFloat(current.quantity),
      }),
    }))
    record(
      `${workflow.managerName} · Manager`,
      accepted ? 'Revised terms accepted' : 'Revised terms declined',
      accepted
        ? `Approved the revised total of ${workflow.revisedTotal} and delivery date of ${workflow.revisedDelivery}.`
        : 'Declined the supplier’s revised terms. The order will not proceed.',
      accepted ? 'success' : 'critical',
    )
  }

  const canDispatch = workflow.approvalStatus === 'Approved' && workflow.documentStatus === 'Generated' && workflow.dispatchStatus === 'Not sent'
  const canReceiveResponse = workflow.dispatchStatus === 'Awaiting response'
  const isAwaitingApproval = workflow.approvalStatus === 'Pending'
  const isChangedTerms = workflow.dispatchStatus === 'Changed terms'

  const printPurchaseOrder = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Could not open the purchase order', { description: 'Allow pop-ups for this site, then try again.' })
      return
    }

    const unit = workflow.quantity.replace(/^[\d,.]+\s*/, '')
    const unitPrice = Number.isFinite(workflow.unitPrice)
      ? `RM ${workflow.unitPrice.toFixed(2)}${unit ? ` / ${escapeHtml(unit)}` : ''}`
      : '—'
    const date = new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
    const poNumber = escapeHtml(workflow.poNumber)
    const supplier = escapeHtml(workflow.supplier)
    const product = escapeHtml(workflow.product)
    const formattedQuantity = escapeHtml(workflow.quantity)
    const paymentTerms = escapeHtml(workflow.paymentTerms)
    const totalAmount = escapeHtml(workflow.total)
    const managerName = escapeHtml(workflow.managerName)
    const approvalStatus = escapeHtml(workflow.approvalStatus)
    const approvalSignature = workflow.approvalStatus === 'Approved'
      ? `<strong>${managerName}</strong><span>Approved by · Manager</span>`
      : `<strong>${approvalStatus}</strong><span>${managerName} · Manager</span>`

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${poNumber}.pdf</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 48px 24px; color: #20243a; font: 14px/1.5 Arial, Helvetica, sans-serif; }
            .document { max-width: 820px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 28px; border-bottom: 3px solid #3154df; }
            .brand { margin: 0; color: #151da4; font-size: 15px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            .business { margin: 5px 0 0; color: #11142d; font-size: 24px; font-weight: 700; }
            .po-title { margin: 0; color: #11142d; font-size: 25px; text-align: right; }
            .po-number { margin: 5px 0 0; color: #737b92; text-align: right; }
            h2 { margin: 30px 0 14px; color: #11142d; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; }
            .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 30px; padding: 20px; border: 1px solid #e6e9f2; border-radius: 8px; }
            .label { display: block; margin-bottom: 3px; color: #737b92; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
            .value { color: #11142d; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { padding: 12px 10px; background: #f3f5fb; color: #555d74; font-size: 11px; text-align: left; text-transform: uppercase; letter-spacing: .04em; }
            td { padding: 16px 10px; border-bottom: 1px solid #e6e9f2; }
            .numeric { text-align: right; white-space: nowrap; }
            .total-row td { border: 0; font-size: 15px; font-weight: 700; }
            .total-row td:last-child { color: #151da4; }
            .signature { width: 280px; margin: 72px 0 0 auto; padding-top: 10px; border-top: 1px solid #8790a8; }
            .signature strong { display: block; color: #11142d; }
            .signature span { color: #737b92; font-size: 12px; }
            .footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #e6e9f2; color: #737b92; font-size: 11px; text-align: center; }
            @media print { body { padding: 0; } .document { max-width: none; } }
            @media (max-width: 560px) { body { padding: 24px 16px; } .header { flex-direction: column; } .po-title, .po-number { text-align: left; } .details { grid-template-columns: 1fr; } }
          </style>
        </head>
        <body>
          <main class="document">
            <header class="header">
              <div><p class="brand">SupplyWise AI</p><p class="business">Brew &amp; Co. Café</p></div>
              <div><h1 class="po-title">Purchase Order</h1><p class="po-number">${poNumber}</p></div>
            </header>
            <section>
              <h2>Purchase Order Details</h2>
              <div class="details">
                <div><span class="label">PO Number</span><span class="value">${poNumber}</span></div>
                <div><span class="label">Date</span><span class="value">${date}</span></div>
                <div><span class="label">Supplier</span><span class="value">${supplier}</span></div>
                <div><span class="label">Terms</span><span class="value">${paymentTerms}</span></div>
              </div>
            </section>
            <section>
              <h2>Items</h2>
              <table>
                <thead><tr><th>Description</th><th class="numeric">Quantity</th><th class="numeric">Unit Price</th><th class="numeric">Total</th></tr></thead>
                <tbody>
                  <tr><td>${product}</td><td class="numeric">${formattedQuantity}</td><td class="numeric">${unitPrice}</td><td class="numeric">${totalAmount}</td></tr>
                  <tr class="total-row"><td colspan="3" class="numeric">Total Amount</td><td class="numeric">${totalAmount}</td></tr>
                </tbody>
              </table>
            </section>
            <section class="signature"><h2>Manager Approval Signature</h2>${approvalSignature}</section>
            <footer class="footer">Generated by SupplyWise AI · ${poNumber}</footer>
          </main>
        </body>
      </html>`)
    printWindow.document.close()
    printWindow.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 250)
  }

  return (
    <div>
      <PageHeader
        title="Automation Workflow"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-[12.5px] text-muted">Manager approval</div>
          <div className="mt-2"><Badge tone={approvalTone[workflow.approvalStatus]} dot>{workflow.approvalStatus}</Badge></div>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-[12.5px] text-muted">PO document</div>
          <div className="mt-2"><Badge tone={documentTone[workflow.documentStatus]} dot>{workflow.documentStatus}</Badge></div>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-[12.5px] text-muted">Supplier response</div>
          <div className="mt-2"><Badge tone={dispatchTone[workflow.dispatchStatus]} dot>{workflow.dispatchStatus}</Badge></div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Manager approval</span>}
              subtitle={`Request ${workflow.requestId} · submitted by ${workflow.requester}`}
              action={<Badge tone={approvalTone[workflow.approvalStatus]}>{workflow.approvalStatus}</Badge>}
            />
            <div className="grid gap-4 px-5 pb-5 pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
              <div className="rounded-xl border border-line bg-[#fbfbfe] p-4">
                <div className="font-semibold text-ink">{workflow.product}</div>
                <div className="mt-1 text-[13px] text-muted">{workflow.quantity} · {workflow.total} · {workflow.supplier}</div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
                  <span>Delivery: {workflow.expectedDelivery}</span>
                  <span>Terms: {workflow.paymentTerms}</span>
                </div>
              </div>
              {isAwaitingApproval ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" onClick={reject}><X className="h-4 w-4" /> Reject</Button>
                  <Button variant="success" onClick={approve}><Check className="h-4 w-4" /> Approve</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  {workflow.approvalStatus === 'Approved' ? <CheckCheck className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-critical" />}
                  {workflow.approvalStatus === 'Approved' ? `Approved by ${workflow.managerName}` : 'Request closed'}
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> PO document generation</span>}
              subtitle="Approval creates a purchase order PDF for supplier dispatch."
              action={<Badge tone={documentTone[workflow.documentStatus]}>{workflow.documentStatus}</Badge>}
            />
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', workflow.documentStatus === 'Generated' ? 'bg-success-soft text-success' : 'bg-subtle text-muted')}>
                  {workflow.documentStatus === 'Generated' ? <FileCheck2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{workflow.poNumber}.pdf</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workflow.documentStatus !== 'Generated'}
                      onClick={printPurchaseOrder}
                    >
                      <Printer className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {workflow.documentStatus === 'Generated'
                      ? 'Generated from the approved request · 1 page · ready to attach'
                      : workflow.documentStatus === 'Not generated'
                        ? 'Request rejected · no document was created'
                        : 'Document generation starts after manager approval'}
                  </p>
                </div>
                {workflow.documentStatus === 'Generated' && <Badge tone="success"><Check className="h-3 w-3" /> Ready</Badge>}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={<span className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Supplier dispatch &amp; response</span>}
              subtitle="MCP-style tool simulation · all channel activity stays in this demo."
              action={<Badge tone="neutral">No live integrations</Badge>}
            />
            <div className="space-y-4 px-5 pb-5 pt-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavender text-[12px] font-semibold text-primary">BC</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{workflow.supplier}</div>
                    <div className="text-[12px] text-muted">{workflow.supplierContact} · {workflow.email}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!canDispatch} onClick={() => dispatch('WhatsApp')}><MessageCircle className="h-4 w-4 text-[#25a56a]" /> WhatsApp</Button>
                  <Button size="sm" variant="outline" disabled={!canDispatch} onClick={() => dispatch('Email')}><Mail className="h-4 w-4 text-primary" /> Email</Button>
                </div>
              </div>

              {workflow.channel && (
                <div className="flex items-start gap-3 rounded-xl bg-lavender/60 p-3.5 text-[13px]">
                  <Send className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="font-medium text-ink">{workflow.poNumber}.pdf dispatched via {workflow.channel}</div>
                    <div className="mt-0.5 text-muted">Simulated MCP tool call · no message was actually delivered.</div>
                  </div>
                </div>
              )}

              {canReceiveResponse ? (
                <div className="rounded-xl border border-dashed border-[#cfd5e6] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-ink"><PackageCheck className="h-4 w-4 text-primary" /> Simulate supplier reply</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="success" onClick={() => simulateResponse('accept')}><Check className="h-4 w-4" /> Accept order</Button>
                    <Button size="sm" variant="danger" onClick={() => simulateResponse('reject')}><X className="h-4 w-4" /> Reject order</Button>
                    <Button size="sm" variant="outline" onClick={() => simulateResponse('changed-terms')}><ArrowRight className="h-4 w-4" /> Send changed terms</Button>
                  </div>
                </div>
              ) : workflow.approvalStatus === 'Rejected' ? (
                <p className="flex items-center gap-2 text-[12.5px] text-muted"><X className="h-4 w-4" /> Request rejected · there is no purchase order to dispatch.</p>
              ) : workflow.dispatchStatus === 'Not sent' ? (
                <p className="flex items-center gap-2 text-[12.5px] text-muted"><Clock3 className="h-4 w-4" /> Approve the request to generate the PO and enable dispatch.</p>
              ) : isChangedTerms ? (
                <div className="rounded-xl border border-[#f6e1b9] bg-warning-soft/50 p-4">
                  <div className="flex items-start gap-2">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />
                    <div>
                      <div className="text-[13px] font-semibold text-ink">Supplier proposed changed terms</div>
                      <p className="mt-1 text-[12.5px] text-muted">Total: {workflow.revisedTotal} · Delivery: {workflow.revisedDelivery}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="success" onClick={() => resolveRevisedTerms(true)}><Check className="h-4 w-4" /> Accept revised terms</Button>
                    <Button size="sm" variant="outline" onClick={() => resolveRevisedTerms(false)}><X className="h-4 w-4" /> Decline terms</Button>
                  </div>
                </div>
              ) : (
                <div className={cn('flex items-start gap-3 rounded-xl p-3.5 text-[13px]', workflow.dispatchStatus === 'Accepted' ? 'bg-success-soft' : 'bg-critical-soft')}>
                  {workflow.dispatchStatus === 'Accepted' ? <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-critical" />}
                  <div>
                    <div className="font-medium text-ink">{workflow.dispatchStatus === 'Accepted' ? 'Supplier confirmed the order' : 'Supplier declined the order'}</div>
                    <div className="mt-0.5 text-muted">{workflow.dispatchStatus === 'Accepted' ? 'The PO is confirmed at the agreed terms.' : 'The order is closed. Review another supplier before proceeding.'}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Activity audit log</span>}
            subtitle="Timestamped record of workflow and integration events."
            action={<Badge tone="neutral">{audit.length} events</Badge>}
          />
          <ol className="space-y-0 px-5 pb-5 pt-2 sm:px-6">
            {audit.map((entry, index) => (
              <li
                key={entry.id}
                ref={index === 0 ? latestAuditRef : null}
                className={cn(
                  'relative flex gap-3 rounded-xl pb-5 transition-all duration-500 last:pb-0',
                  highlightedAuditId === entry.id && 'bg-lavender/70 px-2 py-2 ring-1 ring-primary/30',
                )}
              >
                {index < audit.length - 1 && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
                <span className={cn(
                  'relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full',
                  entry.tone === 'success' ? 'bg-success-soft text-success' : entry.tone === 'warning' ? 'bg-warning-soft text-warning-ink' : entry.tone === 'critical' ? 'bg-critical-soft text-critical' : 'bg-subtle text-muted',
                )}>
                  {entry.actor.includes('Manager') ? <UserRound className="h-3.5 w-3.5" /> : entry.actor.includes('simulator') ? <Send className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-semibold text-ink">{entry.event}</span>
                    <time className="text-[11.5px] text-muted">{entry.time}</time>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{entry.detail}</p>
                  <div className="mt-1 text-[11px] font-medium text-[#8a91a8]">{entry.actor}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}
