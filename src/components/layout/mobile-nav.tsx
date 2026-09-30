"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Bell, Settings, Plug } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function MobileNavBar() {
  const pathname = usePathname();

  const { data } = useQuery<{ unreadCount: number }>({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const unreadCount = data?.unreadCount || 0;

  const tabs = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Meta Ads", href: "/meta-ads", icon: TrendingUp },
    { name: "Integrações", href: "/integrations", icon: Plug },
    { name: "Notificações", href: "/notifications", icon: Bell, badge: unreadCount },
    { name: "Ajustes", href: "/settings", icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around safe-bottom">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center gap-1 relative px-3 py-1 rounded-lg transition-colors ${
              isActive
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="absolute -top-1 -right-2 bg-sky-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge! > 9 ? "9+" : tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
