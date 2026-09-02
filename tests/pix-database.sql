-- Run with an administrative connection. Everything is rolled back, including test
-- storage metadata and notifications. No files, emails, WhatsApp messages or payments.
begin;
do $$
declare
  pro uuid; customer uuid; tenant uuid := gen_random_uuid(); other_tenant uuid := gen_random_uuid();
  person uuid := gen_random_uuid(); service uuid := gen_random_uuid(); booking uuid := gen_random_uuid();
  receipt uuid := gen_random_uuid(); replacement uuid := gen_random_uuid(); affected integer;
  path1 text; path2 text;
begin
  select id into pro from auth.users where email = 'profissional.teste@agenda-profissa.test';
  select id into customer from auth.users where email = 'cliente.teste@agenda-profissa.test';
  if pro is null or customer is null then raise exception 'Requires existing demo identities; no users will be created.'; end if;
  path1 := tenant || '/' || booking || '/' || customer || '/test-one.pdf';
  path2 := tenant || '/' || booking || '/' || customer || '/test-two.pdf';
  insert into public.tenants(id,name,slug) values (tenant,'PIX rollback test','pix-test-' || tenant), (other_tenant,'Isolation test','pix-test-' || other_tenant);
  insert into public.memberships(tenant_id,user_id,role) values (tenant,pro,'owner');
  insert into public.subscriptions(tenant_id,plan_code,status,payment_status) values (tenant,'monthly','authorized','approved');
  insert into public.clients(id,tenant_id,user_id,name) values (person,tenant,customer,'PIX test client');
  insert into public.services(id,tenant_id,name,duration_minutes,price_cents) values (service,tenant,'PIX test service',30,4501);
  insert into public.appointments(id,tenant_id,client_id,service_id,starts_at) values (booking,tenant,person,service,now()+interval '1 day');
  insert into public.tenant_payment_settings(tenant_id,pix_key) values (other_tenant,'private-isolation-test');
  insert into storage.objects(bucket_id,name,owner_id) values ('appointment-payment-receipts',path1,customer::text), ('appointment-payment-receipts',path2,customer::text);

  perform set_config('request.jwt.claim.sub', customer::text, true);
  perform set_config('role','authenticated',true);
  if exists(select 1 from public.tenant_payment_settings where tenant_id=other_tenant) then raise exception 'FAIL: tenant isolation'; end if;
  insert into public.appointment_payment_submissions(id,tenant_id,appointment_id,client_id,submitted_by_user_id,payment_method,receipt_path,receipt_original_name,receipt_content_type,receipt_size_bytes,status)
  values (receipt,tenant,booking,person,customer,'pix',path1,'one.pdf','application/pdf',100,'submitted');
  begin
    perform public.review_pix_receipt(receipt,'request_new','Client must not review');
    raise exception 'FAIL: client reviewed receipt';
  exception when insufficient_privilege then null; end;
  begin
    update public.appointment_payment_submissions set status='confirmed' where id=receipt;
    raise exception 'FAIL: direct receipt update allowed';
  exception when insufficient_privilege then null; end;
  update public.appointments set payment_status='paid' where id=booking;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: client confirmed payment'; end if;
  -- Linked-file deletion is covered by the Storage API orphan-only policy;
  -- never delete storage metadata through SQL (Supabase explicitly prohibits it).
  begin
    insert into public.appointment_payment_submissions(id,tenant_id,appointment_id,client_id,submitted_by_user_id,payment_method,receipt_path,receipt_original_name,receipt_content_type,receipt_size_bytes,status)
    values (replacement,tenant,booking,person,customer,'pix',path2,'two.pdf','application/pdf',100,'submitted');
    raise exception 'FAIL: duplicate pending receipt allowed';
  exception when unique_violation then null; end;

  perform set_config('request.jwt.claim.sub', pro::text, true);
  insert into public.tenant_payment_settings(tenant_id,pix_key,pix_key_type,pix_holder_name,pix_holder_city)
  values (tenant,'test@example.com','email','Test Receiver','BRASILIA');
  update public.tenant_payment_settings set pix_holder_name='Updated Receiver' where tenant_id=tenant;
  if not exists(select 1 from public.tenant_payment_settings where tenant_id=tenant and pix_holder_name='Updated Receiver') then raise exception 'FAIL: saving PIX settings'; end if;
  perform public.review_pix_receipt(receipt,'start_review');
  if not exists(select 1 from public.appointment_payment_submissions where id=receipt and review_started_at is not null and status='submitted') then raise exception 'FAIL: start review'; end if;
  begin
    perform public.review_pix_receipt(receipt,'request_new','x');
    raise exception 'FAIL: missing reason accepted';
  exception when check_violation then null; end;
  perform public.review_pix_receipt(receipt,'request_new','Please send a legible receipt');
  begin
    update public.appointments set payment_status='paid' where id=booking;
    raise exception 'FAIL: rejected receipt confirmed';
  exception when check_violation then null; end;
  begin
    update public.appointments set amount_cents=1 where id=booking;
    raise exception 'FAIL: historical payment amount changed';
  exception when check_violation then null; end;
  update public.services set price_cents=9000 where id=service;
  if (select amount_cents from public.appointments where id=booking) <> 4501 then raise exception 'FAIL: amount snapshot changed'; end if;

  perform set_config('request.jwt.claim.sub', customer::text, true);
  if (select count(*) from public.appointment_notifications where appointment_id=booking and notification_type='receipt_rejected') <> 1 then raise exception 'FAIL: client rejection notice'; end if;
  update public.tenant_payment_settings set pix_key='attacker@example.com' where tenant_id=tenant;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: customer changed professional PIX'; end if;
  begin
    insert into public.appointment_payment_submissions(tenant_id,appointment_id,client_id,submitted_by_user_id,payment_method,receipt_path,receipt_original_name,receipt_content_type,receipt_size_bytes,status)
    values (tenant,booking,person,customer,'pix',path2 || '-forged','fake.pdf','application/pdf',100,'submitted');
    raise exception 'FAIL: forged upload accepted';
  exception when check_violation then null; end;
  insert into public.appointment_payment_submissions(id,tenant_id,appointment_id,client_id,submitted_by_user_id,payment_method,receipt_path,receipt_original_name,receipt_content_type,receipt_size_bytes,status)
  values (replacement,tenant,booking,person,customer,'pix',path2,'two.pdf','application/pdf',100,'submitted');

  perform set_config('request.jwt.claim.sub', pro::text, true);
  update public.appointments set payment_status='paid' where id=booking;
  if not exists(select 1 from public.appointments where id=booking and payment_status='paid' and status='confirmado' and payment_confirmed_at is not null) then raise exception 'FAIL: payment confirmation'; end if;
  if not exists(select 1 from public.appointment_payment_submissions where id=replacement and status='confirmed' and reviewed_by_user_id=pro and reviewed_at is not null) then raise exception 'FAIL: confirmation audit'; end if;
  if not exists(select 1 from public.appointment_payment_submissions where id=receipt and status='rejected' and rejection_reason='Please send a legible receipt') then raise exception 'FAIL: receipt history lost'; end if;
  begin
    perform public.review_pix_receipt(replacement,'request_new','Cannot reject paid receipt');
    raise exception 'FAIL: confirmed payment rejected';
  exception when check_violation then null; end;
  begin
    update public.appointments set payment_status='pending' where id=booking;
    raise exception 'FAIL: paid booking reset';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claim.sub', customer::text, true);
  if (select count(*) from public.appointment_notifications where appointment_id=booking and notification_type='payment_confirmed') <> 1 then raise exception 'FAIL: confirmation notification'; end if;
  perform set_config('role','anon',true);
  begin
    perform public.review_pix_receipt(replacement,'start_review');
    raise exception 'FAIL: anonymous RPC';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  raise notice 'PASS: authorization, isolation, receipt history, upload validation, review, confirmation, amounts and notifications';
end;
$$;
rollback;
select 'PIX database checks passed; all test data rolled back' as result;
