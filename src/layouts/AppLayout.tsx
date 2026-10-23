import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    document.body.style.overflow = ''
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-page">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-line bg-white lg:block">
        <AppSidebar />
      </aside>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-[#11142d]/30" onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-pop"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.05 }}
            >
              <AppSidebar onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="lg:pl-[252px]">
        <AppHeader onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <Suspense fallback={<div className="h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
