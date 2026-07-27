-- ============================================================
-- OroMar - Funciones para el Panel Administrativo (staff)
-- Ejecutar después de 01_esquema.sql y 02_seguridad_y_funciones.sql
-- ============================================================

-- En Supabase, pgcrypto se instala en el esquema "extensions" (no en
-- "public"). Por eso las funciones que usan crypt()/gen_salt() abajo
-- incluyen "extensions" en su search_path; si no lo hicieran, fallarían
-- con el error: function gen_salt(unknown) does not exist.
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- LOGIN DEL STAFF
-- ------------------------------------------------------------
-- Guarda la contraseña con crypt()/gen_salt('bf'); el hash ya
-- incluye la sal, por eso contrasena_salt se deja en null.
create or replace function public.crear_usuario_staff(
  p_nombres text,
  p_apellidos text,
  p_usuario varchar,
  p_password text,
  p_id_rol int
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id_usuario integer;
begin
  insert into public.usuario (nombres, apellidos, usuario, contrasena_hash, id_rol)
  values (
    trim(p_nombres),
    trim(p_apellidos),
    trim(p_usuario),
    convert_to(crypt(p_password, gen_salt('bf')), 'utf8'),
    p_id_rol
  )
  returning id_usuario into v_id_usuario;

  return v_id_usuario;
end;
$$;

create or replace function public.login_staff(
  p_usuario varchar,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
begin
  select u.id_usuario, u.nombres, u.apellidos, u.usuario, u.estado,
         u.id_rol, r.nombre_rol
  into v_row
  from public.usuario u
  join public.rol r on r.id_rol = u.id_rol
  where u.usuario = trim(p_usuario)
    and u.contrasena_hash = convert_to(
          crypt(p_password, convert_from(u.contrasena_hash, 'utf8')),
          'utf8'
        );

  if not found then
    return null;
  end if;

  if v_row.estado <> 'Activo' then
    raise exception 'Usuario inactivo';
  end if;

  return json_build_object(
    'id_usuario', v_row.id_usuario,
    'nombres', v_row.nombres,
    'apellidos', v_row.apellidos,
    'usuario', v_row.usuario,
    'id_rol', v_row.id_rol,
    'nombre_rol', v_row.nombre_rol
  );
end;
$$;

-- ------------------------------------------------------------
-- DASHBOARD
-- ------------------------------------------------------------
create or replace function public.obtener_dashboard()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservas_hoy int;
  v_pedidos_activos int;
  v_ingresos_hoy numeric;
  v_mesas_ocupadas int;
  v_total_mesas int;
begin
  select count(*) into v_reservas_hoy
  from public.reserva where fecha = current_date and estado <> 'Cancelada';

  select count(*) into v_pedidos_activos
  from public.pedido where estado in ('Pendiente','En preparacion');

  select coalesce(sum(monto),0) into v_ingresos_hoy
  from public.pago where estado = 'Pagado' and fecha::date = current_date;

  select count(*) into v_mesas_ocupadas from public.mesa where estado = 'Ocupada';
  select count(*) into v_total_mesas from public.mesa;

  return json_build_object(
    'reservas_hoy', v_reservas_hoy,
    'pedidos_activos', v_pedidos_activos,
    'ingresos_hoy', v_ingresos_hoy,
    'mesas_ocupadas', v_mesas_ocupadas,
    'total_mesas', v_total_mesas
  );
end;
$$;

-- ------------------------------------------------------------
-- RESERVAS
-- ------------------------------------------------------------
create or replace function public.listar_reservas()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha, t.hora), '[]')
  from (
    select r.id_reserva, r.fecha, r.hora, r.cantidad_personas, r.estado,
           r.observacion, c.nombres, c.apellidos, c.telefono,
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

  -- La reserva queda en estado 'Pendiente' (valor por defecto de la tabla)
  -- hasta que el administrador la confirme desde el panel.

  if p_id_mesa is not null then
    insert into public.detalle_reserva_mesa (id_reserva, id_mesa)
    values (v_id_reserva, p_id_mesa)
    on conflict do nothing;
  end if;

  return v_id_reserva;
end;
$$;

create or replace function public.actualizar_estado_reserva(
  p_id_reserva int,
  p_estado varchar
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.reserva set estado = p_estado where id_reserva = p_id_reserva;
$$;

create or replace function public.editar_reserva(
  p_id_reserva int,
  p_fecha date,
  p_hora time,
  p_cantidad_personas smallint,
  p_observacion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cantidad_personas < 1 or p_cantidad_personas > 20 then
    raise exception 'La cantidad de personas debe estar entre 1 y 20';
  end if;

  update public.reserva
  set fecha = p_fecha,
      hora = p_hora,
      cantidad_personas = p_cantidad_personas,
      observacion = nullif(trim(p_observacion), '')
  where id_reserva = p_id_reserva;
end;
$$;

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

-- ------------------------------------------------------------
-- PEDIDOS Y PAGOS
-- ------------------------------------------------------------
create or replace function public.listar_pedidos()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha desc), '[]')
  from (
    select p.id_pedido, p.fecha, p.estado, p.total,
           p.id_usuario,
           u.nombres as mesero,
           (select pm.id_mesa from public.pedido_mesa pm
            where pm.id_pedido = p.id_pedido limit 1) as id_mesa,
           coalesce(
             (select string_agg('Mesa ' || m.numero, ', ')
              from public.pedido_mesa pm
              join public.mesa m on m.id_mesa = pm.id_mesa
              where pm.id_pedido = p.id_pedido),
             'Para llevar'
           ) as mesas,
           coalesce(
             (select string_agg(pr.nombre || ' x' || dp.cantidad, ', ')
              from public.detalle_pedido dp
              join public.producto pr on pr.id_producto = dp.id_producto
              where dp.id_pedido = p.id_pedido),
             ''
           ) as platos
    from public.pedido p
    join public.usuario u on u.id_usuario = p.id_usuario
    where p.estado <> 'Cancelado'
  ) t;
$$;

create or replace function public.actualizar_estado_pedido(
  p_id_pedido int,
  p_estado varchar
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pedido set estado = p_estado where id_pedido = p_id_pedido;
$$;

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
begin
  update public.pedido
  set id_usuario = p_id_usuario,
      estado = p_estado
  where id_pedido = p_id_pedido;

  delete from public.pedido_mesa where id_pedido = p_id_pedido;

  if p_id_mesa is not null then
    insert into public.pedido_mesa (id_pedido, id_mesa)
    values (p_id_pedido, p_id_mesa)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.eliminar_pedido(p_id_pedido int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.pago where id_pedido = p_id_pedido) then
    raise exception 'No se puede eliminar un pedido que ya tiene un pago registrado';
  end if;

  delete from public.detalle_pedido where id_pedido = p_id_pedido;
  delete from public.pedido_mesa where id_pedido = p_id_pedido;
  delete from public.pedido where id_pedido = p_id_pedido;
end;
$$;

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
begin
  insert into public.pago (monto, metodo_pago, id_pedido, estado)
  values (p_monto, p_metodo, p_id_pedido, 'Pagado')
  returning id_pago into v_id_pago;

  update public.pedido set estado = 'Atendido' where id_pedido = p_id_pedido;

  return v_id_pago;
end;
$$;

create or replace function public.listar_pagos()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha desc), '[]')
  from (
    select pg.id_pago, pg.id_pedido, pg.monto, pg.metodo_pago, pg.fecha,
           c.serie, c.numero
    from public.pago pg
    left join public.comprobante c on c.id_pago = pg.id_pago
  ) t;
