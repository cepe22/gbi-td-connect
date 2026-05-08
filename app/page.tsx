"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";
import BwcContactChat from "./components/BwcContactChat";
import BwcMinistrySchedule from "./components/BwcMinistrySchedule";
import BwcMyCoolDynamic from "./components/BwcMyCoolDynamic";

type Member = {
  id: string;
  member_code: string;
  qr_code_value: string;
  full_name: string;
  photo_url: string | null;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  membership_status: string;
  attendance_status: string;
  joined_at: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  created_at: string;
  updated_at?: string | null;
};

type BwcPost = any;
type BwcComment = any;

type MyCoolInfo = {
  member_id: string;
  cool_group_id: string | null;
  cool_group_name: string | null;
  total_members: number | null;
};

type MyMinistry = {
  department_id: string;
  department_name: string;
  role: string;
  source_note: string | null;
  is_active: boolean;
};

type DepartmentMemberItem = {
  member_id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
  photo_url: string | null;
  role: string;
  source_note: string | null;
};

type DepartmentOverview = {
  department_id: string;
  department_name: string;
  total_members: number;
  members: DepartmentMemberItem[];
};

type BwcAttendanceRecord = {
  record_id: string;
  checked_in_at: string;
  member_id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
  photo_url: string | null;
  scanned_by_user_id: string | null;
};

type BwcAttendanceOverview = {
  session_id: string;
  session_title: string;
  session_date: string;
  total_attendance: number;
  records: BwcAttendanceRecord[];
};

type BwcScanResult = {
  status: string;
  message: string;
  member_id: string | null;
  member_name: string | null;
  member_code: string | null;
  session_id: string | null;
  session_title: string | null;
  session_date: string | null;
  total_attendance: number;
};

type AdminProfileViewerData = {
  member: Member;
  ministries: {
    department_id: string;
    department_name: string;
    role: string;
    source_note: string | null;
    is_active: boolean;
  }[];
  attendance_summary: {
    total_attendance?: number;
    last_checkin?: string | null;
  };
  recent_attendance: {
    record_id: string;
    checked_in_at: string;
    session_title: string;
    session_type: string | null;
    session_date: string;
  }[];
};

type BwcAnalyticsOverview = {
  months: number;
  from_date: string;
  total_sessions: number;
  total_checkins: number;
  avg_attendance: number;
  last_session_date: string | null;
  last_session_attendance: number;
  active_members: number;
  unique_attendees_30d: number;
  unique_attendees_90d: number;
};

type BwcTrendItem = {
  session_date?: string;
  title?: string;
  total_attendance: number;
  month?: string;
  total_checkins?: number;
  avg_attendance?: number;
  sessions?: number;
};

type BwcCoolBreakdownItem = {
  cool_group: string;
  total_checkins: number;
  unique_members: number;
};

type BwcAnalyticsMemberRisk = {
  member_id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
  photo_url: string | null;
  cool_group: string;
  last_30_days: number;
  previous_30_days: number;
  last_90_days: number;
  last_seen: string | null;
  days_since_last?: number | null;
  risk_status?: string;
  change_count?: number;
};

type BwcAnalyticsData = {
  overview: BwcAnalyticsOverview;
  weekly_trend: BwcTrendItem[];
  monthly_trend: BwcTrendItem[];
  cool_breakdown: BwcCoolBreakdownItem[];
  declining_members: BwcAnalyticsMemberRisk[];
  at_risk_members: BwcAnalyticsMemberRisk[];
  recent_sessions: BwcTrendItem[];
};

type BwcEventComment = {
  id: string;
  content: string;
  created_at: string;
  member_name: string;
  member_code: string;
  photo_url: string | null;
};

type BwcEventFeedItem = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  description: string | null;
  ig_url: string | null;
  image_url: string | null;
  service_times: string[];
  created_at: string;
  total_likes: number;
  total_comments: number;
  total_rsvps: number;
  liked_by_me: boolean;
  reminder_by_me: boolean;
  my_rsvp_service_time: string | null;
  comments: BwcEventComment[];
  rsvp_summary: Record<string, number>;
};

type AttendanceSession = {
  id: string;
  title: string;
  type: string;
  session_date: string;
  is_active: boolean;
};

