"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type AttendanceSession = {
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

type Attendee = {
  record_id: string;
  session_id: string;
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
  checkin_at: string | null;
  checkin_method: string | null;
  sync_status: string | null;
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

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
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

function toForm(attendee: Attendee): EditForm {
  return {
    full_name: attendee.full_name || "",
    nickname: attendee.nickname || "",
    phone: attendee.phone || "",
    email: attendee.email || "",
    birth_date: attendee.birth_date || "",
    gender: attendee.gender || "",
    address: attendee.address || "",
    is_active: Boolean(attendee.is_active),
    cool_group_id: attendee.cool_group_id || "",
  };
}

export default function BwcAttendanceMemberEditor() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [coolOptions, setCoolOptions] = useState<CoolOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingRecordId, setRemovingRecordId] = useState("");

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const activeAttendees = attendees.filter((item) => item.is_active).length;
  const inactiveAttendees = attendees.length - activeAttendees;

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function selectAttendee(attendee: Attendee) {
    setSelectedAttendee(attendee);
    setForm(toForm(attendee));
  }

  async function loadCoolOptions() {
    const { data, error } = await supabase.rpc("get_attendance_member_editor_cool_options");

    if (error) {
      setStatus(error.message);
      return;
    }

    setCoolOptions((data || []) as CoolOption[]);
  }

  async function loadSessions(selectFirst = false) {
    try {
      setLoadingSessions(true);
      setStatus("");

      const { data, error } = await supabase.rpc("get_attendance_sessions_for_attendance_editor", {
        input_limit: 50,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const rows = (data || []) as AttendanceSession[];
      setSessions(rows);

      if (selectFirst && rows.length > 0 && !selectedSessionId) {
        setSelectedSessionId(rows[0].session_id);
        await loadAttendees(rows[0].session_id, "");
      }
    } finally {
      setLoadingSessions(false);
    }
  }

  async function loadAttendees(sessionId = selectedSessionId, nextSearch = search) {
    if (!sessionId) {
      setAttendees([]);
      setSelectedAttendee(null);
      setForm(null);
      return;
    }

    try {
      setLoadingAttendees(true);
      setStatus("");

      const { data, error } = await supabase.rpc("get_attendance_session_attendees_for_editor", {
        input_session_id: sessionId,
        input_search: nextSearch,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const rows = (data || []) as Attendee[];
      setAttendees(rows);

      if (rows.length > 0) {
        const refreshed = selectedAttendee
          ? rows.find((item) => item.record_id === selectedAttendee.record_id) || rows[0]
          : rows[0];

        setSelectedAttendee(refreshed);
        setForm(toForm(refreshed));
      } else {
        setSelectedAttendee(null);
        setForm(null);
      }
    } finally {
      setLoadingAttendees(false);
    }
  }

  async function removeAttendance(attendee: Attendee) {
    const confirmed = window.confirm(
      `Hapus absensi ${attendee.full_name} dari sesi ${selectedSession?.title || "ini"}? Data member tidak akan dihapus, hanya record absensinya.`
    );

    if (!confirmed) return;

    try {
      setRemovingRecordId(attendee.record_id);
      setStatus("");

      const { error } = await supabase.rpc("remove_attendance_record_for_editor", {
        input_record_id: attendee.record_id,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus(`Absensi ${attendee.full_name} berhasil dihapus dari sesi ini.`);
      await loadSessions(false);
      await loadAttendees(selectedSessionId, search);
    } finally {
      setRemovingRecordId("");
    }
  }

  async function saveMember() {
    if (!selectedAttendee || !form) return;

    try {
      setSaving(true);
      setStatus("");

      const { error } = await supabase.rpc("update_attendance_member_from_session_editor", {
        input_member_id: selectedAttendee.member_id,
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
      await loadAttendees(selectedSessionId, search);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadCoolOptions();
    loadSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="bwc-mobile-page-fix space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-300">Pendataan</p>
        <h2 className="mt-3 text-4xl font-black">Attendance Sessions</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Pilih sesi ibadah, lihat jemaat yang sudah check-in, edit data member, atau hapus absensi dari sesi tersebut.
        </p>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Attendance Sessions</h3>
                <p className="mt-1 text-sm text-slate-500">Klik tanggal ibadah untuk lihat daftar check-in.</p>
              </div>

              <button
                type="button"
                onClick={() => loadSessions(false)}
                disabled={loadingSessions}
                className="rounded-2xl border border-orange-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 max-h-[640px] space-y-3 overflow-auto pr-1">
              {sessions.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  {loadingSessions ? "Loading sessions..." : "Belum ada attendance sessions."}
                </div>
              ) : (
                sessions.map((session) => {
                  const selected = selectedSessionId === session.session_id;

                  return (
                    <button
                      key={session.session_id}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.session_id);
                        setSearch("");
                        loadAttendees(session.session_id, "");
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-orange-300 bg-orange-50" : "border-orange-100 bg-white hover:bg-orange-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{session.title}</p>
                          <p className="mt-1 text-sm font-bold text-slate-500">{formatDate(session.session_date)}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-orange-600">
                            {session.type || "ibadah"}
                          </p>
                        </div>

                        <span className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 ring-1 ring-orange-100">
                          {session.total_checkins}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Total Check-in</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{attendees.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Member Aktif</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{activeAttendees}</p>
            </div>
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Inactive</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{inactiveAttendees}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Daftar Jemaat Check-in</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedSession ? selectedSession.title : "Pilih sesi ibadah dulu"}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selectedSession ? formatDate(selectedSession.session_date) : "Klik salah satu session di kiri."}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadAttendees(selectedSessionId, search);
                  }}
                  className="min-w-0 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="Cari nama / kode / HP..."
                />

                <button
                  type="button"
                  onClick={() => loadAttendees(selectedSessionId, search)}
                  disabled={!selectedSessionId || loadingAttendees}
                  className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
                >
                  Cari
                </button>
              </div>
            </div>

            <div className="mt-5 max-h-[520px] space-y-3 overflow-auto pr-1">
              {!selectedSessionId ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Pilih attendance session dulu dari panel kiri.
                </div>
              ) : attendees.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  {loadingAttendees ? "Loading check-ins..." : "Belum ada jemaat yang check-in di sesi ini."}
                </div>
              ) : (
                attendees.map((attendee) => {
                  const selected = selectedAttendee?.record_id === attendee.record_id;

                  return (
                    <div
                      key={attendee.record_id}
                      className={`rounded-2xl border p-4 transition ${
                        selected ? "border-orange-300 bg-orange-50" : "border-orange-100 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => selectAttendee(attendee)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                            {attendee.photo_url ? (
                              <img src={attendee.photo_url} alt={attendee.full_name} className="h-full w-full object-cover" />
                            ) : (
                              initials(attendee.full_name)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-black text-slate-950">{attendee.full_name}</p>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                attendee.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                              }`}>
                                {attendee.is_active ? "active" : "inactive"}
                              </span>
                            </div>
                            <p className="truncate text-xs font-bold text-slate-500">
                              {attendee.member_code} · {attendee.cool_group_name || "No COOL"}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-400">
                              Check-in: {formatDateTime(attendee.checkin_at)} · {attendee.checkin_method || "manual"}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeAttendance(attendee)}
                          disabled={removingRecordId === attendee.record_id}
                          title="Hapus absensi dari sesi ini"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-lg font-black text-red-600 disabled:opacity-50"
                        >
                          {removingRecordId === attendee.record_id ? "…" : "🗑️"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Edit Data Member</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedAttendee?.full_name || "Pilih jemaat dari list check-in"}
                </h3>
                {selectedAttendee && (
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedAttendee.member_code} · Record absensi tetap aman saat data member diedit.
                  </p>
                )}
              </div>

              {selectedAttendee && (
                <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
                  {selectedAttendee.cool_group_name || "Belum ada COOL"}
                </div>
              )}
            </div>

            {!selectedAttendee || !form ? (
              <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                Klik salah satu jemaat dari daftar check-in untuk mulai edit data.
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
                  <span className="text-sm font-black text-slate-700">Status Member</span>
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
                  <span className="text-sm font-black text-slate-700">Pindah COOL</span>
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
                    onClick={() => selectedAttendee && setForm(toForm(selectedAttendee))}
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
        </div>
      </div>
    </section>
  );
}

