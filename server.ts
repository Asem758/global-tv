import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/api.ts';
import { isSupabaseConfigured, loadLocalDb } from './server/db.ts';
import { isYouTubeApiConfigured } from './server/services/youtubeService.ts';

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Basic security headers without breaking iframe/player embeds
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Mount REST API
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('server.ts');

if (isDirectRun) {
  const PORT = Number(process.env.PORT || 3000);
  if (!isSupabaseConfigured()) {
    loadLocalDb();
    console.log(
      '[Global TV Hub] Running with local persistent store (data/global_tv_hub.db.json). Configure VITE_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY for Supabase PostgreSQL.',
    );
  } else {
    console.log('[Global TV Hub] Supabase PostgreSQL & Auth active.');
  }

  if (!isYouTubeApiConfigured()) {
    console.log(
      '[Global TV Hub] YOUTUBE_API_KEY not configured — YouTube Live discovery disabled until key is added.',
    );
  }

  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Global TV Hub] Server listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[Global TV Hub] Failed starting server:', err);
      process.exit(1);
    });
}
