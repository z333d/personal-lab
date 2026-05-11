import { createAuthClient } from 'better-auth/react';

// Better Auth client uses baseURL as the full path to the auth handler.
// It does NOT honor a separate basePath option client-side — it appends
// `/sign-up/email` (etc.) directly to baseURL. So include the full path here.
const APP_AUTH_PATH = '/apps/todo/api/auth';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined'
    ? `${window.location.origin}${APP_AUTH_PATH}`
    : APP_AUTH_PATH,
});

export const { useSession, signIn, signUp, signOut } = authClient;
