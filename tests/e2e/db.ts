import fs from 'node:fs';
import postgres from 'postgres';

function readEnvFile() {
  const envPath = '.env.local';
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index === -1) return [line, ''];
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^"|"$/g, '');
        return [key, value];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const databaseUrl = env.POSTGRES_URL || env.DATABASE_URL;

export function getSql() {
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL or DATABASE_URL for E2E DB setup.');
  return postgres(databaseUrl, { ssl: 'require', max: 1 });
}

export async function seedSyntheticUsers(prefix: string) {
  const sql = getSql();
  const users = [
    {
      uid: `${prefix}-friend-a`,
      displayName: 'E2E Friend A',
      email: `${prefix}.friend.a@example.test`,
      photoURL: '',
    },
    {
      uid: `${prefix}-friend-b`,
      displayName: 'E2E Friend B',
      email: `${prefix}.friend.b@example.test`,
      photoURL: '',
    },
  ];

  try {
    for (const user of users) {
      await sql`
        insert into users (uid, display_name, email, photo_url)
        values (${user.uid}, ${user.displayName}, ${user.email}, ${user.photoURL})
        on conflict (uid) do update set
          display_name = excluded.display_name,
          email = excluded.email,
          photo_url = excluded.photo_url,
          updated_at = now()
      `;
    }
  } finally {
    await sql.end();
  }

  return users;
}

export async function cleanupE2E(prefix: string) {
  const sql = getSql();
  try {
    await sql`delete from groups where name like ${`E2E_ADV_${prefix}%`}`;
    await sql`delete from friendships where user_id like ${`${prefix}-%`} or friend_id like ${`${prefix}-%`}`;
    await sql`delete from users where uid like ${`${prefix}-%`}`;
  } finally {
    await sql.end();
  }
}