type ClaimResult = {
  status: string;
  message: string;
  linked_member_id: string | null;
  linked_member_name: string | null;
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "?";
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function statusTone(status: string): "green" | "orange" | "red" | "blue" | "slate" {
  if (status === "active" || status === "active_member") return "green";
  if (status === "new_member") return "blue";
  if (status === "need_follow_up" || status === "rarely_attend") return "orange";
  if (status === "inactive") return "red";
  return "slate";
}

function syncProfileFormFromMember(
  member: Member,
  setProfileForm: React.Dispatch<React.SetStateAction<{
    nickname: string;
    phone: string;
    email: string;
    birth_date: string;
    gender: string;
    address: string;
  }>>
) {
  setProfileForm({
    nickname: member.nickname || "",
    phone: member.phone || "",
    email: member.email || "",
    birth_date: toDateInputValue(member.birth_date),
    gender: member.gender || "unknown",
    address: member.address || "",
  });
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [linkedMember, setLinkedMember] = useState<Member | null>(null);
  const [memberQrDataUrl, setMemberQrDataUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [bwcPosts, setBwcPosts] = useState<BwcPost[]>([]);
  const [bwcComments, setBwcComments] = useState<Record<string, BwcComment[]>>({});
  const [newPost, setNewPost] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [bwcAttendanceOverview, setBwcAttendanceOverview] = useState<BwcAttendanceOverview | null>(null);
  const [manualScanQr, setManualScanQr] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [bwcScannerSession, setBwcScannerSession] = useState<any | null>(null);
  const [bwcScannerRecent, setBwcScannerRecent] = useState<any[]>([]);
  const [bwcScannerManualValue, setBwcScannerManualValue] = useState("");
  const [bwcScannerBusy, setBwcScannerBusy] = useState(false);
  const [bwcCameraActive, setBwcCameraActive] = useState(false);
  const [bwcScannerStatus, setBwcScannerStatus] = useState("");
  const bwcQrScannerRef = useRef<any>(null);
  const bwcLastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const [bwcEvents, setBwcEvents] = useState<BwcEventFeedItem[]>([]);
  const [eventCommentInputs, setEventCommentInputs] = useState<Record<string, string>>({});
  const [eventForm, setEventForm] = useState({
    title: "",
    event_date: "",
    location: "GBI Tanjung Duren, Lt.3",
    description: "",
    ig_url: "",
    image_url: "",
    service_times: "10.00 WIB, 13.00 WIB",
  });
  const [eventPosting, setEventPosting] = useState(false);
  const [bwcAnalytics, setBwcAnalytics] = useState<BwcAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const bwcScannerRef = useRef<any>(null);
  const scanLockRef = useRef(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [adminProfileSearch, setAdminProfileSearch] = useState("");
  const [adminProfileData, setAdminProfileData] = useState<AdminProfileViewerData | null>(null);
  const [adminProfileLoading, setAdminProfileLoading] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [myMinistries, setMyMinistries] = useState<MyMinistry[]>([]);
  const [myCoolInfo, setMyCoolInfo] = useState<MyCoolInfo | null>(null);
  const [departmentOverview, setDepartmentOverview] = useState<DepartmentOverview[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "departments" | "profileViewer" | "analytics" | "events" | "scanner" | "contacts" | "ministrySchedule">("dashboard");
  const [memberTab, setMemberTab] = useState<"home" | "qr" | "schedule" | "cool" | "forum" | "analytics" | "scan" | "profile" | "contacts" | "ministrySchedule">("home");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("admin@gbitd.org");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [claimPhone, setClaimPhone] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claimName, setClaimName] = useState("");

  const [profileForm, setProfileForm] = useState({
    nickname: "",
    phone: "",
    email: "",
    birth_date: "",
    gender: "unknown",
    address: "",
  });

  const [newMember, setNewMember] = useState({
    full_name: "",
    phone: "",
    email: "",
  });

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [qrInput, setQrInput] = useState("BWC-00001");

  const isAdmin = roles.includes("admin");
  const isUsher = roles.includes("usher") || isAdmin;

  const activeMembers = useMemo(() => {
    return members.filter((member) => member.attendance_status === "active").length;
  }, [members]);

  const followUpMembers = useMemo(() => {
    return members.filter((member) =>
      ["need_follow_up", "rarely_attend", "inactive"].includes(member.attendance_status)
    );
  }, [members]);

  const filteredAdminProfileMembers = useMemo(() => {
    const keyword = adminProfileSearch.trim().toLowerCase();

    if (!keyword) return members.slice(0, 80);

    return members
      .filter((member) =>
        [
          member.full_name,
          member.nickname || "",
          member.member_code,
          member.phone || "",
          member.email || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 80);
  }, [members, adminProfileSearch]);

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
    function BwcAnalyticsDashboardBrokenUnused() {
    const data = bwcAnalytics;
    const weeklyTrend = data?.weekly_trend || [];
    const monthlyTrend = data?.monthly_trend || [];
    const coolBreakdown = data?.cool_breakdown || [];
    const decliningMembers = data?.declining_members || [];
    const atRiskMembers = data?.at_risk_members || [];
    const recentSessions = data?.recent_sessions || [];
    const maxWeekly = Math.max(1, ...weeklyTrend.map((item) => item.total_attendance || 0));
    const maxMonthly = Math.max(1, ...monthlyTrend.map((item) => item.avg_attendance || item.total_checkins || 0));
    const maxCool = Math.max(1, ...coolBreakdown.map((item) => item.total_checkins || 0));

    if (analyticsLoading && !data) {
      return (
        <Card>
          <p className="text-lg font-black text-slate-950">Loading analytics...</p>
          <p className="mt-1 text-sm text-slate-500">Sedang mengambil data kehadiran BWC.</p>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card>
          <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
            <p className="text-2xl font-black text-slate-950">Belum ada analytics yang dimuat</p>
            <p className="mt-2 text-sm text-slate-500">Klik tombol refresh untuk mengambil data absensi terbaru.</p>
            <button
              onClick={fetchBwcAnalytics}
              className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
            >
              Load Analytics
            </button>
          </div>
        </Card>
      );
    }

    return (
      <section className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Attendance Analytics</p>
              <h2 className="mt-3 text-4xl font-black">Dashboard Kehadiran</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Pantau tren kedatangan, performa per COOL, dan member yang mulai jarang hadir dalam 1–3 bulan terakhir.
              </p>
            </div>
            <button
              onClick={fetchBwcAnalytics}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              {analyticsLoading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Last Attendance</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview.last_session_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{formatAnalyticsDate(data.overview.last_session_date)}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Average / Ibadah</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview.avg_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Last {data.overview.months} months</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Unique 30 Hari</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview.unique_attendees_30d || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Member hadir 30 hari terakhir</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">At Risk</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{atRiskMembers.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Perlu follow-up</p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950">Trend Kedatangan Mingguan</h3>
                <p className="text-sm text-slate-500">Jumlah check-in per ibadah BWC 1PM.</p>
              </div>
            </div>

            <div className="flex h-72 items-end gap-2 overflow-x-auto rounded-3xl bg-orange-50 p-4">
              {weeklyTrend.slice(-20).map((item) => (
                <div key={item.session_date} className="flex h-full min-w-[42px] flex-col items-center justify-end gap-2">
                  <div className="text-xs font-black text-slate-700">{item.total_attendance}</div>
                  <div
                    className="w-full rounded-t-2xl bg-orange-500"
                    style={{ height: `${Math.max(8, (item.total_attendance / maxWeekly) * 210)}px` }}
                    title={`${formatAnalyticsDate(item.session_date)}: ${item.total_attendance}`}
                  />
                  <div className="-rotate-45 whitespace-nowrap text-[10px] font-bold text-slate-400">
                    {formatAnalyticsDate(item.session_date)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Monthly Average</h3>
            <p className="mt-1 text-sm text-slate-500">Rata-rata kedatangan per bulan.</p>

            <div className="mt-5 space-y-4">
              {monthlyTrend.map((item) => {
                const value = item.avg_attendance || item.total_checkins || 0;

                return (
                  <div key={item.month}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-700">{formatAnalyticsMonth(item.month)}</span>
                      <span className="font-black text-slate-950">{value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, (value / maxMonthly) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Kehadiran per COOL</h3>
            <p className="mt-1 text-sm text-slate-500">Total check-in 90 hari terakhir.</p>

            <div className="mt-5 space-y-3">
              {coolBreakdown.length === 0 ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Belum ada data COOL.</p>
              ) : (
                coolBreakdown.map((item) => (
                  <div key={item.cool_group}>
                    <div className="mb-1 flex justify-between gap-4 text-sm">
                      <span className="font-black text-slate-950">{item.cool_group}</span>
                      <span className="font-bold text-slate-500">{item.total_checkins} check-in · {item.unique_members} member</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, (item.total_checkins / maxCool) * 100)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Recent Sessions</h3>
            <p className="mt-1 text-sm text-slate-500">12 ibadah terakhir.</p>

            <div className="mt-5 space-y-2">
              {recentSessions.map((item) => (
                <div key={item.session_date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                  <div>
                    <p className="font-black text-slate-950">{formatAnalyticsDate(item.session_date)}</p>
                    <p className="text-xs font-bold text-slate-500">{item.title || "Ibadah BWC 1PM"}</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">{item.total_attendance}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Mulai Jarang Hadir</h3>
            <p className="mt-1 text-sm text-slate-500">Member yang kedatangannya turun dibanding 30 hari sebelumnya.</p>

            <div className="mt-5 space-y-3">
              {decliningMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Belum ada penurunan signifikan yang terdeteksi.</p>
              ) : (
                decliningMembers.slice(0, 20).map((member) => (
                  <div key={member.member_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(member.full_name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">{member.full_name}</p>
                      <p className="text-xs text-slate-500">{member.cool_group} · Last seen {formatAnalyticsDate(member.last_seen)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">{member.previous_30_days} → {member.last_30_days}</p>
                      <p className="text-xs font-bold text-slate-400">30 hari</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Perlu Follow-up</h3>
            <p className="mt-1 text-sm text-slate-500">Tidak hadir 30–90 hari, sangat jarang, atau belum ada riwayat.</p>

            <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
              {atRiskMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Tidak ada member at-risk.</p>
              ) : (
                atRiskMembers.slice(0, 50).map((member) => (
                  <div key={member.member_id} className="rounded-2xl border border-orange-100 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                        {member.photo_url ? (
                          <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{getInitials(member.full_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.cool_group} · {member.phone || "-"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">{riskStatusLabel(member.risk_status)}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">90d: {member.last_90_days}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last: {formatAnalyticsDate(member.last_seen)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    );
  }


  const BwcAnalyticsDashboard = () => {
    const data = bwcAnalytics;
    const weeklyTrend = data?.weekly_trend || [];
    const monthlyTrend = data?.monthly_trend || [];
    const coolBreakdown = data?.cool_breakdown || [];
    const decliningMembers = data?.declining_members || [];
    const atRiskMembers = data?.at_risk_members || [];
    const recentSessions = data?.recent_sessions || [];
    const maxWeekly = Math.max(1, ...weeklyTrend.map((item) => item.total_attendance || 0));
    const maxMonthly = Math.max(1, ...monthlyTrend.map((item) => item.avg_attendance || item.total_checkins || 0));
    const maxCool = Math.max(1, ...coolBreakdown.map((item) => item.total_checkins || 0));

    if (analyticsLoading && !data) {
      return (
        <Card>
          <p className="text-lg font-black text-slate-950">Loading analytics...</p>
          <p className="mt-1 text-sm text-slate-500">Sedang mengambil data kehadiran BWC.</p>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card>
          <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
            <p className="text-2xl font-black text-slate-950">Belum ada analytics yang dimuat</p>
            <p className="mt-2 text-sm text-slate-500">Klik tombol refresh untuk mengambil data absensi terbaru.</p>
            <button
              onClick={fetchBwcAnalytics}
              className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
            >
              Load Analytics
            </button>
          </div>
        </Card>
      );
    }

    return (
      <section className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Attendance Analytics</p>
              <h2 className="mt-3 text-4xl font-black">Dashboard Kehadiran</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Pantau tren kedatangan, performa per COOL, dan member yang mulai jarang hadir dalam 1–3 bulan terakhir.
              </p>
            </div>
            <button
              onClick={fetchBwcAnalytics}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              {analyticsLoading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Last Attendance</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.last_session_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{formatAnalyticsDate(data.overview?.last_session_date)}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Average / Ibadah</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.avg_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Last {data.overview?.months || 6} months</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Unique 30 Hari</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.unique_attendees_30d || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Member hadir 30 hari terakhir</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">At Risk</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{atRiskMembers.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Perlu follow-up</p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Trend Kedatangan Mingguan</h3>
            <p className="mt-1 text-sm text-slate-500">Jumlah check-in per ibadah BWC 1PM.</p>

            <div className="mt-5 flex h-72 items-end gap-2 overflow-x-auto rounded-3xl bg-orange-50 p-4">
              {weeklyTrend.slice(-20).map((item) => (
                <div key={item.session_date} className="flex h-full min-w-[42px] flex-col items-center justify-end gap-2">
                  <div className="text-xs font-black text-slate-700">{item.total_attendance}</div>
                  <div
                    className="w-full rounded-t-2xl bg-orange-500"
                    style={{ height: `${Math.max(8, ((item.total_attendance || 0) / maxWeekly) * 210)}px` }}
                    title={`${formatAnalyticsDate(item.session_date)}: ${item.total_attendance}`}
                  />
                  <div className="-rotate-45 whitespace-nowrap text-[10px] font-bold text-slate-400">
                    {formatAnalyticsDate(item.session_date)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Monthly Average</h3>
            <p className="mt-1 text-sm text-slate-500">Rata-rata kedatangan per bulan.</p>

            <div className="mt-5 space-y-4">
              {monthlyTrend.map((item) => {
                const value = item.avg_attendance || item.total_checkins || 0;

                return (
                  <div key={item.month}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-700">{formatAnalyticsMonth(item.month)}</span>
                      <span className="font-black text-slate-950">{value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, (value / maxMonthly) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Kehadiran per COOL</h3>
            <p className="mt-1 text-sm text-slate-500">Total check-in 90 hari terakhir.</p>

            <div className="mt-5 space-y-3">
              {coolBreakdown.length === 0 ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Belum ada data COOL.</p>
              ) : (
                coolBreakdown.map((item) => (
                  <div key={item.cool_group}>
                    <div className="mb-1 flex justify-between gap-4 text-sm">
                      <span className="font-black text-slate-950">{item.cool_group}</span>
                      <span className="font-bold text-slate-500">{item.total_checkins} check-in · {item.unique_members} member</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, ((item.total_checkins || 0) / maxCool) * 100)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Recent Sessions</h3>
            <p className="mt-1 text-sm text-slate-500">12 ibadah terakhir.</p>

            <div className="mt-5 space-y-2">
              {recentSessions.map((item) => (
                <div key={item.session_date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                  <div>
                    <p className="font-black text-slate-950">{formatAnalyticsDate(item.session_date)}</p>
                    <p className="text-xs font-bold text-slate-500">{item.title || "Ibadah BWC 1PM"}</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">{item.total_attendance}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Mulai Jarang Hadir</h3>
            <p className="mt-1 text-sm text-slate-500">Member yang kedatangannya turun dibanding 30 hari sebelumnya.</p>

            <div className="mt-5 space-y-3">
              {decliningMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Belum ada penurunan signifikan yang terdeteksi.</p>
              ) : (
                decliningMembers.slice(0, 20).map((member) => (
                  <div key={member.member_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(member.full_name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">{member.full_name}</p>
                      <p className="text-xs text-slate-500">{member.cool_group} · Last seen {formatAnalyticsDate(member.last_seen)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">{member.previous_30_days} → {member.last_30_days}</p>
                      <p className="text-xs font-bold text-slate-400">30 hari</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Perlu Follow-up</h3>
            <p className="mt-1 text-sm text-slate-500">Tidak hadir 30–90 hari, sangat jarang, atau belum ada riwayat.</p>

            <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
              {atRiskMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Tidak ada member at-risk.</p>
              ) : (
                atRiskMembers.slice(0, 50).map((member) => (
                  <div key={member.member_id} className="rounded-2xl border border-orange-100 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                        {member.photo_url ? (
                          <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{getInitials(member.full_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.cool_group} · {member.phone || "-"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">{riskStatusLabel(member.risk_status)}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">90d: {member.last_90_days}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last: {formatAnalyticsDate(member.last_seen)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    );
  };


  if (!session) return;

    fetchRoles();
    fetchLinkedMember();
  }, [session]);

  useEffect(() => {
    return () => {
      if (bwcScannerRef.current) {
        bwcScannerRef.current.stop?.().catch?.(() => {});
        bwcScannerRef.current.clear?.().catch?.(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (memberTab !== "scan") return;
    fetchBwcAttendanceToday();
  }, [memberTab]);

  useEffect(() => {
    if (!linkedMember) return;

    setProfileForm({
      nickname: linkedMember.nickname || "",
      phone: linkedMember.phone || "",
      email: linkedMember.email || "",
      birth_date: toDateInputValue(linkedMember.birth_date),
      gender: linkedMember.gender || "unknown",
      address: linkedMember.address || "",
    });
  }, [
    linkedMember?.id,
    linkedMember?.nickname,
    linkedMember?.phone,
    linkedMember?.email,
    linkedMember?.birth_date,
    linkedMember?.gender,
    linkedMember?.address,
  ]);

  useEffect(() => {
    if (!linkedMember?.qr_code_value) {
      setMemberQrDataUrl("");
      return;
    }

    QRCode.toDataURL(linkedMember.qr_code_value, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(setMemberQrDataUrl)
      .catch(() => setMemberQrDataUrl(""));
  }, [linkedMember?.qr_code_value]);

  useEffect(() => {
    if (!session || !linkedMember) return;

    fetchBwcForum();
  }, [session?.user.id, linkedMember?.id]);

  useEffect(() => {
    if (!session || !linkedMember) return;

    fetchBwcEvents();
  }, [session?.user.id, linkedMember?.id]);

  useEffect(() => {
    if (!session) return;
    if (!isAdmin && !isUsher) return;

    fetchMembers();
    fetchAttendanceSessions();
  }, [session, roles.join("|")]);

  useEffect(() => {
    if (!session || !linkedMember) return;

    fetchMyMinistries();
  }, [session?.user.id, linkedMember?.id]);

  useEffect(() => {
    if (!session || !linkedMember) return;

    fetchMyCoolInfo();
  }, [session?.user.id, linkedMember?.id]);

  useEffect(() => {
    if (!session || !isAdmin) return;

    fetchDepartmentOverview();
  }, [session?.user.id, isAdmin]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Login berhasil.");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!signupName.trim()) {
      setMessage("Nama lengkap wajib diisi.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: signupName,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data.session) {
      setMessage("Akun berhasil dibuat. Cek email untuk konfirmasi, lalu login.");
      setAuthMode("login");
      setLoginEmail(signupEmail);
      return;
    }

    setMessage("Akun berhasil dibuat. Silakan claim profile kamu.");
  }


  async function signInWithGoogle() {
    setMessage("");

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin,
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]);
    setLinkedMember(null);
    setMembers([]);
    setAttendanceSessions([]);
    setMessage("");
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

  async function fetchLinkedMember() {
    if (!session) return;

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("profile_user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    const member = data as Member | null;
    setLinkedMember(member);

    if (member) {
      setProfileForm({
        nickname: member.nickname || "",
        phone: member.phone || "",
        email: member.email || "",
        birth_date: toDateInputValue(member.birth_date),
        gender: member.gender || "unknown",
        address: member.address || "",
      });
    }
  }

  async function claimByPhone(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.rpc("claim_member_profile_by_phone", {
      input_phone: claimPhone,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = (Array.isArray(data) ? data[0] : data) as ClaimResult;
    setMessage(result?.message || "Claim selesai.");
    await fetchRoles();
    await fetchLinkedMember();
  }

  async function claimByCode(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.rpc("claim_member_profile_by_code", {
      input_member_code: claimCode,
      input_full_name: claimName,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = (Array.isArray(data) ? data[0] : data) as ClaimResult;
    setMessage(result?.message || "Claim selesai.");
    await fetchRoles();
    await fetchLinkedMember();
  }

  function downloadMyQr() {
    if (!memberQrDataUrl || !linkedMember) return;

    const link = document.createElement("a");
    link.href = memberQrDataUrl;
    link.download = `${linkedMember.member_code}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const canScanBwcAttendance = useMemo(() => {
    return myMinistries.some((item) => item.department_name?.trim().toLowerCase() === "pendataan");
  }, [myMinistries]);

  useEffect(() => {
    if (!session) return;

    const shouldFetchAdminAnalytics = isAdmin && activeTab === "analytics";
    const shouldFetchPendataanAnalytics = canScanBwcAttendance && memberTab === "analytics";

    if (shouldFetchAdminAnalytics || shouldFetchPendataanAnalytics) {
      fetchBwcAnalytics();
    }
  }, [session?.user.id, isAdmin, activeTab, canScanBwcAttendance, memberTab]);

  async function fetchBwcAttendanceToday() {
    if (!canScanBwcAttendance) return;

    const { data, error } = await supabase.rpc("get_bwc_1pm_attendance_today");

    if (error) {
      setScanMessage(error.message);
      return;
    }

    const overview = Array.isArray(data) ? data[0] : data;
    setBwcAttendanceOverview((overview || null) as BwcAttendanceOverview | null);
  }

  async function checkinBwcQr(qrValue: string) {
    const cleanQr = qrValue.trim();

    if (!cleanQr) {
      setScanMessage("QR/member code kosong.");
      return;
    }

    try {
      setScanBusy(true);
      setScanMessage("");

      const { data, error } = await supabase.rpc("checkin_bwc_1pm_by_qr", {
        input_qr_code: cleanQr,
      });

      if (error) {
        setScanMessage(error.message);
        return;
      }

      const result = (Array.isArray(data) ? data[0] : data) as BwcScanResult | null;

      setScanMessage(result?.message || "Scan selesai.");
      setManualScanQr("");

      await fetchBwcAttendanceToday();
    } finally {
      setScanBusy(false);
    }
  }

  async function handleManualBwcScan(e: React.FormEvent) {
    e.preventDefault();
    await checkinBwcQr(manualScanQr);
  }

  async function startBwcQrScanner() {
    if (scannerRunning) return;

    if (!canScanBwcAttendance) {
      setScanMessage("Akun ini belum memiliki akses Pendataan.");
      return;
    }

    try {
      setScanMessage("");

      const qrModule: any = await import("html5-qrcode");
      const Html5Qrcode = qrModule.Html5Qrcode;

      const scanner = new Html5Qrcode("bwc-qr-reader");
      bwcScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
        },
        async (decodedText: string) => {
          if (scanLockRef.current) return;

          scanLockRef.current = true;
          await checkinBwcQr(decodedText);

          window.setTimeout(() => {
            scanLockRef.current = false;
          }, 1800);
        },
        () => {}
      );

      setScannerRunning(true);
      setScanMessage("Scanner aktif. Arahkan kamera ke QR member.");
    } catch (error: any) {
      setScanMessage(error?.message || "Gagal membuka kamera scanner.");
      setScannerRunning(false);
    }
  }

  async function stopBwcQrScanner() {
    try {
      if (bwcScannerRef.current) {
        await bwcScannerRef.current.stop?.();
        await bwcScannerRef.current.clear?.();
      }
    } catch {
      // ignore scanner stop error
    } finally {
      bwcScannerRef.current = null;
      setScannerRunning(false);
      setScanMessage("Scanner dihentikan.");
    }
  }

  function formatAttendanceTime(value: string) {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  async function fetchBwcAnalytics() {
    try {
      setAnalyticsLoading(true);
      setMessage("");

      const { data, error } = await supabase.rpc("get_bwc_attendance_analytics", {
        input_months: 6,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      setBwcAnalytics((result || null) as BwcAnalyticsData | null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function formatAnalyticsDate(value?: string | null) {
    if (!value) return "-";

    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
      }).format(new Date(`${value}T00:00:00`));
    } catch {
      return value || "-";
    }
  }

  function formatAnalyticsMonth(value?: string | null) {
    if (!value) return "-";

    try {
      return new Intl.DateTimeFormat("id-ID", {
        month: "short",
        year: "2-digit",
      }).format(new Date(`${value}-01T00:00:00`));
    } catch {
      return value || "-";
    }
  }

  function riskStatusLabel(value?: string) {
    const labels: Record<string, string> = {
      belum_ada_riwayat: "Belum ada riwayat",
      tidak_hadir_90_hari: "Tidak hadir 90+ hari",
      tidak_hadir_60_hari: "Tidak hadir 60+ hari",
      tidak_hadir_30_hari: "Tidak hadir 30+ hari",
      sangat_jarang_90_hari: "Sangat jarang 90 hari",
      perlu_diperhatikan: "Perlu diperhatikan",
    };

    return labels[value || ""] || "Perlu dicek";
  }

  async function fetchBwcEvents() {
    const { data, error } = await supabase.rpc("get_bwc_events_feed");

    if (error) {
      setMessage(error.message);
      return;
    }

    setBwcEvents((data || []) as BwcEventFeedItem[]);
  }

  async function createBwcEvent(e: React.FormEvent) {
    e.preventDefault();

    const serviceTimes = eventForm.service_times
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!eventForm.title.trim()) {
      setMessage("Judul event wajib diisi.");
      return;
    }

    if (!eventForm.event_date) {
      setMessage("Tanggal event wajib diisi.");
      return;
    }

    try {
      setEventPosting(true);
      setMessage("");

      const { error } = await supabase.rpc("admin_create_bwc_event", {
        input_title: eventForm.title.trim(),
        input_event_date: eventForm.event_date,
        input_location: eventForm.location.trim() || null,
        input_description: eventForm.description.trim() || null,
        input_ig_url: eventForm.ig_url.trim() || null,
        input_image_url: eventForm.image_url.trim() || null,
        input_service_times: serviceTimes.length > 0 ? serviceTimes : ["13.00 WIB"],
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setEventForm({
        title: "",
        event_date: "",
        location: "GBI Tanjung Duren, Lt.3",
        description: "",
        ig_url: "",
        image_url: "",
        service_times: "10.00 WIB, 13.00 WIB",
      });

      await fetchBwcEvents();
      setMessage("Event broadcast berhasil dipublish ke forum.");
    } finally {
      setEventPosting(false);
    }
  }

  async function toggleEventLike(eventId: string) {
    const { error } = await supabase.rpc("toggle_bwc_event_like", {
      input_event_id: eventId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await fetchBwcEvents();
  }

  async function toggleEventReminder(eventId: string) {
    const { error } = await supabase.rpc("toggle_bwc_event_reminder", {
      input_event_id: eventId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await fetchBwcEvents();
  }

  async function setEventRsvp(eventId: string, serviceTime: string) {
    const { error } = await supabase.rpc("set_bwc_event_rsvp", {
      input_event_id: eventId,
      input_service_time: serviceTime,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await fetchBwcEvents();
  }

  async function createEventComment(eventId: string) {
    const content = (eventCommentInputs[eventId] || "").trim();

    if (!content) return;

    const { error } = await supabase.rpc("create_bwc_event_comment", {
      input_event_id: eventId,
      input_content: content,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setEventCommentInputs((prev) => ({ ...prev, [eventId]: "" }));
    await fetchBwcEvents();
  }

  function formatEventDate(value: string) {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function fetchBwcForum() {
    const { data: posts, error: postsError } = await supabase
      .from("bwc_posts")
      .select(`
        id,
        content,
        created_at,
        author_user_id,
        author_member_id,
        members:author_member_id (
          full_name,
          member_code,
          photo_url
        )
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (postsError) {
      setMessage(postsError.message);
      return;
    }

    setBwcPosts(posts || []);

    const postIds = (posts || []).map((post: any) => post.id);
    if (postIds.length === 0) {
      setBwcComments({});
      return;
    }

    const { data: comments, error: commentsError } = await supabase
      .from("bwc_post_comments")
      .select(`
        id,
        post_id,
        content,
        created_at,
        author_user_id,
        author_member_id,
        members:author_member_id (
          full_name,
          member_code,
          photo_url
        )
      `)
      .in("post_id", postIds)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (commentsError) {
      setMessage(commentsError.message);
      return;
    }

    const grouped: Record<string, BwcComment[]> = {};
    (comments || []).forEach((comment: any) => {
      if (!grouped[comment.post_id]) grouped[comment.post_id] = [];
      grouped[comment.post_id].push(comment);
    });

    setBwcComments(grouped);
  }

  async function createBwcPost(e: React.FormEvent) {
    e.preventDefault();

    if (!session || !linkedMember) {
      setMessage("Kamu perlu login dan claim profile dulu.");
      return;
    }

    const content = newPost.trim();

    if (!content) {
      setMessage("Isi post tidak boleh kosong.");
      return;
    }

    if (content.length > 1000) {
      setMessage("Post maksimal 1000 karakter.");
      return;
    }

    try {
      setPosting(true);
      setMessage("");

      const { error } = await supabase.from("bwc_posts").insert({
        author_user_id: session.user.id,
        author_member_id: linkedMember.id,
        content,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setNewPost("");
      await fetchBwcForum();
      setMemberTab("forum");
    } finally {
      setPosting(false);
    }
  }

  async function createBwcComment(postId: string) {
    if (!session || !linkedMember) {
      setMessage("Kamu perlu login dan claim profile dulu.");
      return;
    }

    const content = (commentInputs[postId] || "").trim();

    if (!content) return;

    if (content.length > 500) {
      setMessage("Komentar maksimal 500 karakter.");
      return;
    }

    const { error } = await supabase.from("bwc_post_comments").insert({
      post_id: postId,
      author_user_id: session.user.id,
      author_member_id: linkedMember.id,
      content,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    await fetchBwcForum();
  }

  function formatPostDate(value: string) {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  async function uploadMyProfilePicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!session) {
      setMessage("Session tidak ditemukan. Silakan login ulang.");
      return;
    }

    if (!linkedMember) {
      setMessage("Profile belum terhubung dengan data member.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("File harus berupa gambar JPG, PNG, atau WebP.");
      return;
    }

    const maxSizeInBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setMessage("Ukuran foto maksimal 2MB. Coba compress atau pilih foto yang lebih kecil.");
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage("");

      const rawExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(rawExtension)
        ? rawExtension
        : "jpg";

      const filePath = `${session.user.id}/avatar-${Date.now()}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("member-avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        setMessage(`Upload foto gagal: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("member-avatars")
        .getPublicUrl(filePath);

      const photoUrl = publicUrlData.publicUrl;

      const { data, error } = await supabase.rpc("update_my_member_photo", {
        input_photo_url: photoUrl,
      });

      if (error) {
        setMessage(`Foto sudah terupload, tapi gagal disimpan ke profile: ${error.message}`);
        return;
      }

      setLinkedMember((prev) => prev ? { ...prev, photo_url: photoUrl, updated_at: new Date().toISOString() } : prev);

      const result = Array.isArray(data) ? data[0] : data;
      setMessage(result?.message || "Foto profile berhasil diperbarui.");

      await fetchLinkedMember();
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function updateMyProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!session) {
      setMessage("Session tidak ditemukan. Silakan login ulang.");
      return;
    }

    const { data, error } = await supabase.rpc("update_my_member_profile", {
      input_nickname: profileForm.nickname?.trim() || null,
      input_phone: profileForm.phone?.trim() || null,
      input_email: profileForm.email?.trim() || null,
      input_birth_date: profileForm.birth_date || null,
      input_gender: profileForm.gender || null,
      input_address: profileForm.address?.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data: refreshedMember, error: refreshError } = await supabase
      .from("members")
      .select("*")
      .eq("profile_user_id", session.user.id)
      .maybeSingle();

    if (refreshError) {
      setMessage(refreshError.message);
      return;
    }

    const member = refreshedMember as Member | null;

    if (member) {
      setLinkedMember(member);
      syncProfileFormFromMember(member, setProfileForm);
    }

    const result = Array.isArray(data) ? data[0] : data;
    setMessage(result?.message || "Data pribadi berhasil diperbarui.");
  }

  async function fetchMyCoolInfo() {
    const { data, error } = await supabase.rpc("get_my_cool_info");

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setMyCoolInfo((result || null) as MyCoolInfo | null);
  }

  async function fetchMyMinistries() {
    const { data, error } = await supabase.rpc("get_my_ministries");

    if (error) {
      setMessage(error.message);
      return;
    }

    setMyMinistries((data || []) as MyMinistry[]);
  }

  async function fetchDepartmentOverview() {
    const { data, error } = await supabase.rpc("get_department_overview");

    if (error) {
      setMessage(error.message);
      return;
    }

    const overview = (data || []) as DepartmentOverview[];
    setDepartmentOverview(overview);

    if (!selectedDepartmentId && overview.length > 0) {
      setSelectedDepartmentId(overview[0].department_id);
    }
  }

  async function fetchAdminMemberProfile(memberId: string) {
    try {
      setAdminProfileLoading(true);
      setMessage("");

      const { data, error } = await supabase.rpc("admin_get_member_profile", {
        input_member_id: memberId,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      setAdminProfileData((result || null) as AdminProfileViewerData | null);
      setActiveTab("profileViewer");
    } finally {
      setAdminProfileLoading(false);
    }
  }

  function formatAdminDateTime(value?: string | null) {
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
      return "-";
    }
  }

  async function fetchMembers() {
    const { data, error } = await supabase
      .from("members")
      .select("id, member_code, qr_code_value, full_name, photo_url, nickname, phone, email, birth_date, gender, address, membership_status, attendance_status, joined_at, created_at, updated_at")
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

    const code = `BWC-${String(Date.now()).slice(-6)}`;

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


  const BwcAnalyticsDashboardFixed = () => {
    const data = bwcAnalytics;
    const weeklyTrend = data?.weekly_trend || [];
    const monthlyTrend = data?.monthly_trend || [];
    const coolBreakdown = data?.cool_breakdown || [];
    const decliningMembers = data?.declining_members || [];
    const atRiskMembers = data?.at_risk_members || [];
    const recentSessions = data?.recent_sessions || [];

    const maxWeekly = Math.max(1, ...weeklyTrend.map((item) => item.total_attendance || 0));
    const maxMonthly = Math.max(1, ...monthlyTrend.map((item) => item.avg_attendance || item.total_checkins || 0));
    const maxCool = Math.max(1, ...coolBreakdown.map((item) => item.total_checkins || 0));

    const formatDate = (value?: string | null) => {
      if (!value) return "-";

      try {
        return new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "short",
        }).format(new Date(`${value}T00:00:00`));
      } catch {
        return value || "-";
      }
    };

    const formatMonth = (value?: string | null) => {
      if (!value) return "-";

      try {
        return new Intl.DateTimeFormat("id-ID", {
          month: "short",
          year: "2-digit",
        }).format(new Date(`${value}-01T00:00:00`));
      } catch {
        return value || "-";
      }
    };

    const riskLabel = (value?: string) => {
      const labels: Record<string, string> = {
        belum_ada_riwayat: "Belum ada riwayat",
        tidak_hadir_90_hari: "Tidak hadir 90+ hari",
        tidak_hadir_60_hari: "Tidak hadir 60+ hari",
        tidak_hadir_30_hari: "Tidak hadir 30+ hari",
        sangat_jarang_90_hari: "Sangat jarang 90 hari",
        perlu_diperhatikan: "Perlu diperhatikan",
      };

      return labels[value || ""] || "Perlu dicek";
    };

    if (analyticsLoading && !data) {
      return (
        <Card>
          <p className="text-lg font-black text-slate-950">Loading analytics...</p>
          <p className="mt-1 text-sm text-slate-500">Sedang mengambil data kehadiran BWC.</p>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card>
          <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
            <p className="text-2xl font-black text-slate-950">Belum ada analytics yang dimuat</p>
            <p className="mt-2 text-sm text-slate-500">Klik tombol refresh untuk mengambil data absensi terbaru.</p>
            <button
              onClick={fetchBwcAnalytics}
              className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
            >
              Load Analytics
            </button>
          </div>
        </Card>
      );
    }

    return (
      <section className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Attendance Analytics</p>
              <h2 className="mt-3 text-4xl font-black">Dashboard Kehadiran</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Pantau tren kedatangan, performa per COOL, dan member yang mulai jarang hadir dalam 1–3 bulan terakhir.
              </p>
            </div>
            <button
              onClick={fetchBwcAnalytics}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              {analyticsLoading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Last Attendance</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.last_session_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(data.overview?.last_session_date)}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Average / Ibadah</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.avg_attendance || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Last {data.overview?.months || 6} months</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Unique 30 Hari</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{data.overview?.unique_attendees_30d || 0}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Member hadir 30 hari terakhir</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">At Risk</p>
            <p className="mt-2 text-4xl font-black text-slate-950">{atRiskMembers.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Perlu follow-up</p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Trend Kedatangan Mingguan</h3>
            <p className="mt-1 text-sm text-slate-500">Jumlah check-in per ibadah BWC 1PM.</p>

            <div className="mt-5 flex h-72 items-end gap-2 overflow-x-auto rounded-3xl bg-orange-50 p-4">
              {weeklyTrend.slice(-20).map((item) => (
                <div key={item.session_date} className="flex h-full min-w-[42px] flex-col items-center justify-end gap-2">
                  <div className="text-xs font-black text-slate-700">{item.total_attendance}</div>
                  <div
                    className="w-full rounded-t-2xl bg-orange-500"
                    style={{ height: `${Math.max(8, ((item.total_attendance || 0) / maxWeekly) * 210)}px` }}
                    title={`${formatDate(item.session_date)}: ${item.total_attendance}`}
                  />
                  <div className="-rotate-45 whitespace-nowrap text-[10px] font-bold text-slate-400">
                    {formatDate(item.session_date)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Monthly Average</h3>
            <p className="mt-1 text-sm text-slate-500">Rata-rata kedatangan per bulan.</p>

            <div className="mt-5 space-y-4">
              {monthlyTrend.map((item) => {
                const value = item.avg_attendance || item.total_checkins || 0;

                return (
                  <div key={item.month}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-700">{formatMonth(item.month)}</span>
                      <span className="font-black text-slate-950">{value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, (value / maxMonthly) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Kehadiran per COOL</h3>
            <p className="mt-1 text-sm text-slate-500">Total check-in 90 hari terakhir.</p>

            <div className="mt-5 space-y-3">
              {coolBreakdown.length === 0 ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Belum ada data COOL.</p>
              ) : (
                coolBreakdown.map((item) => (
                  <div key={item.cool_group}>
                    <div className="mb-1 flex justify-between gap-4 text-sm">
                      <span className="font-black text-slate-950">{item.cool_group}</span>
                      <span className="font-bold text-slate-500">{item.total_checkins} check-in · {item.unique_members} member</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, ((item.total_checkins || 0) / maxCool) * 100)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Recent Sessions</h3>
            <p className="mt-1 text-sm text-slate-500">12 ibadah terakhir.</p>

            <div className="mt-5 space-y-2">
              {recentSessions.map((item) => (
                <div key={item.session_date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                  <div>
                    <p className="font-black text-slate-950">{formatDate(item.session_date)}</p>
                    <p className="text-xs font-bold text-slate-500">{item.title || "Ibadah BWC 1PM"}</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">{item.total_attendance}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Mulai Jarang Hadir</h3>
            <p className="mt-1 text-sm text-slate-500">Member yang kedatangannya turun dibanding 30 hari sebelumnya.</p>

            <div className="mt-5 space-y-3">
              {decliningMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Belum ada penurunan signifikan yang terdeteksi.</p>
              ) : (
                decliningMembers.slice(0, 20).map((member) => (
                  <div key={member.member_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(member.full_name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">{member.full_name}</p>
                      <p className="text-xs text-slate-500">{member.cool_group} · Last seen {formatDate(member.last_seen)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">{member.previous_30_days} → {member.last_30_days}</p>
                      <p className="text-xs font-bold text-slate-400">30 hari</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Perlu Follow-up</h3>
            <p className="mt-1 text-sm text-slate-500">Tidak hadir 30–90 hari, sangat jarang, atau belum ada riwayat.</p>

            <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
              {atRiskMembers.length === 0 ? (
                <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Tidak ada member at-risk.</p>
              ) : (
                atRiskMembers.slice(0, 50).map((member) => (
                  <div key={member.member_id} className="rounded-2xl border border-orange-100 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                        {member.photo_url ? (
                          <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{getInitials(member.full_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.cool_group} · {member.phone || "-"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">{riskLabel(member.risk_status)}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">90d: {member.last_90_days}</span>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last: {formatDate(member.last_seen)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    );
  };



  async function fetchBwcScannerSession() {
    const { data, error } = await supabase.rpc("get_or_create_next_bwc_1pm_session", {
      input_base_date: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      setBwcScannerStatus(error.message);
      setMessage(error.message);
      return;
    }

    const sessionData = Array.isArray(data) ? data[0] : data;
    setBwcScannerSession(sessionData || null);

    if (sessionData?.id) {
      await fetchBwcScannerRecent(sessionData.id);
    }
  }

  async function fetchBwcScannerRecent(sessionId?: string) {
    const targetSessionId = sessionId || bwcScannerSession?.id;
    if (!targetSessionId) return;

    const { data, error } = await supabase.rpc("get_bwc_1pm_attendance_for_session", {
      input_session_id: targetSessionId,
    });

    if (error) {
      setBwcScannerStatus(error.message);
      setMessage(error.message);
      return;
    }

    setBwcScannerRecent((data || []) as any[]);
  }

  async function handleBwcLiveCheckIn(rawValue: string) {
    const cleanValue = rawValue.trim();
    if (!cleanValue || bwcScannerBusy) return;

    const now = Date.now();
    if (
      bwcLastScanRef.current.value === cleanValue &&
      now - bwcLastScanRef.current.at < 2500
    ) {
      return;
    }

    bwcLastScanRef.current = { value: cleanValue, at: now };

    try {
      setBwcScannerBusy(true);
      setBwcScannerStatus("");

      let targetSession = bwcScannerSession;

      if (!targetSession?.id) {
        const { data: sessionData, error: sessionError } = await supabase.rpc("get_or_create_next_bwc_1pm_session", {
          input_base_date: new Date().toISOString().slice(0, 10),
        });

        if (sessionError) {
          setBwcScannerStatus(sessionError.message);
          setMessage(sessionError.message);
          return;
        }

        targetSession = Array.isArray(sessionData) ? sessionData[0] : sessionData;
        setBwcScannerSession(targetSession || null);
      }

      if (!targetSession?.id) {
        setBwcScannerStatus("Sesi BWC 1PM belum tersedia.");
        return;
      }

      const { data, error } = await supabase.rpc("checkin_bwc_1pm_by_qr_for_session", {
        input_session_id: targetSession.id,
        input_qr_value: cleanValue,
      });

      if (error) {
        setBwcScannerStatus(error.message);
        setMessage(error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      const nextMessage =
        result?.message ||
        (result?.success ? "Check-in berhasil." : "Check-in gagal.");

      setBwcScannerStatus(nextMessage);
      setMessage(nextMessage);
      setBwcScannerManualValue("");

      await fetchBwcScannerRecent(targetSession.id);
      await fetchBwcScannerSession();
    } finally {
      setBwcScannerBusy(false);
    }
  }

  async function startBwcCameraScanner() {
    if (typeof window === "undefined") return;

    setBwcScannerStatus("Membuka kamera...");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (bwcQrScannerRef.current) {
        await stopBwcCameraScanner();
      }

      const readerId = "bwc-live-qr-reader";
      const readerElement = document.getElementById(readerId);

      if (readerElement) {
        readerElement.innerHTML = "";
      }

      const scanner = new Html5Qrcode(readerId);
      bwcQrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText: string) => {
          handleBwcLiveCheckIn(decodedText);
        },
        () => {}
      );

      setBwcCameraActive(true);
      setBwcScannerStatus("Kamera aktif. Arahkan ke QR member.");
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        "Kamera gagal dibuka. Klik Allow/Izinkan camera permission, lalu coba Start Camera lagi.";

      setBwcCameraActive(false);
      setBwcScannerStatus(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function stopBwcCameraScanner() {
    try {
      if (bwcQrScannerRef.current) {
        if (typeof bwcQrScannerRef.current.stop === "function") {
          await bwcQrScannerRef.current.stop();
        }

        if (typeof bwcQrScannerRef.current.clear === "function") {
          bwcQrScannerRef.current.clear();
        }

        bwcQrScannerRef.current = null;
      }
    } catch {
      bwcQrScannerRef.current = null;
    }

    const readerElement = typeof document !== "undefined" ? document.getElementById("bwc-live-qr-reader") : null;

    if (readerElement) {
      readerElement.innerHTML = "";
    }

    setBwcCameraActive(false);
  }

  useEffect(() => {
    if (!session) return;

    const isScannerOpen =
      (isAdmin && activeTab === "scanner") ||
      memberTab === "scan";

    if (isScannerOpen) {
      fetchBwcScannerSession();
    }
  }, [session?.user.id, isAdmin, activeTab, memberTab]);

  useEffect(() => {
    return () => {
      if (bwcQrScannerRef.current) {
        bwcQrScannerRef.current.clear().catch(() => {});
        bwcQrScannerRef.current = null;
      }
    };
  }, []);

  function renderBwcLiveQrScanner() {
    const totalCheckins =
      bwcScannerRecent?.[0]?.total_checkins || bwcScannerSession?.total_checkins || 0;

    return (
      <section className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">BWC 1PM Scanner</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Live QR Scanner</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Sesi otomatis diarahkan ke hari Minggu terdekat. Kalau hari ini Minggu, sistem pakai tanggal hari ini.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">Pilih Sesi</label>
              <div className="flex gap-2">
                <select
                  value={bwcScannerSession?.id || ""}
                  disabled
                  className="min-w-0 flex-1 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-slate-950 outline-none"
                >
                  <option value={bwcScannerSession?.id || ""}>
                    {bwcScannerSession
                      ? `${bwcScannerSession.title} - ${bwcScannerSession.session_date}`
                      : "Loading sesi BWC 1PM..."}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={fetchBwcScannerSession}
                  className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-black text-slate-700"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-300">Total check-in sesi ini</p>
                <p className="text-3xl font-black">{totalCheckins}</p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">QR / Member Code Manual</label>
              <div className="flex gap-2">
                <input
                  value={bwcScannerManualValue}
                  onChange={(e) => setBwcScannerManualValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleBwcLiveCheckIn(bwcScannerManualValue);
                    }
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="Contoh: BWC-00139"
                />
                <button
                  type="button"
                  disabled={bwcScannerBusy}
                  onClick={() => handleBwcLiveCheckIn(bwcScannerManualValue)}
                  className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
                >
                  Check-in
                </button>
              </div>
            </div>

            {bwcScannerStatus && (
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
                {bwcScannerStatus}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-950">Scan via Kamera</h3>
              <p className="mt-1 text-sm text-slate-500">
                Minta member menunjukkan QR mereka, lalu arahkan kamera ke QR tersebut.
              </p>
            </div>
            <div className="flex gap-2">
              {!bwcCameraActive ? (
                <button
                  type="button"
                  onClick={startBwcCameraScanner}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopBwcCameraScanner}
                  className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-orange-100 bg-orange-50 p-3">
            <div id="bwc-live-qr-reader" className="min-h-[320px] w-full rounded-2xl bg-white" />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Catatan: kamera biasanya hanya aktif di HTTPS atau localhost. Untuk penggunaan real, pakai link Vercel.
          </p>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950">Live Check-in</h3>
              <p className="text-sm text-slate-500">Data terbaru yang sudah masuk ke absensi sesi ini.</p>
            </div>
            <button
              type="button"
              onClick={() => fetchBwcScannerRecent()}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
            >
              Refresh List
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bwcScannerRecent.length === 0 ? (
              <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                Belum ada check-in untuk sesi ini.
              </div>
            ) : (
              bwcScannerRecent.map((record) => (
                <div key={record.record_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                    {record.photo_url ? (
                      <img src={record.photo_url} alt={record.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{getInitials(record.full_name || "BWC")}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-slate-950">{record.full_name}</p>
                    <p className="text-xs text-slate-500">{record.member_code} · {record.phone || "-"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    );
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
              Admin bisa mengelola database. Member BWC bisa daftar akun dan claim profile sendiri.
            </p>
          </section>

          <Card className="p-6 lg:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500 text-2xl font-black text-white shadow-lg shadow-orange-100">
                GBI
              </div>
              <h2 className="text-3xl font-black text-slate-950">
                {authMode === "login" ? "Masuk Dashboard" : "Daftar Akun Member"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {authMode === "login"
                  ? "Admin login atau member yang sudah daftar bisa masuk di sini."
                  : "Buat akun dulu, lalu claim profile BWC berdasarkan nomor HP atau member code."}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-orange-50 p-2">
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded-xl px-4 py-3 text-sm font-black ${authMode === "login" ? "bg-orange-500 text-white" : "text-orange-700"}`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`rounded-xl px-4 py-3 text-sm font-black ${authMode === "signup" ? "bg-orange-500 text-white" : "text-orange-700"}`}
              >
                Daftar Member
              </button>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-orange-100 bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-orange-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base">G</span>
              Lanjut dengan Google
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-orange-100" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">atau pakai email</span>
              <div className="h-px flex-1 bg-orange-100" />
            </div>

            {authMode === "login" ? (
              <form onSubmit={login} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                  <input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="admin@gbitd.org"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Password"
                  />
                </div>

                {message && <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{message}</div>}

                <button className="w-full rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600">
                  Login
                </button>
              </form>
            ) : (
              <form onSubmit={signUp} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Nama Lengkap</label>
                  <input
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Nama lengkap"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                  <input
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="email@domain.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                {message && <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{message}</div>}

                <button className="w-full rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600">
                  Buat Akun
                </button>
              </form>
            )}
          </Card>
        </div>
      </main>
    );
  }

  if (!isAdmin && !linkedMember) {
    return (
      <main className="min-h-screen bg-[#FFF9F3] p-4 text-slate-900">
        <div className="mx-auto max-w-4xl py-8">
          <div className="mb-6 flex items-center justify-between rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-slate-950">Claim Profile BWC</h1>
              <p className="text-sm text-slate-500">{session.user.email}</p>
            </div>
            <button onClick={logout} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              Logout
            </button>
          </div>

          {message && (
            <div className="mb-5 rounded-3xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-orange-700 shadow-sm">
              {message}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-2xl font-black text-slate-950">Claim dengan Nomor HP</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Pakai nomor HP yang terdaftar di database BWC. Format bebas, contoh 0812... atau +62812...
              </p>

              <form onSubmit={claimByPhone} className="mt-5 space-y-4">
                <input
                  value={claimPhone}
                  onChange={(e) => setClaimPhone(e.target.value)}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="0812..."
                />
                <button className="w-full rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white">
                  Claim Profile
                </button>
              </form>
            </Card>

            <Card>
              <h2 className="text-2xl font-black text-slate-950">Tidak Punya Nomor?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Untuk data yang nomor HP-nya kosong, claim pakai member code dan nama lengkap sesuai database.
              </p>

              <form onSubmit={claimByCode} className="mt-5 space-y-4">
                <input
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300"
                  placeholder="BWC-00001"
                />
                <input
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="Nama lengkap sesuai database"
                />
                <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">
                  Claim dengan Kode
                </button>
              </form>
            </Card>
          </div>
        </div>
      </main>
    );
  }



  if (!isAdmin && linkedMember) {
    const profileFields = [
      linkedMember.nickname,
      linkedMember.phone,
      linkedMember.email,
      profileForm.birth_date,
      profileForm.gender !== "unknown" ? profileForm.gender : "",
      profileForm.address,
    ];

    const completedFields = profileFields.filter(Boolean).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    const memberNavItems = [
      { id: "home", label: "Home", icon: "🏠" },
      { id: "qr", label: "QR", icon: "▣" },
      { id: "schedule", label: "Schedule", icon: "🗓️" },
        { id: "ministrySchedule", label: "Pelayanan", icon: "🙌" },
      { id: "cool", label: "COOL", icon: "🌱" },
      { id: "forum", label: "Forum", icon: "💬" },
        { id: "contacts", label: "Contact", icon: "📩" },
      { id: "profile", label: "Profile", icon: "👤" },
    ] as const;

    return (
      <main className="min-h-screen bg-[#FFF9F3] pb-24 text-slate-900 md:pb-6">
        <div className="mx-auto max-w-6xl px-4 py-5 md:py-8">
          <div className="mb-5 flex items-center justify-between rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">BWC Member Portal</p>
              <h1 className="mt-1 text-xl font-black text-slate-950">{linkedMember.full_name}</h1>
              <p className="text-sm text-slate-500">{session.user.email}</p>
            </div>
            <button onClick={logout} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              Logout
            </button>
          </div>

          {message && (
            <div className="mb-5 rounded-3xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-orange-700 shadow-sm">
              {message}
            </div>
          )}

          <div className="mb-6 hidden rounded-3xl border border-orange-100 bg-white p-2 shadow-sm md:flex">
            {memberNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMemberTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  memberTab === item.id ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "text-slate-600 hover:bg-orange-50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {memberTab === "home" && (
            <section className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[2rem] bg-gradient-to-br from-orange-500 to-amber-400 p-6 text-white shadow-xl shadow-orange-100">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-100">Welcome Home</p>
                  <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                    Halo, {linkedMember.nickname || linkedMember.full_name.split(" ")[0]} 👋
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-orange-50">
                    Ini adalah portal pribadi kamu untuk QR absensi, data member, jadwal pelayanan, dan informasi COOL.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => setMemberTab("qr")}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-orange-600 shadow-sm"
                    >
                      Show My QR
                    </button>
                    <button
                      onClick={() => setMemberTab("profile")}
                      className="rounded-2xl bg-white/20 px-5 py-3 text-sm font-black text-white backdrop-blur"
                    >
                      Lengkapi Data
                    </button>
                  </div>
                </div>

                <Card>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Profile Completion</p>
                  <div className="mt-4 flex items-end justify-between">
                    <p className="text-5xl font-black text-slate-950">{profileCompletion}%</p>
                    <Badge tone={profileCompletion >= 80 ? "green" : "orange"}>
                      {profileCompletion >= 80 ? "Good" : "Need Update"}
                    </Badge>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-orange-50">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${profileCompletion}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Lengkapi data pribadi supaya pendataan BWC lebih akurat.
                  </p>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <p className="text-sm text-slate-500">Member Code</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{linkedMember.member_code}</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Member Status</p>
                  <p className="mt-3"><Badge tone={statusTone(linkedMember.attendance_status)}>{linkedMember.attendance_status}</Badge></p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">COOL / Community</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">BWC</p>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <h3 className="text-xl font-black text-slate-950">Next Activity</h3>
                  <div className="mt-4 rounded-3xl bg-orange-50 p-5">
                    <p className="text-sm font-bold text-orange-700">Ibadah / Event berikutnya</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">Belum ada jadwal aktif</p>
                    <p className="mt-2 text-sm text-slate-500">Nanti bagian ini bisa dihubungkan ke event dan attendance sessions.</p>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-xl font-black text-slate-950">Quick Actions</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button onClick={() => setMemberTab("qr")} className="rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white">
                      Buka QR
                    </button>
                    <button onClick={() => setMemberTab("schedule")} className="rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">
                      Cek Pelayanan
                    </button>
                    <button onClick={() => setMemberTab("cool")} className="rounded-2xl border border-orange-100 bg-white px-4 py-4 text-sm font-black text-slate-700">
                      Info COOL
                    </button>
                    <button onClick={() => setMemberTab("profile")} className="rounded-2xl border border-orange-100 bg-white px-4 py-4 text-sm font-black text-slate-700">
                      Update Profile
                    </button>
                  </div>
                </Card>
              </div>
            </section>
          )}

          {memberTab === "qr" && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Digital Member Card</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">My Attendance QR</h2>

                <div className="mt-6 rounded-[2rem] border border-orange-100 bg-orange-50 p-5 text-center">
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    {memberQrDataUrl ? (
                      <img
                        src={memberQrDataUrl}
                        alt={`QR ${linkedMember.member_code}`}
                        className="mx-auto h-64 w-64 rounded-2xl"
                      />
                    ) : (
                      <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-400">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <p className="mt-5 text-2xl font-black text-slate-950">{linkedMember.member_code}</p>
                  <p className="mt-1 text-sm text-slate-500">{linkedMember.full_name}</p>

                  <button
                    type="button"
                    onClick={downloadMyQr}
                    className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white"
                  >
                    Download QR
                  </button>
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <h3 className="text-xl font-black text-slate-950">Cara Pakai QR</h3>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                    <p>1. Buka halaman QR saat masuk ibadah, COOL, atau event.</p>
                    <p>2. Tunjukkan QR ke tim usher/pendataan.</p>
                    <p>3. Tim usher scan QR kamu.</p>
                    <p>4. Absensi otomatis masuk ke sistem.</p>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-xl font-black text-slate-950">Member Info</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-orange-50 p-4">
                      <p className="text-xs font-bold text-orange-700">QR Value</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{linkedMember.qr_code_value}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">Phone</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{linkedMember.phone || "-"}</p>
                    </div>
                  </div>
                </Card>
              </div>
            </section>
          )}

          {memberTab === "schedule" && (
            <section className="space-y-6">
              <Card>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">My Ministry</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">Pelayanan Saya</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Ini adalah daftar pelayanan yang terdaftar untuk kamu di database BWC.
                </p>

                <div className="mt-6">
                  {myMinistries.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-6 text-center">
                      <p className="text-2xl font-black text-slate-950">Belum ada pelayanan terdaftar</p>
                      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                        Kalau kamu sudah aktif melayani, hubungi admin atau leader BWC untuk update data pelayananmu.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {myMinistries.map((item) => (
                        <div key={`${item.department_id}-${item.role}`} className="rounded-3xl border border-orange-100 bg-orange-50 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Department</p>
                              <h3 className="mt-2 text-2xl font-black text-slate-950">{item.department_name}</h3>
                            </div>
                            <Badge tone="green">Active</Badge>
                          </div>
                          <p className="mt-3 text-sm font-bold text-slate-600">Role: {item.role || "member"}</p>
                          {item.source_note && (
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.source_note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid gap-5 md:grid-cols-3">
                <Card>
                  <p className="text-sm text-slate-500">Total Pelayanan</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">{myMinistries.length}</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Next Service</p>
                  <p className="mt-2 text-xl font-black text-slate-950">Belum dijadwalkan</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Confirmation</p>
                  <p className="mt-2"><Badge tone="slate">Coming soon</Badge></p>
                </Card>
              </div>
            </section>
          )}

          {memberTab === "cool" && <BwcMyCoolDynamic />}


          {memberTab === "forum" && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card className="h-fit">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">BWC Forum</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">Share & Connect</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Ruang sederhana untuk anak-anak BWC saling update, sharing, dan berinteraksi.
                </p>

                <form onSubmit={createBwcPost} className="mt-5 space-y-3">
                  <textarea
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="min-h-32 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Tulis sesuatu untuk BWC..."
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{newPost.length}/1000</span>
                    <button
                      disabled={posting}
                      className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </form>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950">Upcoming Events</h3>
                  <button
                    onClick={fetchBwcEvents}
                    className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
                  >
                    Refresh
                  </button>
                </div>

                {bwcEvents.length === 0 ? (
                  <Card>
                    <p className="text-lg font-black text-slate-950">Belum ada event broadcast.</p>
                    <p className="mt-1 text-sm text-slate-500">Admin bisa publish upcoming event dari dashboard admin.</p>
                  </Card>
                ) : (
                  bwcEvents.map((event) => (
                    <Card key={event.id}>
                      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                        <div className="overflow-hidden rounded-3xl bg-orange-50">
                          {event.image_url ? (
                            <img src={event.image_url} alt={event.title} className="h-56 w-full object-cover lg:h-full" />
                          ) : (
                            <div className="flex h-56 items-center justify-center bg-gradient-to-br from-orange-200 to-amber-100 text-5xl">
                              📣
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Upcoming Event</p>
                          <h3 className="mt-2 text-3xl font-black text-slate-950">{event.title}</h3>
                          <p className="mt-2 text-sm font-bold text-slate-600">{formatEventDate(event.event_date)}</p>
                          <p className="mt-1 text-sm text-slate-500">{event.location || "GBI Tanjung Duren"}</p>

                          {event.description && (
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{event.description}</p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {event.service_times.map((time) => (
                              <button
                                key={`${event.id}-${time}`}
                                onClick={() => setEventRsvp(event.id, time)}
                                className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                  event.my_rsvp_service_time === time ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700"
                                }`}
                              >
                                Hadir {time}
                              </button>
                            ))}
                          </div>

                          {Object.keys(event.rsvp_summary || {}).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(event.rsvp_summary || {}).map(([time, total]) => (
                                <span key={time} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                                  {time}: {total}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => toggleEventLike(event.id)}
                              className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                event.liked_by_me ? "bg-orange-500 text-white" : "bg-slate-950 text-white"
                              }`}
                            >
                              {event.liked_by_me ? "Liked" : "Like"} · {event.total_likes}
                            </button>

                            <button
                              onClick={() => toggleEventReminder(event.id)}
                              className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                event.reminder_by_me ? "bg-amber-500 text-white" : "bg-orange-50 text-orange-700"
                              }`}
                            >
                              {event.reminder_by_me ? "Reminder On" : "Remind Me"}
                            </button>

                            {event.ig_url && (
                              <a
                                href={event.ig_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
                              >
                                Open IG
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl bg-orange-50 p-4">
                        <p className="mb-3 text-sm font-black text-slate-950">Comments · {event.total_comments}</p>

                        <div className="space-y-2">
                          {(event.comments || []).slice(-5).map((comment) => (
                            <div key={comment.id} className="flex gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[10px] font-black text-orange-600">
                                {comment.photo_url ? (
                                  <img src={comment.photo_url} alt={comment.member_name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{getInitials(comment.member_name || "BWC")}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2">
                                <p className="text-xs font-black text-slate-950">{comment.member_name}</p>
                                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            value={eventCommentInputs[event.id] || ""}
                            onChange={(e) => setEventCommentInputs((prev) => ({ ...prev, [event.id]: e.target.value }))}
                            className="min-w-0 flex-1 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                            placeholder="Tulis komentar..."
                          />
                          <button
                            type="button"
                            onClick={() => createEventComment(event.id)}
                            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950">Latest Threads</h3>
                  <button
                    onClick={fetchBwcForum}
                    className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
                  >
                    Refresh
                  </button>
                </div>

                {bwcPosts.length === 0 ? (
                  <Card>
                    <p className="text-lg font-black text-slate-950">Belum ada post.</p>
                    <p className="mt-1 text-sm text-slate-500">Jadilah yang pertama share di BWC Forum.</p>
                  </Card>
                ) : (
                  bwcPosts.map((post) => (
                    <Card key={post.id}>
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-sm font-black text-orange-600">
                          {post.members?.photo_url ? (
                            <img src={post.members.photo_url} alt={post.members.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{getInitials(post.members?.full_name || "BWC")}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-950">{post.members?.full_name || "BWC Member"}</p>
                            <span className="text-xs font-bold text-slate-400">• {formatPostDate(post.created_at)}</span>
                          </div>

                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.content}</p>

                          <div className="mt-4 space-y-3 rounded-2xl bg-orange-50 p-3">
                            {(bwcComments[post.id] || []).map((comment) => (
                              <div key={comment.id} className="flex gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[10px] font-black text-orange-600">
                                  {comment.members?.photo_url ? (
                                    <img src={comment.members.photo_url} alt={comment.members.full_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{getInitials(comment.members?.full_name || "BWC")}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2">
                                  <p className="text-xs font-black text-slate-950">{comment.members?.full_name || "BWC Member"}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{comment.content}</p>
                                </div>
                              </div>
                            ))}

                            <div className="flex gap-2">
                              <input
                                value={commentInputs[post.id] || ""}
                                onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                className="flex-1 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                                placeholder="Tulis komentar..."
                              />
                              <button
                                type="button"
                                onClick={() => createBwcComment(post.id)}
                                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}



          {memberTab === "analytics" && (
            <section className="space-y-6">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Attendance Analytics</p>
                    <h2 className="mt-3 text-4xl font-black">Dashboard Kehadiran</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                      Pantau tren kedatangan, performa COOL, dan member yang mulai jarang hadir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBwcAnalytics}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
                  >
                    {analyticsLoading ? "Refreshing..." : "Refresh Data"}
                  </button>
                </div>
              </div>

              {!bwcAnalytics ? (
                <Card>
                  <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
                    <p className="text-2xl font-black text-slate-950">
                      {analyticsLoading ? "Loading analytics..." : "Belum ada analytics yang dimuat"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Klik tombol refresh untuk mengambil data absensi terbaru.
                    </p>
                    <button
                      type="button"
                      onClick={fetchBwcAnalytics}
                      className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
                    >
                      Load Analytics
                    </button>
                  </div>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <p className="text-sm text-slate-500">Last Attendance</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.last_session_attendance || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{bwcAnalytics.overview?.last_session_date || "-"}</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">Average / Ibadah</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.avg_attendance || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Last {bwcAnalytics.overview?.months || 6} months</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">Unique 30 Hari</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.unique_attendees_30d || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Member hadir 30 hari terakhir</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">At Risk</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.at_risk_members?.length || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Perlu follow-up</p>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Trend Kedatangan Mingguan</h3>
                      <p className="mt-1 text-sm text-slate-500">Jumlah check-in per ibadah BWC 1PM.</p>

                      <div className="mt-5 space-y-3">
                        {(bwcAnalytics.weekly_trend || []).slice(-16).map((item) => (
                          <div key={item.session_date || item.title}>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="font-bold text-slate-700">{item.session_date}</span>
                              <span className="font-black text-slate-950">{item.total_attendance}</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${Math.max(4, Math.min(100, (item.total_attendance || 0)))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Monthly Average</h3>
                      <p className="mt-1 text-sm text-slate-500">Rata-rata kedatangan per bulan.</p>

                      <div className="mt-5 space-y-4">
                        {(bwcAnalytics.monthly_trend || []).map((item) => {
                          const value = item.avg_attendance || item.total_checkins || 0;

                          return (
                            <div key={item.month}>
                              <div className="mb-1 flex justify-between text-sm">
                                <span className="font-bold text-slate-700">{item.month}</span>
                                <span className="font-black text-slate-950">{value}</span>
                              </div>
                              <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                                <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Kehadiran per COOL</h3>
                      <p className="mt-1 text-sm text-slate-500">Total check-in 90 hari terakhir.</p>

                      <div className="mt-5 space-y-3">
                        {(bwcAnalytics.cool_breakdown || []).length === 0 ? (
                          <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Belum ada data COOL.</p>
                        ) : (
                          (bwcAnalytics.cool_breakdown || []).map((item) => (
                            <div key={item.cool_group} className="rounded-2xl bg-orange-50 p-4">
                              <div className="flex justify-between gap-4 text-sm">
                                <span className="font-black text-slate-950">{item.cool_group}</span>
                                <span className="font-bold text-slate-500">{item.total_checkins} check-in · {item.unique_members} member</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Recent Sessions</h3>
                      <p className="mt-1 text-sm text-slate-500">12 ibadah terakhir.</p>

                      <div className="mt-5 space-y-2">
                        {(bwcAnalytics.recent_sessions || []).map((item) => (
                          <div key={item.session_date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                            <div>
                              <p className="font-black text-slate-950">{item.session_date}</p>
                              <p className="text-xs font-bold text-slate-500">{item.title || "Ibadah BWC 1PM"}</p>
                            </div>
                            <p className="text-2xl font-black text-orange-600">{item.total_attendance}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Mulai Jarang Hadir</h3>
                      <p className="mt-1 text-sm text-slate-500">Member yang kedatangannya turun dibanding 30 hari sebelumnya.</p>

                      <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {(bwcAnalytics.declining_members || []).length === 0 ? (
                          <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
                            Belum ada penurunan signifikan yang terdeteksi.
                          </p>
                        ) : (
                          (bwcAnalytics.declining_members || []).slice(0, 30).map((member) => (
                            <div key={member.member_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                                {member.photo_url ? (
                                  <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{getInitials(member.full_name)}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-black text-slate-950">{member.full_name}</p>
                                <p className="text-xs text-slate-500">{member.cool_group} · Last seen {member.last_seen || "-"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-red-600">{member.previous_30_days} → {member.last_30_days}</p>
                                <p className="text-xs font-bold text-slate-400">30 hari</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Perlu Follow-up</h3>
                      <p className="mt-1 text-sm text-slate-500">Tidak hadir 30–90 hari, sangat jarang, atau belum ada riwayat.</p>

                      <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {(bwcAnalytics.at_risk_members || []).length === 0 ? (
                          <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Tidak ada member at-risk.</p>
                        ) : (
                          (bwcAnalytics.at_risk_members || []).slice(0, 50).map((member) => (
                            <div key={member.member_id} className="rounded-2xl border border-orange-100 p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                                  {member.photo_url ? (
                                    <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{getInitials(member.full_name)}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-black text-slate-950">{member.full_name}</p>
                                  <p className="text-xs text-slate-500">{member.cool_group} · {member.phone || "-"}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                                  {member.risk_status || "perlu_diperhatikan"}
                                </span>
                                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">90d: {member.last_90_days}</span>
                                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last: {member.last_seen || "-"}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </section>
          )}

          {memberTab === "scan" && renderBwcLiveQrScanner()}


          {memberTab === "ministrySchedule" && <BwcMinistrySchedule />}

          {memberTab === "contacts" && <BwcContactChat />}

          {memberTab === "profile" && (
            <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
              <Card>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Profile Connected</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">{linkedMember.full_name}</h2>

                <div className="mt-5 flex flex-col gap-4 rounded-[2rem] border border-orange-100 bg-orange-50 p-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white text-2xl font-black text-orange-600 shadow-sm">
                    {linkedMember.photo_url ? (
                      <img
                        src={`${linkedMember.photo_url}?v=${linkedMember.updated_at || Date.now()}`}
                        alt={linkedMember.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{getInitials(linkedMember.full_name)}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-950">Foto Profile</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      Tambahkan foto supaya tim pendataan dan leader lebih mudah mengenali member.
                    </p>

                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={uploadMyProfilePicture}
                      disabled={uploadingPhoto}
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className={`rounded-2xl px-4 py-3 text-sm font-black text-white ${
                          uploadingPhoto ? "bg-slate-400" : "bg-orange-500"
                        }`}
                      >
                        {uploadingPhoto ? "Uploading..." : linkedMember.photo_url ? "Ganti Foto" : "Tambah Foto"}
                      </button>

                      <button
                        type="button"
                        onClick={fetchLinkedMember}
                        className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-black text-slate-700"
                      >
                        Refresh Foto
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">Member Code</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{linkedMember.member_code}</p>
                  </div>
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">QR Value</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{linkedMember.qr_code_value}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">Phone</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{linkedMember.phone || "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">Status</p>
                    <p className="mt-1"><Badge tone={statusTone(linkedMember.attendance_status)}>{linkedMember.attendance_status}</Badge></p>
                  </div>
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">COOL</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{myCoolInfo?.cool_group_name || "Belum COOL"}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-slate-950">Update Data Pribadi</h3>
                  <button
                    type="button"
                    onClick={fetchLinkedMember}
                    className="rounded-xl border border-orange-100 px-3 py-2 text-xs font-black text-slate-600"
                  >
                    Refresh
                  </button>
                </div>
                <form onSubmit={updateMyProfile} className="mt-5 space-y-3">
                  <input
                    value={profileForm.nickname}
                    onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Nama panggilan"
                  />
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Nomor WhatsApp"
                  />
                  <input
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Email"
                  />
                  <input
                    type="date"
                    value={profileForm.birth_date || toDateInputValue(linkedMember?.birth_date)}
                    onChange={(e) => setProfileForm({ ...profileForm, birth_date: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                  <select
                    value={profileForm.gender || linkedMember?.gender || "unknown"}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  >
                    <option value="unknown">Gender</option>
                    <option value="male">Pria</option>
                    <option value="female">Wanita</option>
                  </select>
                  <textarea
                    value={profileForm.address || linkedMember?.address || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="min-h-24 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Alamat"
                  />
                  <button className="w-full rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white">
                    Simpan Update
                  </button>
                </form>
              </Card>
            </section>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-orange-100 bg-white/95 p-2 shadow-2xl backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md gap-1" style={{ gridTemplateColumns: `repeat(${memberNavItems.length}, minmax(0, 1fr))` }}>
            {memberNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMemberTab(item.id)}
                className={`rounded-2xl px-2 py-2 text-center text-[11px] font-black transition ${
                  memberTab === item.id ? "bg-orange-500 text-white" : "text-slate-500"
                }`}
              >
                <span className="block text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
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
              { id: "departments", label: "Departemen", icon: "🧩" },
              { id: "ministrySchedule", label: "Jadwal Pelayanan", icon: "🗓️" },
              { id: "profileViewer", label: "Lihat Profil", icon: "👁️" },
              { id: "analytics", label: "Analytics", icon: "📊" },
              { id: "contacts", label: "Contacts", icon: "💬" },
              { id: "events", label: "Broadcast Event", icon: "📣" },
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


          {activeTab === "departments" && (
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <Card className="h-fit">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">Departemen</h2>
                    <p className="text-sm text-slate-500">Lihat member aktif berdasarkan pelayanan.</p>
                  </div>
                  <button onClick={fetchDepartmentOverview} className="rounded-2xl border border-orange-100 px-4 py-2 text-sm font-bold">
                    Refresh
                  </button>
                </div>

                <div className="space-y-2">
                  {departmentOverview.map((dept) => (
                    <button
                      key={dept.department_id}
                      onClick={() => setSelectedDepartmentId(dept.department_id)}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                        selectedDepartmentId === dept.department_id ? "bg-orange-500 text-white" : "bg-orange-50 text-slate-700"
                      }`}
                    >
                      <span>{dept.department_name}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        selectedDepartmentId === dept.department_id ? "bg-white/20 text-white" : "bg-white text-orange-700"
                      }`}>
                        {dept.total_members}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                {(() => {
                  const selected = departmentOverview.find((dept) => dept.department_id === selectedDepartmentId) || departmentOverview[0];

                  if (!selected) {
                    return (
                      <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
                        <p className="text-2xl font-black text-slate-950">Belum ada data departemen</p>
                        <p className="mt-2 text-sm text-slate-500">Pastikan data pelayanan sudah di-import ke database.</p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Department View</p>
                          <h2 className="mt-2 text-3xl font-black text-slate-950">{selected.department_name}</h2>
                          <p className="mt-1 text-sm text-slate-500">{selected.total_members} member aktif</p>
                        </div>
                        <Badge tone="green">Active</Badge>
                      </div>

                      <div className="overflow-hidden rounded-3xl border border-orange-100">
                        <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_1fr] bg-orange-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-orange-700 md:grid">
                          <span>Nama</span>
                          <span>Role</span>
                          <span>Phone</span>
                          <span>Note</span>
                        </div>

                        <div className="divide-y divide-orange-100">
                          {selected.members.map((member) => (
                            <div key={`${selected.department_id}-${member.member_id}-${member.role}`} className="grid gap-3 px-4 py-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_1fr] md:items-center">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                                  {member.photo_url ? (
                                    <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{getInitials(member.full_name)}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-950">{member.full_name}</p>
                                  <p className="text-xs text-slate-500">{member.member_code}</p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-slate-700">{member.role || "member"}</p>
                              <p className="text-sm text-slate-600">{member.phone || "-"}</p>
                              <p className="text-xs leading-relaxed text-slate-500">{member.source_note || "-"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}



          {activeTab === "profileViewer" && (
            <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
              <Card className="h-fit">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Admin Read-Only</p>
                <h2 className="mt-3 text-2xl font-black text-slate-950">Lihat Profil Member</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Admin bisa membuka profil member untuk pengecekan tampilan dan data, tanpa mengedit data apa pun.
                </p>

                <input
                  value={adminProfileSearch}
                  onChange={(e) => setAdminProfileSearch(e.target.value)}
                  className="mt-5 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  placeholder="Cari nama, member code, phone, email..."
                />

                <div className="mt-4 max-h-[560px] space-y-2 overflow-auto pr-1">
                  {filteredAdminProfileMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => fetchAdminMemberProfile(member.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        adminProfileData?.member?.id === member.id ? "bg-orange-500 text-white" : "bg-orange-50 text-slate-800 hover:bg-orange-100"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black text-orange-600">
                        {member.photo_url ? (
                          <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <span>{getInitials(member.full_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{member.full_name}</p>
                        <p className={`text-xs ${adminProfileData?.member?.id === member.id ? "text-white/75" : "text-slate-500"}`}>
                          {member.member_code}
                        </p>
                      </div>
                    </button>
                  ))}

                  {filteredAdminProfileMembers.length === 0 && (
                    <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                      Tidak ada member ditemukan.
                    </div>
                  )}
                </div>
              </Card>

              <div>
                {adminProfileLoading ? (
                  <Card>
                    <p className="text-lg font-black text-slate-950">Loading profile...</p>
                  </Card>
                ) : !adminProfileData?.member ? (
                  <Card>
                    <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
                      <p className="text-2xl font-black text-slate-950">Pilih member terlebih dahulu</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Search nama/member code di kiri, lalu klik member untuk melihat profilnya.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <div className="flex flex-col gap-5 md:flex-row md:items-center">
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] bg-orange-50 text-3xl font-black text-orange-600">
                          {adminProfileData.member.photo_url ? (
                            <img src={adminProfileData.member.photo_url} alt={adminProfileData.member.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{getInitials(adminProfileData.member.full_name)}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Member Profile Preview</p>
                          <h2 className="mt-2 text-4xl font-black text-slate-950">{adminProfileData.member.full_name}</h2>
                          <p className="mt-1 text-sm text-slate-500">{adminProfileData.member.email || "-"}</p>
                        </div>

                        <Badge tone={statusTone(adminProfileData.member.attendance_status || "active")}>
                          {adminProfileData.member.attendance_status || "active"}
                        </Badge>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-orange-50 p-4">
                          <p className="text-xs font-bold text-orange-700">Member Code</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{adminProfileData.member.member_code}</p>
                        </div>
                        <div className="rounded-2xl bg-orange-50 p-4">
                          <p className="text-xs font-bold text-orange-700">QR Value</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{adminProfileData.member.qr_code_value}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500">Phone</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{adminProfileData.member.phone || "-"}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500">Birth Date</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{toDateInputValue(adminProfileData.member.birth_date) || "-"}</p>
                        </div>
                      </div>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <h3 className="text-xl font-black text-slate-950">Data Pribadi</h3>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex justify-between gap-4 rounded-2xl bg-orange-50 p-4">
                            <span className="font-bold text-slate-500">Nickname</span>
                            <span className="font-black text-slate-950">{adminProfileData.member.nickname || "-"}</span>
                          </div>
                          <div className="flex justify-between gap-4 rounded-2xl bg-orange-50 p-4">
                            <span className="font-bold text-slate-500">Gender</span>
                            <span className="font-black text-slate-950">{adminProfileData.member.gender || "-"}</span>
                          </div>
                          <div className="rounded-2xl bg-orange-50 p-4">
                            <p className="font-bold text-slate-500">Alamat</p>
                            <p className="mt-1 font-black text-slate-950">{adminProfileData.member.address || "-"}</p>
                          </div>
                        </div>
                      </Card>

                      <Card>
                        <h3 className="text-xl font-black text-slate-950">Pelayanan</h3>
                        <div className="mt-4 space-y-3">
                          {adminProfileData.ministries.length === 0 ? (
                            <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                              Belum ada pelayanan terdaftar.
                            </div>
                          ) : (
                            adminProfileData.ministries.map((item) => (
                              <div key={`${item.department_id}-${item.role}`} className="rounded-2xl bg-orange-50 p-4">
                                <p className="text-lg font-black text-slate-950">{item.department_name}</p>
                                <p className="text-sm font-bold text-slate-500">Role: {item.role || "member"}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-950">Riwayat Absensi</h3>
                          <p className="text-sm text-slate-500">
                            Total check-in: {adminProfileData.attendance_summary?.total_attendance || 0}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                          Last: {formatAdminDateTime(adminProfileData.attendance_summary?.last_checkin)}
                        </p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {adminProfileData.recent_attendance.length === 0 ? (
                          <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                            Belum ada riwayat absensi.
                          </div>
                        ) : (
                          adminProfileData.recent_attendance.map((record) => (
                            <div key={record.record_id} className="flex items-center justify-between gap-4 rounded-2xl bg-orange-50 p-4">
                              <div>
                                <p className="font-black text-slate-950">{record.session_title}</p>
                                <p className="text-xs text-slate-500">{record.session_date}</p>
                              </div>
                              <p className="text-sm font-bold text-slate-600">{formatAdminDateTime(record.checked_in_at)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <div className="rounded-3xl border border-orange-100 bg-white px-5 py-4 text-sm font-bold text-slate-500">
                      Mode ini read-only. Admin hanya melihat data profil, pelayanan, dan riwayat absensi. Tidak ada perubahan data dari halaman ini.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {activeTab === "ministrySchedule" && <BwcMinistrySchedule />}

          {activeTab === "contacts" && <BwcContactChat />}

          {activeTab === "analytics" && (
            <section className="space-y-6">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Attendance Analytics</p>
                    <h2 className="mt-3 text-4xl font-black">Dashboard Kehadiran</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                      Pantau tren kedatangan, performa COOL, dan member yang mulai jarang hadir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBwcAnalytics}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
                  >
                    {analyticsLoading ? "Refreshing..." : "Refresh Data"}
                  </button>
                </div>
              </div>

              {!bwcAnalytics ? (
                <Card>
                  <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
                    <p className="text-2xl font-black text-slate-950">
                      {analyticsLoading ? "Loading analytics..." : "Belum ada analytics yang dimuat"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Klik tombol refresh untuk mengambil data absensi terbaru.
                    </p>
                    <button
                      type="button"
                      onClick={fetchBwcAnalytics}
                      className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
                    >
                      Load Analytics
                    </button>
                  </div>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <p className="text-sm text-slate-500">Last Attendance</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.last_session_attendance || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{bwcAnalytics.overview?.last_session_date || "-"}</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">Average / Ibadah</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.avg_attendance || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Last {bwcAnalytics.overview?.months || 6} months</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">Unique 30 Hari</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.overview?.unique_attendees_30d || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Member hadir 30 hari terakhir</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-slate-500">At Risk</p>
                      <p className="mt-2 text-4xl font-black text-slate-950">{bwcAnalytics.at_risk_members?.length || 0}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Perlu follow-up</p>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Trend Kedatangan Mingguan</h3>
                      <p className="mt-1 text-sm text-slate-500">Jumlah check-in per ibadah BWC 1PM.</p>

                      <div className="mt-5 space-y-3">
                        {(bwcAnalytics.weekly_trend || []).slice(-16).map((item) => (
                          <div key={item.session_date || item.title}>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="font-bold text-slate-700">{item.session_date}</span>
                              <span className="font-black text-slate-950">{item.total_attendance}</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${Math.max(4, Math.min(100, (item.total_attendance || 0)))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Monthly Average</h3>
                      <p className="mt-1 text-sm text-slate-500">Rata-rata kedatangan per bulan.</p>

                      <div className="mt-5 space-y-4">
                        {(bwcAnalytics.monthly_trend || []).map((item) => {
                          const value = item.avg_attendance || item.total_checkins || 0;

                          return (
                            <div key={item.month}>
                              <div className="mb-1 flex justify-between text-sm">
                                <span className="font-bold text-slate-700">{item.month}</span>
                                <span className="font-black text-slate-950">{value}</span>
                              </div>
                              <div className="h-3 overflow-hidden rounded-full bg-orange-50">
                                <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Kehadiran per COOL</h3>
                      <p className="mt-1 text-sm text-slate-500">Total check-in 90 hari terakhir.</p>

                      <div className="mt-5 space-y-3">
                        {(bwcAnalytics.cool_breakdown || []).length === 0 ? (
                          <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Belum ada data COOL.</p>
                        ) : (
                          (bwcAnalytics.cool_breakdown || []).map((item) => (
                            <div key={item.cool_group} className="rounded-2xl bg-orange-50 p-4">
                              <div className="flex justify-between gap-4 text-sm">
                                <span className="font-black text-slate-950">{item.cool_group}</span>
                                <span className="font-bold text-slate-500">{item.total_checkins} check-in · {item.unique_members} member</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Recent Sessions</h3>
                      <p className="mt-1 text-sm text-slate-500">12 ibadah terakhir.</p>

                      <div className="mt-5 space-y-2">
                        {(bwcAnalytics.recent_sessions || []).map((item) => (
                          <div key={item.session_date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                            <div>
                              <p className="font-black text-slate-950">{item.session_date}</p>
                              <p className="text-xs font-bold text-slate-500">{item.title || "Ibadah BWC 1PM"}</p>
                            </div>
                            <p className="text-2xl font-black text-orange-600">{item.total_attendance}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Mulai Jarang Hadir</h3>
                      <p className="mt-1 text-sm text-slate-500">Member yang kedatangannya turun dibanding 30 hari sebelumnya.</p>

                      <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {(bwcAnalytics.declining_members || []).length === 0 ? (
                          <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
                            Belum ada penurunan signifikan yang terdeteksi.
                          </p>
                        ) : (
                          (bwcAnalytics.declining_members || []).slice(0, 30).map((member) => (
                            <div key={member.member_id} className="flex items-center gap-3 rounded-2xl border border-orange-100 p-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                                {member.photo_url ? (
                                  <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{getInitials(member.full_name)}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-black text-slate-950">{member.full_name}</p>
                                <p className="text-xs text-slate-500">{member.cool_group} · Last seen {member.last_seen || "-"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-red-600">{member.previous_30_days} → {member.last_30_days}</p>
                                <p className="text-xs font-bold text-slate-400">30 hari</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-black text-slate-950">Perlu Follow-up</h3>
                      <p className="mt-1 text-sm text-slate-500">Tidak hadir 30–90 hari, sangat jarang, atau belum ada riwayat.</p>

                      <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {(bwcAnalytics.at_risk_members || []).length === 0 ? (
                          <p className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Tidak ada member at-risk.</p>
                        ) : (
                          (bwcAnalytics.at_risk_members || []).slice(0, 50).map((member) => (
                            <div key={member.member_id} className="rounded-2xl border border-orange-100 p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                                  {member.photo_url ? (
                                    <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{getInitials(member.full_name)}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-black text-slate-950">{member.full_name}</p>
                                  <p className="text-xs text-slate-500">{member.cool_group} · {member.phone || "-"}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                                  {member.risk_status || "perlu_diperhatikan"}
                                </span>
                                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">90d: {member.last_90_days}</span>
                                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">Last: {member.last_seen || "-"}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "events" && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <Card className="h-fit">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Admin Broadcast</p>
                <h2 className="mt-3 text-2xl font-black text-slate-950">Publish Upcoming Event</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Event yang dipublish akan muncul di Forum member. User bisa like, comment, reminder, dan pilih jam ibadah.
                </p>

                <form onSubmit={createBwcEvent} className="mt-5 space-y-3">
                  <input
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Judul event, contoh: Ibadah Kenaikan Tuhan Yesus"
                  />
                  <input
                    type="date"
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                  />
                  <input
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Lokasi"
                  />
                  <input
                    value={eventForm.service_times}
                    onChange={(e) => setEventForm({ ...eventForm, service_times: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Jam ibadah, pisahkan koma. Contoh: 10.00 WIB, 13.00 WIB"
                  />
                  <input
                    value={eventForm.ig_url}
                    onChange={(e) => setEventForm({ ...eventForm, ig_url: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Link Instagram"
                  />
                  <input
                    value={eventForm.image_url}
                    onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })}
                    className="w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Image URL / poster URL (optional)"
                  />
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="min-h-28 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Deskripsi / announcement event"
                  />
                  <button
                    disabled={eventPosting}
                    className="w-full rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    {eventPosting ? "Publishing..." : "Publish Event"}
                  </button>
                </form>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950">Preview Event Feed</h3>
                  <button onClick={fetchBwcEvents} className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700">
                    Refresh
                  </button>
                </div>
                {bwcEvents.length === 0 ? (
                  <Card>
                    <p className="text-lg font-black text-slate-950">Belum ada event broadcast.</p>
                    <p className="mt-1 text-sm text-slate-500">Admin bisa publish upcoming event dari dashboard admin.</p>
                  </Card>
                ) : (
                  bwcEvents.map((event) => (
                    <Card key={event.id}>
                      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                        <div className="overflow-hidden rounded-3xl bg-orange-50">
                          {event.image_url ? (
                            <img src={event.image_url} alt={event.title} className="h-56 w-full object-cover lg:h-full" />
                          ) : (
                            <div className="flex h-56 items-center justify-center bg-gradient-to-br from-orange-200 to-amber-100 text-5xl">
                              📣
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Upcoming Event</p>
                          <h3 className="mt-2 text-3xl font-black text-slate-950">{event.title}</h3>
                          <p className="mt-2 text-sm font-bold text-slate-600">{formatEventDate(event.event_date)}</p>
                          <p className="mt-1 text-sm text-slate-500">{event.location || "GBI Tanjung Duren"}</p>

                          {event.description && (
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{event.description}</p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {event.service_times.map((time) => (
                              <button
                                key={`${event.id}-${time}`}
                                onClick={() => setEventRsvp(event.id, time)}
                                className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                  event.my_rsvp_service_time === time ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700"
                                }`}
                              >
                                Hadir {time}
                              </button>
                            ))}
                          </div>

                          {Object.keys(event.rsvp_summary || {}).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(event.rsvp_summary || {}).map(([time, total]) => (
                                <span key={time} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                                  {time}: {total}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => toggleEventLike(event.id)}
                              className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                event.liked_by_me ? "bg-orange-500 text-white" : "bg-slate-950 text-white"
                              }`}
                            >
                              {event.liked_by_me ? "Liked" : "Like"} · {event.total_likes}
                            </button>

                            <button
                              onClick={() => toggleEventReminder(event.id)}
                              className={`rounded-2xl px-4 py-2 text-sm font-black ${
                                event.reminder_by_me ? "bg-amber-500 text-white" : "bg-orange-50 text-orange-700"
                              }`}
                            >
                              {event.reminder_by_me ? "Reminder On" : "Remind Me"}
                            </button>

                            {event.ig_url && (
                              <a
                                href={event.ig_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
                              >
                                Open IG
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl bg-orange-50 p-4">
                        <p className="mb-3 text-sm font-black text-slate-950">Comments · {event.total_comments}</p>

                        <div className="space-y-2">
                          {(event.comments || []).slice(-5).map((comment) => (
                            <div key={comment.id} className="flex gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[10px] font-black text-orange-600">
                                {comment.photo_url ? (
                                  <img src={comment.photo_url} alt={comment.member_name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{getInitials(comment.member_name || "BWC")}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2">
                                <p className="text-xs font-black text-slate-950">{comment.member_name}</p>
                                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            value={eventCommentInputs[event.id] || ""}
                            onChange={(e) => setEventCommentInputs((prev) => ({ ...prev, [event.id]: e.target.value }))}
                            className="min-w-0 flex-1 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                            placeholder="Tulis komentar..."
                          />
                          <button
                            type="button"
                            onClick={() => createEventComment(event.id)}
                            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}


          {activeTab === "scanner" && renderBwcLiveQrScanner()}
        </section>
      </div>
    </main>
  );
}
