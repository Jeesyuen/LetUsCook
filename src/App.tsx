import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import Landing from '@/pages/Landing'
const Overview = lazy(() => import('@/pages/app/Overview'))
const Inventory = lazy(() => import('@/pages/app/Inventory'))
const ProductDetail = lazy(() => import('@/pages/app/ProductDetail'))
const Forecasting = lazy(() => import('@/pages/app/Forecasting'))
const Suppliers = lazy(() => import('@/pages/app/Suppliers'))
const SupplierProfilePage = lazy(() => import('@/pages/app/SupplierProfile'))
const Quotations = lazy(() => import('@/pages/app/Quotations'))
const Recommendations = lazy(() => import('@/pages/app/Recommendations'))
const Approvals = lazy(() => import('@/pages/app/Approvals'))
const PurchaseOrders = lazy(() => import('@/pages/app/PurchaseOrders'))
const Activity = lazy(() => import('@/pages/app/Activity'))
const Settings = lazy(() => import('@/pages/app/Settings'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/:productId" element={<ProductDetail />} />
        <Route path="forecasting" element={<Forecasting />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:supplierId" element={<SupplierProfilePage />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
