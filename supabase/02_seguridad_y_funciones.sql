-- ============================================================
-- OroMar - Seguridad y funciones usadas por main.js
-- Ejecutar después de 01_esquema.sql
-- ============================================================

alter table public.rol enable row level security;
alter table public.usuario enable row level security;
alter table public.cliente enable row level security;
alter table public.mesa enable row level security;
alter table public.reserva enable row level security;
alter table public.detalle_reserva_mesa enable row level security;
alter table public.categoria enable row level security;
alter table public.producto enable row level security;
alter table public.pedido enable row level security;
alter table public.pedido_mesa enable row level security;
alter table public.detalle_pedido enable row level security;
alter table public.insumo enable row level security;
alter table public.inventario enable row level security;
alter table public.receta enable row level security;
alter table public.pago enable row level security;
alter table public.comprobante enable row level security;
alter table public.comentario enable row level security;
alter table public.galeria enable row level security;
alter table public.promocion enable row level security;
alter table public.contacto enable row level security;
alter table public.configuracion_empresa enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create or replace function public.obtener_o_crear_cliente_web(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_cliente integer;
begin
  insert into public.cliente (nombres, apellidos, telefono, correo)
  values (
    trim(p_nombres),
    trim(p_apellidos),
    trim(p_telefono),
    nullif(trim(p_correo), '')
  )
  on conflict (telefono) do update
  set nombres = excluded.nombres,
      apellidos = excluded.apellidos,
      correo = coalesce(excluded.correo, public.cliente.correo)
  returning id_cliente into v_id_cliente;

  return v_id_cliente;
end;
$$;

create or replace function public.registrar_cliente_web(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.obtener_o_crear_cliente_web(
    p_nombres,
    p_apellidos,
    p_telefono,
    p_correo
  );
end;
$$;

create or replace function public.crear_reserva_web(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar,
  p_fecha date,
  p_hora time,
  p_cantidad_personas smallint,
  p_observacion text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_cliente integer;
  v_id_reserva integer;
begin
  if p_fecha < current_date then
    raise exception 'La fecha de reserva no puede estar en el pasado';
  end if;

  if p_cantidad_personas < 1 or p_cantidad_personas > 20 then
    raise exception 'La cantidad de personas debe estar entre 1 y 20';
  end if;

  v_id_cliente := public.obtener_o_crear_cliente_web(
    p_nombres,
    p_apellidos,
    p_telefono,
    p_correo
  );

  insert into public.reserva (
    fecha,
    hora,
    cantidad_personas,
    observacion,
    id_cliente
  )
  values (
    p_fecha,
    p_hora,
    p_cantidad_personas,
    nullif(trim(p_observacion), ''),
    v_id_cliente
  )
  returning id_reserva into v_id_reserva;

  return v_id_reserva;
end;
$$;

create or replace function public.crear_comentario_web(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar,
  p_comentario text,
  p_calificacion smallint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_cliente integer;
  v_id_comentario integer;
begin
  if p_calificacion < 1 or p_calificacion > 5 then
    raise exception 'La calificación debe estar entre 1 y 5';
  end if;

  v_id_cliente := public.obtener_o_crear_cliente_web(
    p_nombres,
    p_apellidos,
    p_telefono,
    p_correo
  );

  insert into public.comentario (comentario, calificacion, id_cliente)
  values (trim(p_comentario), p_calificacion, v_id_cliente)
  returning id_comentario into v_id_comentario;

  return v_id_comentario;
end;
$$;

create or replace function public.crear_contacto_web(
  p_nombres text,
  p_apellidos text,
  p_telefono varchar,
  p_correo varchar,
  p_mensaje text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_cliente integer;
  v_id_contacto integer;
begin
  v_id_cliente := public.obtener_o_crear_cliente_web(
    p_nombres,
    p_apellidos,
    p_telefono,
    p_correo
  );

  insert into public.contacto (mensaje, id_cliente)
  values (trim(p_mensaje), v_id_cliente)
  returning id_contacto into v_id_contacto;

  return v_id_contacto;
end;
$$;

revoke all on function public.obtener_o_crear_cliente_web(text, text, varchar, varchar)
from public, anon, authenticated;

revoke all on function public.registrar_cliente_web(text, text, varchar, varchar)
from public;
revoke all on function public.crear_reserva_web(text, text, varchar, varchar, date, time, smallint, text)
from public;
revoke all on function public.crear_comentario_web(text, text, varchar, varchar, text, smallint)
from public;
revoke all on function public.crear_contacto_web(text, text, varchar, varchar, text)
from public;

grant execute on function public.registrar_cliente_web(text, text, varchar, varchar)
to anon, authenticated;
grant execute on function public.crear_reserva_web(text, text, varchar, varchar, date, time, smallint, text)
to anon, authenticated;
grant execute on function public.crear_comentario_web(text, text, varchar, varchar, text, smallint)
to anon, authenticated;
grant execute on function public.crear_contacto_web(text, text, varchar, varchar, text)
to anon, authenticated;
