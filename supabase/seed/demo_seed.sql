-- =========================================================================
-- FINMIND AI — Demo seed
-- Run this AFTER you've created your org via the onboarding flow.
-- It seeds budgets and 6 months of posted journal entries against your org.
-- Replace :org_slug with your org's slug.
-- =========================================================================

do $$
declare
  v_org_id uuid;
  v_budget_id uuid;
  v_corp uuid; v_sme uuid; v_health uuid;
  v_je_id uuid;
  v_period record;
  v_acc_brokerage uuid;
  v_acc_trail uuid;
  v_acc_advisory uuid;
  v_acc_salary uuid;
  v_acc_rent uuid;
  v_acc_marketing uuid;
  v_acc_tech uuid;
  v_acc_bank uuid;
  v_acc_payable uuid;
  v_acc_receivable uuid;
  v_period_count int;
  i int;
  base_revenue numeric;
  base_expense numeric;
begin
  -- Pick the most recent org (assumes you just signed up)
  select id into v_org_id from public.organizations order by created_at desc limit 1;
  if v_org_id is null then raise exception 'No organization found. Sign up first.'; end if;

  -- Lookup business units
  select id into v_corp   from public.business_units where org_id = v_org_id and code = 'CORP';
  select id into v_sme    from public.business_units where org_id = v_org_id and code = 'SME';
  select id into v_health from public.business_units where org_id = v_org_id and code = 'HEALTH';

  -- Lookup accounts
  select id into v_acc_brokerage  from public.chart_of_accounts where org_id = v_org_id and account_code = '4000';
  select id into v_acc_trail      from public.chart_of_accounts where org_id = v_org_id and account_code = '4100';
  select id into v_acc_advisory   from public.chart_of_accounts where org_id = v_org_id and account_code = '4200';
  select id into v_acc_salary     from public.chart_of_accounts where org_id = v_org_id and account_code = '5000';
  select id into v_acc_rent       from public.chart_of_accounts where org_id = v_org_id and account_code = '5100';
  select id into v_acc_marketing  from public.chart_of_accounts where org_id = v_org_id and account_code = '5200';
  select id into v_acc_tech       from public.chart_of_accounts where org_id = v_org_id and account_code = '5300';
  select id into v_acc_bank       from public.chart_of_accounts where org_id = v_org_id and account_code = '1000';
  select id into v_acc_payable    from public.chart_of_accounts where org_id = v_org_id and account_code = '2000';
  select id into v_acc_receivable from public.chart_of_accounts where org_id = v_org_id and account_code = '1100';

  -- Create AOP budget
  insert into public.budgets (org_id, name, fiscal_year, status)
  values (v_org_id, 'AOP FY 2025-26', 'FY 2025-26', 'approved')
  returning id into v_budget_id;

  -- Seed budget lines + journal entries for first 6 fiscal periods
  i := 0;
  for v_period in
    select id, period_label, start_date from public.fiscal_periods where org_id = v_org_id order by start_date limit 6
  loop
    i := i + 1;
    base_revenue := 28000000 + (i * 1500000);  -- ~₹2.8 Cr ramping up
    base_expense := 21000000 + (i * 900000);

    -- Budget lines (revenue accounts)
    insert into public.budget_lines (budget_id, account_id, period_id, business_unit_id, amount) values
      (v_budget_id, v_acc_brokerage, v_period.id, v_corp,   base_revenue * 0.45),
      (v_budget_id, v_acc_brokerage, v_period.id, v_sme,    base_revenue * 0.20),
      (v_budget_id, v_acc_trail,     v_period.id, v_corp,   base_revenue * 0.18),
      (v_budget_id, v_acc_advisory,  v_period.id, v_health, base_revenue * 0.17);

    -- Budget lines (expense accounts)
    insert into public.budget_lines (budget_id, account_id, period_id, business_unit_id, amount) values
      (v_budget_id, v_acc_salary,    v_period.id, null, base_expense * 0.55),
      (v_budget_id, v_acc_rent,      v_period.id, null, base_expense * 0.10),
      (v_budget_id, v_acc_marketing, v_period.id, null, base_expense * 0.15),
      (v_budget_id, v_acc_tech,      v_period.id, null, base_expense * 0.20);

    -- Revenue posting (Bank dr, Brokerage cr) — actuals run ~5% above budget
    insert into public.journal_entries (org_id, entry_number, entry_date, period_id, business_unit_id, description, status, posted_at)
    values (v_org_id, 'JE-SEED-' || lpad(i::text, 3, '0') || '-R', v_period.start_date + 14, v_period.id, v_corp,
            'Brokerage commission earned — ' || v_period.period_label, 'posted', now())
    returning id into v_je_id;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, business_unit_id, debit_amount, credit_amount) values
      (v_je_id, 1, v_acc_bank,     v_corp, base_revenue * 1.05, 0),
      (v_je_id, 2, v_acc_brokerage,v_corp, 0, base_revenue * 1.05);

    -- Expense posting (Salaries dr, Bank cr)
    insert into public.journal_entries (org_id, entry_number, entry_date, period_id, business_unit_id, description, status, posted_at)
    values (v_org_id, 'JE-SEED-' || lpad(i::text, 3, '0') || '-E', v_period.start_date + 28, v_period.id, null,
            'Operating expenses — ' || v_period.period_label, 'posted', now())
    returning id into v_je_id;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount) values
      (v_je_id, 1, v_acc_salary,    base_expense * 0.55,  0),
      (v_je_id, 2, v_acc_rent,      base_expense * 0.10,  0),
      (v_je_id, 3, v_acc_marketing, base_expense * 0.15,  0),
      (v_je_id, 4, v_acc_tech,      base_expense * 0.20,  0),
      (v_je_id, 5, v_acc_bank,      0, base_expense);
  end loop;

  raise notice 'Seeded % months of demo data for org %', i, v_org_id;
end $$;
