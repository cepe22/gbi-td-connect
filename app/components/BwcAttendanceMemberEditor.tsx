"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type AttendanceSessionOption = {
  session_id: string;
  title: string;
  type: string | null;
  session_date: string | null;
  total_checkins: number;
};

type CoolOption = {
  cool_group_id: string;
  cool_group_name: string;
  meeting_day: string | null;
  location: string | null;
  is_active: boolean;
};

type MemberRow = {
  member_id: string;
  member_code: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: string | null;
  address: string | null;
  photo_url: string | null;
  is_active: boolean;
  cool_group_id: string | null;
  cool_group_name: string | null;
  last_attendance_at: string | null;
  last_attendance_session: string | null;
  total_attendance: number;
  profile_user_id: string | null;
  updated_at: string | null;
};

type EditForm = {
  full_name: string;
  nickname: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: string;
  address: string;
  is_active: boolean;
  cool_group_id: string;
};

type AuditLog = {
  log_id: string;
  action: string;
  changed_by_email: string | null;
  created_at: string;
};

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function toForm(member: MemberRow): EditForm {
  return {
    full_name: member.full_name || "",
    nickname: member.nickname || "",
    phone: member.phone || "",
    email: member.email || "",
    birth_date: member.birth_date || "",
    gender: member.gender || "",
    address: member.address || "",
    is_active: Boolean(member.is_active),
    cool_group_id: member.cool_group_id || "",
  };
}