$$;

-- ------------------------------------------------------------
-- PRODUCTOS
-- ------------------------------------------------------------
create or replace function public.listar_categorias()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]')
  from (select id_categoria, nombre_categoria from public.categoria order by nombre_categoria) t;
$$;

create or replace function public.listar_productos()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]')
  from (
    select p.id_producto, p.nombre, p.descripcion, p.precio, p.estado,
           cat.nombre_categoria
    from public.producto p
    join public.categoria cat on cat.id_categoria = p.id_categoria
    where p.estado = 'Activo'
    order by p.id_producto desc
  ) t;
$$;

create or replace function public.crear_producto(
  p_nombre text,
  p_descripcion text,
  p_precio numeric,
  p_id_categoria int
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_producto integer;
begin
  insert into public.producto (nombre, descripcion, precio, id_categoria)
  values (trim(p_nombre), nullif(trim(p_descripcion), ''), p_precio, p_id_categoria)
  returning id_producto into v_id_producto;

  return v_id_producto;
end;
$$;

create or replace function public.eliminar_producto(p_id_producto int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.producto set estado = 'Inactivo' where id_producto = p_id_producto;
$$;

-- ------------------------------------------------------------
-- MESAS
-- ------------------------------------------------------------
create or replace function public.listar_mesas()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.numero), '[]')
  from (select id_mesa, numero, capacidad, estado from public.mesa) t;
