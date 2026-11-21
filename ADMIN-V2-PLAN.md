# Admin v2 — kế hoạch triển khai

Mục tiêu: admin dễ dùng cho người không biết JSON, crop ảnh chủ động, sơ đồ bàn tiệc trực quan, bản đồ xem trước trên trang chính.

## 0. Khung chung (ĐÃ LÀM — không sửa lại trừ khi bắt buộc)

- `src/shared/types.ts`
  - `EventDetails.mapsUrl?` (link Google Maps riêng từng sự kiện), `EventDetails.mapPreviewSrc?` (ảnh xem trước bản đồ, server tự ghi, đường dẫn tương đối dist/, ví dụ `assets/maps/reception-ab12cd34.jpg`).
  - `PhotoRecord.crop?: CropRect | null` — `{x,y,w,h}` chuẩn hoá 0..1 theo ảnh gốc ĐÃ xoay EXIF. Ưu tiên hơn `focalPoint`.
  - `SeatingTable { id, number, x, y, zoneId | null }`, `SeatingLayout { version: 1, tables }`, hằng `SEATING_CANVAS` (1000×700, sân khấu trên cùng, lối đi giữa).
  - `WeddingData.seatingLayout?: SeatingLayout | null` (null = sơ đồ kiểu cũ theo khu).
- `src/backend/db.ts`: cột `photos.crop`, `getSeatingLayout()/setSeatingLayout()` (kv `seating_layout`, mutation `'seating_layout'` → auto build).
- `src/backend/static-builder.ts`: `seatingLayout` có trong `wedding-data.json`.
- `src/backend/server.ts`: phục vụ `/admin/<file>` từ `src/backend/admin/`; `ServerOptions.onConfigSaved(prev, next)` gọi sau `PUT /api/config`; `main()` nối `createSeatingRoutes` (`src/backend/seating-routes.ts`) và `createMapPreview` (`src/backend/map-preview.ts`) — hiện là stub.
- `src/backend/admin.html`: chỉ còn khung; mỗi section có mount point `#config-root`, `#photos-root`, `#seating-root`; mỗi module `src/backend/admin/<x>.js` export `init()`.
- `src/backend/admin/common.js`: `$`, `api`, `busy`, `esc`, `h()` (DOM builder), `openModal({title, body, actions, wide})`.
- CSS dùng chung trong admin.html: `fieldset/legend`, `.field` (label > span + input + small), `.grid-2`, `.modal*`.

## A. Form nội dung & sự kiện (thay JSON) — `admin/config-form.js`

- Render form từ `GET /api/config`, nhóm theo `<fieldset><legend>`:
  1. **Cô dâu & chú rể**: groomName, brideName, headline, story (textarea).
  2. **Gia đình nhà trai**: groomParents.father/mother/address.
  3. **Gia đình nhà gái**: brideParents.*.
  4. **Lễ thành hôn** (ceremony) và 5. **Tiệc cưới** (reception): title, ngày giờ (`<input type="datetime-local">`, giữ offset `+07:00` khi lưu), venueName, hallName, address, **Link Google Maps** (`mapsUrl`) + ảnh xem trước bản đồ (`/site/<mapPreviewSrc>`) nếu có.
  6. **Kỹ thuật** (`<details>` thu gọn): siteBaseUrl, rsvpWebhookUrl, googleMapsEmbedUrl.
- Nhãn tiếng Việt + gợi ý (`<small>`). Không hiển thị `googleMapsUrl` cũ; khi lưu đặt `googleMapsUrl = reception.mapsUrl || ceremony.mapsUrl || googleMapsUrl cũ` để tương thích. Nếu mapsUrl rỗng khi load → điền sẵn từ `googleMapsUrl`.
- Không gửi `mapPreviewSrc` trong PUT (server giữ).
- Nút **Lưu nội dung**, trạng thái; sau lưu reload form (ảnh bản đồ có thể xuất hiện vài giây sau → nút "Làm mới").
- Template: `eventCard` dùng `e.mapsUrl || config.googleMapsUrl` (làm ở phần D).

## B. Ảnh cưới + popup crop — `admin/photos.js`, server photo routes, `image-processor.ts`, gallery template/CSS

