import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Mail, MessageCircle, Paperclip, Send } from 'lucide-react'
import { Modal } from './ui/Overlay'
import { Button } from './ui/Button'
import { DemoTag } from './ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { composePOMessage, type Channel } from '@/services/communication'
import { getSupplier } from '@/services/scoring'
import type { PurchaseOrder } from '@/types'
import { formatTime } from '@/utils/date'
import { cn, formatRM } from '@/utils/format'

export function CommunicationPreviewModal({ po, channel, onClose }: { po: PurchaseOrder | null; channel: Channel | null; onClose: () => void }) {
  const products = useAppStore((s) => s.products)
  const business = useAppStore((s) => s.business)
  const user = useAppStore((s) => s.user)
  const send = useAppStore((s) => s.sendPO)
  const [sending, setSending] = useState(false)
  if (!po || !channel) return null
  const supplier = getSupplier(po.supplierId)
  const product = products.find((p) => p.id === po.productId)!
  const msg = composePOMessage(channel, po, supplier, product, business, user)
  const wa = channel === 'whatsapp'

  const confirm = async () => {
    setSending(true)
    await new Promise((r) => setTimeout(r, 900))
    send(po.id, channel)
    setSending(false)
    toast.success(`${po.number} sent via ${wa ? 'WhatsApp' : 'Email'} (simulated)`, { description: 'No real message was delivered. Status will move to Awaiting Confirmation.' })
    onClose()
  }

  return (
    <Modal
      open={!!po && !!channel}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex flex-wrap items-center gap-2.5">
          Send via {wa ? 'WhatsApp' : 'Email'} <DemoTag />
        </span>
      }
      description="Preview the message before sending. Nothing leaves this prototype."
      icon={wa ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
      footer={
        <>
          <span className="mr-auto text-[12px] text-muted">Live sending can be enabled later via Email, WhatsApp Business API or MCP.</span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={sending}>
            <Send className="h-4 w-4" /> Confirm Send
          </Button>
        </>
      }
    >
      <dl className="mb-4 grid gap-3 text-[13px] sm:grid-cols-2">
        <div className="rounded-xl bg-subtle px-3.5 py-2.5">
          <dt className="text-muted">Recipient</dt>
          <dd className="font-medium text-ink">
            {supplier.contactName}, {supplier.name}
          </dd>
          <dd className="text-muted">{msg.to}</dd>
        </div>
        <div className="rounded-xl bg-subtle px-3.5 py-2.5">
          <dt className="text-muted">Channel</dt>
          <dd className="font-medium text-ink">{wa ? 'WhatsApp Business (simulated)' : 'Email (simulated)'}</dd>
          {msg.subject && <dd className="truncate text-muted">Subject: {msg.subject}</dd>}
        </div>
      </dl>

      {wa ? (
        <div className="rounded-2xl bg-[#efeae2] p-4" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] shadow-sm">
            {msg.body.replace(/\*/g, '')}
            <div className="mt-1 text-right text-[11px] text-[#667781]">{formatTime(new Date())} ✓</div>
          </div>
          <div className="mt-2 ml-auto flex max-w-[88%] items-center gap-3 rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3.5 py-2.5 shadow-sm">
            <FileText className="h-8 w-8 text-[#c23f48]" />
            <div className="text-[12.5px]">
              <div className="font-medium text-[#111b21]">{po.number}.pdf</div>
              <div className="text-[#667781]">1 page · PDF</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="border-b border-line bg-[#fafbfe] px-4 py-2.5 text-[12.5px] text-muted">
            <div>
              <span className="text-ink">From:</span> {user.email}
            </div>
            <div>
              <span className="text-ink">To:</span> {msg.to}
            </div>
            <div>
              <span className="text-ink">Subject:</span> {msg.subject}
            </div>
          </div>
          <pre className="max-h-[260px] overflow-y-auto px-4 py-3 font-sans text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink scrollbar-thin">{msg.body}</pre>
        </div>
      )}

      <div className={cn('mt-4 rounded-2xl border border-line p-4', !wa && 'bg-white')}>
        <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-ink">
          <Paperclip className="h-4 w-4 text-muted" /> Attachment preview — {po.number}.pdf
        </div>
        <div className="rounded-xl border border-dashed border-[#d3d9ea] bg-[#fcfcff] p-4 text-[12.5px]">
          <div className="flex justify-between">
            <div>
              <div className="text-[15px] font-semibold text-ink">PURCHASE ORDER</div>
              <div className="text-muted">{po.number}</div>
            </div>
            <div className="text-right text-muted">
              <div className="font-semibold text-ink">{business.name}</div>
              <div>{business.city}</div>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-2">
            <span>
              {product.name} × {po.quantity} {product.unit}
            </span>
            <span className="tabular">{formatRM(po.unitPrice * po.quantity)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Delivery</span>
            <span className="tabular">{formatRM(po.deliveryFee)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold text-ink">
            <span>Total</span>
            <span className="tabular">{formatRM(po.total)}</span>
          </div>
          <div className="mt-2 text-muted">Approved by {po.approvedBy} · {po.paymentTerms}</div>
        </div>
      </div>
    </Modal>
  )
}
