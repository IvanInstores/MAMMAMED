-- MAMMAMED: struttura dati
create table if not exists config (
  key text primary key,
  value text not null
);

insert into config (key, value) values
  ('admin_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('mom_token',   replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('mom_name', 'Mamma'),
  ('repeat_minutes', '10'),
  ('alert_minutes', '30')
on conflict (key) do nothing;

create table if not exists medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dose text not null,
  kind text not null default '',
  note text not null default '',
  photo text,
  times text[] not null default '{}',
  days int[] not null default '{0,1,2,3,4,5,6}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists doses (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines(id) on delete cascade,
  due_at timestamptz not null,
  name text not null,
  dose text not null,
  kind text not null default '',
  note text not null default '',
  taken_at timestamptz,
  taken_by text,
  notify_count int not null default 0,
  last_notified_at timestamptz,
  admin_alerted_at timestamptz,
  unique (medicine_id, due_at)
);
create index if not exists doses_due_idx on doses (due_at);

create table if not exists push_subs (
  endpoint text primary key,
  role text not null check (role in ('mom', 'admin')),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Nessun accesso diretto dall'esterno: passa tutto dalla funzione "api"
alter table config enable row level security;
alter table medicines enable row level security;
alter table doses enable row level security;
alter table push_subs enable row level security;

-- Crea le dosi di oggi quando arriva l'ora (fuso orario Italia)
create or replace function generate_doses() returns void
language sql set search_path = public as $$
  insert into doses (medicine_id, due_at, name, dose, kind, note)
  select m.id, x.ts, m.name, m.dose, m.kind, m.note
  from medicines m
  cross join unnest(m.times) t
  cross join lateral (
    select (((now() at time zone 'Europe/Rome')::date + t::time) at time zone 'Europe/Rome') as ts
  ) x
  where m.active
    and extract(dow from now() at time zone 'Europe/Rome')::int = any (m.days)
    and x.ts <= now()
    and x.ts > greatest(m.updated_at, now() - interval '60 minutes')
  on conflict (medicine_id, due_at) do nothing;
$$;

-- Programma di oggi (prese, in attesa, più tardi)
create or replace function today_schedule()
returns table (medicine_id uuid, name text, dose text, kind text, "time" text,
               due_at timestamptz, dose_id uuid, taken_at timestamptz)
language sql stable set search_path = public as $$
  select m.id, m.name, m.dose, m.kind, t, x.ts, d.id, d.taken_at
  from medicines m
  cross join unnest(m.times) t
  cross join lateral (
    select (((now() at time zone 'Europe/Rome')::date + t::time) at time zone 'Europe/Rome') as ts
  ) x
  left join doses d on d.medicine_id = m.id and d.due_at = x.ts
  where m.active
    and extract(dow from now() at time zone 'Europe/Rome')::int = any (m.days)
  order by x.ts, m.name;
$$;

revoke all on function generate_doses() from public, anon, authenticated;
revoke all on function today_schedule() from public, anon, authenticated;