$$;

create or replace function public.actualizar_estado_mesa(
  p_id_mesa int,
  p_estado varchar
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.mesa set estado = p_estado where id_mesa = p_id_mesa;
$$;

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
-- Nota: el esquema actual no vincula la tabla pedido con cliente
-- directamente (pedido solo se relaciona con mesa y usuario), así que
-- "visitas" aquí se aproxima contando las reservas del cliente. Si más
-- adelante agregas id_cliente a pedido, puedes sumar el gasto real.
create or replace function public.listar_clientes()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]')
  from (
    select cl.id_cliente, cl.nombres, cl.apellidos, cl.telefono, cl.correo,
           (select count(*) from public.reserva r where r.id_cliente = cl.id_cliente) as visitas
    from public.cliente cl
    order by cl.fecha_registro desc
  ) t;
$$;

-- ------------------------------------------------------------
-- INVENTARIO
-- ------------------------------------------------------------
create or replace function public.listar_insumos()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.nombre), '[]')
  from (
    select id_insumo, nombre, unidad_medida, stock_actual, stock_minimo,
           case when stock_actual <= stock_minimo then 'Urgente'
                when stock_actual <= stock_minimo * 1.5 then 'Bajo'
                else 'OK' end as estado_stock
    from public.insumo
  ) t;
$$;

create or replace function public.registrar_movimiento_inventario(
  p_id_insumo int,
  p_tipo varchar,
  p_cantidad numeric,
  p_observacion text,
  p_id_usuario int
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_inventario integer;
begin
  insert into public.inventario (tipo_movimiento, cantidad, observacion, id_insumo, id_usuario)
  values (p_tipo, p_cantidad, nullif(trim(p_observacion), ''), p_id_insumo, p_id_usuario)
  returning id_inventario into v_id_inventario;

  if p_tipo = 'Entrada' then
    update public.insumo set stock_actual = stock_actual + p_cantidad where id_insumo = p_id_insumo;
  elsif p_tipo = 'Salida' then
    update public.insumo set stock_actual = greatest(stock_actual - p_cantidad, 0) where id_insumo = p_id_insumo;
  else
    update public.insumo set stock_actual = p_cantidad where id_insumo = p_id_insumo;
  end if;

  return v_id_inventario;
end;
$$;

-- ------------------------------------------------------------
-- COMENTARIOS
-- ------------------------------------------------------------
create or replace function public.listar_comentarios()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha desc), '[]')
  from (
    select co.id_comentario, co.comentario, co.calificacion, co.estado,
           co.fecha, co.respuesta_admin, cl.nombres, cl.apellidos
    from public.comentario co
    join public.cliente cl on cl.id_cliente = co.id_cliente
    where co.estado <> 'Oculto'
  ) t;
$$;

