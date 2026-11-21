# KẾ HOẠCH XÂY DỰNG WEB ĐÁM CƯỚI (WEDDING WEBAPP MASTER PLAN)

> **Phương pháp luận**: SDD (Spec-Driven Development) + TDD (Test-Driven Development)
> **Chuẩn tài liệu & Tri thức**:
> - **OpenSpec (v1.17.0 Strict Validated - 100% English)**: `openspec/specs/` & `openspec/changes/build-wedding-webapp/`
> - **Open Knowledge Format (OKF Bundle - 100% English)**: `okf/*.md` (YAML frontmatter + Wiki-linked Markdown concepts)
> **Mô hình điều phối**:
> - **Architect / Spec & OKF Builder**: Gemini 4 Argon
> - **Implementer (Test & Code Subtasks)**: Claude / Haiku

---

## 1. QUYẾT ĐỊNH KIẾN TRÚC & GIẢI PHÁP KỸ THUẬT ĐÃ CHỐT

1. **Local CMS Backend + Auto Static Site Generation (Formidable-style)**:
   - Backend + SQLite (`data/wedding.db`) chỉ chạy trên máy local của anh.
   - Hỗ trợ chỉnh sửa toàn bộ nội dung chữ, thông tin sự kiện, danh sách ảnh cưới linh động, và cấu hình sơ đồ bàn tiệc.
   - **Auto-Rebuild Trigger**: Mọi thao tác thay đổi dữ liệu trong Backend đều tự động kích hoạt bộ `StaticBuilder` kết xuất toàn bộ ra thư mục `dist/` (HTML5/CSS3/JS tĩnh + JSON snapshot + ảnh đã tối ưu) trong `< 500ms`.
2. **Smart Image Pipeline (`sharp`)**:
   - Tự động đọc EXIF orientation, cắt ảnh thông minh (`attention` / focal-point smart crop) và xuất đa kích thước (`sm: 640w`, `md: 1024w`, `lg: 1440w`, `fhd: 1920w`) định dạng `.webp` và `.jpg`.
3. **Google Sheets + Google Apps Script (`doPost` Upsert theo SĐT Unique)**:
   - Trang Đăng ký (`rsvp.html`) gửi dữ liệu tới Google Apps Script Webhook gắn với Google Sheet.
   - Tự động chuẩn hóa SĐT Việt Nam (`+849...` -> `09...`) và dùng làm **Unique Key**: nếu SĐT đã tồn tại sẽ cập nhật đè (Upsert), nếu chưa có sẽ thêm mới.
4. **Cơ chế Mã hóa & Rút gọn URL Khách mời Kép (Hybrid Guest URL Codec)**:
   - **Chế độ 1 — Short ID (`invite.html?id=c9a2f1`)**: Với danh sách khách đã đồng bộ từ Google Sheet trước khi build, Local Backend sinh mã băm ngắn 6 ký tự trong bảng tra cứu tĩnh `dist/assets/data/guests-map.json` (ánh xạ `shortId -> compactToken`).
   - **Chế độ 2 — Self-contained Compact Token (`invite.html?g=<base64url>`)**: Nén trực tiếp 4 trường `[salutation, name, relationshipCode, count]` thành chuỗi Base64URL nhỏ gọn để hoạt động 100% độc lập cho cả khách mời phát sinh sau khi đã deploy web.
5. **Sơ đồ Bàn tiệc theo Khu vực Nhóm (Group Zone Seating Map)**:
   - Hiển thị mặt bằng sảnh tiệc trực quan (Sân khấu, Lối đi chính, và các Khu vực bàn theo 7 nhóm mối quan hệ).
   - Tự động highlight (tô sáng + hiệu ứng pulse + chỉ dẫn đường đi) vào đúng cụm bàn của khách dựa trên `relationship` và `count`.
