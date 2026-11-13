import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../server/api.ts';
import { isValidPublicHttpUrl, parseM3UPlaylist } from '../server/services/m3uParser.ts';
import { parseXmltvContent, parseXmltvTimestamp } from '../server/services/epgParser.ts';
import { loadLocalDb } from '../server/db.ts';

function startTestServer() {
  loadLocalDb();
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter());
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

test('M3U parser normalizes entries, deduplicates URLs, and blocks private SSRF URLs', () => {
  assert.equal(isValidPublicHttpUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'), true);
  assert.equal(isValidPublicHttpUrl('http://127.0.0.1:8080/internal.m3u8'), false);
  assert.equal(isValidPublicHttpUrl('http://localhost:3000/secret'), false);
  assert.equal(isValidPublicHttpUrl('javascript:alert(1)'), false);

  const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="bd.btv" tvg-country="BD" tvg-language="Bengali" group-title="News",BTV Sample [HD]
https://example.com/live/btv.m3u8
#EXTINF:-1 tvg-id="bd.btv" tvg-country="BD" tvg-language="Bengali" group-title="News",BTV Sample Duplicate
https://example.com/live/btv.m3u8
#EXTINF:-1 tvg-country="IN" group-title="Sports",Internal SSRF
http://169.254.169.254/latest/meta-data/
`;

  const parsed = parseM3UPlaylist(sampleM3U, 'Unit Test Source');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'BTV Sample');
  assert.equal(parsed[0].country_code, 'BD');
  assert.equal(parsed[0].country_name, 'Bangladesh');
  assert.equal(parsed[0].category, 'News');
  assert.equal(parsed[0].stream_type, 'hls');
  assert.equal(parsed[0].epg_channel_id, 'bd.btv');
});

test('XMLTV parser extracts programme schedules and converts timezone offsets', () => {
  const iso = parseXmltvTimestamp('20261112140000 +0600');
  assert.ok(iso && iso.startsWith('2026-11-12T08:00:00'));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20261112100000 +0000" stop="20261112110000 +0000" channel="global.reference.hls">
    <title>World News Desk</title>
    <desc>Hourly global bulletin.</desc>
    <category>News</category>
  </programme>
</tv>`;

  const programs = parseXmltvContent(xml, 'https://example.com/epg.xml');
  assert.equal(programs.length, 1);
  assert.equal(programs[0].title, 'World News Desk');
  assert.equal(programs[0].epg_channel_id, 'global.reference.hls');
});

test('REST API channels, countries, RBAC authorization, and admin CRUD workflow', async () => {
  const srv = await startTestServer();
  try {
    // 1. Public channel listing works
    const listRes = await fetch(`${srv.baseUrl}/api/channels?verifiedOnly=true`);
    assert.equal(listRes.status, 200);
    const listData = (await listRes.json()) as { channels: Array<{ verification_status: string }> };
    assert.ok(listData.channels.length >= 1);
    assert.ok(listData.channels.every((c) => c.verification_status === 'verified'));

    // 2. Countries list returns Bangladesh & India
    const countriesRes = await fetch(`${srv.baseUrl}/api/countries`);
    assert.equal(countriesRes.status, 200);
    const countriesData = (await countriesRes.json()) as {
      countries: Array<{ country_code: string }>;
    };
    assert.ok(countriesData.countries.some((c) => c.country_code === 'BD'));
    assert.ok(countriesData.countries.some((c) => c.country_code === 'IN'));

    // 3. Unauthenticated access to admin dashboard is blocked (401)
    const unauthAdmin = await fetch(`${srv.baseUrl}/api/admin/dashboard`);
    assert.equal(unauthAdmin.status, 401);

    // 4. Register standard viewer account -> role MUST be USER and blocked from admin (403)
    const uniqueEmail = `viewer-${Date.now()}@example.com`;
    const regRes = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'ViewerPassword123!',
        display_name: 'Test Viewer',
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = (await regRes.json()) as { token: string; user: { role: string } };
    assert.equal(regData.user.role, 'USER');

    const userAdminRes = await fetch(`${srv.baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${regData.token}` },
    });
    assert.equal(userAdminRes.status, 403);

    // 5. Super Admin login & channel create + delete lifecycle
    const adminLoginRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@globaltvhub.local',
        password: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@GlobalTV2026!',
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminLogin = (await adminLoginRes.json()) as { token: string; user: { role: string } };
    assert.equal(adminLogin.user.role, 'SUPER_ADMIN');

    const createRes = await fetch(`${srv.baseUrl}/api/admin/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        name: 'Test Authorized Channel',
        country_code: 'BD',
        country_name: 'Bangladesh',
        language: 'Bengali',
        category: 'News',
        stream_type: 'hls',
        stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        verification_status: 'verified',
        is_enabled: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { channel: { id: string } };

    const delRes = await fetch(`${srv.baseUrl}/api/admin/channels/${created.channel.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    assert.equal(delRes.status, 200);
  } finally {
    await srv.close();
  }
});
