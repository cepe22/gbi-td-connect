"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

type Contact = {
  member_id: string;
  member_code: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  cool_group: string | null;
  conversation_id: string | null;
  unread_count: number;
  last_message_preview: string | null;
  last_message_created_at: string | null;
};

type Conversation = {
  conversation_id: string;
  my_member_id: string;
  other_member_id: string;
  other_member_code: string;
  other_full_name: string;
  other_photo_url: string | null;
  other_cool_group: string | null;
  unread_count: number;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_sender_member_id: string | null;
  last_message_sender_name: string | null;
  last_message_created_at: string | null;
};

type Message = {
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
    return value;
  }
}

export default function BwcContactChat() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | Conversation | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const notifiedMessageRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedOtherMemberId = useMemo(() => {
    if (!selectedContact) return null;
    return "member_id" in selectedContact ? selectedContact.member_id : selectedContact.other_member_id;
  }, [selectedContact]);

  async function loadContacts() {
    const { data, error } = await supabase.rpc("get_active_chat_contacts", {
      input_search: search,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setContacts((data || []) as Contact[]);
  }

  async function loadConversations({ notify = false } = {}) {
    const { data, error } = await supabase.rpc("get_my_direct_conversations");

    if (error) {
      setStatus(error.message);
      return;
    }

    const rows = (data || []) as Conversation[];
    setConversations(rows);

    if (notify && notificationPermission === "granted") {
      const incoming = rows.find((item) => {
        return (
          item.unread_count > 0 &&
          item.last_message_id &&
          item.last_message_sender_member_id !== item.my_member_id &&
          item.last_message_id !== notifiedMessageRef.current
        );
      });

      if (incoming?.last_message_id) {
        notifiedMessageRef.current = incoming.last_message_id;

        try {
          new Notification(`Pesan baru dari ${incoming.last_message_sender_name || incoming.other_full_name}`, {
            body: incoming.last_message_preview || "Ada pesan baru di BWC Connect.",
            tag: incoming.conversation_id,
          });
        } catch {
          // Browser may block notifications silently.
        }
      }
    }
  }

  async function openConversation(target: Contact | Conversation) {
    setSelectedContact(target);

    const targetMemberId = "member_id" in target ? target.member_id : target.other_member_id;

    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      input_other_member_id: targetMemberId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    const conversationId = data as string;
    setSelectedConversationId(conversationId);
    await loadMessages(conversationId);
    await loadConversations();
  }

  async function loadMessages(conversationId = selectedConversationId || "") {
    if (!conversationId) return;

    const { error: markError } = await supabase.rpc("mark_direct_conversation_read", {
      input_conversation_id: conversationId,
    });

    if (markError) {
      setStatus(markError.message);
    }

    const { data, error } = await supabase.rpc("get_direct_messages", {
      input_conversation_id: conversationId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setMessages((data || []) as Message[]);

    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }

  async function sendMessage() {
    const content = messageInput.trim();

    if (!content || !selectedOtherMemberId) return;

    try {
      setSending(true);

      const { data, error } = await supabase.rpc("send_direct_message", {
        input_recipient_member_id: selectedOtherMemberId,
        input_content: content,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      const conversationId = result?.conversation_id || selectedConversationId;

      setMessageInput("");

      if (conversationId) {
        setSelectedConversationId(conversationId);
        await loadMessages(conversationId);
      }

      await loadContacts();
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setStatus("Browser ini belum mendukung notification popup.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setStatus("Notifikasi browser aktif.");
    } else {
      setStatus("Notifikasi belum diizinkan. Kamu bisa izinkan dari browser settings.");
    }
  }

  useEffect(() => {
    async function initialLoad() {
      try {
        setLoading(true);
        await loadContacts();
        await loadConversations();
      } finally {
        setLoading(false);
      }
    }

    initialLoad();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadContacts();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations({ notify: true });

      if (selectedConversationId) {
        loadMessages(selectedConversationId);
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [selectedConversationId, notificationPermission]);

  const totalUnread = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">BWC Contacts</p>
            <h2 className="mt-3 text-4xl font-black">Personal Chat</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Chat personal dengan sesama member yang sudah claim profile aktif.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              {notificationPermission === "granted" ? "Notification On" : "Enable Notification"}
            </button>
            <button
              type="button"
              onClick={() => {
                loadContacts();
                loadConversations({ notify: false });
              }}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
          {status}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-950">Inbox</h3>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                {totalUnread} unread
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {conversations.length === 0 ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">
                  Belum ada conversation.
                </p>
              ) : (
                conversations.slice(0, 8).map((item) => (
                  <button
                    key={item.conversation_id}
                    type="button"
                    onClick={() => openConversation(item)}
                    className={`w-full rounded-2xl p-3 text-left transition ${
                      selectedConversationId === item.conversation_id ? "bg-orange-500 text-white" : "bg-orange-50 text-slate-950 hover:bg-orange-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black text-orange-600">
                        {item.other_photo_url ? (
                          <img src={item.other_photo_url} alt={item.other_full_name} className="h-full w-full object-cover" />
                        ) : (
                          initials(item.other_full_name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-black">{item.other_full_name}</p>
                          {item.unread_count > 0 && (
                            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">
                              {item.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs opacity-80">{item.last_message_preview || "No message"}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-slate-950">Contacts</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
              placeholder="Cari nama, kode member, COOL..."
            />

            <div className="mt-4 max-h-[560px] space-y-2 overflow-auto pr-1">
              {loading ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Loading contacts...</p>
              ) : contacts.length === 0 ? (
                <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-slate-500">Tidak ada contact aktif.</p>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.member_id}
                    type="button"
                    onClick={() => openConversation(contact)}
                    className="w-full rounded-2xl border border-orange-100 p-3 text-left transition hover:bg-orange-50"
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-black text-slate-950">{contact.full_name}</p>
                          {contact.unread_count > 0 && (
                            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
                              {contact.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {contact.member_code} · {contact.cool_group || "Belum COOL"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-white shadow-sm">
          {!selectedContact ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-orange-50 text-4xl">💬</div>
              <h3 className="mt-5 text-2xl font-black text-slate-950">Pilih contact untuk mulai chat</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Pilih member aktif dari daftar contact di kiri. Pesan akan masuk ke inbox personal mereka.
              </p>
            </div>
          ) : (
            <div className="flex min-h-[720px] flex-col">
              <div className="flex items-center gap-3 border-b border-orange-100 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 text-sm font-black text-orange-600">
                  {"photo_url" in selectedContact && selectedContact.photo_url ? (
                    <img src={selectedContact.photo_url} alt={selectedContact.full_name} className="h-full w-full object-cover" />
                  ) : "other_photo_url" in selectedContact && selectedContact.other_photo_url ? (
                    <img src={selectedContact.other_photo_url} alt={selectedContact.other_full_name} className="h-full w-full object-cover" />
                  ) : (
                    initials("full_name" in selectedContact ? selectedContact.full_name : selectedContact.other_full_name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-slate-950">
                    {"full_name" in selectedContact ? selectedContact.full_name : selectedContact.other_full_name}
                  </p>
                  <p className="truncate text-xs font-bold text-slate-500">
                    {"member_code" in selectedContact ? selectedContact.member_code : selectedContact.other_member_code}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-auto bg-orange-50/40 p-5">
                {messages.length === 0 ? (
                  <div className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-500">
                    Belum ada pesan. Mulai percakapan dengan sapaan singkat.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.message_id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 text-sm shadow-sm ${
                          message.is_mine ? "bg-orange-500 text-white" : "bg-white text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        <div className={`mt-2 text-[10px] font-bold ${message.is_mine ? "text-orange-100" : "text-slate-400"}`}>
                          {formatTime(message.created_at)}
                          {message.is_mine && message.read_at ? " · read" : ""}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={scrollRef} />
              </div>

              <div className="border-t border-orange-100 p-5">
                <div className="flex gap-2">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="min-h-14 flex-1 rounded-2xl border border-orange-100 px-4 py-3 text-sm outline-none focus:border-orange-300"
                    placeholder="Tulis pesan..."
                  />
                  <button
                    type="button"
                    disabled={sending || !messageInput.trim()}
                    onClick={sendMessage}
                    className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Kalau pesan belum dibalas 15 menit, sistem email reminder akan berjalan setelah Edge Function dijadwalkan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

