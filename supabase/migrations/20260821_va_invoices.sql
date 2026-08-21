-- VA "money owed to us" queue — a simple manual admin-reviewed list, no
-- Stripe payouts involved. Admin pays the VA outside the app and marks paid.
create table if not exists va_invoices (
  id uuid primary key default gen_random_uuid(),
  va_id uuid references profiles(id) not null,
  amount numeric(10,2) not null,
  note text,
  status text default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table va_invoices enable row level security;

create policy "vas manage own invoices" on va_invoices
  for select, insert to authenticated
  using (va_id = auth.uid())
  with check (va_id = auth.uid());

create policy "admins manage all invoices" on va_invoices
  for all to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');