- Danh sách ảnh: bỏ ô số `sortOrder` khó hiểu → thay bằng nút **↑ / ↓** (gọi `PUT /api/photos/order`) và nhãn "Vị trí #n". Mọi input đều có label. Placement hiển thị tên tiếng Việt: hero=Ảnh bìa, story=Nền "Câu chuyện", gallery=Album, rsvp_background=Nền trang đăng ký, invite_portrait=Ảnh chân dung thiệp, static_map=Ảnh bản đồ.
- Nút **✂ Chỉnh khung ảnh** mở popup (`openModal`, wide):
  - Ảnh gốc đã xoay EXIF tải từ route mới `GET /api/photos/:id/original` (sharp `.rotate()`, resize tối đa 2000px, JPEG).
  - Khung crop cố định theo tỉ lệ khu vực (`aspectFor` của server: hero/rsvp 16:9, story/invite 4:5, gallery 3:2 hoặc 2:3 — popup có nút chuyển Ngang/Dọc cho gallery; static_map: không crop → ẩn nút).
  - Kéo để di chuyển ảnh dưới khung, zoom bằng slider + con lăn chuột (+ pinch nếu dễ); ảnh luôn phủ kín khung (không lộ nền). Nút "Đặt lại" (vừa khít).
  - Lưu → `PUT /api/photos/:id { crop: {x,y,w,h}, orientation? }` → server cắt lại các variant.
- Server: `validCrop` (0..1, w,h>0, x+w≤1, y+h≤1 với dung sai 1e-6); PUT nhận `crop` (null = bỏ crop), recrop khi thay đổi; khi đổi placement thì xoá crop (vì tỉ lệ khác). Gallery: thêm field `aspect` tuỳ chọn? → KHÔNG; tỉ lệ gallery suy từ crop (w/h ảnh pixel).
- `processImage`: `opts.crop` → `extract` đúng vùng (làm tròn, clamp vào ảnh) rồi tạo variants; bỏ qua aspect/focal.
- Gallery frontend: mỗi `<figure>` có `style="aspect-ratio: W / H"` theo variant thật → khung hiển thị đúng tỉ lệ đã crop, không bị `object-fit: cover` cắt thêm (ảnh đầu tiên span 2 cột cũng giữ tỉ lệ).
- Test: image-processor (crop extract đúng kích thước), cms-api (PUT crop, validate lỗi, original endpoint trả image/jpeg), index-template (aspect-ratio inline).

## C. Sơ đồ bàn tiệc trực quan — `shared/seating-layout.ts`, `shared/seating-mapper.ts`, `backend/seating-routes.ts`, `admin/seating-editor.js`, invite/card

- **Khu vực = zone có sẵn** (7 zone, gắn với nhóm khách → `mapSeating` vẫn hoạt động). Đặt tên khu = sửa `nameVi`. `tableRange`, `hallSide`, `row` của zone được **tự tính** từ các bàn được gán.
- `shared/seating-layout.ts` (thuần, có test):
  - `autoLayout(count, prev?)`: xếp lưới 2 khối trái/phải lối đi, dưới sân khấu, khoảng cách tự giãn/co theo số bàn để vừa canvas; đánh số theo hàng (gần sân khấu trước), trái→phải. Giữ `zoneId` theo số bàn từ `prev`. Hỗ trợ 1..80 bàn, tối ưu 30–60.
  - `layoutFromZones(zones)`: tạo layout mặc định từ `tableRange` hiện tại (để lần đầu mở editor đã có bàn đúng khu).
  - `deriveZones(layout, zones)`: cập nhật tableRange ("Bàn 01 - Bàn 03" nếu liên tục, ngược lại "Bàn 01, 03, 07"; "Chưa xếp bàn" nếu rỗng), hallSide (x trung bình so với lối đi), row (y).
  - `validateLayout(x)`.