create or replace function public.responder_comentario(
  p_id_comentario int,
  p_respuesta text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comentario
  set respuesta_admin = p_respuesta, estado = 'Respondido'
  where id_comentario = p_id_comentario;
$$;

create or replace function public.ocultar_comentario(p_id_comentario int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comentario set estado = 'Oculto' where id_comentario = p_id_comentario;
$$;

-- ------------------------------------------------------------
-- PERMISOS
-- Igual que en 02_seguridad_y_funciones.sql: se revoca todo y se
-- otorga ejecución solo de las funciones necesarias. anon/authenticated
-- nunca reciben acceso directo a las tablas.
-- ------------------------------------------------------------
revoke all on function public.crear_usuario_staff(text, text, varchar, text, int) from public, anon, authenticated;

revoke all on function public.login_staff(varchar, text) from public;
revoke all on function public.obtener_dashboard() from public;
revoke all on function public.listar_reservas() from public;
revoke all on function public.crear_reserva_admin(text, text, varchar, varchar, date, time, smallint, text, int) from public;
revoke all on function public.actualizar_estado_reserva(int, varchar) from public;
revoke all on function public.editar_reserva(int, date, time, smallint, text) from public;
revoke all on function public.eliminar_reserva(int) from public;
revoke all on function public.listar_pedidos() from public;
revoke all on function public.actualizar_estado_pedido(int, varchar) from public;
revoke all on function public.crear_pedido_admin(int, int, varchar, jsonb) from public;
revoke all on function public.editar_pedido_admin(int, int, int, varchar) from public;
revoke all on function public.eliminar_pedido(int) from public;
revoke all on function public.registrar_pago(int, numeric, varchar) from public;
revoke all on function public.listar_pagos() from public;
revoke all on function public.listar_categorias() from public;
revoke all on function public.listar_productos() from public;
revoke all on function public.crear_producto(text, text, numeric, int) from public;
revoke all on function public.eliminar_producto(int) from public;
revoke all on function public.listar_mesas() from public;
revoke all on function public.actualizar_estado_mesa(int, varchar) from public;
revoke all on function public.listar_clientes() from public;
revoke all on function public.listar_insumos() from public;
revoke all on function public.registrar_movimiento_inventario(int, varchar, numeric, text, int) from public;
revoke all on function public.listar_comentarios() from public;
revoke all on function public.responder_comentario(int, text) from public;
revoke all on function public.ocultar_comentario(int) from public;

grant execute on function public.login_staff(varchar, text) to anon, authenticated;
grant execute on function public.obtener_dashboard() to anon, authenticated;
grant execute on function public.listar_reservas() to anon, authenticated;
grant execute on function public.crear_reserva_admin(text, text, varchar, varchar, date, time, smallint, text, int) to anon, authenticated;
grant execute on function public.actualizar_estado_reserva(int, varchar) to anon, authenticated;
grant execute on function public.editar_reserva(int, date, time, smallint, text) to anon, authenticated;
grant execute on function public.eliminar_reserva(int) to anon, authenticated;
grant execute on function public.listar_pedidos() to anon, authenticated;
grant execute on function public.actualizar_estado_pedido(int, varchar) to anon, authenticated;
grant execute on function public.crear_pedido_admin(int, int, varchar, jsonb) to anon, authenticated;
grant execute on function public.editar_pedido_admin(int, int, int, varchar) to anon, authenticated;
grant execute on function public.eliminar_pedido(int) to anon, authenticated;
grant execute on function public.registrar_pago(int, numeric, varchar) to anon, authenticated;
grant execute on function public.listar_pagos() to anon, authenticated;
grant execute on function public.listar_categorias() to anon, authenticated;
grant execute on function public.listar_productos() to anon, authenticated;
grant execute on function public.crear_producto(text, text, numeric, int) to anon, authenticated;
grant execute on function public.eliminar_producto(int) to anon, authenticated;
grant execute on function public.listar_mesas() to anon, authenticated;
grant execute on function public.actualizar_estado_mesa(int, varchar) to anon, authenticated;
grant execute on function public.listar_clientes() to anon, authenticated;
grant execute on function public.listar_insumos() to anon, authenticated;
grant execute on function public.registrar_movimiento_inventario(int, varchar, numeric, text, int) to anon, authenticated;
grant execute on function public.listar_comentarios() to anon, authenticated;
grant execute on function public.responder_comentario(int, text) to anon, authenticated;
grant execute on function public.ocultar_comentario(int) to anon, authenticated;

-- ------------------------------------------------------------
-- Crea aquí tu primer usuario administrador (cambia la contraseña).
-- Ejecuta esto UNA sola vez, luego borra o comenta esta línea:
-- select public.crear_usuario_staff('Admin','OroMar','admin','admin123', 1);
-- ------------------------------------------------------------
