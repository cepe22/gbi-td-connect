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
      { id: "home", label: "Home", icon: "⌂" },
      { id: "qr", label: "QR", icon: "▦" },
      { id: "schedule", label: "Acara", icon: "▣" },
      { id: "contacts", label: "Pesan", icon: "☷", badge: unreadCount },
      { id: "profile", label: "Profil", icon: "♙" },
    ],
    [unreadCount]
  );

  async function loadUnread() {
    const { data, error } = await supabase.rpc("get_unread_direct_message_count");
    if (!error) setUnreadCount(Number(data || 0));
  }

  useEffect(() => {
    loadUnread();
    const interval = window.setInterval(loadUnread, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add("bwc-has-mobile-bottom-nav");
    return () => document.body.classList.remove("bwc-has-mobile-bottom-nav");
  }, []);

  return (
    <nav className="bwc-mobile-bottom-nav" aria-label="Member mobile navigation">
      <div className="bwc-mobile-bottom-nav__grid">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const showBadge = Number(item.badge || 0) > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`bwc-mobile-bottom-nav__item${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="bwc-mobile-bottom-nav__item-icon">{item.icon}</span>
              <span className="bwc-mobile-bottom-nav__item-label">{item.label}</span>

              {showBadge && (
                <span className="bwc-mobile-bottom-nav__badge">
                  {Number(item.badge) > 9 ? "9+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
