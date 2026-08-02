import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { invitesRouter } from './invites.js';
import { keysRouter } from './keys.js';
import { pastesRouter } from './pastes.js';
import { shortUrlsRouter } from './shortUrls.js';
import { uploadsRouter } from './uploads.js';
import { usersRouter } from './users.js';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  keys: keysRouter,
  invites: invitesRouter,
  uploads: uploadsRouter,
  pastes: pastesRouter,
  shortUrls: shortUrlsRouter,
});

export type AppRouter = typeof appRouter;
