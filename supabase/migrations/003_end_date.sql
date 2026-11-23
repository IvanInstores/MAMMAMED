-- Fine terapia: dopo questa data (compresa) la medicina non genera più avvisi
alter table medicines add column if not exists end_date date;

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
    and (m.end_date is null or (now() at time zone 'Europe/Rome')::date <= m.end_date)
    and extract(dow from now() at time zone 'Europe/Rome')::int = any (m.days)
    and x.ts <= now()
    and x.ts > greatest(m.updated_at, now() - interval '60 minutes')
  on conflict (medicine_id, due_at) do nothing;
$$;

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
    and (m.end_date is null or (now() at time zone 'Europe/Rome')::date <= m.end_date)
    and extract(dow from now() at time zone 'Europe/Rome')::int = any (m.days)
  order by x.ts, m.name;
$$;
