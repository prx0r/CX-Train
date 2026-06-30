import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const dbPath = process.env.MVP_SQLITE_PATH || "./data/callcallum.db";
const resolvedPath = path.resolve(process.cwd(), dbPath);

export const auth = betterAuth({
  database: new Database(resolvedPath),
  baseURL: {
    allowedHosts: ['*.trycloudflare.com', 'localhost:3000', '127.0.0.1:3000'],
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      bio: {
        type: "string",
        required: false,
        defaultValue: "",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { getDb } = await import("@/lib/mvp/db");
          const db = getDb();
          db.prepare(`
            INSERT OR IGNORE INTO candidate_profiles (user_id, is_public, show_attempts, show_recordings, show_transcripts, show_feedback, show_ticket_notes, bio)
            VALUES (?, 0, 0, 0, 0, 0, 0, '')
          `).run(user.id);
          /* Link any existing assessments with matching email */
          if (user.email) {
            db.prepare(`
              UPDATE assessments SET candidate_user_id = ? WHERE candidate_email = ? AND candidate_user_id IS NULL
            `).run(user.id, user.email);
          }
        },
      },
    },
  },
});

/* ── Backward-compatible auth helpers for legacy dashboard routes ── */

export async function getCurrentUser() {
  try {
    const h = new Headers();
    const c = await cookies();
    const cookie = c.toString();
    if (cookie) h.set('cookie', cookie);
    const session = await auth.api.getSession({ headers: h });
    return session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email, role: 'admin' } : null;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function requireAuth() {
  return requireAdmin();
}
