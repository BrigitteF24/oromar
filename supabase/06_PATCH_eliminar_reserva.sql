-- ============================================================
-- PATCH: solo la función eliminar_reserva (03_panel_admin.sql)
-- Pega esto en el SQL Editor de Supabase y ejecútalo.
-- No afecta datos existentes, solo reemplaza la función.
-- ============================================================
create or replace function public.eliminar_reserva(p_id_reserva int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.reserva where id_reserva = p_id_reserva) then
    raise exception 'La reserva #% no existe o ya fue eliminada.', p_id_reserva;
  end if;

  delete from public.detalle_reserva_mesa where id_reserva = p_id_reserva;
  delete from public.reserva where id_reserva = p_id_reserva;
end;
$$;
