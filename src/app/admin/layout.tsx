import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/access-control'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { Header } from '@/components/layout/header'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Se o usuário não for ADMIN, redireciona com segurança para o Dashboard do cliente
  if (!isAdmin(session as any)) {
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040A14] text-slate-900 dark:text-slate-100">
          <div className="container mx-auto p-4 md:p-6 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
