-- ============================================================
-- OroMar - Parche: eliminación real de productos/categorías
-- y reseñas públicas con respuesta del restaurante.
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 01, 02, 03 y 05.
-- Es seguro volver a ejecutar este archivo las veces que haga falta.
-- ============================================================

-- ------------------------------------------------------------
-- 1) POR QUÉ FALLABA "Eliminar categoría"
-- ------------------------------------------------------------
-- eliminar_producto() solo hacía un "soft delete" (estado = 'Inactivo'):
-- la fila del producto seguía existiendo y seguía apuntando a su
-- categoría con una llave foránea. Por eso, aunque el contador de
-- "productos activos" ya mostraba 0, al intentar borrar la categoría
-- Postgres igual chocaba con esa fila inactiva (foreign_key_violation)
-- y devolvía "aún tiene productos asociados en el historial".
--
-- Ahora: eliminar_producto() borra el producto de verdad (DELETE)
-- cuando nunca fue pedido ni tiene receta asociada. Si el producto
-- SÍ tiene historial real (aparece en pedidos ya registrados), no se
-- puede borrar sin perder ese historial, así que se mantiene el
-- soft delete (estado = 'Inactivo') únicamente en ese caso.
--
-- Además, eliminar_categoria() ahora limpia primero los productos
-- inactivos "huérfanos" (sin historial) que hayan quedado de antes
-- de este parche, para que categorías ya afectadas por el error
-- también se puedan eliminar.
-- ------------------------------------------------------------

create or replace function public.eliminar_producto(p_id_producto int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tiene_historial boolean;
begin
  select exists(
    select 1 from public.detalle_pedido where id_producto = p_id_producto
    union all
    select 1 from public.receta where id_producto = p_id_producto
  ) into v_tiene_historial;

  if v_tiene_historial then
    -- Tiene pedidos o receta registrados: se retira de la carta sin
    -- borrar la fila, para no perder ese historial.
    update public.producto set estado = 'Inactivo' where id_producto = p_id_producto;
  else
    -- Nunca se usó: se elimina por completo.
    delete from public.producto where id_producto = p_id_producto;
  end if;
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

  -- Limpieza de productos inactivos sin historial que hayan quedado
  -- de antes de este parche (soft-delete antiguo).
  delete from public.producto p
  where p.id_categoria = p_id_categoria
    and p.estado = 'Inactivo'
    and not exists (select 1 from public.detalle_pedido d where d.id_producto = p.id_producto)
    and not exists (select 1 from public.receta r where r.id_producto = p.id_producto);

  delete from public.categoria where id_categoria = p_id_categoria;
exception
  when foreign_key_violation then
    raise exception 'No puedes eliminar esta categoría: aún tiene productos asociados en el historial de pedidos.';
end;
$$;

-- ------------------------------------------------------------
-- 2) RESEÑAS PÚBLICAS (para la web)
-- ------------------------------------------------------------
-- Devuelve solo las reseñas que el equipo ya aprobó y respondió
-- desde el sistema interno (estado = 'Respondido'), junto con el
-- texto de esa respuesta, para mostrarlas en la web pública.
create or replace function public.listar_comentarios_publicos()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.fecha desc), '[]')
  from (
    select co.id_comentario, co.comentario, co.calificacion,
           co.respuesta_admin, co.fecha, cl.nombres, cl.apellidos
    from public.comentario co
    join public.cliente cl on cl.id_cliente = co.id_cliente
    where co.estado = 'Respondido'
    limit 12
  ) t;
$$;

-- ------------------------------------------------------------
-- 3) PERMISOS
-- ------------------------------------------------------------
revoke all on function public.eliminar_producto(int) from public, anon, authenticated;
revoke all on function public.eliminar_categoria(int) from public, anon, authenticated;
revoke all on function public.listar_comentarios_publicos() from public, anon, authenticated;

grant execute on function public.eliminar_producto(int) to anon, authenticated;
grant execute on function public.eliminar_categoria(int) to anon, authenticated;
grant execute on function public.listar_comentarios_publicos() to anon, authenticated;

-- ------------------------------------------------------------
-- 4) Fuerza a PostgREST a refrescar su caché de funciones.
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
