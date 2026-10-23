export type ManagerApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
export type PurchaseOrderDocumentStatus = 'Awaiting approval' | 'Generated' | 'Not generated'
export type DispatchChannel = 'WhatsApp' | 'Email'
export type DispatchStatus = 'Not sent' | 'Awaiting response' | 'Accepted' | 'Rejected' | 'Changed terms' | 'Terms declined'
export type SupplierResponse = 'accept' | 'reject' | 'changed-terms'

export interface AutomationWorkflowData {
  requestId: string
  poNumber: string
  requester: string
  managerName: string
  supplier: string
  supplierContact: string
  whatsapp: string
  email: string
  product: string
  quantity: number
  unit: string
  unitPrice: number
  total: number
  expectedDelivery: string
  paymentTerms: string
  approvalStatus: ManagerApprovalStatus
  documentStatus: PurchaseOrderDocumentStatus
  dispatchStatus: DispatchStatus
  channel: DispatchChannel | null
  response: SupplierResponse | null
  revisedTotal: number
  revisedDelivery: string
}

export interface AutomationAuditEntry {
  id: string
  time: string
  actor: string
  event: string
  detail: string
  tone: 'neutral' | 'success' | 'warning' | 'critical'
}

export const initialAutomationWorkflow: AutomationWorkflowData = {
  requestId: 'REQ-2048',
  poNumber: 'SW-PO-2048',
  requester: 'Nurul Aisyah',
  managerName: 'Alex Tan',
  supplier: 'BeanCraft Wholesale',
  supplierContact: 'Daniel Lim',
  whatsapp: '+60 12-334 8812',
  email: 'orders@beancraft.example.my',
  product: 'Colombian Arabica Coffee Beans',
  quantity: 12,
  unit: 'kg',
  unitPrice: 104,
  total: 1248,
  expectedDelivery: '28 Oct 2026',
  paymentTerms: 'Net 30',
  approvalStatus: 'Pending',
  documentStatus: 'Awaiting approval',
  dispatchStatus: 'Not sent',
  channel: null,
  response: null,
  revisedTotal: 1310.4,
  revisedDelivery: '31 Oct 2026',
}

export const initialAutomationAudit: AutomationAuditEntry[] = [
  {
    id: 'audit-request',
    time: '10:02 AM',
    actor: 'SupplyWise AI',
    event: 'Purchase request created',
    detail: 'REQ-2048 submitted by Nurul Aisyah for manager approval.',
    tone: 'neutral',
  },
  {
    id: 'audit-routed',
    time: '10:02 AM',
    actor: 'Workflow engine',
    event: 'Approval task assigned',
    detail: 'Alex Tan was notified. PO generation is waiting for approval.',
    tone: 'warning',
  },
]

export const supplierResponseDetails: Record<SupplierResponse, { label: string; message: string }> = {
  accept: {
    label: 'Order accepted',
    message: 'We can fulfil the order at the quoted price and delivery date.',
  },
  reject: {
    label: 'Order declined',
    message: 'We are unable to fulfil this order at this time.',
  },
  'changed-terms': {
    label: 'Revised terms received',
    message: 'The supplier proposed a 5% price increase and a three-day delivery extension.',
  },
}