6. **Xuất & Gửi Thiệp Mời JPG (Client-side & Bulk Studio)**:
   - **Trên trang Mời cưới (`invite.html`)**: Khách bấm 1 nút để kết xuất thiệp mời cá nhân hóa thành ảnh `.jpg` sắc nét (tỷ lệ dọc `1080x1620`), tải về máy hoặc chia sẻ thẳng qua menu điện thoại (`navigator.share` Web Share API).
   - **Trên Local Backend (`Bulk Invitation Studio`)**: Đồng bộ danh sách khách từ Google Sheet, kết xuất hàng loạt file `<ShortID>_<TenKhach>.jpg`, hỗ trợ gửi Email tự động đính kèm JPG và bảng điều khiển **"1-Click Zalo/Messenger Assist"**.
7. **Hệ màu sắc (Color Palette Harmony)**:
   - **Tông chủ đạo (90% diện tích)**: Xanh Navy (`#0F2042`) & Đỏ Burgundy (`#7A1C24`) kết hợp nền Trắng Kem (`#FDFBF7`) và chữ Đen Than (`#111827`).
   - **Tông màu phụ (10% Accent/Highlight)**: Xanh da trời (`#38BDF8`) đại diện cho cụm bàn & huy hiệu Nhà Trai; Hồng cánh sen (`#EC4899`) đại diện cho cụm bàn & huy hiệu Nhà Gái.

---

## 2. CẤU TRÚC CHUẨN OPENSPEC & OKF ĐÃ KHỞI TẠO (100% ENGLISH & VALIDATED)

Toàn bộ cấu trúc OpenSpec đã được khởi tạo bằng `openspec init` (tích hợp sẵn slash commands `/opsx:apply`, `/opsx:propose` trong `.claude/` và `.agents/`) và vượt qua kiểm tra `openspec validate --all --strict` (`6 passed, 0 failed`):

```text
/Users/sakutara/Work/wedding/
├── PLAN.md                                              # Bản kế hoạch tổng thể
├── okf/                                                 # Open Knowledge Format Bundle (100% English Markdown + YAML Frontmatter)
│   ├── index.md                                         # OKF Bundle Index & Knowledge Graph links
│   ├── domain_glossary.md                               # 3 pages, 7 relationship groups, Vietnamese salutations & schemas
│   ├── design_tokens.md                                 # Navy/Burgundy palette, fluid clamp() tokens, parallax, 1080x1620 JPG spec
│   ├── invitation_and_seating_rules.md                  # Greeting copy rules, VN phone normalization, hybrid URL codec, seating zones
│   └── google_sheets_and_bulk_playbook.md               # Unique-phone Apps Script upsert protocol & bulk JPG dispatch workflow
└── openspec/                                            # Standard OpenSpec Repository (100% English)
    ├── config.yaml                                      # OpenSpec schema: spec-driven (language: en)
    ├── specs/                                           # Source-of-truth Capability Specifications
    │   ├── cms-and-static-builder/spec.md               # Local CMS, SQLite & Auto-Static Builder requirements + scenarios
    │   ├── smart-image-and-card-pipeline/spec.md        # sharp image crop/resize & 1080x1620 JPEG card requirements + scenarios
    │   ├── google-sheets-and-bulk-dispatch/spec.md      # Unique-phone Google Sheets RSVP & bulk JPG generation requirements + scenarios
    │   ├── guest-url-codec-and-seating/spec.md          # Hybrid URL codec (?g= & ?id=), greeting copy & seating map requirements + scenarios
    │   └── wedding-frontend-pages/spec.md               # 3 static pages, fluid responsive, parallax & JPEG save/share requirements + scenarios
    └── changes/
        └── build-wedding-webapp/                        # Active OpenSpec Change (4/4 Artifacts Ready for /opsx:apply)
            ├── .openspec.yaml
            ├── proposal.md                              # Why, What Changes, Capabilities, Impact
            ├── design.md                                # Context, Goals/Non-Goals, Architectural Decisions, Risks
            ├── tasks.md                                 # Tracked TDD Implementation Checklist (Groups 1..6)
            └── specs/                                   # Delta Specs for all 5 capabilities
                ├── cms-and-static-builder/spec.md
                ├── smart-image-and-card-pipeline/spec.md
                ├── google-sheets-and-bulk-dispatch/spec.md
                ├── guest-url-codec-and-seating/spec.md
                └── wedding-frontend-pages/spec.md
```

