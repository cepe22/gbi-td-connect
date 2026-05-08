import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PendingReminder = {
  message_id: string;
  conversation_id: string;
  sender_name: string;
  sender_member_code: string;
  recipient_name: string;
  recipient_email: string;
  message_preview: string;
  message_created_at: string;
  minutes_waiting: number;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const fromEmail = Deno.env.get("CHAT_FROM_EMAIL") || "BWC Connect <onboarding@resend.dev>";
const appUrl = Deno.env.get("APP_URL") || "https://gbi-td-connect.vercel.app";

const supabase = createClient(supabaseUrl, serviceRoleKey);

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendEmail(item: PendingReminder) {
  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY secret.");
  }

  const subject = `Pesan BWC dari ${item.sender_name} belum dibalas`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Halo ${htmlEscape(item.recipient_name)},</h2>
      <p>Kamu punya pesan personal dari <strong>${htmlEscape(item.sender_name)}</strong> yang belum dibalas sekitar ${item.minutes_waiting} menit.</p>
      <div style="padding:16px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa;margin:16px 0">
        ${htmlEscape(item.message_preview)}
      </div>
      <p>
        <a href="${appUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold">
          Buka BWC Connect
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">Email ini otomatis dikirim karena pesan belum mendapat balasan dalam 15 menit.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: item.recipient_email,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error ${response.status}: ${errorText}`);
  }
}

serve(async () => {
  try {
    const { data, error } = await supabase.rpc("get_pending_direct_message_email_reminders");

    if (error) {
      throw error;
    }

    const pending = (data || []) as PendingReminder[];
    const results = [];

    for (const item of pending) {
      try {
        await sendEmail(item);

        const { error: markError } = await supabase.rpc("mark_direct_message_email_reminder_sent", {
          input_message_id: item.message_id,
        });

        if (markError) throw markError;

        results.push({ message_id: item.message_id, status: "sent" });
      } catch (error) {
        results.push({
          message_id: item.message_id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_pending: pending.length,
        results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

