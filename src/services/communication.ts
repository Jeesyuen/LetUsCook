// Message templates for supplier communication.
// In the prototype nothing is sent: the store records a simulated message. A real implementation
// would hand these payloads to an email provider, the WhatsApp Business API or an MCP server.

import type { Business, Product, ProposedChanges, PurchaseOrder, Supplier, User } from '@/types'
import { formatDate } from '@/utils/date'
import { formatQty, formatRM, round } from '@/utils/format'

export type Channel = 'email' | 'whatsapp'

export interface OutboundMessage {
  channel: Channel
  to: string
  subject?: string
  body: string
}

export function composePOMessage(channel: Channel, po: PurchaseOrder, supplier: Supplier, product: Product, business: Business, user: User): OutboundMessage {
  const first = supplier.contactName.split(' ')[0]
  if (channel === 'whatsapp') {
    return {
      channel,
      to: supplier.whatsapp,
      body:
        `Hi ${first}, this is ${user.name.split(' ')[0]} from ${business.name}.\n\n` +
        `📦 *${po.number}*\n` +
        `${product.name}: ${formatQty(po.quantity, product.unit)} @ ${formatRM(po.unitPrice)}/${product.unit}\n` +
        `Delivery fee: ${formatRM(po.deliveryFee)}\n` +
        `*Total: ${formatRM(po.total)}*\n` +
        `Requested delivery: ${formatDate(po.expectedDelivery)}\n` +
        `Payment: ${po.paymentTerms}\n\n` +
        `Please reply to confirm, or let us know if anything needs to change. Thank you!`,
    }
  }
  return {
    channel,
    to: supplier.email,
    subject: `Purchase Order ${po.number} — ${business.name}`,
    body:
      `Dear ${supplier.contactName},\n\n` +
      `Please find below our purchase order ${po.number}.\n\n` +
      `Item: ${product.name} (${product.sku})\n` +
      `Quantity: ${formatQty(po.quantity, product.unit)}\n` +
      `Unit price: ${formatRM(po.unitPrice)}\n` +
      `Delivery fee: ${formatRM(po.deliveryFee)}\n` +
      `Total: ${formatRM(po.total)}\n\n` +
      `Requested delivery date: ${formatDate(po.expectedDelivery)}\n` +
      `Delivery address: ${business.address}, ${business.city}\n` +
      `Payment terms: ${po.paymentTerms}\n\n` +
      `Kindly confirm acceptance of this order at your earliest convenience.\n\n` +
      `Best regards,\n${user.name}\n${user.role}, ${business.name}\n${business.phone}`,
  }
}

/** Deterministic "supplier asks for changes" scenario: small price rise and a slightly longer lead time. */
export function simulatedChangeRequest(po: PurchaseOrder, product: Product): ProposedChanges {
  return {
    unitPrice: round(po.unitPrice * 1.04, 2),
    quantity: po.quantity,
    leadTimeDays: po.leadTimeDays + 1,
    note: `Due to a shipment delay we can deliver ${formatQty(po.quantity, product.unit)} in ${po.leadTimeDays + 1} days, and need to adjust the price to ${formatRM(round(po.unitPrice * 1.04, 2))}/${product.unit} (+4%) because of increased import costs.`,
  }
}

export const supplierReplies = {
  accept: (po: PurchaseOrder) => `Thank you! ${po.number} is confirmed. Delivery is scheduled for ${formatDate(po.expectedDelivery)}.`,
  decline: (po: PurchaseOrder) => `Sorry, we are unable to fulfil ${po.number} at this time due to insufficient stock.`,
}
