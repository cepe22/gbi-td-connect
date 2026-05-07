"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Member = {
  id: string;
  member_code: string;
  qr_code_value: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  membership_status: string;
  attendance_status: string;
  joined_at: string | null;
  created_at: string;
};

type AttendanceSession = {
  id: string;
  title: string;
  type: string;
  session_date: string;
  is_active: boolean;
};

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "orange" | "red" | "blue" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-orange-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function statusTone(status: string): "green" | "orange" | "red" | "blue" | "slate" {
  if (status === "active" || status === "active_member") return "green";
  if (status === "new_member") return "blue";
  if (status === "need_follow_up" || status === "rarely_attend") return "orange";
  if (status === "inactive") return "red";
  return "slate";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "scanner">("dashboard");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("admin@gbitd.org");
  const [password, setPassword] = useState("");

  const [newMember, setNewMember] = useState({
    full_name: "",
    phone: "",
    email: "",
  });

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [qrInput, setQrInput] = useState("MEMBER-GBITD-000123");

  const activeMembers = useMemo(() => {
    return members.filter((member) => member.attendance_status === "active").length;
  }, [members]);

  const followUpMembers = useMemo(() => {
    return members.filter((member) =>
      ["need_follow_up", "rarely_attend", "inactive"].includes(member.attendance_status)
    );
  }, [members]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    fetchRoles();
    fetchMembers();
    fetchAttendanceSessions();
  }, [session]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Login berhasil.");
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]);
    setMembers([]);
    setAttendanceSessions([]);
  }

  async function fetchRoles() {
    if (!session) return;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoles((data || []).map((item) => item.role));
  }

  async function fetchMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("id, member_code, qr_code_value, full_name, nickname, phone, email, membership_status, attendance_status, joined_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers(data || []);
  }

  async function fetchAttendanceSessions() {
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("id, title, type, session_date, is_active")
      .eq("is_active", true)
      .order("session_date", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const sessions = data || [];
    setAttendanceSessions(sessions);

    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!newMember.full_name.trim()) {
      setMessage("Nama jemaat wajib diisi.");
      return;
    }

    const code = `MEMBER-GBITD-${String(Date.now()).slice(-6)}`;

    const { error } = await supabase.from("members").insert({
      member_code: code,
      qr_code_value: code,
      full_name: newMember.full_name,
      nickname: newMember.full_name.split(" ")[0],
      phone: newMember.phone || null,
      email: newMember.email || null,
      membership_status: "new_member",
      attendance_status: "new_member",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewMember({ full_name: "", phone: "", email: "" });
    setMessage("Jemaat berhasil ditambahkan ke Supabase.");
    fetchMembers();
  }

  async function scanQr(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!selectedSessionId) {
      setMessage("Pilih sesi absensi dulu.");
      return;
    }

    const cleanQr = qrInput.trim();

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, full_name, member_code")
      .eq("qr_code_value", cleanQr)
      .maybeSingle();

    if (memberError) {
      setMessage(memberError.message);
      return;
    }

    if (!member) {
      setMessage("QR tidak ditemukan di database jemaat.");
      return;
    }

    const { error } = await supabase.from("attendance_records").insert({
      attendance_session_id: selectedSessionId,
      member_id: member.id,
      checkin_method: "qr_scan",
      scanned_by_user_id: session?.user.id,
      sync_status: "synced",
      device_id: "browser-test",
    });

    if (error) {
      if (error.code === "23505") {
        setMessage(`${member.full_name} sudah check-in di sesi ini.`);
        return;
      }

      setMessage(error.message);
      return;
    }

    setMessage(`${member.full_name} berhasil check-in.`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-orange-50">
        <p className="text-sm font-bold text-slate-600">Loading GBI TD Connect...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#FFF9F3] p-4 text-slate-900">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-amber-400 p-8 text-white shadow-2xl shadow-orange-100 lg:p-10">
            <div className="mb-16 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">✦</div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-100">GBI TD Connect</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight lg:text-6xl">
              Church management yang rapi, cepat, dan real-time.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-orange-50">
              Login ke database Supabase real untuk mengelola jemaat, absensi QR, dan jadwal pelayanan.
            </p>
          </section>

          <Card className="p-6 lg:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500 text-2xl font-black text-white shadow-lg shadow-orange-100">
                GBI
              </div>
              <h2 className="text-3xl font-black text-slate-950">Masuk Dashboard</h2>
              <p className="mt-2 text-sm text-slate-500">Gunakan user admin yang sudah dibuat di Supabase.</p>
            </div>

            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="admin@gbitd.org"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="Password admin Supabase"
                />
              </div>

              {message && <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{message}</div>}

              <button className="w-full rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600">
                Login
              </button>
            </form>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">GBI TD Connect</h1>
            <p className="text-xs text-slate-500">{session.user.email}</p>
          </div>

          <div className="flex items-center gap-2">
            {roles.map((role) => (
              <Badge key={role} tone={role === "admin" ? "green" : "blue"}>{role}</Badge>
            ))}
            <button onClick={logout} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "members", label: "Database Jemaat", icon: "👥" },
              { id: "scanner", label: "QR Scanner", icon: "📷" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                  activeTab === item.id ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          {message && (
            <div className="rounded-3xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-orange-700 shadow-sm">
              {message}
            </div>
          )}

          {activeTab === "dashboard" && (
            <>
              <div className="rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-400 p-6 text-white shadow-xl shadow-orange-100">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-100">Real Supabase Connected</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Dashboard Gereja</h2>
                <p className="mt-2 text-orange-50">Data di halaman ini sudah ditarik dari database Supabase kamu.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <p className="text-sm text-slate-500">Total Jemaat</p>
                  <p className="mt-2 text-4xl font-black">{members.length}</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Jemaat Aktif</p>
                  <p className="mt-2 text-4xl font-black">{activeMembers}</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Perlu Follow-up</p>
                  <p className="mt-2 text-4xl font-black">{followUpMembers.length}</p>
                </Card>
              </div>

              <Card>
                <h3 className="text-lg font-black text-slate-950">Attendance Sessions</h3>
                <div className="mt-4 space-y-3">
                  {attendanceSessions.map((sessionItem) => (
                    <div key={sessionItem.id} className="flex items-center justify-between rounded-2xl border border-orange-100 p-4">
                      <div>
                        <p className="font-bold text-slate-950">{sessionItem.title}</p>
                        <p className="text-sm text-slate-500">{sessionItem.type} • {sessionItem.session_date}</p>
                      </div>
                      <Badge tone="green">Active</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {activeTab === "members" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <Card>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">Database Jemaat</h2>
                    <p className="text-sm text-slate-500">Data ini real dari table members Supabase.</p>
                  </div>
                  <button onClick={fetchMembers} className="rounded-2xl border border-orange-100 px-4 py-2 text-sm font-bold">
                    Refresh
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-orange-100">
                  <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] bg-orange-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-orange-700 md:grid">
                    <span>Nama</span>
                    <span>Phone</span>
                    <span>Status</span>
                    <span>QR Code</span>
                  </div>

                  <div className="divide-y divide-orange-100">
                    {members.map((member) => (
                      <div key={member.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center">
                        <div>
                          <p className="font-bold text-slate-950">{member.full_name}</p>
                          <p className="text-xs text-slate-500">{member.member_code}</p>
                        </div>
                        <p className="text-sm text-slate-600">{member.phone || "-"}</p>
                        <Badge tone={statusTone(member.attendance_status)}>{member.attendance_status}</Badge>
                        <p className="text-xs font-bold text-slate-500">{member.qr_code_value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="h-fit">
                <h3 className="text-xl font-black text-slate-950">Tambah Jemaat</h3>
                <form onSubmit={addMember} className="mt-5 space-y-3">
                  <input
                    value={newMember.full_name}
                    onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Nama lengkap"
                  />
                  <input
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Nomor WhatsApp"
                  />
                  <input
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Email"
                  />
                  <button className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white">
                    Simpan ke Supabase
                  </button>
                </form>
              </Card>
            </div>
          )}

          {activeTab === "scanner" && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <Card>
                <h2 className="text-2xl font-black text-slate-950">QR Scanner</h2>
                <p className="mt-1 text-sm text-slate-500">Untuk test awal, input QR code value manual dulu.</p>

                <form onSubmit={scanQr} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Pilih Sesi</label>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300"
                    >
                      {attendanceSessions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">QR / Member Code</label>
                    <input
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300"
                      placeholder="MEMBER-GBITD-000123"
                    />
                  </div>

                  <button className="w-full rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-100">
                    Check-in
                  </button>
                </form>
              </Card>

              <Card>
                <h3 className="text-xl font-black text-slate-950">Cara Test</h3>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                  <p>1. Pilih attendance session.</p>
                  <p>2. Masukkan QR/member code, contoh:</p>
                  <pre className="rounded-2xl bg-slate-950 p-4 text-xs font-bold text-white">MEMBER-GBITD-000123</pre>
                  <p>3. Klik Check-in.</p>
                  <p>4. Cek Supabase table <b>attendance_records</b>. Data harus masuk.</p>
                  <p>5. Klik Check-in lagi dengan QR yang sama. Harus muncul pesan sudah check-in.</p>
                </div>
              </Card>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
