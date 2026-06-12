/* ============================================================
   config.js — cloud storage credentials (Supabase)
   ------------------------------------------------------------
   Để bật đồng bộ đám mây, điền 2 giá trị dưới đây từ Supabase:
     Supabase Dashboard → Project Settings → API
       • Project URL      -> SUPABASE_URL
       • anon public key  -> SUPABASE_ANON_KEY   (key "anon", KHÔNG phải service_role)

   anon key vốn được thiết kế để công khai trên web (được bảo vệ bằng
   RLS policy), nên commit file này lên GitHub/Vercel là bình thường.

   Để TRỐNG -> app chạy hoàn toàn cục bộ (IndexedDB), không cần mạng.
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
