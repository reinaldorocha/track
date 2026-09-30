export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-sky-50/50 dark:from-[#050D1A] dark:via-[#081A33] dark:to-[#030712] p-4 relative overflow-hidden">
      {children}
    </div>
  )
}
