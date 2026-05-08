"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type CoolGroup = {
  cool_group_id: string;
  cool_group_name: string;
  meeting_day: string | null;
  location: string | null;
  my_role: string | null;
  member_count: number;
  leader_count: number;
  last_attendance_date: string | null;
  last_present_count: number | null;
  last_new_soul_count: number | null;
};

type CoolMember = {
  member_id: string;
  member_code: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
};

type AttendanceRecord = {
  record_id: string;
  attendance_type: "member" | "new_soul";
  member_id: string | null;
  member_code: string | null;
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
  visitor_name: string | null;
  visitor_phone: string | null;
  visitor_note: string | null;
  status: string;
  created_at: string;
};

function nearestFridayValue() {
  const date = new Date();
  const day = date.getDay();
  const diff = (5 - day + 7) % 7;
  date.setDate(date.getDate() + diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateNumber = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateNumber}`;
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

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function BwcCoolAttendanceManager() {
  const [groups, setGroups] = useState<CoolGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [members, setMembers] = useState<CoolMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [meetingDate, setMeetingDate] = useState(nearestFridayValue());
  const [title, setTitle] = useState("COOL Weekly Meeting");
  const [notes, setNotes] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorNote, setVisitorNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState("");
  const [savingVisitor, setSavingVisitor] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.cool_group_id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const presentMemberIds = useMemo(() => {
    return new Set(
      records
        .filter((record) => record.attendance_type === "member" && record.status === "present" && record.member_id)
        .map((record) => record.member_id)
    );
  }, [records]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const haystack = `${member.full_name} ${member.member_code} ${member.nickname || ""} ${member.phone || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [memberSearch, members]);

  const presentMembers = records.filter((record) => record.attendance_type === "member" && record.status === "present");
  const newSouls = records.filter((record) => record.attendance_type === "new_soul");

  async function loadGroups() {
    const { data, error } = await supabase.rpc("get_my_manageable_cool_groups");
    if (error) {
      setStatus(error.message);
      return;
    }
    const rows = (data || []) as CoolGroup[];
    setGroups(rows);
    if (!selectedGroupId && rows.length > 0) setSelectedGroupId(rows[0].cool_group_id);
  }

  async function loadMembers(groupId = selectedGroupId) {
    if (!groupId) return;
    const { data, error } = await supabase.rpc("get_cool_attendance_member_options", {
      input_cool_group_id: groupId,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setMembers((data || []) as CoolMember[]);
  }

  async function prepareSession(groupId = selectedGroupId, date = meetingDate) {
    if (!groupId || !date) return "";
    const { data, error } = await supabase.rpc("get_or_create_cool_attendance_session", {
      input_cool_group_id: groupId,
      input_meeting_date: date,
      input_title: title,
      input_notes: notes,
    });
    if (error) {
      setStatus(error.message);
      return "";
    }
    const id = data as string;
    setSessionId(id);
    return id;
  }

  async function loadRecords(id = sessionId) {
    if (!id) {
      setRecords([]);
      return;
    }
    const { data, error } = await supabase.rpc("get_cool_attendance_records", {
      input_session_id: id,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setRecords((data || []) as AttendanceRecord[]);
  }

  async function loadAll(groupId = selectedGroupId, date = meetingDate) {
    if (!groupId) return;
    try {
      setLoading(true);
      setStatus("");
      await loadMembers(groupId);
      const id = await prepareSession(groupId, date);
      if (id) await loadRecords(id);
    } finally {
      setLoading(false);
    }
  }

  async function markMemberPresent(member: CoolMember) {
    if (!sessionId) return;
    try {
      setSavingMemberId(member.member_id);
      setStatus("");
      const { error } = await supabase.rpc("upsert_cool_member_attendance", {
        input_session_id: sessionId,
        input_member_id: member.member_id,
        input_status: "present",
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      await loadRecords(sessionId);
      await loadGroups();
    } finally {
      setSavingMemberId("");
    }
  }

  async function removeRecord(recordId: string) {
    const { error } = await supabase.rpc("delete_cool_attendance_record", {
      input_record_id: recordId,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadRecords(sessionId);
    await loadGroups();
  }

  async function addNewSoul() {
    if (!sessionId || !visitorName.trim()) return;
    try {
      setSavingVisitor(true);
      setStatus("");
      const { error } = await supabase.rpc("add_cool_new_soul_attendance", {
        input_session_id: sessionId,
        input_visitor_name: visitorName,
        input_visitor_phone: visitorPhone,
        input_visitor_note: visitorNote,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      setVisitorName("");
      setVisitorPhone("");
      setVisitorNote("");
      await loadRecords(sessionId);
      await loadGroups();
    } finally {
      setSavingVisitor(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadAll(selectedGroupId, meetingDate);
  }, [selectedGroupId]);

  return (
    <section className="bwc-mobile-page-fix space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-300">COOL Attendance</p>
        <h2 className="mt-3 text-4xl font-black">Absensi COOL Mingguan</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Untuk gembala COOL mencatat kehadiran anak COOL dan jiwa baru setiap minggu.
        </p>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Pilih COOL</h3>
            <p className="mt-1 text-sm text-slate-500">COOL yang bisa kamu kelola.</p>

            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
            >
              {groups.length === 0 ? (
                <option value="">Belum ada akses gembala COOL</option>
              ) : (
                groups.map((group) => (
                  <option key={group.cool_group_id} value={group.cool_group_id}>
                    {group.cool_group_name}
                  </option>
                ))
              )}
            </select>

            {selectedGroup && (
              <div className="mt-4 rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">COOL Info</p>
                <p className="mt-2 text-lg font-black text-slate-950">{selectedGroup.cool_group_name}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selectedGroup.meeting_day || "-"} · {selectedGroup.location || "-"}
                </p>
                <p className="mt-3 text-xs font-black text-slate-500">
                  {selectedGroup.member_count} anak COOL · role: {selectedGroup.my_role || "gembala"}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Sesi Mingguan</h3>

            <label className="mt-4 block text-sm font-black text-slate-700">Tanggal COOL</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
            />

            <label className="mt-4 block text-sm font-black text-slate-700">Judul / Tema</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Contoh: COOL Weekly Meeting"
            />

            <label className="mt-4 block text-sm font-black text-slate-700">Catatan</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Opsional"
            />

            <button
              type="button"
              onClick={() => loadAll(selectedGroupId, meetingDate)}
              disabled={!selectedGroupId || loading}
              className="mt-4 w-full rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              {loading ? "Loading..." : "Buka / Refresh Absensi"}
            </button>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Tambah Jiwa Baru</h3>
            <p className="mt-1 text-sm text-slate-500">Untuk tamu/jiwa baru yang hadir di COOL.</p>

            <input
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Nama jiwa baru"
            />

            <input
              value={visitorPhone}
              onChange={(event) => setVisitorPhone(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="No. WhatsApp / phone (opsional)"
            />

            <textarea
              value={visitorNote}
              onChange={(event) => setVisitorNote(event.target.value)}
              className="mt-3 min-h-20 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Catatan follow up (opsional)"
            />

            <button
              type="button"
              onClick={addNewSoul}
              disabled={!visitorName.trim() || savingVisitor || !sessionId}
              className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              {savingVisitor ? "Menyimpan..." : "Tambah Jiwa Baru Hadir"}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Anak COOL Hadir</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{presentMembers.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Jiwa Baru</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{newSouls.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">Total Hadir</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{presentMembers.length + newSouls.length}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950">Pilih Anak COOL Hadir</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Pilih dari member yang sudah terdaftar di COOL {selectedGroup?.cool_group_name || ""}.
                </p>
              </div>

              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                className="rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                placeholder="Cari nama / kode..."
              />
            </div>

            <div className="mt-5 grid max-h-[520px] gap-3 overflow-auto pr-1 md:grid-cols-2">
              {filteredMembers.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada anak COOL terdaftar di group ini.
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isPresent = presentMemberIds.has(member.member_id);
                  return (
                    <button
                      key={member.member_id}
                      type="button"
                      onClick={() => markMemberPresent(member)}
                      disabled={isPresent || savingMemberId === member.member_id || !sessionId}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isPresent ? "border-green-100 bg-green-50" : "border-orange-100 bg-white hover:bg-orange-50"
                      } disabled:opacity-75`}
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
                          <p className="truncate font-black text-slate-950">{member.full_name}</p>
                          <p className="truncate text-xs font-bold text-slate-500">{member.member_code}</p>
                          <p className="mt-1 text-xs font-black text-orange-600">
                            {isPresent ? "Sudah ditandai hadir" : "Klik untuk hadir"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Rekap Absensi</h3>
            <p className="mt-1 text-sm text-slate-500">
              {selectedGroup?.cool_group_name || "COOL"} · {formatDate(meetingDate)}
            </p>

            <div className="mt-5 space-y-3">
              {records.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada data kehadiran untuk sesi ini.
                </div>
              ) : (
                records.map((record) => {
                  const displayName =
                    record.attendance_type === "member"
                      ? record.full_name || "Member"
                      : record.visitor_name || "Jiwa Baru";

                  return (
                    <div key={record.record_id} className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black text-orange-600">
                          {record.photo_url ? (
                            <img src={record.photo_url} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            initials(displayName)
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-950">
                            {displayName}
                            {record.attendance_type === "new_soul" ? " · Jiwa Baru" : ""}
                          </p>
                          <p className="text-xs font-bold text-slate-500">
                            {record.member_code || record.visitor_phone || "No phone"}
                          </p>
                          {record.visitor_note && <p className="mt-1 text-xs text-slate-500">{record.visitor_note}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecord(record.record_id)}
                        className="rounded-xl border border-orange-100 bg-white px-3 py-2 text-xs font-black text-orange-600"
                      >
                        Hapus
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

