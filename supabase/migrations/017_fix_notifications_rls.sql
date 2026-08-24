-- Security fix: "Admins insert notifications" (004_supplier_workflow.sql:88-90)
-- was defined as `with check (public.is_admin() or true)` — the `or true`
-- makes the check pass unconditionally, so ANY authenticated (or anon, if
-- granted) caller could insert a notification for any user_id with arbitrary
-- title/body/link, i.e. in-app phishing of order/payment alerts.
--
-- Verified before writing this migration that no client code inserts into
-- notifications directly (grep across src/ for `.from("notifications")`
-- shows only .select()/.update() in src/lib/data/notifications.ts). All
-- current notification inserts happen inside existing `security definer`
-- functions (mark_order_delivered in 008/013, set_rider_delivery_status in
-- 014/016, admin_request_supplier/admin_record_supplier_response). Those
-- functions execute as their owner (the migration-running role, effectively
-- bypassing RLS the same way every other security definer function here
-- does), so tightening this policy does not affect any of them — it only
-- closes the direct-client-insert hole.

drop policy if exists "Admins insert notifications" on public.notifications;

create policy "Admins insert notifications"
  on public.notifications for insert
  with check (public.is_admin());