- `renderSeatingMapSvg(zones, { layout, zoneId, seatCount, ... })`: nếu có layout → vẽ chế độ bàn trong viewBox 600×560 (giữ nguyên để card-svg không đổi): sân khấu, lối đi, mỗi bàn là vòng tròn có số, tô màu theo zone; nền mờ bao quanh cụm bàn mỗi zone + nhãn mã khu; zone được highlight → bàn tô đậm + badge "n chỗ" + đường đi từ lối vào. Không có layout → giữ nguyên cách vẽ cũ (test cũ phải pass).
- Truyền `seatingLayout` vào: `invite.template.ts`, `scripts/invite.ts`, `card-svg-template.ts` (`renderCardSvg({ ..., layout })`), `bulk-studio.ts` → `generateCards`.
- Routes: `GET /api/seating-layout` → `{ layout | layoutFromZones(zones), zones, isDefault }`; `PUT /api/seating-layout { layout, zones }` → validate, `deriveZones`, lưu cả hai; `GET /api/seating-layout/preview.svg` → SVG hiện tại (image/svg+xml).
- **Admin — giao diện chính (không sửa được)**: `<img src="/api/seating-layout/preview.svg?t=…">` + bảng khu vực (tên, nhóm khách, bàn). Nút **Chỉnh sơ đồ bàn** mở popup.
- **Popup editor** (SVG thuần):
  - Toolbar: ô số bàn (+/−, 1–80) → `autoLayout` co/giãn lại toàn bộ (cảnh báo sẽ đặt lại vị trí đã kéo); "Sắp xếp tự động"; zoom −/+/vừa màn hình (+ con lăn chuột quanh con trỏ); chế độ "Chọn" / "Kéo khung nhìn" (giữ Space cũng pan).
  - Click bàn = chọn; Shift/Cmd-click = thêm/bớt; kéo vùng trống = khung chọn nhiều; kéo bàn đã chọn = di chuyển cả nhóm (snap lưới 5, giới hạn trong canvas, không đè sân khấu).
  - Panel khu vực: chọn bàn → chọn zone + nhập tên khu → "Gán khu vực"; "Bỏ khỏi khu". Danh sách khu với màu + số bàn.
  - **Lưu** → `PUT /api/seating-layout` (layout + zones đã đổi tên) → JSON lưu DB → dist tự build; đóng popup, làm mới ảnh chính. "Huỷ" bỏ thay đổi.
- Test: seating-layout (autoLayout 30/45/60 không chồng nhau & trong canvas; deriveZones range), seating-mapper layout mode, cms-api seating routes.

## D. Bản đồ xem trước trên trang chính — `backend/map-preview.ts`, `partials.ts eventCard`, CSS, builder copy

- `createMapPreview({ cms, fetchImpl?, mapsDir? })` → `{ routes, onConfigSaved }`.
- `onConfigSaved(prev, next)`: với mỗi sự kiện (ceremony, reception) mà `mapsUrl`/`address` thay đổi, hoặc chưa có `mapPreviewSrc` → chạy nền `refresh(event)` (không chặn response, lỗi chỉ log).
- `refresh(event)`:
  1. Lấy toạ độ: theo redirect link rút gọn (`maps.app.goo.gl`, `goo.gl/maps`) bằng `fetch(..., { redirect: 'follow' })` → `res.url`; parse `!3d<lat>!4d<lng>`, `@lat,lng`, `q|query|ll|center|destination=lat,lng`. Không có → geocode Nominatim (`q` = tên địa điểm trong URL hoặc `address`), User-Agent chung `wedding-cms-local/0.1`, timeout 8s.
  2. Có toạ độ → ghép tile OpenStreetMap zoom 16 (`https://tile.openstreetmap.org/z/x/y.png`) bằng sharp thành ảnh 800×400, ghim đỏ burgundy ở giữa, dòng "© OpenStreetMap contributors" góc phải dưới.
  3. Không có toạ độ / lỗi mạng → **sơ đồ đơn giản**: SVG cách điệu (nền kem, vài đường phố, ghim, tên địa điểm + địa chỉ) render bằng sharp → JPG.
  4. Ghi `data/media/_maps/<event>-<hash8>.jpg` (hash theo url+address), xoá file cũ cùng event, rồi `cms.db.setConfig({ [event]: { ...cur, mapPreviewSrc: 'assets/maps/<file>' } })` (gọi db trực tiếp, không qua onConfigSaved → không lặp).
