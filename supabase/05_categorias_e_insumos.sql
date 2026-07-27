-- ============================================================
-- OroMar - Gestión de Categorías (Productos) e Insumos (Inventario)
-- Ejecutar después de 01_esquema.sql, 02_seguridad_y_funciones.sql
-- y 03_panel_admin.sql
--
-- Objetivo: que el Administrador cree/edite/elimine categorías de
-- la carta e insumos del inventario desde el propio panel web,
-- sin necesitar entrar nunca a Supabase. Solo soporte técnico
-- debería tener acceso al panel de Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORÍAS
-- ------------------------------------------------------------

-- Igual que listar_categorias(), pero además indica cuántos
-- productos activos tiene cada categoría (útil para el panel,
-- por ejemplo para avisar antes de eliminar una categoría en uso).
create or replace function public.listar_categorias_admin()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.nombre_categoria), '[]')
  from (
    select c.id_categoria, c.nombre_categoria,
           (select count(*) from public.producto p
             where p.id_categoria = c.id_categoria and p.estado = 'Activo') as cantidad_productos
    from public.categoria c
  ) t;
$$;

create or replace function public.crear_categoria(p_nombre text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_categoria integer;
begin
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre de la categoría es obligatorio.';
  end if;

  insert into public.categoria (nombre_categoria)
  values (trim(p_nombre))
  returning id_categoria into v_id_categoria;

  return v_id_categoria;
exception
  when unique_violation then
    raise exception 'Ya existe una categoría con ese nombre.';
end;
$$;

create or replace function public.editar_categoria(
  p_id_categoria int,
  p_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre de la categoría es obligatorio.';
  end if;

  update public.categoria
  set nombre_categoria = trim(p_nombre)
  where id_categoria = p_id_categoria;
exception
  when unique_violation then
    raise exception 'Ya existe una categoría con ese nombre.';
end;
$$;

create or replace function public.eliminar_categoria(p_id_categoria int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_en_uso int;
begin
  select count(*) into v_en_uso
  from public.producto
  where id_categoria = p_id_categoria and estado = 'Activo';

  if v_en_uso > 0 then
    raise exception 'No puedes eliminar esta categoría: tiene % producto(s) de la carta asociados. Reasígnalos o elimínalos primero.', v_en_uso;
  end if;

  delete from public.categoria where id_categoria = p_id_categoria;
exception
  when foreign_key_violation then
    raise exception 'No puedes eliminar esta categoría: aún tiene productos asociados en el historial.';
end;
$$;

-- ------------------------------------------------------------
-- INSUMOS (alta y edición de la ficha del insumo)
-- registrar_movimiento_inventario() ya existente sigue siendo la
-- única forma de mover el stock de un insumo (entrada/salida/ajuste).
-- ------------------------------------------------------------

create or replace function public.crear_insumo(
  p_nombre text,
  p_unidad_medida varchar,
  p_stock_actual numeric,
  p_stock_minimo numeric,
  p_id_usuario int default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_insumo integer;
begin
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre del insumo es obligatorio.';
  end if;
  if p_stock_actual < 0 or p_stock_minimo < 0 then
    raise exception 'El stock no puede ser negativo.';
  end if;

  insert into public.insumo (nombre, unidad_medida, stock_actual, stock_minimo)
  values (trim(p_nombre), trim(p_unidad_medida), p_stock_actual, p_stock_minimo)
  returning id_insumo into v_id_insumo;

  -- Deja registrado en el historial de inventario la carga inicial,
  -- para que el módulo de movimientos siempre cuadre con el stock.
  if p_stock_actual > 0 then
    insert into public.inventario (tipo_movimiento, cantidad, observacion, id_insumo, id_usuario)
    values ('Entrada', p_stock_actual, 'Alta inicial del insumo', v_id_insumo, p_id_usuario);
  end if;

  return v_id_insumo;
end;
$$;

create or replace function public.editar_insumo(
  p_id_insumo int,
  p_nombre text,
  p_unidad_medida varchar,
  p_stock_minimo numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre del insumo es obligatorio.';
  end if;
  if p_stock_minimo < 0 then
    raise exception 'El stock mínimo no puede ser negativo.';
  end if;

  update public.insumo
  set nombre = trim(p_nombre),
      unidad_medida = trim(p_unidad_medida),
      stock_minimo = p_stock_minimo
  where id_insumo = p_id_insumo;
end;
$$;

create or replace function public.eliminar_insumo(p_id_insumo int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.insumo where id_insumo = p_id_insumo;
exception
  when foreign_key_violation then
    raise exception 'No puedes eliminar este insumo: tiene movimientos o recetas registradas. Puedes editar su nombre, unidad o stock mínimo en su lugar.';
end;
$$;

-- ------------------------------------------------------------
-- PERMISOS
-- Mismo criterio que en 03_panel_admin.sql: se revoca todo y se
-- otorga ejecución solo de estas funciones puntuales. anon/authenticated
-- nunca reciben acceso directo a las tablas categoria / insumo.
-- ------------------------------------------------------------
revoke all on function public.listar_categorias_admin() from public, anon, authenticated;
revoke all on function public.crear_categoria(text) from public, anon, authenticated;
revoke all on function public.editar_categoria(int, text) from public, anon, authenticated;
revoke all on function public.eliminar_categoria(int) from public, anon, authenticated;
revoke all on function public.crear_insumo(text, varchar, numeric, numeric, int) from public, anon, authenticated;
revoke all on function public.editar_insumo(int, text, varchar, numeric) from public, anon, authenticated;
revoke all on function public.eliminar_insumo(int) from public, anon, authenticated;

grant execute on function public.listar_categorias_admin() to anon, authenticated;
grant execute on function public.crear_categoria(text) to anon, authenticated;
grant execute on function public.editar_categoria(int, text) to anon, authenticated;
grant execute on function public.eliminar_categoria(int) to anon, authenticated;
grant execute on function public.crear_insumo(text, varchar, numeric, numeric, int) to anon, authenticated;
grant execute on function public.editar_insumo(int, text, varchar, numeric) to anon, authenticated;
grant execute on function public.eliminar_insumo(int) to anon, authenticated;
