"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type MobileHomeData = {
  member_id: string;
  member_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  member_status: string | null;
  cool_group_name: string | null;
  cool_meeting_day: string | null;
  cool_location: string | null;
  upcoming_session_id: string | null;
  upcoming_session_title: string | null;
  upcoming_session_date: string | null;
  upcoming_session_type: string | null;
  pending_ministry_count: number;
  unread_direct_count: number;
  profile_completion: number;
};

type Props = {
  onNavigate?: (tab: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function BwcMemberHomeV2({ onNavigate }: Props) {
  const [data, setData] = useState<MobileHomeData | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const profileCompletion = Number(data?.profile_completion || 0);
  const isProfileComplete = profileCompletion >= 100;

  const firstName = useMemo(() => {
    return (data?.full_name || "Member").split(" ")[0] || "Member";
  }, [data?.full_name]);

  function go(tab: string) {
    if (onNavigate) {
      onNavigate(tab);
      return;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bwc:navigate-member-tab", { detail: tab }));
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setStatus("");

      const { data, error } = await supabase.rpc("get_bwc_mobile_home_data");

      if (error) {
        setStatus(error.message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setData(row || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const shortcuts = [
    { label: "QR Kehadiran", icon: "▦", tab: "qr" },
    { label: "Jadwal", icon: "▣", tab: "schedule" },
    { label: "COOL", icon: "✦", tab: "cool" },
    { label: "Absensi COOL", icon: "✓", tab: "coolAttendance" },
    { label: "Pelayanan", icon: "▤", tab: "ministrySchedule" },
    { label: "Forum", icon: "☷", tab: "forum" },
    { label: "Kontak", icon: "☎", tab: "contacts" },
    { label: "Group", icon: "◌", tab: "groupChat" },
    { label: "Profil", icon: "♙", tab: "profile" },
  ];

  return (
    <section className="bwc-member-home-v2 mx-auto w-full max-w-[480px] space-y-5 pb-6 md:max-w-6xl">
      {status && (
        <div className="rounded-[1.25rem] bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-white px-5 pb-5 pt-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-56 w-56 rounded-full bg-orange-100 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-4rem] left-[-4rem] h-44 w-44 rounded-full bg-orange-50 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-xl font-black text-white shadow-lg shadow-orange-200">
              ✝
            </div>
            <div>
              <p className="text-sm font-black leading-none text-slate-950">GBI TD</p>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Connect</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go("contacts")}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-orange-100"
            >
              🔔
              {Number(data?.unread_direct_count || 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                  {data?.unread_direct_count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => go("profile")}
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600 ring-1 ring-orange-100"
            >
              {data?.photo_url ? (
                <img src={data.photo_url} alt={data.full_name} className="h-full w-full object-cover" />
              ) : (
                initials(data?.full_name)
              )}
            </button>
          </div>
        </div>

        <div className="relative mt-7">
          <p className="text-sm font-medium text-slate-500">Halo,</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            {loading ? "Loading..." : `${data?.full_name || "Member"} 👋`}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Tuhan Yesus memberkati hari Anda.
          </p>
        </div>

        <div className="relative mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => go("forum")}
            className="flex min-h-14 flex-1 items-center gap-3 rounded-[1.35rem] bg-slate-50 px-4 text-left text-sm font-bold text-slate-400 ring-1 ring-slate-100"
          >
            <span className="text-lg">⌕</span>
            Cari info, acara, komunitas...
          </button>

          <button
            type="button"
            onClick={() => go("qr")}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-orange-500 text-2xl font-black text-white shadow-lg shadow-orange-200"
          >
            ⛶
          </button>
        </div>
      </div>

      <div data-bwc-shortcut-grid="true" className="bwc-shortcut-grid grid grid-cols-4 gap-3 rounded-[2rem] border border-orange-100 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        {shortcuts.map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => go(item.tab)}
            data-bwc-shortcut-item="true" className="group flex flex-col items-center gap-2 rounded-[1.35rem] px-2 py-3 transition hover:bg-orange-50"
          >
            <span data-bwc-shortcut-icon="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-xl font-black text-orange-500 shadow-sm transition group-hover:bg-orange-500 group-hover:text-white">
              {item.icon}
            </span>
            <span data-bwc-shortcut-label="true" className="text-center text-[11px] font-black leading-tight text-slate-700">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 p-5 text-white shadow-[0_20px_55px_rgba(249,115,22,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-50">Status Keanggotaan</p>
            <h2 className="mt-1 flex items-center gap-2 text-3xl font-black">
              {data?.member_status === "active" ? "Aktif" : "Member"}
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm">✓</span>
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-orange-50">
              Terima kasih sudah menjadi bagian dari keluarga GBI TD.
            </p>
          </div>

          <div className="rounded-2xl bg-white/18 px-3 py-2 text-right backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-50">Member</p>
            <p className="mt-1 text-sm font-black">{data?.member_code || "-"}</p>
          </div>
        </div>
      </div>

      {!isProfileComplete && (
        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Profile Completion</p>
              <h3 className="mt-2 text-3xl font-black text-slate-950">{profileCompletion}%</h3>
              <p className="mt-1 text-sm text-slate-500">Lengkapi data pribadi supaya pendataan lebih akurat.</p>
            </div>
            <button
              type="button"
              onClick={() => go("profile")}
              className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white"
            >
              Lengkapi
            </button>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-orange-50">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(profileCompletion, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-500">Ibadah / Event Berikutnya</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {data?.upcoming_session_title || "Belum ada jadwal aktif"}
            </h3>

            {data?.upcoming_session_date ? (
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                <p>▣ {formatDate(data.upcoming_session_date)}</p>
                <p>◷ 13.00 WIB · GBI TD</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Nanti bagian ini akan terhubung ke jadwal ibadah dan event aktif.
              </p>
            )}
          </div>

          <div className="hidden h-24 w-32 shrink-0 rounded-[1.35rem] bg-gradient-to-br from-slate-900 to-orange-500 md:block" />
        </div>

        <button
          type="button"
          onClick={() => go("schedule")}
          className="mt-5 rounded-2xl border border-orange-200 px-5 py-3 text-sm font-black text-orange-600"
        >
          Lihat Detail
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => go("cool")}
          className="rounded-[1.5rem] border border-orange-100 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">COOL</p>
          <p className="mt-2 truncate text-lg font-black text-slate-950">{data?.cool_group_name || "-"}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{data?.cool_meeting_day || "-"} · {data?.cool_location || "-"}</p>
        </button>

        <button
          type="button"
          onClick={() => go("ministrySchedule")}
          className="rounded-[1.5rem] border border-orange-100 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Pelayanan</p>
          <p className="mt-2 text-lg font-black text-slate-950">{Number(data?.pending_ministry_count || 0)} Pending</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Konfirmasi jadwal pelayanan.</p>
        </button>

        <button
          type="button"
          onClick={() => go("contacts")}
          className="rounded-[1.5rem] border border-orange-100 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Pesan</p>
          <p className="mt-2 text-lg font-black text-slate-950">{Number(data?.unread_direct_count || 0)} Unread</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Chat dan contact BWC.</p>
        </button>
      </div>
    </section>
  );
}

