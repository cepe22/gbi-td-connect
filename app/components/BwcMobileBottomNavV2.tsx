"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type Props = {
  activeTab: string;
  onNavigate: (tab: string) => void;
};

export default function BwcMobileBottomNavV2({ activeTab, onNavigate }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = useMemo(
    () => [
      { id: "home", label: "Beranda", icon: "⌂" },
      { id: "qr", label: "QR", icon: "▦" },
      { id: "schedule", label: "Acara", icon: "▣" },
      { id: "contacts", label: "Pesan", icon: "☷", badge: unreadCount },
      { id: "profile", label: "Profil", icon: "♙" },
    ],
    [unreadCount]
  );

  async function loadUnread() {
    const { data, error } = await supabase.rpc("get_unread_direct_message_count");

    if (!error) {
      setUnreadCount(Number(data || 0));
    }
  }

  useEffect(() => {
    loadUnread();

    const interval = window.setInterval(loadUnread, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add("bwc-has-mobile-bottom-nav");

    return () => {
      document.body.classList.remove("bwc-has-mobile-bottom-nav");
    };
  }, []);

  return (
    <>
      <div className="bwc-mobile-bottom-spacer md:hidden" />

      <nav className="bwc-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[80] border-t border-orange-100 bg-white/92 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] pt-2 shadow-[0_-18px_45px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-[480px] grid-cols-5 gap-1 rounded-[1.5rem]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const showBadge = Number(item.badge || 0) > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[1.15rem] px-2 transition ${
                  isActive ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "text-slate-400"
                }`}
              >
                <span className={`text-[1.35rem] leading-none ${isActive ? "text-white" : "text-slate-400"}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-black leading-none ${isActive ? "text-white" : "text-slate-500"}`}>
                  {item.label}
                </span>

                {showBadge && (
                  <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
                    {Number(item.badge) > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

