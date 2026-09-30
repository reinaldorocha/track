import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNavBar } from '@/components/layout/mobile-nav'
import { MobileClientInit } from '@/components/layout/mobile-client-init'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MobileClientInit />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040A14] text-slate-900 dark:text-slate-100 pb-16 md:pb-0">
          <div className="container mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
      <MobileNavBar />
    </div>
  )
}
