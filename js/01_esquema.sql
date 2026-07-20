-- ============================================================
-- OroMar - Esquema compatible con Supabase/PostgreSQL
-- Ejecutar una sola vez en Supabase > SQL Editor
-- ============================================================

create table if not exists public.rol (
  id_rol serial primary key,
  nombre_rol varchar(30) not null unique
);

create table if not exists public.usuario (
  id_usuario serial primary key,
  nombres text not null,
  apellidos text not null,
  usuario varchar(50) not null unique,
  contrasena_hash bytea not null,
  contrasena_salt bytea,
  estado varchar(20) not null default 'Activo'
    check (estado in ('Activo','Inactivo')),
  id_rol int not null references public.rol(id_rol)
);

create table if not exists public.cliente (
  id_cliente serial primary key,
  nombres text not null,
  apellidos text not null,
  telefono varchar(15) not null,
  correo varchar(150),
  fecha_registro timestamptz not null default now()
);

create unique index if not exists uq_cliente_telefono
  on public.cliente (telefono);

create table if not exists public.mesa (
  id_mesa serial primary key,
  numero smallint not null unique,
  capacidad smallint not null default 4 check (capacidad > 0),
  estado varchar(20) not null default 'Disponible'
    check (estado in ('Disponible','Ocupada','Reservada'))
);

create table if not exists public.reserva (
  id_reserva serial primary key,
  fecha date not null,
  hora time not null,
  cantidad_personas smallint not null check (cantidad_personas > 0),
  observacion text,
  estado varchar(20) not null default 'Pendiente'
    check (estado in ('Pendiente','Confirmada','Cancelada','Atendida')),
  fecha_registro timestamptz not null default now(),
  id_cliente int not null references public.cliente(id_cliente)
);

create table if not exists public.detalle_reserva_mesa (
  id_detalle_reserva serial primary key,
  id_reserva int not null references public.reserva(id_reserva),
  id_mesa int not null references public.mesa(id_mesa),
  unique (id_reserva, id_mesa)
);

create table if not exists public.categoria (
  id_categoria serial primary key,
  nombre_categoria text not null unique
);

create table if not exists public.producto (
  id_producto serial primary key,
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null check (precio > 0),
  estado varchar(20) not null default 'Activo'
    check (estado in ('Activo','Inactivo')),
  id_categoria int not null references public.categoria(id_categoria)
);

create table if not exists public.pedido (
  id_pedido serial primary key,
  fecha timestamptz not null default now(),
  estado varchar(30) not null default 'Pendiente'
    check (estado in ('Pendiente','En preparacion','Atendido','Cancelado')),
  total numeric(10,2) not null default 0 check (total >= 0),
  id_usuario int not null references public.usuario(id_usuario)
);

create table if not exists public.pedido_mesa (
  id_pedido_mesa serial primary key,
  id_pedido int not null references public.pedido(id_pedido),
  id_mesa int not null references public.mesa(id_mesa),
  unique (id_pedido, id_mesa)
);

create table if not exists public.detalle_pedido (
  id_detalle serial primary key,
  cantidad smallint not null check (cantidad > 0),
  precio numeric(10,2) not null check (precio >= 0),
  id_pedido int not null references public.pedido(id_pedido),
  id_producto int not null references public.producto(id_producto)
);

create table if not exists public.insumo (
  id_insumo serial primary key,
  nombre text not null,
  unidad_medida varchar(30) not null,
  stock_actual numeric(9,2) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(9,2) not null check (stock_minimo >= 0)
);

create table if not exists public.inventario (
  id_inventario serial primary key,
  fecha timestamptz not null default now(),
  tipo_movimiento varchar(20) not null
    check (tipo_movimiento in ('Entrada','Salida','Ajuste')),
  cantidad numeric(9,2) not null check (cantidad > 0),
  observacion text,
  id_insumo int not null references public.insumo(id_insumo),
  id_usuario int not null references public.usuario(id_usuario)
);

create table if not exists public.receta (
  id_receta serial primary key,
  id_producto int not null references public.producto(id_producto),
  id_insumo int not null references public.insumo(id_insumo),
  cantidad_utilizada numeric(9,2) not null check (cantidad_utilizada > 0),
  unique (id_producto, id_insumo)
);

create table if not exists public.pago (
  id_pago serial primary key,
  fecha timestamptz not null default now(),
  monto numeric(10,2) not null check (monto > 0),
  metodo_pago varchar(20) not null
    check (metodo_pago in ('Efectivo','Yape','Plin','Tarjeta','Transferencia')),
  id_pedido int not null references public.pedido(id_pedido),
  estado varchar(20) not null default 'Pagado'
    check (estado in ('Pendiente','Pagado','Anulado'))
);

create table if not exists public.comprobante (
  id_comprobante serial primary key,
  serie varchar(10) not null,
  numero varchar(20) not null,
  fecha timestamptz not null default now(),
  hora time not null default localtime,
  id_pago int not null references public.pago(id_pago),
  unique (serie, numero),
  unique (id_pago)
);

create table if not exists public.comentario (
  id_comentario serial primary key,
  comentario text not null,
  calificacion smallint not null check (calificacion between 1 and 5),
  respuesta_admin text,
  fecha timestamptz not null default now(),
  estado varchar(20) not null default 'Pendiente'
    check (estado in ('Pendiente','Respondido','Oculto')),
  id_cliente int not null references public.cliente(id_cliente)
);

create table if not exists public.galeria (
  id_galeria serial primary key,
  titulo text not null,
  descripcion text,
  ruta_imagen varchar(300) not null,
  fecha_publicacion timestamptz not null default now(),
  estado varchar(20) not null default 'Activo'
    check (estado in ('Activo','Inactivo'))
);

create table if not exists public.promocion (
  id_promocion serial primary key,
  titulo text not null,
  descripcion text,
  fecha_inicio date not null,
  fecha_fin date not null,
  imagen varchar(300),
  estado varchar(20) not null default 'Activo'
    check (estado in ('Activo','Inactivo','Finalizada')),
  check (fecha_fin >= fecha_inicio)
);

create table if not exists public.contacto (
  id_contacto serial primary key,
  mensaje text not null,
  fecha timestamptz not null default now(),
  estado varchar(20) not null default 'Pendiente'
    check (estado in ('Pendiente','Atendido','Archivado')),
  id_cliente int not null references public.cliente(id_cliente)
);

create table if not exists public.configuracion_empresa (
  id_configuracion serial primary key,
  nombre_empresa text not null,
  direccion text,
  facebook varchar(300),
  whatsapp varchar(15),
  correo varchar(150),
  horario text
);

insert into public.rol (nombre_rol)
values ('Administrador'), ('Cajero'), ('Mesero'), ('Cocinero')
on conflict (nombre_rol) do nothing;

insert into public.mesa (numero, capacidad)
select numero, 4
from generate_series(1, 10) as numero
on conflict (numero) do nothing;
