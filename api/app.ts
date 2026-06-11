import { verifyToken } from '@clerk/backend';
import postgres from 'postgres';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const sql = databaseUrl
  ? postgres(databaseUrl, { ssl: 'require', max: 1 })
  : null;

let schemaReady: Promise<void> | null = null;
const CURRENCIES = new Set(['USD', 'TWD', 'HKD', 'JPY', 'EUR', 'AUD']);
const LANGUAGES = new Set(['en', 'zh']);
const THEMES = new Set(['light', 'dark']);
const MAX_GROUP_NAME_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 120;
const MAX_PHOTO_URL_LENGTH = 250_000;
const MAX_AMOUNT = 1_000_000_000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!sql) {
    return res.status(500).json({ error: 'missing_database_url' });
  }

  try {
    await ensureSchema();
    const uid = await requireUserId(req);
    const { action, payload = {} } = req.body || {};

    switch (action) {
      case 'profile.sync':
        return res.status(200).json({ profile: await syncProfile(uid, payload) });
      case 'profile.update':
        return res.status(200).json({ profile: await updateProfile(uid, payload) });
      case 'groups.list':
        return res.status(200).json({ groups: await listGroups(uid) });
      case 'groups.create':
        return res.status(200).json({ group: await createGroup(uid, payload) });
      case 'groups.get':
        return res.status(200).json({ group: await getGroup(uid, payload.groupId) });
      case 'groups.update':
        return res.status(200).json({ group: await updateGroup(uid, payload) });
      case 'groups.addMemberByEmail':
        return res.status(200).json({ group: await addGroupMemberByEmail(uid, payload) });
      case 'groups.delete':
        await deleteGroup(uid, payload.groupId);
        return res.status(200).json({ ok: true });
      case 'expenses.list':
        return res.status(200).json({ expenses: await listExpenses(uid, payload.groupId) });
      case 'expenses.create':
        return res.status(200).json({ expense: await createExpense(uid, payload) });
      case 'expenses.update':
        return res.status(200).json({ expense: await updateExpense(uid, payload) });
      case 'expenses.delete':
        await deleteExpense(uid, payload.expenseId);
        return res.status(200).json({ ok: true });
      case 'friends.add':
        return res.status(200).json({ profile: await addFriend(uid, payload.email) });
      case 'balances.summary':
        return res.status(200).json(await getBalanceSummary(uid));
      case 'reports.data':
        return res.status(200).json(await getReportsData(uid));
      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'server_error';
    const status = message === 'unauthorized' ? 401 : message === 'forbidden' ? 403 : 500;
    return res.status(status).json({ error: message });
  }
}

