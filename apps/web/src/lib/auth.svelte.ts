import type { PublicUser } from '@albbas/shared';
import { trpc } from './trpc';

export const auth = $state<{ user: PublicUser | null; ready: boolean }>({
  user: null,
  ready: false,
});

export async function initAuth(): Promise<void> {
  try {
    auth.user = await trpc.auth.me.query();
  } catch {
    auth.user = null;
  } finally {
    auth.ready = true;
  }
}

export async function signOut(): Promise<void> {
  try {
    await trpc.auth.logout.mutate();
  } catch {
    // ignore network failures; the local session is cleared regardless
  }
  auth.user = null;
}