- Route `POST /api/map-preview/:event` → tạo lại ngay, trả `{ mapPreviewSrc }`.
- `static-builder.ts`: copy `<mediaDir>/_maps/*` → `dist/assets/maps/` (dọn file thừa).
- `eventCard`: nếu `e.mapPreviewSrc` → `<a class="event__map" href=mapsUrl><img src=... alt="Bản đồ đến …" loading="lazy" width=800 height=400></a>` **ngay trên** nút "Chỉ đường Google Maps"; href nút = `e.mapsUrl || mapsUrl`.
- CSS `.event__map` (bo góc, viền, max-width 100%, aspect 2/1).
- Test: parse toạ độ (nhiều dạng URL), fallback khi fetch lỗi (fetchImpl giả, không gọi mạng thật), eventCard có ảnh trên nút + dùng mapsUrl riêng.

## Quy tắc chung cho người thực thi

- Chỉ sửa file thuộc phần của mình (danh sách ở mỗi phần). Cần đổi file khác → ghi chú lại, không tự sửa.
- Không gọi mạng thật trong test. `npm run typecheck` và `npx vitest run` phải xanh.
- Giữ giao diện tiếng Việt, màu Navy/Burgundy hiện có.

---

# Vòng 3 — bản đồ phóng to + popup, admin Tailwind & mobile

## 0. Khung chung (ĐÃ LÀM)

- Tailwind v4 (`@tailwindcss/cli`). Nguồn: `src/backend/admin/tailwind.css` (màu `navy`, `burgundy`, `ivory`, `cream`, `line`, `ink`, `muted`, `sky`, `lotus`; font `font-serif`). Kết quả build: `src/backend/admin/admin.css`, được admin.html nạp qua `/admin/admin.css`. `npm run build:admin-css`; `npm run dev` / `dev:lan` tự build trước khi chạy.
- Các class dùng chung (dùng những class này, đừng tự viết CSS riêng):
  - Nút: `.btn` + `.btn-primary | .btn-secondary | .btn-outline | .btn-danger`, kèm `.btn-sm` / `.btn-icon`. Nút bật/tắt dùng `aria-pressed="true"` (tự tô navy).
  - Khung và chữ: `.card .card-title .fieldset .legend .field .label .hint .input .status .badge`.
  - Popup: `.modal*` do `openModal` tạo; full màn hình trên điện thoại, căn giữa từ 640px.
- Tailwind chỉ nhận class viết đầy đủ trong chuỗi, không ghép chuỗi kiểu `bg-${x}`. Màu động (màu khu…) đặt bằng `style`.
- `admin.html` đã chuyển sang Tailwind: header sticky có menu ngang tới từng mục, Bulk Studio hiển thị dạng thẻ.
- `EventDetails.mapPreviewLargeSrc?` (ảnh bản đồ lớn cho popup). Server giữ cả `mapPreviewSrc` và `mapPreviewLargeSrc`, bỏ qua giá trị client gửi.

## M. Bản đồ: zoom lớn hơn + popup

- Ảnh mặc định: tile zoom 17, vùng 400×200 px tile phóng ×2 lên 800×400. Hiển thị ở khoảng 400px CSS thì tile gần đúng tỉ lệ 1:1, chữ và đường rõ.
- Ảnh lớn: cùng zoom 17 và cùng hệ số ×2, vùng 900×650 px tile thành 1800×1300 (xem rộng hơn, cùng tỉ lệ zoom). Fallback SVG cũng có bản lớn.
- Trang web: bấm ảnh bản đồ mở popup thay vì chuyển sang Google Maps. Popup lớn (gần full màn hình), ảnh hiển thị cùng tỉ lệ zoom với ảnh nhỏ, kéo để xem xung quanh, ban đầu căn giữa ghim. Có nút "Mở Google Maps" và nút đóng. Không có JS thì link vẫn mở Google Maps.

## T. Admin Tailwind + mobile (config-form.js, photos.js, seating-editor.js)

- Bỏ các khối `<style>` tự chèn và style inline cố định, thay bằng class Tailwind cùng các class dùng chung ở trên.
- Mobile-first: dùng được ở 375px, không cuộn ngang, nút cao tối thiểu 40px, input 16px trên điện thoại (tránh iOS tự zoom).
- Các popup chỉnh sửa (crop, sơ đồ bàn) dùng được bằng cảm ứng: kéo, pinch-zoom, chọn nhiều không cần phím Shift.
