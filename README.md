# Global TV Hub

**Global TV Hub** is a full-stack international live television discovery and streaming platform built with React 19, TypeScript, Tailwind CSS, Express.js, HLS.js, and Supabase PostgreSQL.

It enables viewers to watch verified, legally accessible public streams, browse regional broadcaster directories (including Bangladesh, India, South Asia, North America, Europe, and the Middle East), explore official YouTube Live sports broadcasts, view XMLTV Electronic Program Guides (EPG), save favorites, and report broken feeds.

---

## Key Features

- **Adaptive Live Video Player (`src/components/LivePlayer.tsx`)**:
  - Supports `.m3u8` adaptive bitrate HLS streams via `hls.js` and native HLS fallback.
  - Quality level selector (`Auto` + rendition heights), Volume/Mute, Fullscreen, Picture-in-Picture, Loading/Buffering indicators, and keyboard shortcuts (`Space`/`K`, `M`, `F`, `P`).
  - Bounded HLS recovery attempts (max 3 retries) with clean `hls.destroy()` teardown when switching channels.
  - Supports official YouTube IFrame embeds and authorized external broadcaster links.
  - Honest discovery listings: channels without a verified stream URL clearly display their status and link to the broadcaster's official website instead of showing fake LIVE badges.
- **Channel Directory & Regional Spotlights**:
  - Dedicated sections for **Bangladesh** (BTV, BTV News, Somoy TV, Jamuna TV, Channel 24, Independent TV, Ekattor TV, ATN News, RTV, NTV, Channel i, Maasranga Television, Deepto TV, Banglavision, GTV, T Sports) and **India** (DD News, DD National, DD Sports, Sansad TV, Aaj Tak, ABP News, India Today, Republic TV, NDTV), plus international countries.
  - Real-time filtering by country, category, language, verification status, alphabetical/popularity sorting, and debounced search.
- **Sports Center & YouTube Data API v3 Integration**:
  - Discipline filtering (Cricket, Football, Tennis, Basketball, Other).
  - Server-side cached YouTube Live discovery (`eventType=live`) when `YOUTUBE_API_KEY` is configured.
- **Electronic Program Guide (EPG)**:
  - XMLTV parser (`fast-xml-parser`) supporting timezone offsets, Now & Next slots, and admin feed synchronization.
- **Protected Admin Console (`/admin`)**:
  - Role-Based Access Control (`SUPER_ADMIN`, `ADMIN`, `CHANNEL_MANAGER`, `CONTENT_EDITOR`).
  - Channel CRUD, server-side stream health checks (`#EXTM3U` verification + latency), IPTV-org M3U playlist preview & moderated import queue, broken stream reports triage, and audit logs.

---

## Local Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Variables in `.env.example`:
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`: Found in **Supabase Dashboard -> Project Settings -> API**.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side only secret from **Supabase Dashboard -> Project Settings -> API**. Never expose this in frontend code.
- `SESSION_SECRET`: Random HMAC secret used when running in local persistent database mode.
- `YOUTUBE_API_KEY`: Server-side only API key from **Google Cloud Console -> APIs & Services -> Credentials** (with YouTube Data API v3 enabled).
- `PORT`: Server port (default `3000`).
- `APP_URL`: Public URL of your deployment.

> **Zero-Config Preview Mode:** If `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are left blank, the server automatically runs with an atomic local persistent database at `data/global_tv_hub.db.json` and signed HMAC sessions so you can test every feature immediately.
>
> **Initial Local Admin Account:** `admin@globaltvhub.local` / `Admin@GlobalTV2026!` (override via `INITIAL_ADMIN_PASSWORD`).

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000`.

---

## Supabase PostgreSQL & RLS Setup

1. Create a new project in [Supabase](https://supabase.com/).
2. Open **SQL Editor** and execute `/supabase/migrations/001_initial_schema.sql`.
   - Creates `countries`, `categories`, `channels`, `profiles`, `user_roles`, `favorites`, `watch_history`, `stream_reports`, `stream_health_checks`, `audit_logs`, and `epg_programs`.
   - Enables Row Level Security (RLS) across all tables so public users can only read enabled channels, users manage only their own favorites/history, and only `SUPER_ADMIN` can assign privileged roles.
3. Optional: Enable Google OAuth under **Supabase -> Authentication -> Providers -> Google**.
4. Promote your first user to `SUPER_ADMIN` in Supabase SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('YOUR_USER_UUID', 'SUPER_ADMIN')
   ON CONFLICT (user_id) DO UPDATE SET role = 'SUPER_ADMIN';
   ```

---

## Testing

Run the automated TypeScript test suite (M3U parser, XMLTV EPG parser, REST endpoints, and RBAC enforcement):
```bash
npm test
```

Run static typechecking and production build verification:
```bash
npm run lint
npm run build
```

---

## Production Deployment

1. **Database**: Provision Supabase PostgreSQL and run `/supabase/migrations/001_initial_schema.sql`.
2. **Build**: Run `npm run build` to bundle the React SPA into `/dist`.
3. **Start Server**: Run `NODE_ENV=production npm start` (serves both `/api/*` REST endpoints and static `/dist` bundle via Express).
4. **Hosting**:
   - Deploy the Node.js + Express backend (or unified Express + `dist` server) to **Render**, **Railway**, or **Cloud Run**.
   - Alternatively host `/dist` on **Vercel** / **Netlify** and point `/api/*` rewrites to your Express backend URL.
