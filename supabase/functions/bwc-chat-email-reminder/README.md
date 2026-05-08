# BWC Chat Email Reminder Edge Function

Fungsi ini mengirim email reminder kalau pesan personal belum dibalas selama 15 menit.

## Setup secrets

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set CHAT_FROM_EMAIL="BWC Connect <noreply@yourdomain.com>"
supabase secrets set APP_URL="https://gbi-td-connect.vercel.app"
```

## Deploy

```bash
supabase functions deploy bwc-chat-email-reminder --no-verify-jwt
```

## Schedule

Jalankan function ini tiap 5 menit via Supabase Scheduled Functions / Cron.

Target endpoint:

```text
https://<project-ref>.functions.supabase.co/bwc-chat-email-reminder
```

Kalau belum pakai scheduler, browser notification dan in-app unread badge tetap jalan, tapi email reminder belum otomatis terkirim.

