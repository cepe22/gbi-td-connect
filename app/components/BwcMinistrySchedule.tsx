"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type Department = {
  department_id: string;
  department_name: string;
  can_manage: boolean;
  my_role: string | null;
};

type DepartmentMember = {
  member_id: string;
  member_code: string;
  full_name: string;
  photo_url: string | null;
  role: string | null;
  status: string | null;
};

type ScheduleAssignment = {
  assignment_id: string;
  department_id: string;
  department_name: string;
  schedule_month: string;
  service_date: string;
  service_title: string;
  slot_name: string;
  assigned_member_id?: string;
  assigned_member_code?: string;
  assigned_full_name?: string;
  assigned_photo_url?: string | null;
  status: "pending" | "accepted" | "declined" | "tentative";
  response_note: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

function monthValue(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function firstDateOfMonth(value: string) {
  return `${value}-01`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function getSundays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const result: string[] = [];
  const date = new Date(year, monthNumber - 1, 1);

  while (date.getMonth() === monthNumber - 1) {
    if (date.getDay() === 0) {
      result.push(date.toISOString().slice(0, 10));
    }
    date.setDate(date.getDate() + 1);
  }

  return result;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    accepted: "bg-green-50 text-green-700",
    declined: "bg-red-50 text-red-700",
    tentative: "bg-blue-50 text-blue-700",
  };

  const labels: Record<string, string> = {
    pending: "Menunggu konfirmasi",
    accepted: "Accepted",
    declined: "Declined",
    tentative: "Tentative",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[status] || "bg-slate-50 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function BwcMinistrySchedule() {
  const [month, setMonth] = useState(monthValue());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [departmentMembers, setDepartmentMembers] = useState<DepartmentMember[]>([]);
  const [departmentSchedule, setDepartmentSchedule] = useState<ScheduleAssignment[]>([]);
  const [myAssignments, setMyAssignments] = useState<ScheduleAssignment[]>([]);
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTitle, setServiceTitle] = useState("Ibadah BWC 1PM");
  const [slotName, setSlotName] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const sundays = useMemo(() => getSundays(month), [month]);
  const selectedDepartment = departments.find((item) => item.department_id === selectedDepartmentId);

  async function loadInitial() {
    try {
      setLoading(true);
      setStatus("");

      const [deptResult, myAssignmentResult] = await Promise.all([
        supabase.rpc("get_my_schedulable_departments"),
        supabase.rpc("get_my_ministry_assignments", {
          input_month: firstDateOfMonth(month),
        }),
      ]);

      if (deptResult.error) {
        setStatus(deptResult.error.message);
      } else {
        const rows = (deptResult.data || []) as Department[];
        setDepartments(rows);

        if (!selectedDepartmentId && rows.length > 0) {
          setSelectedDepartmentId(rows[0].department_id);
        }
      }

      if (myAssignmentResult.error) {
        setStatus(myAssignmentResult.error.message);
      } else {
        setMyAssignments((myAssignmentResult.data || []) as ScheduleAssignment[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartmentData(departmentId = selectedDepartmentId) {
    if (!departmentId) return;

    try {
      setLoading(true);
      setStatus("");

      const [membersResult, scheduleResult] = await Promise.all([
        supabase.rpc("get_department_member_options", {
          input_department_id: departmentId,
        }),
        supabase.rpc("get_ministry_schedule", {
          input_department_id: departmentId,
          input_month: firstDateOfMonth(month),
        }),
      ]);

      if (membersResult.error) {
        setStatus(membersResult.error.message);
      } else {
        const rows = (membersResult.data || []) as DepartmentMember[];
        setDepartmentMembers(rows);

        if (!assignedMemberId && rows.length > 0) {
          setAssignedMemberId(rows[0].member_id);
        }
      }

      if (scheduleResult.error) {
        setStatus(scheduleResult.error.message);
      } else {
        setDepartmentSchedule((scheduleResult.data || []) as ScheduleAssignment[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadMyAssignments() {
    const { data, error } = await supabase.rpc("get_my_ministry_assignments", {
      input_month: firstDateOfMonth(month),
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setMyAssignments((data || []) as ScheduleAssignment[]);
  }

  async function addAssignment() {
    if (!selectedDepartmentId || !serviceDate || !slotName.trim() || !assignedMemberId) {
      setStatus("Lengkapi department, tanggal, slot pelayanan, dan member yang di-assign.");
      return;
    }

    try {
      setSaving(true);
      setStatus("");

      const { error } = await supabase.rpc("upsert_ministry_schedule_assignment", {
        input_department_id: selectedDepartmentId,
        input_service_date: serviceDate,
        input_service_title: serviceTitle,
        input_slot_name: slotName,
        input_assigned_member_id: assignedMemberId,
        input_assignment_id: null,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Jadwal berhasil ditambahkan. Menunggu konfirmasi user.");
      setSlotName("");
      await loadDepartmentData();
      await loadMyAssignments();
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(assignmentId: string) {
    if (!confirm("Hapus assignment ini?")) return;

    const { error } = await supabase.rpc("delete_ministry_schedule_assignment", {
      input_assignment_id: assignmentId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Assignment dihapus.");
    await loadDepartmentData();
  }

  async function respondAssignment(assignmentId: string, nextStatus: "accepted" | "declined" | "tentative") {
    const { error } = await supabase.rpc("respond_ministry_assignment", {
      input_assignment_id: assignmentId,
      input_status: nextStatus,
      input_response_note: responseNote,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Konfirmasi jadwal berhasil disimpan.");
    setResponseNote("");
    await loadMyAssignments();
    if (selectedDepartmentId) {
      await loadDepartmentData();
    }
  }

  useEffect(() => {
    loadInitial();
  }, [month]);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadDepartmentData(selectedDepartmentId);
    }
  }, [selectedDepartmentId, month]);

  useEffect(() => {
    if (!serviceDate && sundays.length > 0) {
      setServiceDate(sundays[0]);
    }
  }, [sundays, serviceDate]);

  const groupedSchedule = departmentSchedule.reduce<Record<string, ScheduleAssignment[]>>((acc, item) => {
    if (!acc[item.service_date]) acc[item.service_date] = [];
    acc[item.service_date].push(item);
    return acc;
  }, {});

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Ministry Schedule</p>
            <h2 className="mt-3 text-4xl font-black">Jadwal Pelayanan</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              PIC departemen dapat menyusun jadwal pelayanan bulanan. User yang di-assign bisa accept, tentative, atau decline.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-300">Bulan</label>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-950 outline-none"
            />
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Jadwal Saya</h3>
            <p className="mt-1 text-sm text-slate-500">Konfirmasi jadwal pelayanan yang ditugaskan ke kamu.</p>

            <div className="mt-5 space-y-3">
              {myAssignments.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada jadwal pelayanan untuk bulan ini.
                </div>
              ) : (
                myAssignments.map((assignment) => (
                  <div key={assignment.assignment_id} className="rounded-2xl border border-orange-100 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-black text-orange-600">{formatDate(assignment.service_date)}</p>
                        <p className="mt-1 text-lg font-black text-slate-950">{assignment.slot_name}</p>
                        <p className="text-sm text-slate-500">
                          {assignment.department_name} · {assignment.service_title}
                        </p>
                      </div>
                      {statusBadge(assignment.status)}
                    </div>

                    {assignment.response_note && (
                      <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
                        Note: {assignment.response_note}
                      </p>
                    )}

                    {assignment.status === "pending" && (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={responseNote}
                          onChange={(event) => setResponseNote(event.target.value)}
                          className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                          placeholder="Catatan opsional, misalnya kalau perlu tukar jadwal..."
                        />

                        <div className="grid gap-2 md:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => respondAssignment(assignment.assignment_id, "accepted")}
                            className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respondAssignment(assignment.assignment_id, "tentative")}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
                          >
                            Tentative
                          </button>
                          <button
                            type="button"
                            onClick={() => respondAssignment(assignment.assignment_id, "declined")}
                            className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Akses PIC</h3>
            <p className="mt-1 text-sm text-slate-500">
              Departemen yang bisa kamu jadwalkan.
            </p>

            <div className="mt-4 space-y-2">
              {departments.length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Kamu belum terdaftar sebagai PIC departemen.
                </div>
              ) : (
                departments.map((department) => (
                  <button
                    key={department.department_id}
                    type="button"
                    onClick={() => setSelectedDepartmentId(department.department_id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-black ${
                      selectedDepartmentId === department.department_id
                        ? "bg-orange-500 text-white"
                        : "bg-orange-50 text-slate-950"
                    }`}
                  >
                    {department.department_name}
                    <span className="ml-2 text-xs opacity-70">({department.my_role})</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950">Buat Jadwal Bulanan</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedDepartment ? `Department: ${selectedDepartment.department_name}` : "Pilih department terlebih dahulu."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectedDepartmentId && loadDepartmentData()}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
              >
                Refresh
              </button>
            </div>

            {departments.length > 0 && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Tanggal Ibadah</label>
                  <select
                    value={serviceDate}
                    onChange={(event) => setServiceDate(event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    {sundays.map((date) => (
                      <option key={date} value={date}>
                        {formatDate(date)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Nama Ibadah / Event</label>
                  <input
                    value={serviceTitle}
                    onChange={(event) => setServiceTitle(event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Ibadah BWC 1PM"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Slot Pelayanan</label>
                  <input
                    value={slotName}
                    onChange={(event) => setSlotName(event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Contoh: WL, Singer, Usher, Multimedia"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">Assign Member</label>
                  <select
                    value={assignedMemberId}
                    onChange={(event) => setAssignedMemberId(event.target.value)}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    {departmentMembers.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {member.full_name} · {member.role || "member"}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={addAssignment}
                  className="md:col-span-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
                >
                  {saving ? "Menyimpan..." : "Tambah ke Jadwal"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Schedule View</h3>
            <p className="mt-1 text-sm text-slate-500">Rekap jadwal bulan ini beserta status konfirmasi.</p>

            <div className="mt-5 space-y-5">
              {Object.keys(groupedSchedule).length === 0 ? (
                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada jadwal untuk department ini di bulan terpilih.
                </div>
              ) : (
                Object.entries(groupedSchedule).map(([date, assignments]) => (
                  <div key={date} className="rounded-3xl border border-orange-100 p-4">
                    <p className="text-sm font-black text-orange-600">{formatDate(date)}</p>

                    <div className="mt-3 space-y-3">
                      {assignments.map((assignment) => (
                        <div key={assignment.assignment_id} className="flex flex-col gap-3 rounded-2xl bg-orange-50 p-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black text-orange-600">
                              {assignment.assigned_photo_url ? (
                                <img src={assignment.assigned_photo_url} alt={assignment.assigned_full_name} className="h-full w-full object-cover" />
                              ) : (
                                initials(assignment.assigned_full_name)
                              )}
                            </div>

                            <div>
                              <p className="font-black text-slate-950">{assignment.slot_name}</p>
                              <p className="text-sm text-slate-500">
                                {assignment.assigned_full_name} · {assignment.assigned_member_code}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {statusBadge(assignment.status)}
                            <button
                              type="button"
                              onClick={() => deleteAssignment(assignment.assignment_id)}
                              className="rounded-xl bg-white px-3 py-2 text-xs font-black text-red-600"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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

