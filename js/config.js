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
  SUPABASE_URL: 'https://rqqahnmgyuhuokyeuxnk.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcWFobm1neXVodW9reWV1eG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjc0MjIsImV4cCI6MjA5Njg0MzQyMn0.rSZW3NpXMgwfIwOyLcxbtel3qR3fjMahKT72M1qjO7Q',
};
