-- ============================================================
-- OroMar - Parche de funcionalidades (Reservas, Pedidos, Mesas,
-- Pagos, Usuarios, Reseñas)
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 01, 02, 03, 04 y 05.
-- Es seguro volver a ejecutar este archivo las veces que haga falta.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Columna nueva: motivo de cancelación de una reserva
-- ------------------------------------------------------------
alter table public.reserva
  add column if not exists motivo_cancelacion text;

-- ------------------------------------------------------------
-- 1) FUNCIONES INTERNAS (no se exponen al panel, solo las usan
--    otras funciones) para mantener sincronizado el estado de
--    las mesas con los pedidos y las reservas activas.
-- ------------------------------------------------------------
create or replace function public._liberar_mesa_pedido(
  p_id_mesa int,
  p_id_pedido_excluir int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id_mesa is null then
    return;
  end if;

  -- Si todavía hay otro pedido activo usando esta mesa, no se toca.
  if exists (
    select 1
    from public.pedido_mesa pm
    join public.pedido p on p.id_pedido = pm.id_pedido
    where pm.id_mesa = p_id_mesa
      and p.estado in ('Pendiente','En preparacion','Atendido')
      and (p_id_pedido_excluir is null or pm.id_pedido <> p_id_pedido_excluir)
  ) then
    return;
  end if;

  -- Si la mesa tiene una reserva vigente (hoy en adelante), queda "Reservada".
  if exists (
    select 1
    from public.detalle_reserva_mesa d
    join public.reserva r on r.id_reserva = d.id_reserva
    where d.id_mesa = p_id_mesa
      and r.estado in ('Pendiente','Confirmada')
      and r.fecha >= current_date
  ) then
    update public.mesa set estado = 'Reservada' where id_mesa = p_id_mesa and estado = 'Ocupada';
  else
    update public.mesa set estado = 'Disponible' where id_mesa = p_id_mesa and estado = 'Ocupada';
  end if;
end;
$$;

create or replace function public._liberar_mesa_reserva(
  p_id_mesa int,
  p_id_reserva_excluir int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id_mesa is null then
    return;
  end if;

  -- Si otra reserva vigente sigue usando esta mesa, no se toca.
  if exists (
    select 1
    from public.detalle_reserva_mesa d
    join public.reserva r on r.id_reserva = d.id_reserva
    where d.id_mesa = p_id_mesa
      and r.estado in ('Pendiente','Confirmada')
      and (p_id_reserva_excluir is null or d.id_reserva <> p_id_reserva_excluir)
  ) then
    return;
  end if;

  -- Solo baja de "Reservada" a "Disponible" (nunca pisa una mesa "Ocupada").
  update public.mesa set estado = 'Disponible' where id_mesa = p_id_mesa and estado = 'Reservada';
end;
$$;

revoke all on function public._liberar_mesa_pedido(int, int) from public, anon, authenticated;
revoke all on function public._liberar_mesa_reserva(int, int) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2) RESERVAS
-- ------------------------------------------------------------

-- listar_reservas: ahora también devuelve id_mesa (para poder
-- preseleccionarla al editar) y el motivo de cancelación.
create or replace function public.listar_reservas()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha, t.hora), '[]')
  from (
    select r.id_reserva, r.fecha, r.hora, r.cantidad_personas, r.estado,
           r.observacion, r.motivo_cancelacion, c.nombres, c.apellidos, c.telefono,
           (select d.id_mesa from public.detalle_reserva_mesa d
             where d.id_reserva = r.id_reserva limit 1) as id_mesa,
           coalesce(
             (select string_agg('Mesa ' || m.numero, ', ')
              from public.detalle_reserva_mesa d
              join public.mesa m on m.id_mesa = d.id_mesa
              where d.id_reserva = r.id_reserva),
             'Sin asignar'
           ) as mesas
    from public.reserva r
    join public.cliente c on c.id_cliente = r.id_cliente
    where r.estado <> 'Cancelada' or r.fecha >= current_date - interval '2 days'
  ) t;
$$;

