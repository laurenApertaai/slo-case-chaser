-- Case Document Chaser - schema
-- Apply in the Supabase SQL Editor. Safe to re-run: it drops nothing.

-- ---------- enums ----------

create type requirement_type   as enum ('upload', 'question', 'question_group');
create type requirement_status as enum ('outstanding', 'received', 'accepted', 'rejected', 'waived');
create type applicant_slot     as enum ('applicant_1', 'applicant_2', 'joint');
create type received_via       as enum ('portal', 'email', 'post', 'in_person');
create type case_status        as enum ('active', 'on_hold', 'complete', 'withdrawn');
create type employment_type    as enum ('employed_monthly', 'employed_4weekly',
                                        'employed_fortnightly', 'employed_weekly',
                                        'self_employed');
create type message_channel    as enum ('email', 'sms');
create type message_status     as enum ('queued', 'sent', 'delivered', 'failed');

-- ---------- tables ----------

create table advisers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  mobile      text,
  firm        text,
  created_at  timestamptz not null default now()
);

create table cases (
  id                  uuid primary key default gen_random_uuid(),
  adviser_id          uuid not null references advisers(id),
  case_ref            text not null,
  lender              text,
  loan_amount         numeric(12,2),
  status              case_status not null default 'active',
  is_joint            boolean not null default false,
  employment_type     employment_type,

  applicant_1_name    text not null,
  applicant_1_email   text not null,
  applicant_1_mobile  text not null,
  applicant_2_name    text,
  applicant_2_email   text,
  applicant_2_mobile  text,

  -- bank details are encrypted at rest; only the last four digits are readable
  bank_details_enc    bytea,
  bank_details_last4  text,

  portal_token        text not null unique,
  token_expires_at    timestamptz not null,

  pack_issued_at      timestamptz,
  completed_at        timestamptz,
  files_deleted_at    timestamptz,
  created_at          timestamptz not null default now()
);

create index on cases (adviser_id, status);

create table requirements (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references cases(id) on delete cascade,
  applicant         applicant_slot not null,
  type              requirement_type not null,
  -- which template item this came from; null for a one-off item an adviser
  -- added to a live case. See migration 002 for why the label cannot do this.
  template_key      text,
  label             text not null,
  description       text,
  status            requirement_status not null default 'outstanding',
  is_mandatory      boolean not null default true,
  expected_count    integer,
  sort_order        integer not null default 0,
  rejection_count   integer not null default 0,
  is_paused         boolean not null default false,
  received_via      received_via,
  received_at       timestamptz,
  accepted_at       timestamptz,
  accepted_by       uuid references advisers(id),
  last_chased_at    timestamptz,
  next_chase_at     timestamptz,
  created_at        timestamptz not null default now()
);

create index on requirements (case_id, status);
create index on requirements (case_id, template_key);
create index on requirements (next_chase_at) where status in ('outstanding', 'rejected');

create table answers (
  id              uuid primary key default gen_random_uuid(),
  requirement_id  uuid not null references requirements(id) on delete cascade,
  field_key       text not null,
  value           text,
  answered_at     timestamptz not null default now(),
  unique (requirement_id, field_key)
);

create table uploads (
  id                uuid primary key default gen_random_uuid(),
  requirement_id    uuid not null references requirements(id) on delete cascade,
  original_filename text not null,
  storage_path      text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  blur_score        numeric,
  page_count        integer,
  uploaded_by       text not null,
  source            received_via not null default 'portal',
  uploaded_at       timestamptz not null default now(),
  deleted_at        timestamptz
);

create index on uploads (requirement_id) where deleted_at is null;

create table bundles (
  id              uuid primary key default gen_random_uuid(),
  requirement_id  uuid not null unique references requirements(id) on delete cascade,
  storage_path    text not null,
  page_order      jsonb not null default '[]'::jsonb,
  built_at        timestamptz not null default now()
);

create table templates (
  id          uuid primary key default gen_random_uuid(),
  adviser_id  uuid references advisers(id),
  name        text not null,
  items       jsonb not null,
  created_at  timestamptz not null default now()
);

create table rejection_reasons (
  id            uuid primary key default gen_random_uuid(),
  adviser_id    uuid references advisers(id),
  label         text not null,
  email_copy    text not null,
  sms_copy      text not null,
  is_active     boolean not null default true,
  sort_order    integer not null default 0
);

-- audit trail. never store anything describing a document's contents here.
create table events (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(id) on delete cascade,
  requirement_id  uuid references requirements(id) on delete set null,
  type            text not null,
  actor           text not null,
  detail          jsonb,
  created_at      timestamptz not null default now()
);

create index on events (case_id, created_at);

create table messages (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references cases(id) on delete cascade,
  channel       message_channel not null,
  recipient     text not null,
  template      text not null,
  body          text not null,
  status        message_status not null default 'queued',
  provider_id   text,
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index on messages (case_id, created_at);

-- ---------- row level security ----------
-- Nothing is reachable with a browser key. All access goes through server
-- routes using the secret key, after they have validated the portal token.

alter table advisers          enable row level security;
alter table cases             enable row level security;
alter table requirements      enable row level security;
alter table answers           enable row level security;
alter table uploads           enable row level security;
alter table bundles           enable row level security;
alter table templates         enable row level security;
alter table rejection_reasons enable row level security;
alter table events            enable row level security;
alter table messages          enable row level security;
