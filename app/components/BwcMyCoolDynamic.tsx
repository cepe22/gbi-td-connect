"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type BwcMyCoolDynamicProps = {
  onNavigate?: (tab: string) => void;
};

type MyCoolProfile = {
  member_id: string;
  member_code: string;
  full_name: string;
  cool_group_id: string | null;
  cool_group_name: string | null;
  meeting_day: string | null;
  location: string | null;
};

export default function BwcMyCoolDynamic({ onNavigate }: BwcMyCoolDynamicProps) {
  const [data, setData] = useState<MyCoolProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  function goToCoolAttendance() {
    if (onNavigate) {
      onNavigate("coolAttendance");
      return;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bwc:navigate-member-tab", { detail: "coolAttendance" }));
    }
  }

  async function loadMyCool() {
    try {
      setLoading(true);
      setStatus("");

      const { data, error } = await supabase.rpc("get_my_cool_profile");

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
    loadMyCool();
  }, []);

  const coolName = data?.cool_group_name || "Belum terdaftar COOL";
  const meetingDay = data?.meeting_day || "-";
  const location = data?.location || "-";

  return (
    <section className="space-y-6">
      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">My COOL</p>
            <h2 className="mt-4 text-4xl font-black">{loading ? "Loading COOL..." : coolName}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
              Ini adalah data COOL yang terhubung dengan profile member kamu di database BWC Connect.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMyCool}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Generation</p>
          <p className="mt-3 text-2xl font-black text-slate-950">Youth</p>
        </div>

        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Meeting Day</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{meetingDay}</p>
        </div>

        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Location</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{location}</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Member COOL Info</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Member</p>
            <p className="mt-2 font-black text-slate-950">{data?.full_name || "-"}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Member Code</p>
            <p className="mt-2 font-black text-slate-950">{data?.member_code || "-"}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">COOL</p>
            <p className="mt-2 font-black text-slate-950">{coolName}</p>
          </div>
        </div>
      </div>


      <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Gembala COOL</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Input Absensi COOL Mingguan</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Khusus gembala COOL yang sudah di-assign. Catat kehadiran anak COOL dan jiwa baru setiap minggu.
            </p>
          </div>

          <button
            type="button"
            onClick={goToCoolAttendance}
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
          >
            Buka Absensi COOL
          </button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Upcoming COOL / Event</h3>
        <div className="mt-4 rounded-2xl bg-orange-50 p-5">
          <p className="font-black text-slate-950">Belum ada announcement aktif</p>
          <p className="mt-2 text-sm text-slate-500">
            Nanti bagian ini bisa dihubungkan ke event BWC dan announcement dari leader COOL.
          </p>
        </div>
      </div>
    </section>
  );
}