-- crear_reserva_admin: si se asigna mesa, queda en estado "Reservada".
create or replace function public.crear_reserva_admin(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar,
  p_fecha date,
  p_hora time,
  p_cantidad_personas smallint,
  p_observacion text default null,
  p_id_mesa int default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_reserva integer;
begin
  v_id_reserva := public.crear_reserva_web(
    p_nombres, p_apellidos, p_telefono, p_correo,
    p_fecha, p_hora, p_cantidad_personas, p_observacion
  );

  if p_id_mesa is not null then
    insert into public.detalle_reserva_mesa (id_reserva, id_mesa)
    values (v_id_reserva, p_id_mesa)
    on conflict do nothing;

    update public.mesa set estado = 'Reservada'
    where id_mesa = p_id_mesa and estado = 'Disponible';
  end if;

  return v_id_reserva;
end;
$$;

-- editar_reserva: cambia de firma (agrega p_id_mesa), por eso se
-- elimina la versión anterior antes de crear la nueva.
drop function if exists public.editar_reserva(int, date, time, smallint, text);

create or replace function public.editar_reserva(
  p_id_reserva int,
  p_fecha date,
  p_hora time,
  p_cantidad_personas smallint,
  p_observacion text default null,
  p_id_mesa int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa_anterior int;
begin
  if p_cantidad_personas < 1 or p_cantidad_personas > 20 then
    raise exception 'La cantidad de personas debe estar entre 1 y 20';
  end if;

  select d.id_mesa into v_mesa_anterior
  from public.detalle_reserva_mesa d
  where d.id_reserva = p_id_reserva
  limit 1;

  update public.reserva
  set fecha = p_fecha,
      hora = p_hora,
      cantidad_personas = p_cantidad_personas,
      observacion = nullif(trim(p_observacion), '')
  where id_reserva = p_id_reserva;

  if v_mesa_anterior is distinct from p_id_mesa then
    delete from public.detalle_reserva_mesa where id_reserva = p_id_reserva;

    if v_mesa_anterior is not null then
      perform public._liberar_mesa_reserva(v_mesa_anterior, p_id_reserva);
    end if;

    if p_id_mesa is not null then
      insert into public.detalle_reserva_mesa (id_reserva, id_mesa)
      values (p_id_reserva, p_id_mesa)
      on conflict do nothing;

      update public.mesa set estado = 'Reservada'
      where id_mesa = p_id_mesa and estado = 'Disponible';
    end if;
  end if;
end;
$$;

-- cancelar_reserva: reemplaza el uso de actualizar_estado_reserva
-- para el caso "Cancelada": guarda el motivo y libera la mesa.
create or replace function public.cancelar_reserva(
  p_id_reserva int,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_mesa int;
begin
  if not exists (select 1 from public.reserva where id_reserva = p_id_reserva) then
    raise exception 'La reserva #% no existe o ya fue eliminada.', p_id_reserva;
  end if;

  update public.reserva
  set estado = 'Cancelada',
      motivo_cancelacion = nullif(trim(p_motivo), '')
  where id_reserva = p_id_reserva;

  for v_id_mesa in select id_mesa from public.detalle_reserva_mesa where id_reserva = p_id_reserva
  loop
    perform public._liberar_mesa_reserva(v_id_mesa, p_id_reserva);
  end loop;
end;
$$;

-- eliminar_reserva: además de borrar, libera la mesa si correspondía.
create or replace function public.eliminar_reserva(p_id_reserva int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_mesa int;
begin
  if not exists (select 1 from public.reserva where id_reserva = p_id_reserva) then
    raise exception 'La reserva #% no existe o ya fue eliminada.', p_id_reserva;
  end if;

  for v_id_mesa in select id_mesa from public.detalle_reserva_mesa where id_reserva = p_id_reserva
  loop
    perform public._liberar_mesa_reserva(v_id_mesa, p_id_reserva);
  end loop;

  delete from public.detalle_reserva_mesa where id_reserva = p_id_reserva;
  delete from public.reserva where id_reserva = p_id_reserva;
end;
$$;

-- ------------------------------------------------------------
-- 3) PEDIDOS (corrige el error "Could not find the function
--    crear_pedido_admin... in the schema cache" recreándola tal
--    cual, y hace que ocupar/liberar una mesa sea automático)
-- ------------------------------------------------------------
create or replace function public.crear_pedido_admin(
  p_id_usuario int,
  p_id_mesa int,
  p_estado varchar,
  p_platos jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_pedido integer;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_precio numeric(10,2);
  v_cantidad smallint;
begin
  if p_platos is null or jsonb_array_length(p_platos) = 0 then
    raise exception 'Debes agregar al menos un plato al pedido';
  end if;

  insert into public.pedido (estado, total, id_usuario)
  values (coalesce(nullif(p_estado, ''), 'Pendiente'), 0, p_id_usuario)
  returning id_pedido into v_id_pedido;

  if p_id_mesa is not null then
    insert into public.pedido_mesa (id_pedido, id_mesa)
    values (v_id_pedido, p_id_mesa)
    on conflict do nothing;

    -- La mesa pasa a "Ocupada" automáticamente al registrar el pedido.
    update public.mesa set estado = 'Ocupada' where id_mesa = p_id_mesa;
  end if;

  for v_item in select * from jsonb_array_elements(p_platos)
  loop
    select precio into v_precio
    from public.producto
    where id_producto = (v_item->>'id_producto')::int and estado = 'Activo';

    if v_precio is null then
      raise exception 'Uno de los platos seleccionados ya no está disponible';
    end if;

    v_cantidad := (v_item->>'cantidad')::smallint;
    if v_cantidad < 1 then
      raise exception 'La cantidad de cada plato debe ser al menos 1';
    end if;

    insert into public.detalle_pedido (cantidad, precio, id_pedido, id_producto)
    values (v_cantidad, v_precio, v_id_pedido, (v_item->>'id_producto')::int);

    v_total := v_total + (v_precio * v_cantidad);
  end loop;

  update public.pedido set total = v_total where id_pedido = v_id_pedido;

  return v_id_pedido;
end;
$$;

create or replace function public.editar_pedido_admin(
  p_id_pedido int,
  p_id_usuario int,
  p_id_mesa int,
  p_estado varchar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa_anterior int;
begin
  select id_mesa into v_mesa_anterior
  from public.pedido_mesa where id_pedido = p_id_pedido limit 1;

  update public.pedido
  set id_usuario = p_id_usuario,
      estado = p_estado
  where id_pedido = p_id_pedido;

  if v_mesa_anterior is distinct from p_id_mesa then
    delete from public.pedido_mesa where id_pedido = p_id_pedido;

    if p_id_mesa is not null then
      insert into public.pedido_mesa (id_pedido, id_mesa)
      values (p_id_pedido, p_id_mesa)
      on conflict do nothing;
      update public.mesa set estado = 'Ocupada' where id_mesa = p_id_mesa;
    end if;

    if v_mesa_anterior is not null then
      perform public._liberar_mesa_pedido(v_mesa_anterior, p_id_pedido);
    end if;
  end if;

  if p_estado = 'Cancelado' and p_id_mesa is not null then
    perform public._liberar_mesa_pedido(p_id_mesa, p_id_pedido);
  end if;
end;
$$;

-- actualizar_estado_pedido: libera la mesa cuando el pedido se cancela.
create or replace function public.actualizar_estado_pedido(
  p_id_pedido int,
  p_estado varchar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_mesa int;
begin
  update public.pedido set estado = p_estado where id_pedido = p_id_pedido;

  if p_estado = 'Cancelado' then
    select id_mesa into v_id_mesa from public.pedido_mesa where id_pedido = p_id_pedido limit 1;
    if v_id_mesa is not null then
      perform public._liberar_mesa_pedido(v_id_mesa, p_id_pedido);
    end if;
  end if;
end;
$$;

create or replace function public.eliminar_pedido(p_id_pedido int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_mesa int;
begin
  if exists (select 1 from public.pago where id_pedido = p_id_pedido) then
    raise exception 'No se puede eliminar un pedido que ya tiene un pago registrado';
  end if;

  select id_mesa into v_id_mesa from public.pedido_mesa where id_pedido = p_id_pedido limit 1;

  delete from public.detalle_pedido where id_pedido = p_id_pedido;
  delete from public.pedido_mesa where id_pedido = p_id_pedido;
  delete from public.pedido where id_pedido = p_id_pedido;

  if v_id_mesa is not null then
    perform public._liberar_mesa_pedido(v_id_mesa, p_id_pedido);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 4) PAGOS
-- ------------------------------------------------------------

-- registrar_pago: al cobrar, libera la mesa (si nadie más la usa).
create or replace function public.registrar_pago(
  p_id_pedido int,
  p_monto numeric,
  p_metodo varchar
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_pago integer;
  v_id_mesa int;
begin
  insert into public.pago (monto, metodo_pago, id_pedido, estado)
  values (p_monto, p_metodo, p_id_pedido, 'Pagado')
  returning id_pago into v_id_pago;

  update public.pedido set estado = 'Atendido' where id_pedido = p_id_pedido;

  select id_mesa into v_id_mesa from public.pedido_mesa where id_pedido = p_id_pedido limit 1;
  if v_id_mesa is not null then
    perform public._liberar_mesa_pedido(v_id_mesa, p_id_pedido);
  end if;

  return v_id_pago;
end;
$$;

-- Lista de pedidos que aún no tienen pago registrado (para el modal
-- "+ Agregar pago": primero se elige a qué pedido corresponde).
create or replace function public.listar_pedidos_pendientes_pago()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.id_pedido desc), '[]')
  from (
    select p.id_pedido, p.total, p.estado,
           coalesce(
             (select string_agg('Mesa ' || m.numero, ', ')
              from public.pedido_mesa pm join public.mesa m on m.id_mesa = pm.id_mesa
              where pm.id_pedido = p.id_pedido),
             'Para llevar'
           ) as mesas
    from public.pedido p
    where p.estado <> 'Cancelado'
      and not exists (select 1 from public.pago pg where pg.id_pedido = p.id_pedido)
  ) t;
$$;

-- ------------------------------------------------------------
-- 5) USUARIOS: editar (cambiar contraseña y/o rol) — solo Administrador
-- ------------------------------------------------------------
create or replace function public.editar_usuario_staff(
  p_id_usuario_actor int,
  p_id_usuario int,
  p_password text default null,
  p_id_rol int default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rol_actor text;
begin
  select r.nombre_rol into v_rol_actor
  from public.usuario u
  join public.rol r on r.id_rol = u.id_rol
  where u.id_usuario = p_id_usuario_actor and u.estado = 'Activo';

  if v_rol_actor is distinct from 'Administrador' then
    raise exception 'Solo un Administrador puede editar usuarios.';
  end if;

  if p_id_rol is not null then
    update public.usuario set id_rol = p_id_rol where id_usuario = p_id_usuario;
  end if;

  if p_password is not null and trim(p_password) <> '' then
    if length(p_password) < 4 then
      raise exception 'La contraseña debe tener al menos 4 caracteres.';
    end if;

    update public.usuario
    set contrasena_hash = convert_to(crypt(p_password, gen_salt('bf')), 'utf8'),
        contrasena_salt = null
    where id_usuario = p_id_usuario;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6) RESEÑAS: eliminar en vez de ocultar
-- ------------------------------------------------------------
create or replace function public.eliminar_comentario(p_id_comentario int)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.comentario where id_comentario = p_id_comentario;
$$;

-- ------------------------------------------------------------
-- 7) PERMISOS
-- ------------------------------------------------------------
revoke all on function public.listar_reservas() from public, anon, authenticated;
revoke all on function public.crear_reserva_admin(text, text, varchar, varchar, date, time, smallint, text, int) from public, anon, authenticated;
revoke all on function public.editar_reserva(int, date, time, smallint, text, int) from public, anon, authenticated;
revoke all on function public.cancelar_reserva(int, text) from public, anon, authenticated;
revoke all on function public.eliminar_reserva(int) from public, anon, authenticated;
revoke all on function public.crear_pedido_admin(int, int, varchar, jsonb) from public, anon, authenticated;
revoke all on function public.editar_pedido_admin(int, int, int, varchar) from public, anon, authenticated;
revoke all on function public.actualizar_estado_pedido(int, varchar) from public, anon, authenticated;
revoke all on function public.eliminar_pedido(int) from public, anon, authenticated;
revoke all on function public.registrar_pago(int, numeric, varchar) from public, anon, authenticated;
revoke all on function public.listar_pedidos_pendientes_pago() from public, anon, authenticated;
revoke all on function public.editar_usuario_staff(int, int, text, int) from public, anon, authenticated;
revoke all on function public.eliminar_comentario(int) from public, anon, authenticated;

grant execute on function public.listar_reservas() to anon, authenticated;
grant execute on function public.crear_reserva_admin(text, text, varchar, varchar, date, time, smallint, text, int) to anon, authenticated;
grant execute on function public.editar_reserva(int, date, time, smallint, text, int) to anon, authenticated;
grant execute on function public.cancelar_reserva(int, text) to anon, authenticated;
grant execute on function public.eliminar_reserva(int) to anon, authenticated;
grant execute on function public.crear_pedido_admin(int, int, varchar, jsonb) to anon, authenticated;
grant execute on function public.editar_pedido_admin(int, int, int, varchar) to anon, authenticated;
grant execute on function public.actualizar_estado_pedido(int, varchar) to anon, authenticated;
grant execute on function public.eliminar_pedido(int) to anon, authenticated;
grant execute on function public.registrar_pago(int, numeric, varchar) to anon, authenticated;
grant execute on function public.listar_pedidos_pendientes_pago() to anon, authenticated;
grant execute on function public.editar_usuario_staff(int, int, text, int) to anon, authenticated;
grant execute on function public.eliminar_comentario(int) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) Fuerza a PostgREST a refrescar su caché de funciones.
--    Esto es lo que corrige el error "Could not find the function
--    ... in the schema cache" sin tener que esperar unos minutos.
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
