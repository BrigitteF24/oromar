CREATE DATABASE OroMar;
GO

USE OroMar;
GO

CREATE TABLE Rol (
    id_rol INT IDENTITY(1,1) PRIMARY KEY,
    nombre_rol VARCHAR(30) NOT NULL UNIQUE
);
GO

CREATE TABLE Usuario (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    nombres NVARCHAR(100) NOT NULL,
    apellidos NVARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    contrasena_hash VARBINARY(64) NOT NULL,
    contrasena_salt VARBINARY(16),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
        CHECK (estado IN ('Activo','Inactivo')),
    id_rol INT NOT NULL,

    CONSTRAINT FK_Usuario_Rol
    FOREIGN KEY (id_rol)
    REFERENCES Rol(id_rol)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Cliente (
    id_cliente INT IDENTITY(1,1) PRIMARY KEY,
    nombres NVARCHAR(100) NOT NULL,
    apellidos NVARCHAR(100) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    correo VARCHAR(150),
    fecha_registro DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE Mesa (
    id_mesa INT IDENTITY(1,1) PRIMARY KEY,
    numero SMALLINT NOT NULL UNIQUE,
    capacidad TINYINT NOT NULL DEFAULT 4
        CHECK (capacidad > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible'
        CHECK (estado IN ('Disponible','Ocupada','Reservada'))
);
GO

CREATE TABLE Reserva (
    id_reserva INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATE NOT NULL,
    hora TIME(0) NOT NULL,
    cantidad_personas TINYINT NOT NULL
        CHECK (cantidad_personas > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','Confirmada','Cancelada','Atendida')),
    fecha_registro DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    id_cliente INT NOT NULL,

    CONSTRAINT FK_Reserva_Cliente
    FOREIGN KEY (id_cliente)
    REFERENCES Cliente(id_cliente)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Detalle_Reserva_Mesa (
    id_detalle_reserva INT IDENTITY(1,1) PRIMARY KEY,
    id_reserva INT NOT NULL,
    id_mesa INT NOT NULL,

    CONSTRAINT UQ_DetalleReserva_Mesa UNIQUE(id_reserva, id_mesa),

    CONSTRAINT FK_DetalleReserva_Reserva
    FOREIGN KEY (id_reserva)
    REFERENCES Reserva(id_reserva)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,

    CONSTRAINT FK_DetalleReserva_Mesa
    FOREIGN KEY (id_mesa)
    REFERENCES Mesa(id_mesa)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Categoria (
    id_categoria INT IDENTITY(1,1) PRIMARY KEY,
    nombre_categoria NVARCHAR(50) NOT NULL UNIQUE
);
GO

CREATE TABLE Producto (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(255),
    precio MONEY NOT NULL
        CHECK (precio > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
        CHECK (estado IN ('Activo','Inactivo')),
    id_categoria INT NOT NULL,

    CONSTRAINT FK_Producto_Categoria
    FOREIGN KEY (id_categoria)
    REFERENCES Categoria(id_categoria)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Pedido (
    id_pedido INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','En preparacion','Atendido','Cancelado')),
    total MONEY NOT NULL DEFAULT 0
        CHECK (total >= 0),
    id_usuario INT NOT NULL,

    CONSTRAINT FK_Pedido_Usuario
    FOREIGN KEY (id_usuario)
    REFERENCES Usuario(id_usuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Pedido_Mesa (
    id_pedido_mesa INT IDENTITY(1,1) PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_mesa INT NOT NULL,

    CONSTRAINT UQ_PedidoMesa UNIQUE(id_pedido, id_mesa),

    CONSTRAINT FK_PedidoMesa_Pedido
    FOREIGN KEY (id_pedido)
    REFERENCES Pedido(id_pedido)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,

    CONSTRAINT FK_PedidoMesa_Mesa
    FOREIGN KEY (id_mesa)
    REFERENCES Mesa(id_mesa)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Detalle_Pedido (
    id_detalle INT IDENTITY(1,1) PRIMARY KEY,
    cantidad SMALLINT NOT NULL
        CHECK (cantidad > 0),
    precio MONEY NOT NULL
        CHECK (precio >= 0),
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,

    CONSTRAINT FK_DetallePedido_Pedido
    FOREIGN KEY (id_pedido)
    REFERENCES Pedido(id_pedido)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,

    CONSTRAINT FK_DetallePedido_Producto
    FOREIGN KEY (id_producto)
    REFERENCES Producto(id_producto)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Insumo (
    id_insumo INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL,
    stock_actual DECIMAL(9,2) NOT NULL DEFAULT 0
        CHECK (stock_actual >= 0),
    stock_minimo DECIMAL(9,2) NOT NULL
        CHECK (stock_minimo >= 0)
);
GO

CREATE TABLE Inventario (
    id_inventario INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    tipo_movimiento VARCHAR(20) NOT NULL
        CHECK (tipo_movimiento IN ('Entrada','Salida','Ajuste')),
    cantidad DECIMAL(9,2) NOT NULL
        CHECK (cantidad > 0),
    observacion NVARCHAR(255),
    id_insumo INT  NOT NULL,
    id_usuario INT NOT NULL,

    CONSTRAINT FK_Inventario_Insumo
    FOREIGN KEY (id_insumo)
    REFERENCES Insumo(id_insumo)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,

    CONSTRAINT FK_Inventario_Usuario
    FOREIGN KEY (id_usuario)
    REFERENCES Usuario(id_usuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Receta (
    id_receta INT IDENTITY(1,1) PRIMARY KEY,
    id_producto INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad_utilizada DECIMAL(9,2) NOT NULL
        CHECK (cantidad_utilizada > 0),

    CONSTRAINT UQ_Receta_Producto_Insumo UNIQUE(id_producto, id_insumo),

    CONSTRAINT FK_Receta_Producto
    FOREIGN KEY (id_producto)
    REFERENCES Producto(id_producto)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,

    CONSTRAINT FK_Receta_Insumo
    FOREIGN KEY (id_insumo)
    REFERENCES Insumo(id_insumo)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Pago (
    id_pago INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    monto MONEY NOT NULL
        CHECK (monto > 0),
    metodo_pago VARCHAR(20) NOT NULL
        CHECK (metodo_pago IN ('Efectivo','Yape','Plin','Tarjeta','Transferencia')),
    id_pedido INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pagado'
        CHECK (estado IN ('Pendiente','Pagado','Anulado')),

    CONSTRAINT FK_Pago_Pedido
    FOREIGN KEY (id_pedido)
    REFERENCES Pedido(id_pedido)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Comprobante (
    id_comprobante INT IDENTITY(1,1) PRIMARY KEY,
    serie VARCHAR(10) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    hora TIME(0) NOT NULL DEFAULT CAST(SYSDATETIME() AS TIME(0)),
    id_pago INT NOT NULL,

    CONSTRAINT UQ_Comprobante_Serie_Numero UNIQUE(serie, numero),
    CONSTRAINT UQ_Comprobante_Pago UNIQUE(id_pago),

    CONSTRAINT FK_Comprobante_Pago
    FOREIGN KEY (id_pago)
    REFERENCES Pago(id_pago)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Comentario(
    id_comentario INT IDENTITY(1,1) PRIMARY KEY,
    comentario NVARCHAR(500) NOT NULL,
    calificacion TINYINT NOT NULL
        CHECK (calificacion BETWEEN 1 AND 5),
    respuesta_admin NVARCHAR(500),
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','Respondido','Oculto')),
    id_cliente INT NOT NULL,

    CONSTRAINT FK_Comentario_Cliente
    FOREIGN KEY (id_cliente)
    REFERENCES Cliente(id_cliente)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Galeria(
    id_galeria INT IDENTITY(1,1) PRIMARY KEY,
    titulo NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(300),
    ruta_imagen VARCHAR(300) NOT NULL,
    fecha_publicacion DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
        CHECK (estado IN ('Activo','Inactivo'))
);
GO

CREATE TABLE Promocion(
    id_promocion INT IDENTITY(1,1) PRIMARY KEY,
    titulo NVARCHAR(150) NOT NULL,
    descripcion NVARCHAR(500),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    imagen VARCHAR(300),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
        CHECK (estado IN ('Activo','Inactivo','Finalizada')),

    CONSTRAINT CK_Promocion_Fechas CHECK (fecha_fin >= fecha_inicio)
);
GO

CREATE TABLE Contacto(
    id_contacto INT IDENTITY(1,1) PRIMARY KEY,
    mensaje NVARCHAR(500) NOT NULL,
    fecha DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','Atendido','Archivado')),
    id_cliente INT NOT NULL,

    CONSTRAINT FK_Contacto_Cliente
    FOREIGN KEY (id_cliente)
    REFERENCES Cliente(id_cliente)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);
GO

CREATE TABLE Configuracion_Empresa(
    id_configuracion INT IDENTITY(1,1) PRIMARY KEY,
    nombre_empresa NVARCHAR(150) NOT NULL,
    direccion NVARCHAR(200),
    facebook VARCHAR(300),
    whatsapp VARCHAR(15),
    correo VARCHAR(150),
    horario NVARCHAR(200)
);
GO
