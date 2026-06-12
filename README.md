# Âm Nhạc — iOS 26 Liquid Glass Music Player

Web app phát nhạc lấy cảm hứng từ giao diện Apple Music trên iOS 26 (Liquid Glass), chạy hoàn toàn tĩnh — không cần server, deploy thẳng lên Vercel.

## Tính năng

- **Liquid Glass thật**: tab bar, mini player và nút tìm kiếm dùng SVG displacement filter (khúc xạ viền + tán sắc màu) trên Chrome/Edge; tự fallback sang frosted glass trên Safari/Firefox.
- **4 tab**: Trang chủ, Khám phá, Radio, Thư viện — đúng bố cục iOS 26 (large title, glass header khi cuộn, tab bar thu gọn khi cuộn xuống).
- **Phát nhạc từ YouTube**: dán link, tên bài + nghệ sĩ tự điền (oEmbed), ảnh bìa lấy từ thumbnail. Video chạy trong player ẩn phía sau giao diện — điều khiển hoàn toàn bằng UI của app (phát/dừng, tua, hàng đợi, tự chuyển bài).
- **Tải nhạc lên**: chọn file MP3/M4A từ máy, đặt tên / nghệ sĩ / album / ảnh bìa. File lưu trong IndexedDB của trình duyệt — phát được cả khi offline, có Media Session (điều khiển trên màn hình khoá với file tải lên).
- **Thư viện đầy đủ**: Playlist, Nghệ sĩ, Album, Bài hát (nhóm A–Z + thanh chữ cái đỏ), Đã tải về, Bài Hát Yêu Thích, hàng đợi, xáo trộn, phát tiếp theo.
- **Now Playing**: nền màu chuyển động lấy từ ảnh bìa, artwork co lại khi pause, tiêu đề chạy marquee, thanh tua phình to khi chạm, vuốt xuống để đóng, vuốt ngang mini player để chuyển bài, nút xem video (với bài YouTube).

## Chạy thử trên máy

Phải chạy qua HTTP (mở file trực tiếp sẽ không phát được YouTube — lỗi 153):

```bash
npx serve .
# hoặc
python -m http.server 8000
```

Rồi mở http://localhost:3000 (hoặc :8000).

## Deploy lên Vercel

Cách 1 — kéo thả: vào https://vercel.com/new, kéo cả thư mục này vào.

Cách 2 — CLI:

```bash
npm i -g vercel
vercel
```

Cách 3 — GitHub: push thư mục lên repo, import vào Vercel. Không cần cấu hình gì thêm (site tĩnh thuần). `.vercelignore` đã loại ảnh chụp tham khảo và thư mục `reference/` khỏi bản deploy.

## Lưu ý

- **YouTube chạy nền**: trên desktop, nhạc tiếp tục phát khi chuyển tab khác. Trên điện thoại, trình duyệt sẽ dừng video YouTube khi tắt màn hình — đây là giới hạn của nền tảng web (không web app nào vượt qua được); nhạc **tải lên từ file** thì vẫn phát khi khoá màn hình.
- Việc ẩn player YouTube không đúng chuẩn ToS của YouTube API — dùng cho mục đích cá nhân; nếu phát hành công khai, hãy bật chế độ "Xem video" trong Now Playing.
- Một số video bị chủ kênh tắt nhúng (lỗi 101/150) — app sẽ tự bỏ qua và chuyển bài tiếp theo.
- Nhạc demo có sẵn là các bản NCS (NoCopyrightSounds) — nhạc miễn phí bản quyền; bạn có thể xoá trong menu ••• của từng bài.
- Dữ liệu (bài hát, playlist, file nhạc) lưu trong trình duyệt (IndexedDB) — xoá dữ liệu trang web sẽ mất thư viện.

## Cấu trúc

```
index.html        — khung app + SVG liquid glass filters
css/app.css       — toàn bộ style (design tokens theo iOS 26)
js/util.js        — helpers (màu từ ảnh bìa, gradient cover, toast…)
js/icons.js       — bộ icon SVG tự vẽ kiểu SF Symbols
js/db.js          — IndexedDB (songs / playlists / kv)
js/youtube.js     — tách video ID, oEmbed, IFrame API loader
js/glass.js       — sinh displacement map cho hiệu ứng khúc xạ
js/player.js      — engine phát hợp nhất (YouTube + file)
js/library.js     — trạng thái thư viện, recents, favorites
js/views.js       — render các màn hình + điều hướng
js/nowplaying.js  — mini player + màn Now Playing
js/app.js         — boot, tab, sheet, tìm kiếm, seed demo
```