async function ensureSchema() {
  schemaReady ||= (async () => {
    await sql!`
      create table if not exists users (
        uid text primary key,
        display_name text not null,
        email text not null unique,
        photo_url text,
        preferred_currency text not null default 'TWD',
        language text not null default 'en',
        theme text not null default 'light',
        email_notifications boolean not null default true,
        push_notifications boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql!`
      create table if not exists friendships (
        user_id text not null references users(uid) on delete cascade,
        friend_id text not null references users(uid) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (user_id, friend_id)
      )
    `;
    await sql!`
      create table if not exists groups (
        id text primary key,
        name text not null,
        owner_id text not null references users(uid) on delete cascade,
        currency text not null default 'TWD',
        default_payer_id text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql!`
      create table if not exists group_members (
        group_id text not null references groups(id) on delete cascade,
        user_id text not null references users(uid) on delete cascade,
        display_name text not null,
        created_at timestamptz not null default now(),
        primary key (group_id, user_id)
      )
    `;
    await sql!`
      create table if not exists expenses (
        id text primary key,
        group_id text not null references groups(id) on delete cascade,
        description text not null,
        amount numeric not null,
        currency text not null,
        original_currency text,
        original_amount numeric,
        exchange_rate numeric,
        payer_id text not null references users(uid) on delete cascade,
        split_type text not null,
        splits jsonb not null,
        split_percentages jsonb not null default '{}',
        is_settlement boolean not null default false,
        date timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql!`alter table expenses add column if not exists split_percentages jsonb not null default '{}'`;
  })();

  return schemaReady;
}

async function requireUserId(req: ApiRequest) {
  const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('unauthorized');
  const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  if (!verified.sub) throw new Error('unauthorized');
  return verified.sub;
}

async function syncProfile(uid: string, payload: any) {
  const displayName = cleanText(payload.displayName || 'Anonymous User', MAX_DISPLAY_NAME_LENGTH);
  const email = String(payload.email || '').toLowerCase();
  const photoURL = cleanPhotoURL(payload.photoURL);
  const language = normalizeEnum(payload.language || 'en', LANGUAGES, 'en');
  const theme = normalizeEnum(payload.theme || 'light', THEMES, 'light');
  if (!email) throw new Error('missing_email');

  await sql!`
    insert into users (uid, display_name, email, photo_url, language, theme)
    values (${uid}, ${displayName}, ${email}, ${photoURL}, ${language}, ${theme})
    on conflict (uid) do update set
      email = excluded.email,
      updated_at = now()
  `;

  return getProfile(uid);
}

async function getProfile(uid: string) {
  const rows = await sql!`
    select u.*, coalesce(
      json_agg(json_build_object('uid', f.uid, 'displayName', f.display_name, 'email', f.email, 'photoURL', coalesce(f.photo_url, '')))
      filter (where f.uid is not null),
      '[]'
    ) as friends
    from users u
    left join friendships fs on fs.user_id = u.uid
    left join users f on f.uid = fs.friend_id
    where u.uid = ${uid}
    group by u.uid
  `;
  if (!rows[0]) throw new Error('unauthorized');
  return mapUser(rows[0]);
}

async function updateProfile(uid: string, payload: any) {
  const current = await getProfile(uid);
  const preferredCurrency = normalizeCurrency(payload.preferredCurrency ?? current.preferredCurrency);
  const language = normalizeEnum(payload.language ?? current.language, LANGUAGES, current.language);
  const theme = normalizeEnum(payload.theme ?? current.theme, THEMES, current.theme);
  const displayName = payload.displayName === undefined ? current.displayName : cleanText(payload.displayName, MAX_DISPLAY_NAME_LENGTH);
  const photoURL = payload.photoURL === undefined ? current.photoURL : cleanPhotoURL(payload.photoURL);
  const emailNotifications = payload.emailNotifications ?? current.emailNotifications ?? true;
  const pushNotifications = payload.pushNotifications ?? current.pushNotifications ?? false;
  if (!displayName) throw new Error('error_valid_name');

  await sql!`
    update users set
      display_name = ${displayName},
      photo_url = ${photoURL},
      preferred_currency = ${preferredCurrency},
      language = ${language},
      theme = ${theme},
      email_notifications = ${emailNotifications},
      push_notifications = ${pushNotifications},
      updated_at = now()
    where uid = ${uid}
  `;
  return getProfile(uid);
}

async function listGroups(uid: string) {
  const rows = await sql!`
    select g.*
    from groups g
    join group_members gm on gm.group_id = g.id
    where gm.user_id = ${uid}
    order by g.created_at desc
  `;
  return Promise.all(rows.map(mapGroupWithMembers));
}

async function createGroup(uid: string, payload: any) {
  const profile = await getProfile(uid);
  const id = crypto.randomUUID();
  const name = cleanText(payload.name, MAX_GROUP_NAME_LENGTH);
  if (!name) throw new Error('missing_group_name');
  const currency = normalizeCurrency(payload.currency || profile.preferredCurrency || 'TWD');

  await sql!.begin(async (tx) => {
    await tx`
      insert into groups (id, name, owner_id, currency)
      values (${id}, ${name}, ${uid}, ${currency})
    `;
    await tx`
      insert into group_members (group_id, user_id, display_name)
      values (${id}, ${uid}, ${profile.displayName})
    `;
  });

  return getGroup(uid, id);
}

async function getGroup(uid: string, groupId: string) {
  await requireMember(uid, groupId);
  const rows = await sql!`select * from groups where id = ${groupId}`;
  if (!rows[0]) throw new Error('forbidden');
  return mapGroupWithMembers(rows[0]);
}

async function updateGroup(uid: string, payload: any) {
  const groupId = String(payload.groupId || '');
  await requireMember(uid, groupId);
  const group = await getGroup(uid, groupId);
  const name = payload.name === undefined ? group.name : cleanText(payload.name, MAX_GROUP_NAME_LENGTH);
  if (!name) throw new Error('missing_group_name');
  const currency = normalizeCurrency(payload.currency ?? group.currency);
  const defaultPayerId = payload.defaultPayerId ?? group.defaultPayerId ?? '';
  if (defaultPayerId && !group.memberIds.includes(defaultPayerId)) throw new Error('forbidden');

  await sql!`
    update groups set
      name = ${name},
      currency = ${currency},
      default_payer_id = ${defaultPayerId || null},
      updated_at = now()
    where id = ${groupId}
  `;

  return getGroup(uid, groupId);
}

async function addGroupMemberByEmail(uid: string, payload: any) {
  const groupId = String(payload.groupId || '');
  await requireMember(uid, groupId);
  const email = String(payload.email || '').trim().toLowerCase();
  const userRows = await sql!`select uid, display_name from users where lower(email) = ${email}`;
  if (!userRows[0]) throw new Error('error_user_not_found');

  await sql!`
    insert into group_members (group_id, user_id, display_name)
    values (${groupId}, ${userRows[0].uid}, ${userRows[0].display_name})
    on conflict do nothing
  `;

  return getGroup(uid, groupId);
}

async function deleteGroup(uid: string, groupId: string) {
  const rows = await sql!`select owner_id from groups where id = ${groupId}`;
  if (!rows[0] || rows[0].owner_id !== uid) throw new Error('forbidden');
  await sql!`delete from groups where id = ${groupId}`;
}

async function listExpenses(uid: string, groupId: string) {
  await requireMember(uid, groupId);
  const rows = await sql!`
    select * from expenses
    where group_id = ${groupId}
    order by date desc
  `;
  return rows.map(mapExpense);
}

async function createExpense(uid: string, payload: any) {
  const groupId = String(payload.groupId || '');
  await requireMember(uid, groupId);
  const expense = await validateExpensePayload(groupId, payload, uid);

  const id = crypto.randomUUID();
  await sql!`
    insert into expenses (
      id, group_id, description, amount, currency, original_currency, original_amount,
      exchange_rate, payer_id, split_type, splits, split_percentages, is_settlement, date
    ) values (
      ${id},
      ${groupId},
      ${expense.description},
      ${expense.amount},
      ${expense.currency},
      ${expense.originalCurrency || null},
      ${expense.originalAmount ?? null},
      ${expense.exchangeRate ?? null},
      ${expense.payerId},
      ${expense.splitType},
      ${sql!.json(expense.splits)},
      ${sql!.json(expense.splitPercentages)},
      ${expense.isSettlement},
      ${payload.date ? new Date(payload.date) : new Date()}
    )
  `;
  const rows = await sql!`select * from expenses where id = ${id}`;
  return mapExpense(rows[0]);
}

async function updateExpense(uid: string, payload: any) {
  const expenseId = String(payload.expenseId || '');
  const rows = await sql!`select group_id from expenses where id = ${expenseId}`;
  if (!rows[0]) throw new Error('forbidden');
  await requireMember(uid, rows[0].group_id);
  const expense = await validateExpensePayload(rows[0].group_id, payload, uid);

  await sql!`
    update expenses set
      description = ${expense.description},
      amount = ${expense.amount},
      currency = ${expense.currency},
      original_currency = ${expense.originalCurrency || null},
      original_amount = ${expense.originalAmount ?? null},
      exchange_rate = ${expense.exchangeRate ?? null},
      payer_id = ${expense.payerId},
      split_type = ${expense.splitType},
      splits = ${sql!.json(expense.splits)},
      split_percentages = ${sql!.json(expense.splitPercentages)},
      updated_at = now()
    where id = ${expenseId}
  `;
  const updatedRows = await sql!`select * from expenses where id = ${expenseId}`;
  return mapExpense(updatedRows[0]);
}

async function deleteExpense(uid: string, expenseId: string) {
  const rows = await sql!`select group_id from expenses where id = ${expenseId}`;
  if (!rows[0]) throw new Error('forbidden');
  await requireMember(uid, rows[0].group_id);
  await sql!`delete from expenses where id = ${expenseId}`;
}

async function addFriend(uid: string, email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const current = await getProfile(uid);
  if (normalizedEmail === current.email.toLowerCase()) throw new Error('error_add_self');

  const friendRows = await sql!`select uid from users where lower(email) = ${normalizedEmail}`;
  if (!friendRows[0]) throw new Error('error_user_not_found');
  const friendId = friendRows[0].uid as string;

  await sql!`
    insert into friendships (user_id, friend_id)
    values (${uid}, ${friendId})
    on conflict do nothing
  `;
  await sql!`
    insert into friendships (user_id, friend_id)
    values (${friendId}, ${uid})
    on conflict do nothing
  `;
  return getProfile(uid);
}

async function getBalanceSummary(uid: string) {
  const groups = await listGroups(uid);
  const names = Object.assign({}, ...groups.map((group) => group.memberNames));
  const balances: Record<string, number> = {};
  const balancesByCurrency: Record<string, Record<string, number>> = {};
  const totalsByCurrency: Record<string, { totalBalance: number; totalOwedToYou: number; totalYouOwe: number }> = {};
  const expenses = await getAllMemberExpenses(uid);
  const groupBalancesByCurrency: Record<string, Record<string, number>> = {};

  expenses.forEach((expense) => {
    const currency = expense.currency || 'TWD';
    balancesByCurrency[currency] ||= {};
    groupBalancesByCurrency[currency] ||= {};
    groupBalancesByCurrency[currency][expense.groupId] ||= 0;

    if (expense.payerId === uid) {
      groupBalancesByCurrency[currency][expense.groupId] += Number(expense.amount || 0);
    }

    if (expense.splits?.[uid] !== undefined) {
      groupBalancesByCurrency[currency][expense.groupId] -= Number(expense.splits[uid] || 0);
    }

    Object.entries(expense.splits || {}).forEach(([splitUid, share]) => {
      const value = Number(share);
      if (!Number.isFinite(value) || value <= 0) return;
      if (expense.payerId === uid && splitUid !== uid) {
        balances[splitUid] = (balances[splitUid] || 0) + value;
        balancesByCurrency[currency][splitUid] = (balancesByCurrency[currency][splitUid] || 0) + value;
      } else if (expense.payerId !== uid && splitUid === uid) {
        balances[expense.payerId] = (balances[expense.payerId] || 0) - value;
        balancesByCurrency[currency][expense.payerId] = (balancesByCurrency[currency][expense.payerId] || 0) - value;
      }
    });
  });

  Object.keys(balances).forEach((key) => {
    balances[key] = roundMoney(balances[key]);
    if (Math.abs(balances[key]) < 0.01) delete balances[key];
  });

  const values = Object.values(balances);
  const totalOwedToYou = roundMoney(values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0));
  const totalYouOwe = roundMoney(Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)));

  Object.entries(groupBalancesByCurrency).forEach(([currency, currencyBalances]) => {
    Object.keys(currencyBalances).forEach((key) => {
      currencyBalances[key] = roundMoney(currencyBalances[key]);
      if (Math.abs(currencyBalances[key]) < 0.01) delete currencyBalances[key];
    });

    const currencyValues = Object.values(currencyBalances);
    const currencyOwedToYou = roundMoney(currencyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0));
    const currencyYouOwe = roundMoney(Math.abs(currencyValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)));
    totalsByCurrency[currency] = {
      totalOwedToYou: currencyOwedToYou,
      totalYouOwe: currencyYouOwe,
      totalBalance: roundMoney(currencyOwedToYou - currencyYouOwe),
    };
  });

  return {
    balances,
    balancesByCurrency,
    names,
    totalOwedToYou,
    totalYouOwe,
    totalBalance: roundMoney(totalOwedToYou - totalYouOwe),
    totalsByCurrency,
    groupTotalsByCurrency: groupBalancesByCurrency,
  };
}

async function getReportsData(uid: string) {
  const groups = await listGroups(uid);
  const expenses = await getAllMemberExpenses(uid);
  return { groups, expenses };
}

async function getAllMemberExpenses(uid: string) {
  const rows = await sql!`
    select e.*
    from expenses e
    join group_members gm on gm.group_id = e.group_id
    where gm.user_id = ${uid}
    order by e.date desc
  `;
  return rows.map(mapExpense);
}

async function requireMember(uid: string, groupId: string) {
  const rows = await sql!`
    select 1 from group_members
    where user_id = ${uid} and group_id = ${groupId}
    limit 1
  `;
  if (!rows[0]) throw new Error('forbidden');
}

async function getGroupMemberIds(groupId: string) {
  const rows = await sql!`
    select user_id from group_members
    where group_id = ${groupId}
  `;
  return rows.map((row) => row.user_id as string);
}

async function validateExpensePayload(groupId: string, payload: any, fallbackPayerId: string) {
  const memberIds = await getGroupMemberIds(groupId);
  if (!memberIds.length) throw new Error('forbidden');

  const isSettlement = Boolean(payload.isSettlement);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency || 'TWD');
  const originalCurrency = payload.originalCurrency ? normalizeCurrency(payload.originalCurrency) : '';
  const originalAmount = payload.originalAmount === undefined || payload.originalAmount === null
    ? null
    : normalizeAmount(payload.originalAmount);
  const exchangeRate = payload.exchangeRate === undefined || payload.exchangeRate === null
    ? null
    : normalizePositiveNumber(payload.exchangeRate, 'invalid_exchange_rate');
  const payerId = String(payload.payerId || fallbackPayerId);
  const splitType = isSettlement ? 'exact' : normalizeEnum(payload.splitType || 'percentage', new Set(['equal', 'exact', 'percentage']), 'percentage');
  const description = cleanText(payload.description || (isSettlement ? 'Settlement' : 'Expense'), MAX_DESCRIPTION_LENGTH);

  if (!memberIds.includes(payerId)) throw new Error('forbidden');
  if (!description) throw new Error('error_enter_description');

  const splits = normalizeSplitMap(payload.splits || {}, memberIds);
  const splitEntries = Object.entries(splits);
  if (!splitEntries.length) throw new Error('error_no_valid_split_members');

  const splitTotal = roundMoney(splitEntries.reduce((sum, [, value]) => sum + value, 0));
  if (Math.abs(splitTotal - amount) > 0.02) throw new Error('invalid_split_total');

  const splitPercentages = isSettlement
    ? {}
    : normalizePercentageMap(payload.splitPercentages || {}, memberIds);

  if (!isSettlement) {
    const percentageTotal = roundMoney(Object.values(splitPercentages).reduce((sum, value) => sum + value, 0));
    if (Math.abs(percentageTotal - 100) > 0.05) throw new Error('error_percentage_total');
  }

  return {
    description,
    amount,
    currency,
    originalCurrency,
    originalAmount,
    exchangeRate,
    payerId,
    splitType,
    splits,
    splitPercentages,
    isSettlement,
  };
}

async function mapGroupWithMembers(row: any) {
  const members = await sql!`
    select gm.user_id, gm.display_name, coalesce(u.photo_url, '') as photo_url
    from group_members gm
    left join users u on u.uid = gm.user_id
    where gm.group_id = ${row.id}
    order by gm.created_at asc
  `;
  const memberIds = members.map((member) => member.user_id as string);
  const memberNames = Object.fromEntries(members.map((member) => [member.user_id, member.display_name]));
  const memberPhotos = Object.fromEntries(members.map((member) => [member.user_id, member.photo_url || '']));
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    memberIds,
    memberNames,
    memberPhotos,
    defaultPayerId: row.default_payer_id || '',
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUser(row: any) {
  return {
    uid: row.uid,
    displayName: row.display_name,
    email: row.email,
    photoURL: row.photo_url || '',
    preferredCurrency: row.preferred_currency,
    language: row.language,
    theme: row.theme,
    emailNotifications: row.email_notifications,
    pushNotifications: row.push_notifications,
    createdAt: row.created_at,
    friends: row.friends || [],
  };
}

function mapExpense(row: any) {
  const amount = Number(row.amount);
  const originalAmount = row.original_amount == null ? undefined : Number(row.original_amount);
  const originalCurrency = row.original_currency || undefined;
  const currency = row.currency;
  const rawSplits = row.splits || {};
  const rawSplitPercentages = row.split_percentages || {};
  const shouldNormalizeSameCurrency =
    originalCurrency &&
    originalCurrency === currency &&
    originalAmount !== undefined &&
    Number.isFinite(originalAmount) &&
    originalAmount > 0 &&
    Number.isFinite(amount) &&
    Math.abs(originalAmount - amount) >= 0.01;
  const splits = shouldNormalizeSameCurrency ? normalizeSplits(rawSplits, originalAmount) : rawSplits;

  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: shouldNormalizeSameCurrency ? originalAmount : amount,
    currency,
    originalCurrency,
    originalAmount,
    exchangeRate: row.exchange_rate == null ? undefined : Number(row.exchange_rate),
    payerId: row.payer_id,
    splitType: row.split_type,
    splits,
    splitPercentages: rawSplitPercentages,
    isSettlement: row.is_settlement,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSplits(rawSplits: Record<string, number>, targetAmount: number) {
  const entries = Object.entries(rawSplits || {});
  const currentTotal = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length || !Number.isFinite(currentTotal) || currentTotal <= 0) return rawSplits || {};

  let assignedAmount = 0;
  return entries.reduce<Record<string, number>>((splits, [uid, value], index) => {
    const isLastSplit = index === entries.length - 1;
    const share = isLastSplit
      ? roundMoney(targetAmount - assignedAmount)
      : roundMoney((Number(value || 0) / currentTotal) * targetAmount);
    splits[uid] = share;
    assignedAmount += share;
    return splits;
  }, {});
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanPhotoURL(value: unknown) {
  const photoURL = String(value || '').trim();
  if (photoURL.length > MAX_PHOTO_URL_LENGTH) throw new Error('error_update_profile');
  if (!photoURL) return '';
  if (photoURL.startsWith('data:image/') || photoURL.startsWith('https://')) return photoURL;
  return '';
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || '').toUpperCase();
  if (!CURRENCIES.has(currency)) throw new Error('invalid_currency');
  return currency;
}

function normalizeEnum<T extends string>(value: unknown, allowed: Set<T> | Set<string>, fallback: T) {
  const nextValue = String(value || fallback) as T;
  return allowed.has(nextValue) ? nextValue : fallback;
}

function normalizeAmount(value: unknown) {
  return normalizePositiveNumber(value, 'error_valid_amount');
}

function normalizePositiveNumber(value: unknown, errorMessage: string) {
  const amount = roundMoney(Number(value));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new Error(errorMessage);
  return amount;
}

function normalizeSplitMap(rawSplits: Record<string, unknown>, memberIds: string[]) {
  const memberSet = new Set(memberIds);
  return Object.entries(rawSplits).reduce<Record<string, number>>((splits, [memberId, rawValue]) => {
    if (!memberSet.has(memberId)) throw new Error('forbidden');
    const value = roundMoney(Number(rawValue));
    if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) throw new Error('error_valid_amount');
    if (value > 0) splits[memberId] = value;
    return splits;
  }, {});
}

function normalizePercentageMap(rawPercentages: Record<string, unknown>, memberIds: string[]) {
  const memberSet = new Set(memberIds);
  return Object.entries(rawPercentages).reduce<Record<string, number>>((percentages, [memberId, rawValue]) => {
    if (!memberSet.has(memberId)) throw new Error('forbidden');
    const value = roundMoney(Number(rawValue));
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('error_percentage_total');
    percentages[memberId] = value;
    return percentages;
  }, {});
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