export default function BwcAttendanceMemberEditor() {
  const [sessions, setSessions] = useState<AttendanceSessionOption[]>([]);
  const [coolOptions, setCoolOptions] = useState<CoolOption[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function selectMember(member: MemberRow) {
    setSelectedMember(member);
    setForm(toForm(member));
    loadLogs(member.member_id);
  }

  async function loadSessions() {
    const { data, error } = await supabase.rpc("get_attendance_sessions_for_member_editor", {
      input_limit: 40,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setSessions((data || []) as AttendanceSessionOption[]);
  }

  async function loadCoolOptions() {
    const { data, error } = await supabase.rpc("get_attendance_member_editor_cool_options");

    if (error) {
      setStatus(error.message);
      return;
    }

    setCoolOptions((data || []) as CoolOption[]);
  }

  async function searchMembers(nextSearch = search, nextSessionId = selectedSessionId) {
    try {
      setLoading(true);
      setStatus("");

      const { data, error } = await supabase.rpc("search_attendance_members_for_edit", {
        input_search: nextSearch,
        input_session_id: nextSessionId || null,
        input_limit: 100,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const rows = (data || []) as MemberRow[];
      setMembers(rows);

      if (rows.length > 0) {
        const refreshed = selectedMember
          ? rows.find((item) => item.member_id === selectedMember.member_id)
          : rows[0];

        if (refreshed) {
          setSelectedMember(refreshed);
          setForm(toForm(refreshed));
        }
      } else {
        setSelectedMember(null);
        setForm(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(memberId: string) {
    const { data, error } = await supabase.rpc("get_attendance_member_update_logs", {
      input_member_id: memberId,
    });

    if (!error) {
      setLogs((data || []) as AuditLog[]);
    }
  }

  async function saveMember() {
    if (!selectedMember || !form) return;

    try {
      setSaving(true);
      setStatus("");

      const { error } = await supabase.rpc("update_attendance_member_profile", {
        input_member_id: selectedMember.member_id,
        input_full_name: form.full_name,
        input_nickname: form.nickname || null,
        input_phone: form.phone || null,
        input_email: form.email || null,
        input_birth_date: form.birth_date || null,
        input_gender: form.gender || null,
        input_address: form.address || null,
        input_is_active: form.is_active,
        input_cool_group_id: form.cool_group_id || null,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Data member berhasil diperbarui.");
      await searchMembers(search, selectedSessionId);
      await loadLogs(selectedMember.member_id);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSessions();
    loadCoolOptions();
    searchMembers("", "");
  }, []);

  return (
    <section className="bwc-mobile-page-fix space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-300">Pendataan</p>
        <h2 className="mt-3 text-4xl font-black">Edit Member Absensi Ibadah</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Untuk admin dan tim pendataan mengubah data jemaat yang melakukan check-in absensi ibadah.
        </p>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Filter Absensi</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pilih sesi ibadah atau cari langsung dari database member.
            </p>

            <label className="mt-4 block text-sm font-black text-slate-700">Sesi Ibadah</label>
            <select
              value={selectedSessionId}
              onChange={(event) => {
                setSelectedSessionId(event.target.value);
                searchMembers(search, event.target.value);
              }}
              className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
            >
              <option value="">Semua member / semua absensi</option>
              {sessions.map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {formatDate(session.session_date)} · {session.title} · {session.total_checkins} hadir
                </option>
              ))}
            </select>

            {selectedSession && (
              <div className="mt-4 rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Sesi Terpilih</p>
                <p className="mt-2 font-black text-slate-950">{selectedSession.title}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {formatDate(selectedSession.session_date)} · {selectedSession.total_checkins} check-in
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchMembers(search, selectedSessionId);
                }}
                className="min-w-0 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                placeholder="Cari nama, kode, HP, COOL..."
              />
              <button
                type="button"
                onClick={() => searchMembers(search, selectedSessionId)}
                disabled={loading}
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                Cari
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-950">Member</h3>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">
                {members.length} data
              </span>
            </div>

            <div className="mt-4 max-h-[640px] space-y-3 overflow-auto pr-1">
              {members.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  {loading ? "Loading..." : "Belum ada data ditemukan."}
                </div>
              ) : (
                members.map((member) => {
                  const selected = selectedMember?.member_id === member.member_id;

                  return (
                    <button
                      key={member.member_id}
                      type="button"
                      onClick={() => selectMember(member)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-orange-300 bg-orange-50" : "border-orange-100 bg-white hover:bg-orange-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                          {member.photo_url ? (
                            <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                          ) : (
                            initials(member.full_name)
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-black text-slate-950">{member.full_name}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                              member.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {member.is_active ? "active" : "inactive"}
                            </span>
                          </div>
                          <p className="truncate text-xs font-bold text-slate-500">
                            {member.member_code} · {member.cool_group_name || "No COOL"}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-400">
                            Last: {formatDateTime(member.last_attendance_at)} · {member.total_attendance || 0}x
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Edit Member</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedMember?.full_name || "Pilih member dulu"}
                </h3>
                {selectedMember && (
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedMember.member_code} · {selectedMember.last_attendance_session || "Belum ada sesi terakhir"}
                  </p>
                )}
              </div>

              {selectedMember && (
                <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
                  {selectedMember.cool_group_name || "Belum ada COOL"}
                </div>
              )}
            </div>

            {!selectedMember || !form ? (
              <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                Pilih member dari list kiri untuk mulai edit.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Nama Lengkap</span>
                  <input
                    value={form.full_name}
                    onChange={(event) => updateField("full_name", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Nickname</span>
                  <input
                    value={form.nickname}
                    onChange={(event) => updateField("nickname", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Nomor HP / WhatsApp</span>
                  <input
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="+628..."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Email</span>
                  <input
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Tanggal Lahir</span>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(event) => updateField("birth_date", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Gender</span>
                  <select
                    value={form.gender}
                    onChange={(event) => updateField("gender", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    <option value="">Belum diisi</option>
                    <option value="Pria">Pria</option>
                    <option value="Wanita">Wanita</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Status</span>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(event) => updateField("is_active", event.target.value === "active")}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-700">COOL</span>
                  <select
                    value={form.cool_group_id}
                    onChange={(event) => updateField("cool_group_id", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    <option value="">Belum ada COOL</option>
                    {coolOptions.map((option) => (
                      <option key={option.cool_group_id} value={option.cool_group_id}>
                        {option.cool_group_name} {option.is_active ? "" : "(inactive)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-black text-slate-700">Alamat</span>
                  <textarea
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                </label>

                <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={() => selectedMember && setForm(toForm(selectedMember))}
                    className="rounded-2xl border border-orange-100 px-5 py-3 text-sm font-black text-slate-700"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={saveMember}
                    disabled={saving || !form.full_name.trim()}
                    className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    {saving ? "Menyimpan..." : "Simpan Update"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">History Perubahan</h3>
            <p className="mt-1 text-sm text-slate-500">
              Perubahan yang dibuat oleh admin/tim pendataan akan tercatat di sini.
            </p>

            <div className="mt-5 space-y-3">
              {logs.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada history perubahan.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.log_id} className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-sm font-black text-slate-950">{log.action}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {formatDateTime(log.created_at)} · {log.changed_by_email || "admin/pendataan"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