---

## 3. LỘ TRÌNH THỰC THI TDD THEO OPENSPEC (`openspec/changes/build-wedding-webapp/tasks.md`)

Khi mở Claude Code trong thư mục dự án, anh có thể chạy trực tiếp lệnh `/opsx:apply build-wedding-webapp` (hoặc bảo Claude thực thi `openspec/changes/build-wedding-webapp/tasks.md` kết hợp `okf/`):

- **Group 1 — Project Scaffolding and OKF Bundle Verification**:
  - `1.1`: Khởi tạo `package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`.
  - `1.2`: Xây dựng `src/shared/types.ts` khớp với `okf/domain_glossary.md` & `okf/design_tokens.md` và chạy pass `tests/unit/okf-bundle.test.ts`.
- **Group 2 — Guest URL Codec, Greeting Formatter, and Seating Mapper (TDD)**:
  - `2.1`: Viết test `tests/unit/phone-normalizer.test.ts` & code `src/shared/phone-normalizer.ts`.
  - `2.2`: Viết test `tests/unit/guest-codec.test.ts` & code `src/shared/guest-codec.ts` (`?g=` và `?id=`).
  - `2.3`: Viết test `tests/unit/invitation-seating.test.ts` & code `src/shared/invitation-formatter.ts`, `src/shared/seating-mapper.ts`.
- **Group 3 — Smart Image Pipeline and JPEG Card Renderer (TDD)**:
  - `3.1`: Viết test `tests/integration/image-processor.test.ts` & code `src/backend/image-processor.ts` (`sharp`).
  - `3.2`: Viết test `tests/integration/card-renderer.test.ts` & code `src/shared/card-svg-template.ts`, `src/backend/bulk-card-generator.ts` (`1080x1620` JPEG).
- **Group 4 — Local CMS Backend, SQLite Store, and Auto-Static Builder (TDD)**:
  - `4.1`: Viết test `tests/integration/static-builder.test.ts` & code `src/backend/db.ts`, `src/backend/static-builder.ts` (tự động build ra `dist/` trong `< 500ms` mỗi khi DB thay đổi).
  - `4.2`: Viết test `tests/integration/cms-api.test.ts` & code `src/backend/server.ts`.
- **Group 5 — Google Sheets Unique-Phone RSVP and Bulk Invitation Studio (TDD)**:
  - `5.1`: Viết test `tests/unit/sheets-sync.test.ts` & code `src/gas/Code.gs`, `src/backend/sheets-sync.ts`.
  - `5.2`: Viết test `tests/integration/bulk-dispatch.test.ts` & tích hợp Bulk Studio vào `src/backend/server.ts`.
- **Group 6 — Static Frontend Pages, Fluid Layout, Parallax, and Client JPEG Share (TDD)**:
  - `6.1`: Xây dựng `src/frontend/styles/main.css` & `src/frontend/scripts/parallax.ts` + unit test `tests/unit/parallax.test.ts`.
  - `6.2`: Xây dựng Trang Báo Hỉ (`src/frontend/templates/index.template.ts`).
  - `6.3`: Xây dựng Trang Đăng Ký không cuộn (`src/frontend/templates/rsvp.template.ts`, `src/frontend/scripts/rsvp.ts`).
  - `6.4`: Xây dựng Trang Mời Cưới cá nhân hóa & Lưu/Chia sẻ JPG (`src/frontend/templates/invite.template.ts`, `src/frontend/scripts/invite.ts`).
  - `6.5`: Chạy bộ kiểm thử E2E Playwright `tests/e2e/wedding-webapp.spec.ts` trên Mobile (`390x844`) và FullHD (`1920x1080`).
