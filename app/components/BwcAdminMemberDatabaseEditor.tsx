"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

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
  cool_meeting_day: string | null;
  cool_location: string | null;
  profile_user_id: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type CoolOption = {
  cool_group_id: string;
  cool_group_name: string;
  meeting_day: string | null;
  location: string | null;
  is_active: boolean;
};

type AuditLog = {
  log_id: string;
  action: string;
  changed_by_email: string | null;
  created_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};

type EditorForm = {
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  gender: string;
  birth_date: string;
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

function toForm(member: MemberRow): EditorForm {
  return {
    full_name: member.full_name || "",
    nickname: member.nickname || "",
    email: member.email || "",
    phone: member.phone || "",
    gender: member.gender || "",
    birth_date: member.birth_date || "",
    address: member.address || "",
    is_active: Boolean(member.is_active),
    cool_group_id: member.cool_group_id || "",
  };
}

export default function BwcAdminMemberDatabaseEditor() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [coolOptions, setCoolOptions] = useState<CoolOption[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => members.filter((item) => item.is_active).length, [members]);
  const inactiveCount = useMemo(() => members.filter((item) => !item.is_active).length, [members]);

  function updateField<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function loadOptions() {
    const { data, error } = await supabase.rpc("admin_get_member_editor_options");

    if (error) {
      setStatus(error.message);
      return;
    }

    setCoolOptions((data || []) as CoolOption[]);
  }

  async function searchMembers(nextSearch = search) {
    try {
      setLoading(true);
      setStatus("");

      const { data, error } = await supabase.rpc("admin_search_members", {
        input_search: nextSearch,
        input_limit: 80,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const rows = (data || []) as MemberRow[];
      setMembers(rows);

      if (!selectedMember && rows.length > 0) {
        selectMember(rows[0]);
      } else if (selectedMember) {
        const refreshed = rows.find((item) => item.member_id === selectedMember.member_id);
        if (refreshed) selectMember(refreshed, false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(memberId: string) {
    const { data, error } = await supabase.rpc("admin_get_member_update_logs", {
      input_member_id: memberId,
    });

    if (!error) {
      setLogs((data || []) as AuditLog[]);
    }
  }

  function selectMember(member: MemberRow, shouldLoadLogs = true) {
    setSelectedMember(member);
    setForm(toForm(member));

    if (shouldLoadLogs) {
      loadLogs(member.member_id);
    }
  }

  async function saveMember() {
    if (!selectedMember || !form) return;

    try {
      setSaving(true);
      setStatus("");

      const { error } = await supabase.rpc("admin_update_member_profile", {
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

      setStatus("Data jemaat berhasil diperbarui.");
      await searchMembers(search);
      await loadLogs(selectedMember.member_id);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadOptions();
    searchMembers("");
  }, []);

  return (
    <section className="bwc-mobile-page-fix space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-300">Admin Database</p>
        <h2 className="mt-3 text-4xl font-black">Database Jemaat</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Edit data jemaat, nomor HP, status keaktifan, dan perpindahan COOL.
        </p>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Total Ditampilkan</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{members.length}</p>
        </div>
        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Aktif</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Tidak Aktif</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{inactiveCount}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">Cari Jemaat</h3>
              <p className="mt-1 text-sm text-slate-500">Cari nama, kode, HP, email, atau COOL.</p>
            </div>

            <button
              type="button"
              onClick={() => searchMembers(search)}
              className="rounded-2xl border border-orange-100 px-4 py-3 text-sm font-black text-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") searchMembers(search);
              }}
              className="min-w-0 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Contoh: Christopher / BWC-00139"
            />
            <button
              type="button"
              onClick={() => searchMembers(search)}
              disabled={loading}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              Cari
            </button>
          </div>

          <div className="mt-5 max-h-[680px] space-y-3 overflow-auto pr-1">
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
                          {member.phone || "No phone"} · {member.email || "No email"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Edit Profile Jemaat</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedMember?.full_name || "Pilih jemaat dulu"}
                </h3>
                {selectedMember && (
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedMember.member_code} · terakhir update {formatDateTime(selectedMember.updated_at)}
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
                Pilih salah satu jemaat dari list kiri untuk mulai edit.
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
                    placeholder="nama@email.com"
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
                  <span className="text-sm font-black text-slate-700">Status Keaktifan</span>
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
                    onClick={() => setForm(toForm(selectedMember))}
                    className="rounded-2xl border border-orange-100 px-5 py-3 text-sm font-black text-slate-700"
                  >
                    Reset Perubahan
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
            <p className="mt-1 text-sm text-slate-500">Audit log perubahan data jemaat ini.</p>

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
                      {formatDateTime(log.created_at)} · {log.changed_by_email || "admin"}
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

