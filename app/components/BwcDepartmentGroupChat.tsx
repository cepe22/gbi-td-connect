"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type DepartmentRoom = {
  department_id: string;
  department_name: string;
  my_role: string | null;
  member_count: number;
  last_message_preview: string | null;
  last_message_sender_name: string | null;
  last_message_created_at: string | null;
};

type GroupMessage = {
  message_id: string;
  department_id: string;
  sender_member_id: string;
  sender_name: string;
  sender_photo_url: string | null;
  sender_role: string | null;
  content: string;
  created_at: string;
  is_mine: boolean;
};

type DepartmentContact = {
  member_id: string;
  member_code: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  role: string | null;
  is_me: boolean;
  conversation_id: string | null;
  last_message_preview: string | null;
  last_message_created_at: string | null;
};

type DirectMessage = {
  message_id: string;
  conversation_id: string;
  sender_member_id: string;
  sender_name: string;
  sender_photo_url: string | null;
  recipient_member_id: string;
  content: string;
  read_at: string | null;
  email_reminder_sent_at: string | null;
  created_at: string;
  is_mine: boolean;
};

function initials(name?: string | null) {
  return (name || "BWC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function formatTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value || "";
  }
}

export default function BwcDepartmentGroupChat() {
  const [rooms, setRooms] = useState<DepartmentRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [contacts, setContacts] = useState<DepartmentContact[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [selectedContact, setSelectedContact] = useState<DepartmentContact | null>(null);
  const [directConversationId, setDirectConversationId] = useState<string | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [directInput, setDirectInput] = useState("");
  const [viewMode, setViewMode] = useState<"group" | "direct">("group");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const groupScrollRef = useRef<HTMLDivElement | null>(null);
  const directScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.department_id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  async function loadRooms() {
    const { data, error } = await supabase.rpc("get_my_department_chat_rooms");

    if (error) {
      setStatus(error.message);
      return;
    }

    const rows = (data || []) as DepartmentRoom[];
    setRooms(rows);

    if (!selectedRoomId && rows.length > 0) {
      setSelectedRoomId(rows[0].department_id);
    }
  }

  async function loadRoomData(roomId = selectedRoomId) {
    if (!roomId) return;

    try {
      setLoading(true);

      const [contactsResult, messagesResult] = await Promise.all([
        supabase.rpc("get_department_group_contacts", {
          input_department_id: roomId,
        }),
        supabase.rpc("get_department_group_messages", {
          input_department_id: roomId,
        }),
      ]);

      if (contactsResult.error) {
        setStatus(contactsResult.error.message);
      } else {
        setContacts((contactsResult.data || []) as DepartmentContact[]);
      }

      if (messagesResult.error) {
        setStatus(messagesResult.error.message);
      } else {
        setGroupMessages((messagesResult.data || []) as GroupMessage[]);
        setTimeout(() => groupScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendGroupMessage() {
    const content = groupInput.trim();
    if (!content || !selectedRoomId) return;

    try {
      setSending(true);

      const { error } = await supabase.rpc("send_department_group_message", {
        input_department_id: selectedRoomId,
        input_content: content,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setGroupInput("");
      await loadRoomData(selectedRoomId);
      await loadRooms();
    } finally {
      setSending(false);
    }
  }

  async function openDirectChat(contact: DepartmentContact) {
    if (contact.is_me) return;

    setSelectedContact(contact);
    setViewMode("direct");

    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      input_other_member_id: contact.member_id,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    const conversationId = data as string;
    setDirectConversationId(conversationId);
    await loadDirectMessages(conversationId);
  }

  async function loadDirectMessages(conversationId = directConversationId || "") {
    if (!conversationId) return;

    await supabase.rpc("mark_direct_conversation_read", {
      input_conversation_id: conversationId,
    });

    const { data, error } = await supabase.rpc("get_direct_messages", {
      input_conversation_id: conversationId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setDirectMessages((data || []) as DirectMessage[]);
    setTimeout(() => directScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  async function sendDirectMessage() {
    const content = directInput.trim();
    if (!content || !selectedContact) return;

    try {
      setSending(true);

      const { data, error } = await supabase.rpc("send_direct_message", {
        input_recipient_member_id: selectedContact.member_id,
        input_content: content,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      const conversationId = result?.conversation_id || directConversationId;

      setDirectInput("");

      if (conversationId) {
        setDirectConversationId(conversationId);
        await loadDirectMessages(conversationId);
      }

      await loadRoomData();
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      setViewMode("group");
      setSelectedContact(null);
      setDirectConversationId(null);
      setDirectMessages([]);
      loadRoomData(selectedRoomId);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (selectedRoomId && viewMode === "group") {
        loadRoomData(selectedRoomId);
      }

      if (directConversationId && viewMode === "direct") {
        loadDirectMessages(directConversationId);
      }
    }, 8000);

    return () => window.clearInterval(timer);
  }, [selectedRoomId, directConversationId, viewMode]);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Department Group</p>
            <h2 className="mt-3 text-4xl font-black">Group Chat Pelayanan</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Chat group berdasarkan divisi pelayanan yang sama. Dari daftar contact, kamu juga bisa langsung chat personal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              loadRooms();
              loadRoomData();
            }}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Refresh
          </button>
        </div>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_320px]">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">Divisi Saya</h3>
          <p className="mt-1 text-sm text-slate-500">Pilih group chat pelayanan.</p>

          <div className="mt-5 space-y-2">
            {rooms.length === 0 ? (
              <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                Belum ada divisi pelayanan yang terhubung ke akun ini.
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.department_id}
                  type="button"
                  onClick={() => setSelectedRoomId(room.department_id)}
                  className={`w-full rounded-2xl p-4 text-left transition ${
                    selectedRoomId === room.department_id ? "bg-orange-500 text-white" : "bg-orange-50 text-slate-950 hover:bg-orange-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{room.department_name}</p>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-orange-700">
                      {room.member_count} org
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs opacity-80">
                    {room.last_message_preview
                      ? `${room.last_message_sender_name || "Member"}: ${room.last_message_preview}`
                      : `Role kamu: ${room.my_role || "member"}`}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-orange-100 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">
                {viewMode === "group" ? "Group Chat" : "Personal Chat"}
              </p>
              <h3 className="mt-1 text-2xl font-black text-slate-950">
                {viewMode === "group"
                  ? selectedRoom?.department_name || "Pilih Divisi"
                  : selectedContact?.full_name || "Personal Chat"}
              </h3>
              <p className="text-sm text-slate-500">
                {viewMode === "group"
                  ? `${selectedRoom?.member_count || 0} contact dalam divisi ini`
                  : selectedContact?.role || "member"}
              </p>
            </div>

            {viewMode === "direct" && (
              <button
                type="button"
                onClick={() => setViewMode("group")}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-slate-700"
              >
                Back to Group
              </button>
            )}
          </div>

          {viewMode === "group" ? (
            <>
              <div className="h-[560px] space-y-3 overflow-auto bg-orange-50/40 p-5">
                {loading ? (
                  <div className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-500">
                    Loading group chat...
                  </div>
                ) : groupMessages.length === 0 ? (
                  <div className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-500">
                    Belum ada pesan di group ini. Mulai diskusi pelayanan dengan pesan singkat.
                  </div>
                ) : (
                  groupMessages.map((message) => (
                    <div key={message.message_id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 text-sm shadow-sm ${
                          message.is_mine ? "bg-orange-500 text-white" : "bg-white text-slate-800"
                        }`}
                      >
                        {!message.is_mine && (
                          <p className="mb-1 text-xs font-black text-orange-600">
                            {message.sender_name} · {message.sender_role || "member"}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        <p className={`mt-2 text-[10px] font-bold ${message.is_mine ? "text-orange-100" : "text-slate-400"}`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={groupScrollRef} />
              </div>

              <div className="border-t border-orange-100 p-5">
                <div className="flex gap-2">
                  <textarea
                    value={groupInput}
                    onChange={(event) => setGroupInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendGroupMessage();
                      }
                    }}
                    className="min-h-14 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Tulis pesan ke group divisi..."
                  />
                  <button
                    type="button"
                    disabled={sending || !groupInput.trim() || !selectedRoomId}
                    onClick={sendGroupMessage}
                    className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-[560px] space-y-3 overflow-auto bg-orange-50/40 p-5">
                {directMessages.length === 0 ? (
                  <div className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-500">
                    Belum ada personal chat dengan contact ini.
                  </div>
                ) : (
                  directMessages.map((message) => (
                    <div key={message.message_id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 text-sm shadow-sm ${
                          message.is_mine ? "bg-orange-500 text-white" : "bg-white text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        <p className={`mt-2 text-[10px] font-bold ${message.is_mine ? "text-orange-100" : "text-slate-400"}`}>
                          {formatTime(message.created_at)}
                          {message.is_mine && message.read_at ? " · read" : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={directScrollRef} />
              </div>

              <div className="border-t border-orange-100 p-5">
                <div className="flex gap-2">
                  <textarea
                    value={directInput}
                    onChange={(event) => setDirectInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendDirectMessage();
                      }
                    }}
                    className="min-h-14 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder={`Tulis pesan ke ${selectedContact?.full_name || "contact"}...`}
                  />
                  <button
                    type="button"
                    disabled={sending || !directInput.trim() || !selectedContact}
                    onClick={sendDirectMessage}
                    className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">Contact Divisi</h3>
          <p className="mt-1 text-sm text-slate-500">
            Orang-orang yang ter-label di bidang pelayanan ini.
          </p>

          <div className="mt-5 max-h-[720px] space-y-2 overflow-auto pr-1">
            {contacts.length === 0 ? (
              <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                Belum ada contact aktif dalam divisi ini.
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.member_id}
                  type="button"
                  disabled={contact.is_me}
                  onClick={() => openDirectChat(contact)}
                  className={`w-full rounded-2xl border border-orange-100 p-3 text-left transition ${
                    contact.is_me ? "bg-slate-50 opacity-70" : "hover:bg-orange-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-xs font-black text-orange-600">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt={contact.full_name} className="h-full w-full object-cover" />
                      ) : (
                        initials(contact.full_name)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">
                        {contact.full_name}
                        {contact.is_me ? " (Saya)" : ""}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {contact.member_code} · {contact.role || "member"}
                      </p>
                      {contact.last_message_preview && !contact.is_me && (
                        <p className="mt-1 truncate text-xs font-bold text-orange-600">
                          {contact.last_message_preview}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

