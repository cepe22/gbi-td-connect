"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";

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
  const [bwcPosts, setBwcPosts] = useState<BwcPost[]>([]);
  const [bwcComments, setBwcComments] = useState<Record<string, BwcComment[]>>({});
  const [newPost, setNewPost] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "scanner">("dashboard");
  const [memberTab, setMemberTab] = useState<"home" | "qr" | "schedule" | "cool" | "forum" | "profile">("home");
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
    fetchLinkedMember();
  }, [session]);

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
    if (!session) return;
    if (!isAdmin && !isUsher) return;

    fetchMembers();
    fetchAttendanceSessions();
  }, [session, roles.join("|")]);

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
      setMessage("File harus berupa gambar.");
      return;
    }

    const maxSizeInBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setMessage("Ukuran foto maksimal 2MB.");
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
        setMessage(uploadError.message);
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
        setMessage(error.message);
        return;
      }

      setLinkedMember((prev) => prev ? { ...prev, photo_url: photoUrl } : prev);

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
      { id: "cool", label: "COOL", icon: "🌱" },
      { id: "forum", label: "Forum", icon: "💬" },
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
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">My Schedule</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">Jadwal Pelayanan</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Untuk sekarang, halaman ini disiapkan sebagai tempat jadwal pelayanan pribadi.
                </p>

                <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-6 text-center">
                  <p className="text-2xl font-black text-slate-950">Belum ada jadwal pelayanan aktif</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                    Nanti jadwal dari ketua departemen akan muncul di sini, termasuk status konfirmasi hadir dan role pelayanan.
                  </p>
                </div>
              </Card>

              <div className="grid gap-5 md:grid-cols-3">
                <Card>
                  <p className="text-sm text-slate-500">Next Service</p>
                  <p className="mt-2 text-xl font-black text-slate-950">-</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Department</p>
                  <p className="mt-2 text-xl font-black text-slate-950">-</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Confirmation</p>
                  <p className="mt-2"><Badge tone="slate">No schedule</Badge></p>
                </Card>
              </div>
            </section>
          )}

          {memberTab === "cool" && (
            <section className="space-y-6">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">My COOL</p>
                <h2 className="mt-3 text-4xl font-black">Bride Warrior Community</h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                  BWC adalah komunitas Youth untuk bertumbuh bersama dalam iman, karakter, pelayanan, dan kehidupan sehari-hari.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Card>
                  <p className="text-sm text-slate-500">Generation</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">Youth</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Meeting Day</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">Sabtu</p>
                </Card>
                <Card>
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">GBI Tanjung Duren</p>
                </Card>
              </div>

              <Card>
                <h3 className="text-xl font-black text-slate-950">Upcoming COOL / Event</h3>
                <div className="mt-4 rounded-3xl bg-orange-50 p-5">
                  <p className="font-black text-slate-950">Belum ada announcement aktif</p>
                  <p className="mt-1 text-sm text-slate-500">Nanti bagian ini bisa dihubungkan ke event BWC dan announcement dari leader.</p>
                </div>
              </Card>
            </section>
          )}


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

                    <label className={`mt-4 inline-flex cursor-pointer rounded-2xl px-4 py-3 text-sm font-black text-white ${
                      uploadingPhoto ? "bg-slate-400" : "bg-orange-500"
                    }`}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={uploadMyProfilePicture}
                        disabled={uploadingPhoto}
                      />
                      {uploadingPhoto ? "Uploading..." : linkedMember.photo_url ? "Ganti Foto" : "Tambah Foto"}
                    </label>
                    <button
                      type="button"
                      onClick={fetchLinkedMember}
                      className="ml-2 mt-4 inline-flex rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-black text-slate-700"
                    >
                      Refresh Foto
                    </button>
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
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
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
                      placeholder="BWC-00001"
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
                  <pre className="rounded-2xl bg-slate-950 p-4 text-xs font-bold text-white">BWC-00001</pre>
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
