-- ============================================================
-- OroMar - Gestión de usuarios internos desde el Panel Admin
-- Ejecutar después de 01_esquema.sql, 02_seguridad_y_funciones.sql
-- y 03_panel_admin.sql
-- ============================================================

-- ------------------------------------------------------------
-- LISTAR ROLES (para el <select> del formulario "Nuevo usuario")
-- ------------------------------------------------------------
create or replace function public.listar_roles()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.id_rol), '[]')
  from (select id_rol, nombre_rol from public.rol) t;
$$;

-- ------------------------------------------------------------
-- LISTAR USUARIOS DEL SISTEMA (para la tabla del módulo Usuarios)
-- ------------------------------------------------------------
create or replace function public.listar_usuarios()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.id_usuario), '[]')
  from (
    select u.id_usuario, u.nombres, u.apellidos, u.usuario, u.estado,
           u.id_rol, r.nombre_rol
    from public.usuario u
    join public.rol r on r.id_rol = u.id_rol
  ) t;
$$;

-- ------------------------------------------------------------
-- ACTIVAR / DESACTIVAR USUARIO (en vez de borrarlo, se bloquea el
-- acceso; login_staff ya rechaza a los usuarios con estado <> 'Activo')
-- ------------------------------------------------------------
create or replace function public.actualizar_estado_usuario(
  p_id_usuario int,
  p_estado varchar
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usuario set estado = p_estado where id_usuario = p_id_usuario;
$$;

-- ------------------------------------------------------------
-- PERMISOS
-- Mismo patrón que en 02 y 03: revocar todo y otorgar ejecución solo
-- de lo necesario. Nota: crear_usuario_staff ya existe desde
-- 03_panel_admin.sql pero ahí se revocó sin volver a otorgarse el
-- acceso; aquí se corrige ese permiso para que el panel pueda usarlo.
-- ------------------------------------------------------------
revoke all on function public.listar_roles() from public, anon, authenticated;
revoke all on function public.listar_usuarios() from public, anon, authenticated;
revoke all on function public.actualizar_estado_usuario(int, varchar) from public, anon, authenticated;
revoke all on function public.crear_usuario_staff(text, text, varchar, text, int) from public, anon, authenticated;

grant execute on function public.listar_roles() to anon, authenticated;
grant execute on function public.listar_usuarios() to anon, authenticated;
grant execute on function public.actualizar_estado_usuario(int, varchar) to anon, authenticated;
grant execute on function public.crear_usuario_staff(text, text, varchar, text, int) to anon, authenticated;

-- ------------------------------------------------------------
-- Crea aquí tu primer usuario administrador (cambia usuario/clave).
-- Ejecuta esto UNA sola vez y luego bórralo o coméntalo:
-- select public.crear_usuario_staff('Admin','OroMar','admin','admin123', 1);
-- (id_rol: 1 = Administrador, 2 = Cajero, 3 = Mesero, 4 = Cocinero,
--  según el insert de 01_esquema.sql)
-- ------------------------------------------------------------
