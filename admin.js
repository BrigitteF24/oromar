// ============================================================
//   OroMar – admin.js | Panel administrativo conectado a Supabase
//   Requiere que en el HTML se carguen, en este orden:
//   1) SDK de Supabase  2) supabase.js  3) admin.js
// ============================================================

const SESSION_KEY = 'oromar_staff_session';

// ---------- PERMISOS POR ROL ----------
// El Administrador ve todo. "usuarios" es exclusivo del Administrador:
// ningún otro rol lo ve ni puede acceder a ese módulo.
const ROLE_MODULES = {
  Administrador: ['dashboard', 'reservas', 'pedidos', 'pagos', 'inventario', 'productos', 'mesas', 'clientes', 'comentarios', 'usuarios'],
  Cajero: ['dashboard', 'pedidos', 'pagos', 'mesas', 'clientes'],
  Mesero: ['dashboard', 'reservas', 'pedidos', 'mesas'],
  Cocinero: ['dashboard', 'pedidos', 'inventario']
};

function aplicarPermisosRol(nombreRol) {
  const permitidos = ROLE_MODULES[nombreRol] || ROLE_MODULES.Mesero;

  document.querySelectorAll('.nav-item[data-modulo]').forEach(item => {
    const modulo = item.dataset.modulo;
    item.style.display = permitidos.includes(modulo) ? '' : 'none';
  });

  // Si el módulo actualmente activo no está permitido para este rol,
  // se redirige al dashboard (que todos los roles pueden ver).
  const activo = document.querySelector('.module.active');
  if (activo && !permitidos.includes(activo.id.replace('mod-', ''))) {
    const primerItemVisible = document.querySelector('.nav-item[data-modulo="dashboard"]');
    showModule('dashboard', primerItemVisible);
  }
}

function obtenerBaseDatos() {
  if (!window.oromarDb) {
    throw new Error('No se encontró la conexión con Supabase. Revisa supabase.js y el orden de los scripts.');
  }
  return window.oromarDb;
}

function obtenerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function guardarSesion(usuario) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
}

function borrarSesion() {
  sessionStorage.removeItem(SESSION_KEY);
}

function money(n) {
  return 'S/. ' + Number(n || 0).toFixed(2);
}

// ---------- MODAL GENÉRICO ----------
function abrirModal(titulo, bodyHtml) {
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('active');
}

window.cerrarModal = function () {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('modalBody').innerHTML = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});

// Modal de confirmación (reemplaza a confirm()). Devuelve una Promise<boolean>.
function confirmarAccion(mensaje, tipo = 'warn') {
  return new Promise(resolve => {
    abrirModal('Confirmar acción', `
      <div class="confirm-icon ${tipo}">${tipo === 'danger' ? '🗑️' : '❓'}</div>
      <p class="confirm-text">${mensaje}</p>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" id="btnConfirmNo">Cancelar</button>
        <button type="button" class="btn-sm ${tipo === 'danger' ? 'btn-danger' : 'btn-primary'}" id="btnConfirmSi">Sí, continuar</button>
      </div>
    `);
    document.getElementById('btnConfirmNo').onclick = () => { cerrarModal(); resolve(false); };
    document.getElementById('btnConfirmSi').onclick = () => { cerrarModal(); resolve(true); };
  });
}

// ---------- NOTIFICACIONES (reemplaza a alert()) ----------
function mostrarToast(mensaje, tipo = 'success') {
  const cont = document.getElementById('toastContainer');
  if (!cont) { alert(mensaje); return; }
  const icono = tipo === 'error' ? '⚠️' : '✅';
  const el = document.createElement('div');
  el.className = `toast${tipo === 'error' ? ' error' : ''}`;
  el.innerHTML = `<span class="toast-icon">${icono}</span><span>${mensaje}</span>`;
  cont.appendChild(el);
  setTimeout(() => {
    el.classList.add('exit');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function fmtFecha(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE') + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function badgeEstado(estado) {
  const map = {
    Confirmada: 'green', Pendiente: 'yellow', Cancelada: 'red', Atendida: 'green',
    'En preparacion': 'yellow', Entregado: 'green', Nuevo: 'blue', Pagado: 'green',
    Disponible: 'green', Ocupada: 'red', Reservada: 'yellow',
    Activo: 'green', Inactivo: 'red', Respondido: 'green', Oculto: 'red'
  };
  const cls = map[estado] || 'blue';
  return `<span class="badge badge-${cls}">${estado}</span>`;
}

// ---------- LOGIN ----------
window.login = async function () {
  const usuario = document.getElementById('loginUser').value.trim();
  const clave = document.getElementById('loginPass').value;
  const boton = document.querySelector('.btn-login');

  if (!usuario || !clave) {
    mostrarToast('Ingresa tu usuario y contraseña.', 'error');
    return;
  }

  try {
    if (boton) { boton.disabled = true; boton.textContent = 'Ingresando...'; }

    const { data, error } = await obtenerBaseDatos().rpc('login_staff', {
      p_usuario: usuario,
      p_password: clave
    });

    if (error) throw error;

    if (!data) {
      mostrarToast('Usuario o contraseña incorrectos.', 'error');
      return;
    }

    guardarSesion(data);
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('adminWrap').style.display = 'flex';

    const avatar = document.querySelector('.user-avatar');
    const nombreEl = document.querySelector('.topbar-user span:last-child');
    if (avatar) avatar.textContent = (data.nombres || 'A').charAt(0).toUpperCase();
    if (nombreEl) nombreEl.textContent = `${data.nombres} (${data.nombre_rol})`;

    aplicarPermisosRol(data.nombre_rol);
    cargarDashboard();
    cargarNotificaciones();
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    mostrarToast('No se pudo iniciar sesión. Intenta nuevamente.', 'error');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Ingresar al sistema'; }
  }
};

window.logout = function () {
  borrarSesion();
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('adminWrap').style.display = 'none';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginWrap').style.display !== 'none') login();
});

// Restaura sesión si sigue vigente (misma pestaña)
(function restaurarSesion() {
  const sesion = obtenerSesion();
  if (sesion) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('adminWrap').style.display = 'flex';

    const avatar = document.querySelector('.user-avatar');
    const nombreEl = document.querySelector('.topbar-user span:last-child');
    if (avatar) avatar.textContent = (sesion.nombres || 'A').charAt(0).toUpperCase();
    if (nombreEl) nombreEl.textContent = `${sesion.nombres} (${sesion.nombre_rol})`;

    aplicarPermisosRol(sesion.nombre_rol);
    cargarDashboard();
    cargarNotificaciones();
  }
})();

// ---------- NOTIFICACIONES (campanita) ----------
window.toggleNotificaciones = function (e) {
  e.stopPropagation();
  const panel = document.getElementById('notiPanel');
  const abrir = !panel.classList.contains('active');
  panel.classList.toggle('active', abrir);
  if (abrir) cargarNotificaciones();
};

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notiWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notiPanel')?.classList.remove('active');
  }
});

window.irANotificacion = function (modulo) {
  const item = document.querySelector(`.nav-item[data-modulo="${modulo}"]`);
  if (item) showModule(modulo, item);
  document.getElementById('notiPanel')?.classList.remove('active');
};

async function cargarNotificaciones() {
  const lista = document.getElementById('notiLista');
  const badge = document.getElementById('notiBadge');
  try {
    const db = obtenerBaseDatos();
    const [{ data: reservas }, { data: pedidos }, { data: insumos }] = await Promise.all([
      db.rpc('listar_reservas').catch(() => ({ data: [] })),
      db.rpc('listar_pedidos').catch(() => ({ data: [] })),
      db.rpc('listar_insumos').catch(() => ({ data: [] }))
    ]);

    const notis = [];

    (reservas || []).filter(r => r.estado === 'Pendiente').forEach(r => {
      notis.push({
        icono: '📅',
        html: `Reserva pendiente de <b>${r.nombres} ${r.apellidos}</b> para ${r.fecha} a las ${r.hora}.`,
        modulo: 'reservas'
      });
    });

    (pedidos || []).filter(p => p.estado === 'Nuevo' || p.estado === 'En preparacion').forEach(p => {
      notis.push({
        icono: '🍽️',
        html: `Pedido <b>#${p.id_pedido}</b> (${p.mesas}) está "${p.estado}".`,
        modulo: 'pedidos'
      });
    });

    (insumos || []).filter(i => i.estado_stock === 'Urgente' || i.estado_stock === 'Bajo').forEach(i => {
      notis.push({
        icono: '⚠️',
        html: `Stock ${i.estado_stock.toLowerCase()} de <b>${i.nombre}</b> (${i.stock_actual} ${i.unidad_medida}).`,
        modulo: 'inventario'
      });
    });

    if (badge) {
      badge.textContent = notis.length;
      badge.classList.toggle('oculto', notis.length === 0);
    }

    if (lista) {
      lista.innerHTML = notis.length
        ? notis.slice(0, 20).map(n => `
          <div class="noti-item" onclick="irANotificacion('${n.modulo}')">
            <span class="noti-icon">${n.icono}</span>
            <span class="noti-texto">${n.html}</span>
          </div>`).join('')
        : '<div class="noti-vacio">No tienes notificaciones pendientes 🎉</div>';
    }
  } catch (err) {
    console.error('Error al cargar notificaciones:', err);
    if (lista) lista.innerHTML = '<div class="noti-vacio">No se pudieron cargar las notificaciones.</div>';
  }
}

// Refresca notificaciones periódicamente mientras la sesión esté activa
setInterval(() => {
  if (obtenerSesion()) cargarNotificaciones();
}, 60000);

// ---------- NAVEGACIÓN DE MÓDULOS ----------
window.showModule = function (id, el) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.getElementById('mod-' + id).classList.add('active');
  if (el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('topbarTitle').textContent = el.textContent.trim();
  }

  const cargadores = {
    dashboard: cargarDashboard,
    reservas: cargarReservas,
    pedidos: cargarPedidos,
    pagos: cargarPagos,
    inventario: cargarInventario,
    productos: cargarModuloProductos,
    mesas: cargarMesas,
    clientes: cargarClientes,
    comentarios: cargarComentarios,
    usuarios: cargarUsuarios
  };
  cargadores[id]?.();

  // En móvil/tablet, cerrar el menú lateral al elegir un módulo
  if (window.innerWidth <= 992) toggleSidebar(false);
};

// ---------- SIDEBAR RESPONSIVE (móvil/tablet) ----------
window.toggleSidebar = function (forceState) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;
  const abrir = typeof forceState === 'boolean' ? forceState : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', abrir);
  overlay.classList.toggle('open', abrir);
  document.body.classList.toggle('no-scroll', abrir);
};

window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) toggleSidebar(false);
});

// ---------- DASHBOARD ----------
async function cargarDashboard() {
  try {
    const db = obtenerBaseDatos();
    const [{ data: stats, error: e1 }, { data: pedidos, error: e2 }, { data: reservas, error: e3 }] = await Promise.all([
      db.rpc('obtener_dashboard'),
      db.rpc('listar_pedidos'),
      db.rpc('listar_reservas')
    ]);
    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;

    const cards = document.querySelectorAll('#mod-dashboard .stat-card .val');
    if (cards[0]) cards[0].textContent = stats.reservas_hoy;
    if (cards[1]) cards[1].textContent = stats.pedidos_activos;
    if (cards[2]) cards[2].textContent = money(stats.ingresos_hoy);
    if (cards[3]) cards[3].textContent = `${stats.mesas_ocupadas}/${stats.total_mesas}`;

    const tbodyPedidos = document.getElementById('dashPedidosBody');
    if (tbodyPedidos) {
      tbodyPedidos.innerHTML = (pedidos || []).slice(0, 5).map(p => `
        <tr>
          <td>#${p.id_pedido}</td>
          <td>${p.mesas}</td>
          <td>${p.platos || '-'}</td>
          <td>${badgeEstado(p.estado)}</td>
          <td>${money(p.total)}</td>
        </tr>`).join('') || '<tr><td colspan="5">Sin pedidos aún</td></tr>';
    }

    const tbodyReservas = document.getElementById('dashReservasBody');
    if (tbodyReservas) {
      tbodyReservas.innerHTML = (reservas || []).slice(0, 5).map(r => `
        <tr>
          <td>${r.nombres} ${r.apellidos}</td>
          <td>${r.fecha}</td>
          <td>${r.hora}</td>
          <td>${r.cantidad_personas}</td>
          <td>${badgeEstado(r.estado)}</td>
        </tr>`).join('') || '<tr><td colspan="5">Sin reservas próximas</td></tr>';
    }
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
  }
}

// ---------- RESERVAS ----------
let reservasCache = [];

async function cargarReservas() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_reservas');
    if (error) throw error;

    reservasCache = data || [];

    document.getElementById('reservasBody').innerHTML = reservasCache.map(r => `
      <tr>
        <td>#R${String(r.id_reserva).padStart(3, '0')}</td>
        <td>${r.nombres} ${r.apellidos}</td>
        <td>${r.telefono}</td>
        <td>${r.fecha}</td>
        <td>${r.hora}</td>
        <td>${r.cantidad_personas}</td>
        <td>${r.mesas}</td>
        <td>${badgeEstado(r.estado)}</td>
        <td>
          ${r.estado === 'Pendiente' ? `<button class="btn-sm btn-success" onclick="confirmarReserva(${r.id_reserva})">Confirmar</button>` : ''}
          ${r.estado !== 'Cancelada' ? `<button class="btn-sm btn-danger" onclick="cancelarReserva(${r.id_reserva})">Cancelar</button>` : ''}
          <button class="btn-sm btn-secondary" onclick="editarReserva(${r.id_reserva})">Editar</button>
          <button class="btn-sm btn-danger" onclick="eliminarReserva(${r.id_reserva})">Eliminar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="9">No hay reservas registradas</td></tr>';
  } catch (err) {
    console.error('Error al cargar reservas:', err);
  }
}

window.confirmarReserva = async function (id) {
  try {
    const { error } = await obtenerBaseDatos().rpc('actualizar_estado_reserva', { p_id_reserva: id, p_estado: 'Confirmada' });
    if (error) throw error;
    cargarReservas();
    mostrarToast('Reserva confirmada.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo confirmar la reserva.', 'error');
  }
};

window.cancelarReserva = function (id) {
  abrirModal('🚫 Cancelar reserva', `
    <form id="formCancelarReserva">
      <p class="confirm-text" style="margin-bottom:12px">Por favor indica el motivo de la cancelación antes de continuar.</p>
      <div class="form-group">
        <label>Motivo de cancelación *</label>
        <textarea id="crMotivo" required placeholder="Ej: el cliente llamó a cancelar, no llegó a la hora acordada..." autofocus></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">No, volver</button>
        <button type="submit" class="btn-sm btn-danger">Sí, cancelar reserva</button>
      </div>
    </form>
  `);

  document.getElementById('formCancelarReserva').addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = document.getElementById('crMotivo').value.trim();
    try {
      const { error } = await obtenerBaseDatos().rpc('cancelar_reserva', { p_id_reserva: id, p_motivo: motivo });
      if (error) throw error;
      cerrarModal();
      cargarReservas();
      mostrarToast('Reserva cancelada.');
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo cancelar la reserva.', 'error');
    }
  });
};

async function obtenerOpcionesMesaReserva(idMesaSeleccionada) {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_mesas');
    if (error) throw error;
    const mesas = data || [];
    const opciones = mesas.map(m => {
      const ocupable = m.estado === 'Disponible' || m.id_mesa === idMesaSeleccionada;
      const etiqueta = m.id_mesa === idMesaSeleccionada ? '' : (m.estado !== 'Disponible' ? ` (${m.estado})` : '');
      return `<option value="${m.id_mesa}" ${m.id_mesa === idMesaSeleccionada ? 'selected' : ''} ${!ocupable ? 'disabled' : ''}>Mesa ${m.numero}${etiqueta}</option>`;
    }).join('');
    return `<option value="">Sin asignar</option>${opciones}`;
  } catch (err) {
    console.error('Error al cargar mesas para la reserva:', err);
    return '<option value="">Sin asignar</option>';
  }
}

window.addReserva = async function () {
  const opcionesMesa = await obtenerOpcionesMesaReserva(null);

  abrirModal('📅 Nueva reserva', `
    <form id="formReserva">
      <div class="form-row">
        <div class="form-group"><label>Nombres *</label><input type="text" id="rNombres" required autofocus></div>
        <div class="form-group"><label>Apellidos</label><input type="text" id="rApellidos"></div>
      </div>
      <div class="form-group"><label>Teléfono *</label><input type="tel" id="rTelefono" placeholder="9xx xxx xxx" required></div>
      <div class="form-row">
        <div class="form-group"><label>Fecha *</label><input type="date" id="rFecha" required></div>
        <div class="form-group"><label>Hora *</label><input type="time" id="rHora" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Cantidad de personas *</label><input type="number" id="rPersonas" min="1" max="20" value="2" required></div>
        <div class="form-group"><label>Mesa (opcional)</label><select id="rMesa">${opcionesMesa}</select></div>
      </div>
      <div class="form-group"><label>Observación (opcional)</label><textarea id="rObservacion" placeholder="Ej: mesa cerca a la ventana, cumpleaños..."></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Registrar reserva</button>
      </div>
    </form>
  `);

  document.getElementById('formReserva').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombres = document.getElementById('rNombres').value.trim();
    const apellidos = document.getElementById('rApellidos').value.trim() || 'No indicado';
    const telefono = document.getElementById('rTelefono').value.trim();
    const fecha = document.getElementById('rFecha').value;
    const hora = document.getElementById('rHora').value;
    const personas = Number(document.getElementById('rPersonas').value);
    const observacion = document.getElementById('rObservacion').value.trim() || null;
    const idMesaVal = document.getElementById('rMesa').value;
    const idMesa = idMesaVal ? Number(idMesaVal) : null;

    try {
      const { error } = await obtenerBaseDatos().rpc('crear_reserva_admin', {
        p_nombres: nombres, p_apellidos: apellidos, p_telefono: telefono,
        p_correo: null, p_fecha: fecha, p_hora: hora,
        p_cantidad_personas: personas, p_observacion: observacion, p_id_mesa: idMesa
      });
      if (error) throw error;
      cerrarModal();
      mostrarToast('¡Reserva registrada correctamente! 🎉');
      cargarReservas();
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo registrar la reserva. Verifica los datos.', 'error');
    }
  });
};

window.editarReserva = async function (id) {
  const r = reservasCache.find(x => x.id_reserva === id);
  if (!r) return;

  const opcionesMesa = await obtenerOpcionesMesaReserva(r.id_mesa || null);

  abrirModal('✏️ Editar reserva', `
    <form id="formEditarReserva">
      <div class="form-group"><label>Cliente</label><input type="text" value="${r.nombres} ${r.apellidos}" disabled></div>
      <div class="form-row">
        <div class="form-group"><label>Fecha *</label><input type="date" id="eFecha" value="${r.fecha}" required></div>
        <div class="form-group"><label>Hora *</label><input type="time" id="eHora" value="${r.hora}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Cantidad de personas *</label><input type="number" id="ePersonas" min="1" max="20" value="${r.cantidad_personas}" required></div>
        <div class="form-group"><label>Mesa (opcional)</label><select id="eMesa">${opcionesMesa}</select></div>
      </div>
      <div class="form-group"><label>Observación (opcional)</label><textarea id="eObservacion">${r.observacion || ''}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('formEditarReserva').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = document.getElementById('eFecha').value;
    const hora = document.getElementById('eHora').value;
    const personas = Number(document.getElementById('ePersonas').value);
    const observacion = document.getElementById('eObservacion').value.trim() || null;
    const idMesaVal = document.getElementById('eMesa').value;
    const idMesa = idMesaVal ? Number(idMesaVal) : null;

    try {
      const { error } = await obtenerBaseDatos().rpc('editar_reserva', {
        p_id_reserva: id, p_fecha: fecha, p_hora: hora,
        p_cantidad_personas: personas, p_observacion: observacion, p_id_mesa: idMesa
      });
      if (error) throw error;
      cerrarModal();
      mostrarToast('Reserva actualizada correctamente.');
      cargarReservas();
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo actualizar la reserva.', 'error');
    }
  });
};

window.eliminarReserva = async function (id) {
  const ok = await confirmarAccion('¿Seguro que deseas eliminar esta reserva? Esta acción no se puede deshacer.', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_reserva', { p_id_reserva: id });
    if (error) throw error;
    await cargarReservas();
    mostrarToast('Reserva eliminada.');
  } catch (err) {
    console.error('Error al eliminar reserva:', err);
    mostrarToast('No se pudo eliminar la reserva' + (err?.message ? `: ${err.message}` : '.'), 'error');
  }
};

// ---------- PEDIDOS ----------
let pedidosCache = [];

async function cargarPedidos() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_pedidos');
    if (error) throw error;

    pedidosCache = data || [];

    const tbody = document.getElementById('pedidosBody');
    tbody.innerHTML = pedidosCache.map(p => `
      <tr>
        <td>#${p.id_pedido}</td>
        <td>${p.mesas}</td>
        <td>${p.mesero}</td>
        <td>${p.platos || '-'}</td>
        <td>${badgeEstado(p.estado)}</td>
        <td>${money(p.total)}</td>
        <td>${accionPedido(p)}</td>
      </tr>`).join('') || '<tr><td colspan="7">No hay pedidos en curso</td></tr>';
  } catch (err) {
    console.error('Error al cargar pedidos:', err);
  }
}

function accionPedido(p) {
  let acciones = '';
  if (p.estado === 'Pendiente') acciones += `<button class="btn-sm btn-success" onclick="avanzarPedido(${p.id_pedido},'En preparacion')">Preparar</button> `;
  else if (p.estado === 'En preparacion') acciones += `<button class="btn-sm btn-success" onclick="avanzarPedido(${p.id_pedido},'Atendido')">Listo</button> `;
  else if (p.estado === 'Atendido') acciones += `<button class="btn-sm btn-primary" onclick="cobrarPedido(${p.id_pedido},${p.total})">Cobrar</button> `;
  acciones += `<button class="btn-sm btn-secondary" onclick="actualizarEstadoPedidoManual(${p.id_pedido})">Actualizar estado</button> `;
  acciones += `<button class="btn-sm btn-secondary" onclick="editarPedido(${p.id_pedido})">Editar</button> `;
  acciones += `<button class="btn-sm btn-danger" onclick="cancelarPedido(${p.id_pedido})">Cancelar</button> `;
  acciones += `<button class="btn-sm btn-danger" onclick="eliminarPedido(${p.id_pedido})">Eliminar</button>`;
  return acciones;
}

// Permite fijar manualmente cualquier estado válido del pedido,
// además de los botones rápidos (Preparar/Listo/Cobrar) de arriba.
window.actualizarEstadoPedidoManual = function (id) {
  const p = pedidosCache.find(x => x.id_pedido === id);
  if (!p) return;

  const estados = ['Pendiente', 'En preparacion', 'Atendido', 'Cancelado'];
  const etiqueta = { 'Pendiente': 'Pendiente', 'En preparacion': 'En preparación', 'Atendido': 'Atendido', 'Cancelado': 'Cancelado' };
  const opciones = estados.map(es => `<option value="${es}" ${es === p.estado ? 'selected' : ''}>${etiqueta[es]}</option>`).join('');

  abrirModal('🔄 Actualizar estado del pedido', `
    <div class="modal-readonly">Pedido #${p.id_pedido} — ${p.mesas} — ${money(p.total)}</div>
    <form id="formEstadoPedido">
      <div class="form-group">
        <label>Nuevo estado *</label>
        <select id="uepEstado" required>${opciones}</select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Actualizar</button>
      </div>
    </form>
  `);

  document.getElementById('formEstadoPedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoEstado = document.getElementById('uepEstado').value;
    try {
      const { error } = await obtenerBaseDatos().rpc('actualizar_estado_pedido', { p_id_pedido: id, p_estado: nuevoEstado });
      if (error) throw error;
      cerrarModal();
      cargarPedidos();
      mostrarToast(`Pedido #${id} → ${etiqueta[nuevoEstado]}`);
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo actualizar el estado del pedido.', 'error');
    }
  });
};

window.avanzarPedido = async function (id, estado) {
  try {
    const { error } = await obtenerBaseDatos().rpc('actualizar_estado_pedido', { p_id_pedido: id, p_estado: estado });
    if (error) throw error;
    cargarPedidos();
    mostrarToast('Pedido actualizado.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo actualizar el pedido.', 'error');
  }
};

window.cobrarPedido = function (id, monto) {
  abrirModal('💳 Cobrar pedido', `
    <div class="modal-readonly">Total a cobrar: ${money(monto)}</div>
    <form id="formCobro">
      <div class="form-group">
        <label>Método de pago *</label>
        <select id="cMetodo" required>
          <option value="Efectivo">Efectivo</option>
          <option value="Yape">Yape</option>
          <option value="Plin">Plin</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Transferencia">Transferencia</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Confirmar cobro</button>
      </div>
    </form>
  `);

  document.getElementById('formCobro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const metodo = document.getElementById('cMetodo').value;
    try {
      const { error } = await obtenerBaseDatos().rpc('registrar_pago', {
        p_id_pedido: id, p_monto: Number(monto), p_metodo: metodo
      });
      if (error) throw error;
      cerrarModal();
      cargarPedidos();
      mostrarToast(`Pago de ${money(monto)} registrado correctamente 🎉`);
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo registrar el pago.', 'error');
    }
  });
};

window.cancelarPedido = async function (id) {
  const ok = await confirmarAccion('¿Seguro que deseas cancelar este pedido?', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('actualizar_estado_pedido', { p_id_pedido: id, p_estado: 'Cancelado' });
    if (error) throw error;
    cargarPedidos();
    mostrarToast('Pedido cancelado.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo cancelar el pedido.', 'error');
  }
};

window.eliminarPedido = async function (id) {
  const ok = await confirmarAccion('¿Seguro que deseas eliminar este pedido? Esta acción no se puede deshacer.', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_pedido', { p_id_pedido: id });
    if (error) throw error;
    cargarPedidos();
    mostrarToast('Pedido eliminado.');
  } catch (err) {
    console.error(err);
    mostrarToast(err?.message || 'No se pudo eliminar el pedido.', 'error');
  }
};

// -- Mini formulario de platos (reutilizado por Nuevo pedido y Editar) --
let pPlatosCatalogo = [];
let pFilaContador = 0;

function filaPlatoHtml(idSeleccionado, cantidad) {
  const n = pFilaContador++;
  const opciones = pPlatosCatalogo.map(pr =>
    `<option value="${pr.id_producto}" data-precio="${pr.precio}" ${pr.id_producto === idSeleccionado ? 'selected' : ''}>${pr.nombre} — S/.${Number(pr.precio).toFixed(2)}</option>`
  ).join('');
  return `
    <div class="form-row plato-row" data-fila="${n}" style="align-items:flex-end">
      <div class="form-group" style="flex:3">
        <label>Plato</label>
        <select class="pProductoSel" onchange="recalcularTotalPedido()">${opciones}</select>
      </div>
      <div class="form-group" style="flex:1">
        <label>Cant.</label>
        <input type="number" class="pCantidadInp" min="1" value="${cantidad || 1}" oninput="recalcularTotalPedido()">
      </div>
      <button type="button" class="btn-sm btn-danger" onclick="quitarFilaPlato(this)">✕</button>
    </div>`;
}

window.agregarFilaPlato = function () {
  document.getElementById('pPlatosRows').insertAdjacentHTML('beforeend', filaPlatoHtml());
  recalcularTotalPedido();
};

window.quitarFilaPlato = function (btn) {
  const filas = document.querySelectorAll('#pPlatosRows .plato-row');
  if (filas.length <= 1) {
    mostrarToast('El pedido debe tener al menos un plato.', 'error');
    return;
  }
  btn.closest('.plato-row').remove();
  recalcularTotalPedido();
};

function leerFilasPlatos() {
  return Array.from(document.querySelectorAll('#pPlatosRows .plato-row')).map(fila => {
    const sel = fila.querySelector('.pProductoSel');
    const cant = Number(fila.querySelector('.pCantidadInp').value);
    return {
      id_producto: Number(sel.value),
      cantidad: cant,
      precio: Number(sel.selectedOptions[0]?.dataset.precio || 0)
    };
  }).filter(p => p.id_producto && p.cantidad > 0);
}

window.recalcularTotalPedido = function () {
  const total = leerFilasPlatos().reduce((sum, p) => sum + p.precio * p.cantidad, 0);
  const el = document.getElementById('pTotalPreview');
  if (el) el.textContent = money(total);
};

async function cargarCatalogoPedido() {
  const [{ data: usuarios }, { data: mesas }, { data: productos }] = await Promise.all([
    obtenerBaseDatos().rpc('listar_usuarios'),
    obtenerBaseDatos().rpc('listar_mesas'),
    obtenerBaseDatos().rpc('listar_productos')
  ]);
  return {
    usuarios: (usuarios || []).filter(u => u.estado === 'Activo'),
    mesas: mesas || [],
    productos: productos || []
  };
}

window.addPedido = async function () {
  let catalogo;
  try {
    catalogo = await cargarCatalogoPedido();
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo cargar meseros, mesas o platos.', 'error');
    return;
  }
  if (!catalogo.productos.length) {
    mostrarToast('No hay platos activos en la carta para agregar a un pedido.', 'error');
    return;
  }
  if (!catalogo.mesas.length) {
    mostrarToast('No hay mesas registradas. Revisa el módulo Mesas.', 'error');
    return;
  }

  pPlatosCatalogo = catalogo.productos;
  pFilaContador = 0;

  const opcionesMesero = catalogo.usuarios.map(u => `<option value="${u.id_usuario}">${u.nombres} ${u.apellidos}</option>`).join('');
  const opcionesMesa = catalogo.mesas.map(m => `<option value="${m.id_mesa}">Mesa ${m.numero}</option>`).join('');

  abrirModal('🍽️ Nuevo pedido', `
    <form id="formPedido">
      <div class="form-row">
        <div class="form-group"><label>Mesero *</label><select id="pMesero" required>${opcionesMesero}</select></div>
        <div class="form-group"><label>Mesa *</label><select id="pMesa" required>${opcionesMesa}</select></div>
      </div>
      <div class="form-group">
        <label>Estado inicial</label>
        <select id="pEstado">
          <option value="Pendiente">Pendiente</option>
          <option value="En preparacion">En preparación</option>
          <option value="Atendido">Atendido</option>
        </select>
      </div>
      <div class="form-group">
        <label>Platos *</label>
        <div id="pPlatosRows">${filaPlatoHtml()}</div>
        <button type="button" class="btn-sm btn-secondary" onclick="agregarFilaPlato()" style="margin-top:8px">+ Agregar plato</button>
      </div>
      <div class="modal-readonly">Total estimado: <strong id="pTotalPreview">S/.0.00</strong></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Registrar pedido</button>
      </div>
    </form>
  `);
  recalcularTotalPedido();

  document.getElementById('formPedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idUsuario = Number(document.getElementById('pMesero').value);
    const idMesaVal = document.getElementById('pMesa').value;
    const idMesa = idMesaVal ? Number(idMesaVal) : null;
    const estado = document.getElementById('pEstado').value;
    const platos = leerFilasPlatos().map(p => ({ id_producto: p.id_producto, cantidad: p.cantidad }));

    if (!platos.length) {
      mostrarToast('Agrega al menos un plato al pedido.', 'error');
      return;
    }

    try {
      const { error } = await obtenerBaseDatos().rpc('crear_pedido_admin', {
        p_id_usuario: idUsuario, p_id_mesa: idMesa, p_estado: estado, p_platos: platos
      });
      if (error) throw error;
      cerrarModal();
      mostrarToast('¡Pedido registrado correctamente! 🎉');
      cargarPedidos();
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo registrar el pedido.', 'error');
    }
  });
};

window.editarPedido = async function (id) {
  const p = pedidosCache.find(x => x.id_pedido === id);
  if (!p) return;

  let catalogo;
  try {
    catalogo = await cargarCatalogoPedido();
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo cargar meseros o mesas.', 'error');
    return;
  }

  const opcionesMesero = catalogo.usuarios.map(u =>
    `<option value="${u.id_usuario}" ${u.id_usuario === p.id_usuario ? 'selected' : ''}>${u.nombres} ${u.apellidos}</option>`).join('');
  const opcionesMesa = catalogo.mesas.map(m =>
    `<option value="${m.id_mesa}" ${m.id_mesa === p.id_mesa ? 'selected' : ''}>Mesa ${m.numero}</option>`).join('');
  const estados = ['Pendiente', 'En preparacion', 'Atendido'];
  const opcionesEstado = estados.map(es => `<option value="${es}" ${es === p.estado ? 'selected' : ''}>${es === 'En preparacion' ? 'En preparación' : es}</option>`).join('');

  abrirModal('✏️ Editar pedido', `
    <div class="modal-readonly">Platos: ${p.platos || '-'} — Total: ${money(p.total)}</div>
    <form id="formEditarPedido">
      <div class="form-row">
        <div class="form-group"><label>Mesero *</label><select id="epMesero" required>${opcionesMesero}</select></div>
        <div class="form-group"><label>Mesa *</label><select id="epMesa" required>${opcionesMesa}</select></div>
      </div>
      <div class="form-group"><label>Estado</label><select id="epEstado">${opcionesEstado}</select></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('formEditarPedido').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idUsuario = Number(document.getElementById('epMesero').value);
    const idMesaVal = document.getElementById('epMesa').value;
    const idMesa = idMesaVal ? Number(idMesaVal) : null;
    const estado = document.getElementById('epEstado').value;

    try {
      const { error } = await obtenerBaseDatos().rpc('editar_pedido_admin', {
        p_id_pedido: id, p_id_usuario: idUsuario, p_id_mesa: idMesa, p_estado: estado
      });
      if (error) throw error;
      cerrarModal();
      mostrarToast('Pedido actualizado.');
      cargarPedidos();
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo actualizar el pedido.', 'error');
    }
  });
};

// ---------- PAGOS ----------
async function cargarPagos() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_pagos');
    if (error) throw error;

    const tbody = document.querySelector('#mod-pagos tbody');
    tbody.innerHTML = (data || []).map(p => `
      <tr>
        <td>#P${String(p.id_pago).padStart(3, '0')}</td>
        <td>#${p.id_pedido}</td>
        <td>${money(p.monto)}</td>
        <td>${p.metodo_pago}</td>
        <td>${p.serie ? p.serie + '-' + p.numero : '-'}</td>
        <td>${fmtFecha(p.fecha)}</td>
      </tr>`).join('') || '<tr><td colspan="6">Sin pagos registrados</td></tr>';

    const totales = { Efectivo: 0, Tarjeta: 0, YapePlin: 0, Total: 0 };
    (data || []).forEach(p => {
      const m = Number(p.monto);
      totales.Total += m;
      if (p.metodo_pago === 'Efectivo') totales.Efectivo += m;
      else if (p.metodo_pago === 'Tarjeta') totales.Tarjeta += m;
      else if (p.metodo_pago === 'Yape' || p.metodo_pago === 'Plin') totales.YapePlin += m;
    });
    const vals = document.querySelectorAll('#mod-pagos .stats-grid .val');
    if (vals[0]) vals[0].textContent = money(totales.Efectivo);
    if (vals[1]) vals[1].textContent = money(totales.Tarjeta);
    if (vals[2]) vals[2].textContent = money(totales.YapePlin);
    if (vals[3]) vals[3].textContent = money(totales.Total);
  } catch (err) {
    console.error('Error al cargar pagos:', err);
  }
}

window.addPago = async function () {
  let pedidos;
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_pedidos_pendientes_pago');
    if (error) throw error;
    pedidos = data || [];
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudieron cargar los pedidos pendientes de pago.', 'error');
    return;
  }

  if (!pedidos.length) {
    mostrarToast('No hay pedidos pendientes de pago en este momento.', 'error');
    return;
  }

  const opciones = pedidos.map(p => `<option value="${p.id_pedido}" data-monto="${p.total}">#${p.id_pedido} — ${p.mesas} — ${money(p.total)}</option>`).join('');

  abrirModal('💳 Agregar pago', `
    <form id="formAgregarPago">
      <div class="form-group">
        <label>Pedido *</label>
        <select id="apPedido" required onchange="document.getElementById('apMonto').value = this.selectedOptions[0].dataset.monto">${opciones}</select>
      </div>
      <div class="form-group">
        <label>Monto (S/.) *</label>
        <input type="number" id="apMonto" step="0.10" min="0.10" value="${pedidos[0].total}" required>
      </div>
      <div class="form-group">
        <label>Método de pago *</label>
        <select id="apMetodo" required>
          <option value="Efectivo">Efectivo</option>
          <option value="Yape">Yape</option>
          <option value="Plin">Plin</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Transferencia">Transferencia</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Registrar pago</button>
      </div>
    </form>
  `);

  document.getElementById('formAgregarPago').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idPedido = Number(document.getElementById('apPedido').value);
    const monto = Number(document.getElementById('apMonto').value);
    const metodo = document.getElementById('apMetodo').value;

    try {
      const { error } = await obtenerBaseDatos().rpc('registrar_pago', {
        p_id_pedido: idPedido, p_monto: monto, p_metodo: metodo
      });
      if (error) throw error;
      cerrarModal();
      cargarPagos();
      mostrarToast(`Pago de ${money(monto)} registrado correctamente 🎉`);
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo registrar el pago.', 'error');
    }
  });
};

// ---------- INVENTARIO ----------
function esAdministrador() {
  return obtenerSesion()?.nombre_rol === 'Administrador';
}

async function cargarInventario() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_insumos');
    if (error) throw error;

    const esAdmin = esAdministrador();
    const btnNuevo = document.getElementById('btnNuevoInsumo');
    if (btnNuevo) btnNuevo.style.display = esAdmin ? '' : 'none';

    const tbody = document.getElementById('insumosBody');
    tbody.innerHTML = (data || []).map(i => `
      <tr>
        <td>${i.nombre}</td>
        <td>${i.unidad_medida}</td>
        <td>${i.stock_actual}</td>
        <td>${i.stock_minimo}</td>
        <td>${i.estado_stock === 'OK' ? badgeEstado('Activo').replace('Activo', 'OK') : `<span class="badge badge-${i.estado_stock === 'Urgente' ? 'red' : 'yellow'}">${i.estado_stock === 'Urgente' ? '⚠ Urgente' : 'Bajo'}</span>`}</td>
        <td>${esAdmin
        ? `<button class="btn-sm btn-primary" onclick="editarInsumo(${i.id_insumo})">Editar</button> <button class="btn-sm btn-danger" onclick="eliminarInsumo(${i.id_insumo})">Eliminar</button>`
        : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="6">Sin insumos registrados. Usa «+ Nuevo insumo» para comenzar.</td></tr>';

    window._insumosCache = data || [];
  } catch (err) {
    console.error('Error al cargar inventario:', err);
  }
}

window.addInsumo = function () {
  const insumos = window._insumosCache || [];
  if (!insumos.length) { mostrarToast('Primero registra un insumo con el botón "+ Nuevo insumo".', 'error'); return; }

  const opciones = insumos.map(i => `<option value="${i.id_insumo}">${i.nombre} (stock: ${i.stock_actual} ${i.unidad_medida})</option>`).join('');

  abrirModal('🔄 Registrar movimiento de inventario', `
    <form id="formInsumo">
      <div class="form-group">
        <label>Insumo *</label>
        <select id="iInsumo" required>${opciones}</select>
      </div>
      <div class="form-group">
        <label>Tipo de movimiento *</label>
        <select id="iTipo" required>
          <option value="Entrada">Entrada (compra/ingreso)</option>
          <option value="Salida">Salida (consumo/merma)</option>
          <option value="Ajuste">Ajuste (dejar el stock en un valor exacto)</option>
        </select>
      </div>
      <div class="form-group"><label>Cantidad *</label><input type="number" id="iCantidad" step="0.01" min="0.01" required></div>
      <div class="form-group"><label>Observación (opcional)</label><textarea id="iObservacion" placeholder="Ej: compra al proveedor, merma..."></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Registrar movimiento</button>
      </div>
    </form>
  `);

  document.getElementById('formInsumo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInsumo = Number(document.getElementById('iInsumo').value);
    const tipo = document.getElementById('iTipo').value;
    const cantidad = Number(document.getElementById('iCantidad').value);
    const observacion = document.getElementById('iObservacion').value.trim() || '';
    const sesion = obtenerSesion();

    try {
      const { error } = await obtenerBaseDatos().rpc('registrar_movimiento_inventario', {
        p_id_insumo: idInsumo, p_tipo: tipo, p_cantidad: cantidad,
        p_observacion: observacion, p_id_usuario: sesion?.id_usuario
      });
      if (error) throw error;
      cerrarModal();
      cargarInventario();
      mostrarToast('Movimiento de inventario registrado.');
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo registrar el movimiento.', 'error');
    }
  });
};

window.addInsumoNuevo = function () {
  abrirModal('🆕 Nuevo insumo', `
    <form id="formInsumoNuevo">
      <div class="form-group"><label>Nombre *</label><input type="text" id="niNombre" required autofocus placeholder="Ej: Corvina fresca"></div>
      <div class="form-row">
        <div class="form-group"><label>Unidad de medida *</label><input type="text" id="niUnidad" required placeholder="kg, lt, unidad..."></div>
        <div class="form-group"><label>Stock inicial *</label><input type="number" id="niStockActual" step="0.01" min="0" value="0" required></div>
      </div>
      <div class="form-group"><label>Stock mínimo (para alertas) *</label><input type="number" id="niStockMinimo" step="0.01" min="0" required></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar insumo</button>
      </div>
    </form>
  `);

  document.getElementById('formInsumoNuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('niNombre').value.trim();
    const unidad = document.getElementById('niUnidad').value.trim();
    const stockActual = Number(document.getElementById('niStockActual').value);
    const stockMinimo = Number(document.getElementById('niStockMinimo').value);
    const sesion = obtenerSesion();

    try {
      const { error } = await obtenerBaseDatos().rpc('crear_insumo', {
        p_nombre: nombre, p_unidad_medida: unidad, p_stock_actual: stockActual,
        p_stock_minimo: stockMinimo, p_id_usuario: sesion?.id_usuario
      });
      if (error) throw error;
      cerrarModal();
      cargarInventario();
      mostrarToast('¡Insumo agregado al inventario! 🎉');
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo registrar el insumo.', 'error');
    }
  });
};

window.editarInsumo = function (id) {
  const insumo = (window._insumosCache || []).find(i => i.id_insumo === id);
  if (!insumo) return;

  abrirModal('✏️ Editar insumo', `
    <form id="formEditarInsumo">
      <div class="form-group"><label>Nombre *</label><input type="text" id="eiNombre" value="${insumo.nombre}" required autofocus></div>
      <div class="form-row">
        <div class="form-group"><label>Unidad de medida *</label><input type="text" id="eiUnidad" value="${insumo.unidad_medida}" required></div>
        <div class="form-group"><label>Stock mínimo *</label><input type="number" id="eiStockMinimo" step="0.01" min="0" value="${insumo.stock_minimo}" required></div>
      </div>
      <p class="card-hint">Para cambiar el stock actual usa «Registrar movimiento» (Entrada, Salida o Ajuste); así el historial de inventario queda correcto.</p>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('formEditarInsumo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('eiNombre').value.trim();
    const unidad = document.getElementById('eiUnidad').value.trim();
    const stockMinimo = Number(document.getElementById('eiStockMinimo').value);

    try {
      const { error } = await obtenerBaseDatos().rpc('editar_insumo', {
        p_id_insumo: id, p_nombre: nombre, p_unidad_medida: unidad, p_stock_minimo: stockMinimo
      });
      if (error) throw error;
      cerrarModal();
      cargarInventario();
      mostrarToast('Insumo actualizado.');
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo actualizar el insumo.', 'error');
    }
  });
};

window.eliminarInsumo = async function (id) {
  const ok = await confirmarAccion('¿Eliminar este insumo del inventario? Esta acción no se puede deshacer.', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_insumo', { p_id_insumo: id });
    if (error) throw error;
    cargarInventario();
    mostrarToast('Insumo eliminado.');
  } catch (err) {
    console.error(err);
    mostrarToast(err?.message || 'No se pudo eliminar el insumo.', 'error');
  }
};

// ---------- PRODUCTOS Y CATEGORÍAS ----------
async function cargarModuloProductos() {
  await cargarCategorias();
  await cargarProductos();
}

async function cargarCategorias() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_categorias_admin');
    if (error) throw error;

    const tbody = document.getElementById('categoriasBody');
    tbody.innerHTML = (data || []).map(c => `
      <tr>
        <td>${c.nombre_categoria}</td>
        <td>${c.cantidad_productos}</td>
        <td>
          <button class="btn-sm btn-primary" onclick="editarCategoria(${c.id_categoria})">Editar</button>
          <button class="btn-sm btn-danger" onclick="eliminarCategoria(${c.id_categoria})">Eliminar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="3">Sin categorías todavía. Usa «+ Nueva categoría» para comenzar.</td></tr>';

    window._categoriasCache = data || [];
  } catch (err) {
    console.error('Error al cargar categorías:', err);
  }
}

window.addCategoria = function () {
  abrirModal('🏷️ Nueva categoría', `
    <form id="formCategoria">
      <div class="form-group"><label>Nombre de la categoría *</label><input type="text" id="catNombre" required autofocus placeholder="Ej: Mariscos, Carnes, Bebidas, Postres..."></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar categoría</button>
      </div>
    </form>
  `);

  document.getElementById('formCategoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('catNombre').value.trim();
    try {
      const { error } = await obtenerBaseDatos().rpc('crear_categoria', { p_nombre: nombre });
      if (error) throw error;
      cerrarModal();
      cargarCategorias();
      mostrarToast('¡Categoría creada! 🎉');
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo crear la categoría.', 'error');
    }
  });
};

window.editarCategoria = function (id) {
  const cat = (window._categoriasCache || []).find(c => c.id_categoria === id);
  if (!cat) return;

  abrirModal('✏️ Editar categoría', `
    <form id="formEditarCategoria">
      <div class="form-group"><label>Nombre de la categoría *</label><input type="text" id="ecNombre" value="${cat.nombre_categoria}" required autofocus></div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('formEditarCategoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('ecNombre').value.trim();
    try {
      const { error } = await obtenerBaseDatos().rpc('editar_categoria', { p_id_categoria: id, p_nombre: nombre });
      if (error) throw error;
      cerrarModal();
      cargarCategorias();
      cargarProductos();
      mostrarToast('Categoría actualizada.');
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo actualizar la categoría.', 'error');
    }
  });
};

window.eliminarCategoria = async function (id) {
  const ok = await confirmarAccion('¿Eliminar esta categoría? Solo se puede eliminar si no tiene productos activos asociados.', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_categoria', { p_id_categoria: id });
    if (error) throw error;
    cargarCategorias();
    mostrarToast('Categoría eliminada.');
  } catch (err) {
    console.error(err);
    mostrarToast(err?.message || 'No se pudo eliminar la categoría.', 'error');
  }
};

async function cargarProductos() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_productos');
    if (error) throw error;

    const tbody = document.getElementById('productosBody');
    tbody.innerHTML = (data || []).map(p => `
      <tr>
        <td>#${p.id_producto}</td>
        <td>${p.nombre}</td>
        <td>${p.nombre_categoria}</td>
        <td>S/.${Number(p.precio).toFixed(2)}</td>
        <td>${p.descripcion || '-'}</td>
        <td><button class="btn-sm btn-danger" onclick="eliminarProducto(${p.id_producto})">Eliminar</button></td>
      </tr>`).join('') || '<tr><td colspan="6">Sin productos en la carta</td></tr>';
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
}

window.eliminarProducto = async function (id) {
  const ok = await confirmarAccion('¿Quitar este producto de la carta?', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_producto', { p_id_producto: id });
    if (error) throw error;
    cargarProductos();
    mostrarToast('Producto retirado de la carta.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo eliminar el producto.', 'error');
  }
};

window.addProducto = function () {
  const categorias = window._categoriasCache || [];
  if (!categorias.length) {
    mostrarToast('Primero crea una categoría con el botón "+ Nueva categoría".', 'error');
    return;
  }

  const opciones = categorias.map(c => `<option value="${c.id_categoria}">${c.nombre_categoria}</option>`).join('');

  abrirModal('🍽️ Nuevo producto', `
    <form id="formProducto">
      <div class="form-group"><label>Nombre *</label><input type="text" id="pNombre" required autofocus></div>
      <div class="form-group"><label>Descripción</label><textarea id="pDescripcion" placeholder="Ingredientes, presentación..."></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Precio (S/.) *</label><input type="number" id="pPrecio" step="0.10" min="0.10" required></div>
        <div class="form-group"><label>Categoría *</label><select id="pCategoria" required>${opciones}</select></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar producto</button>
      </div>
    </form>
  `);

  document.getElementById('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('pNombre').value.trim();
    const descripcion = document.getElementById('pDescripcion').value.trim() || '';
    const precio = Number(document.getElementById('pPrecio').value);
    const idCategoria = Number(document.getElementById('pCategoria').value);

    try {
      const { error } = await obtenerBaseDatos().rpc('crear_producto', {
        p_nombre: nombre, p_descripcion: descripcion, p_precio: precio,
        p_id_categoria: idCategoria
      });
      if (error) throw error;
      cerrarModal();
      cargarProductos();
      mostrarToast('¡Producto agregado a la carta! 🎉');
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo registrar el producto.', 'error');
    }
  });
};

// ---------- MESAS ----------
async function cargarMesas() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_mesas');
    if (error) throw error;
    window._mesasCache = data || [];
    renderMesas();
  } catch (err) {
    console.error('Error al cargar mesas:', err);
  }
}

function renderMesas() {
  const g = document.getElementById('mesasGrid');
  const mesas = window._mesasCache || [];
  g.innerHTML = mesas.map(m => {
    const s = m.estado;
    const color = s === 'Disponible' ? '#d1fae5' : s === 'Ocupada' ? '#fee2e2' : '#fef3c7';
    const border = s === 'Disponible' ? '#10b981' : s === 'Ocupada' ? '#ef4444' : '#f59e0b';
    const emoji = s === 'Disponible' ? '🟢' : s === 'Ocupada' ? '🔴' : '🟡';
    return `<div onclick="toggleMesa(${m.id_mesa})" style="background:${color};border:2px solid ${border};border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:.2s;">
      <div style="font-size:24px">🪑</div>
      <div style="font-weight:700;margin:4px 0">Mesa ${m.numero}</div>
      <div style="font-size:11px;color:#666">${emoji} ${s}</div>
    </div>`;
  }).join('');
}

window.toggleMesa = async function (idMesa) {
  const estados = ['Disponible', 'Ocupada', 'Reservada'];
  const mesa = (window._mesasCache || []).find(m => m.id_mesa === idMesa);
  if (!mesa) return;
  const siguiente = estados[(estados.indexOf(mesa.estado) + 1) % estados.length];

  try {
    const { error } = await obtenerBaseDatos().rpc('actualizar_estado_mesa', { p_id_mesa: idMesa, p_estado: siguiente });
    if (error) throw error;
    mesa.estado = siguiente;
    renderMesas();
    mostrarToast(`Mesa ${mesa.numero} → ${siguiente}`);
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo actualizar la mesa.', 'error');
  }
};

// ---------- CLIENTES ----------
let clientesCache = [];
let clientesFiltro = { texto: '', soloConVisitas: false };

async function cargarClientes() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_clientes');
    if (error) throw error;
    clientesCache = data || [];
    renderClientes();
  } catch (err) {
    console.error('Error al cargar clientes:', err);
  }
}

function renderClientes() {
  const tbody = document.querySelector('#mod-clientes tbody');
  const texto = clientesFiltro.texto.trim().toLowerCase();

  const filtrados = clientesCache.filter(c => {
    if (clientesFiltro.soloConVisitas && !(c.visitas > 0)) return false;
    if (!texto) return true;
    const campo = `${c.nombres} ${c.apellidos} ${c.telefono} ${c.correo || ''}`.toLowerCase();
    return campo.includes(texto);
  });

  tbody.innerHTML = filtrados.map(c => `
    <tr>
      <td>#C${String(c.id_cliente).padStart(3, '0')}</td>
      <td>${c.nombres} ${c.apellidos}</td>
      <td>${c.telefono}</td>
      <td>${c.visitas}</td>
      <td>${c.correo || '-'}</td>
    </tr>`).join('') || '<tr><td colspan="5">Sin clientes que coincidan con el filtro</td></tr>';
}

window.filtrarClientes = function () {
  abrirModal('🔍 Filtrar clientes', `
    <form id="formFiltroClientes">
      <div class="form-group">
        <label>Buscar por nombre, teléfono o correo</label>
        <input type="text" id="fcTexto" value="${clientesFiltro.texto}" placeholder="Ej: Quispe, 9xx..." autofocus>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="fcVisitas" ${clientesFiltro.soloConVisitas ? 'checked' : ''} style="width:auto">
        <label style="margin:0" for="fcVisitas">Mostrar solo clientes con al menos 1 visita/reserva</label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="limpiarFiltroClientes()">Limpiar filtro</button>
        <button type="submit" class="btn-sm btn-primary">Aplicar filtro</button>
      </div>
    </form>
  `);

  document.getElementById('formFiltroClientes').addEventListener('submit', (e) => {
    e.preventDefault();
    clientesFiltro.texto = document.getElementById('fcTexto').value;
    clientesFiltro.soloConVisitas = document.getElementById('fcVisitas').checked;
    cerrarModal();
    renderClientes();
  });
};

window.limpiarFiltroClientes = function () {
  clientesFiltro = { texto: '', soloConVisitas: false };
  cerrarModal();
  renderClientes();
};

// ---------- COMENTARIOS ----------
async function cargarComentarios() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_comentarios');
    if (error) throw error;

    const tbody = document.querySelector('#mod-comentarios tbody');
    tbody.innerHTML = (data || []).map(c => `
      <tr>
        <td>${c.nombres} ${c.apellidos}</td>
        <td>${'⭐'.repeat(c.calificacion)}</td>
        <td>${c.comentario}</td>
        <td>${fmtFecha(c.fecha)}</td>
        <td>${badgeEstado(c.estado)}</td>
        <td>
          ${c.estado === 'Pendiente' ? `<button class="btn-sm btn-success" onclick="responderComentario(${c.id_comentario})">Aprobar</button>` : ''}
          <button class="btn-sm btn-danger" onclick="eliminarComentario(${c.id_comentario})">Eliminar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6">Sin reseñas todavía</td></tr>';
  } catch (err) {
    console.error('Error al cargar comentarios:', err);
  }
}

window.responderComentario = function (id) {
  abrirModal('⭐ Responder reseña', `
    <form id="formRespuesta">
      <div class="form-group">
        <label>Respuesta pública</label>
        <textarea id="rsRespuesta" placeholder="¡Gracias por tu comentario!">¡Gracias por tu comentario!</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Publicar respuesta</button>
      </div>
    </form>
  `);

  document.getElementById('formRespuesta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const respuesta = document.getElementById('rsRespuesta').value.trim() || '¡Gracias por tu comentario!';
    try {
      const { error } = await obtenerBaseDatos().rpc('responder_comentario', { p_id_comentario: id, p_respuesta: respuesta });
      if (error) throw error;
      cerrarModal();
      cargarComentarios();
      mostrarToast('Respuesta publicada.');
    } catch (err) {
      console.error(err);
      mostrarToast('No se pudo aprobar la reseña.', 'error');
    }
  });
};

window.eliminarComentario = async function (id) {
  const ok = await confirmarAccion('¿Deseas eliminar esta reseña? Esta acción no se puede deshacer.', 'danger');
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('eliminar_comentario', { p_id_comentario: id });
    if (error) throw error;
    cargarComentarios();
    mostrarToast('Reseña eliminada.');
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo eliminar la reseña.', 'error');
  }
};

// ---------- USUARIOS (solo Administrador) ----------
// Requiere ejecutar supabase/04_gestion_usuarios.sql en el proyecto.
async function cargarUsuarios() {
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_usuarios');
    if (error) throw error;

    const sesion = obtenerSesion();
    const tbody = document.getElementById('usuariosBody');
    tbody.innerHTML = (data || []).map(u => `
      <tr>
        <td>#${u.id_usuario}</td>
        <td>${u.nombres} ${u.apellidos}</td>
        <td>${u.usuario}</td>
        <td>${u.nombre_rol}</td>
        <td>${badgeEstado(u.estado)}</td>
        <td>
          <button class="btn-sm btn-secondary" onclick="editarUsuario(${u.id_usuario})">Editar</button>
          ${u.id_usuario === sesion?.id_usuario
        ? ''
        : (u.estado === 'Activo'
          ? `<button class="btn-sm btn-danger" onclick="cambiarEstadoUsuario(${u.id_usuario},'Inactivo')">Desactivar</button>`
          : `<button class="btn-sm btn-success" onclick="cambiarEstadoUsuario(${u.id_usuario},'Activo')">Activar</button>`)
      }
        </td>
      </tr>`).join('') || '<tr><td colspan="6">Sin usuarios registrados</td></tr>';

    window._usuariosCache = data || [];
  } catch (err) {
    console.error('Error al cargar usuarios:', err);
    mostrarToast('No se pudo cargar la lista de usuarios. Verifica que ejecutaste supabase/04_gestion_usuarios.sql en Supabase.', 'error');
  }
}

// Editar usuario: cambiar contraseña y/o rol. La base de datos vuelve
// a validar que quien ejecuta la acción sea Administrador; en el panel
// el módulo "usuarios" ya es exclusivo de ese rol (ver ROLE_MODULES).
window.editarUsuario = async function (id) {
  const sesion = obtenerSesion();
  if (sesion?.nombre_rol !== 'Administrador') {
    mostrarToast('Solo un Administrador puede editar usuarios.', 'error');
    return;
  }

  const usuario = (window._usuariosCache || []).find(u => u.id_usuario === id);
  if (!usuario) return;

  let roles;
  try {
    const { data, error } = await obtenerBaseDatos().rpc('listar_roles');
    if (error) throw error;
    roles = data || [];
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudieron cargar los roles.', 'error');
    return;
  }

  const opcionesRol = roles.map(r => `<option value="${r.id_rol}" ${r.id_rol === usuario.id_rol ? 'selected' : ''}>${r.nombre_rol}</option>`).join('');

  abrirModal('🔐 Editar usuario', `
    <div class="modal-readonly">${usuario.nombres} ${usuario.apellidos} (@${usuario.usuario})</div>
    <form id="formEditarUsuario">
      <div class="form-group"><label>Rol</label><select id="euRol">${opcionesRol}</select></div>
      <div class="form-group">
        <label>Nueva contraseña (opcional)</label>
        <input type="password" id="euPassword" minlength="4" placeholder="Dejar en blanco para no cambiarla">
        <span class="form-hint">Mínimo 4 caracteres. Solo se actualiza si escribes algo aquí.</span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn-sm btn-primary">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('formEditarUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idRol = Number(document.getElementById('euRol').value);
    const password = document.getElementById('euPassword').value;

    try {
      const { error } = await obtenerBaseDatos().rpc('editar_usuario_staff', {
        p_id_usuario_actor: sesion.id_usuario,
        p_id_usuario: id,
        p_password: password || null,
        p_id_rol: idRol
      });
      if (error) throw error;
      cerrarModal();
      cargarUsuarios();
      mostrarToast('Usuario actualizado correctamente.');
    } catch (err) {
      console.error(err);
      mostrarToast(err?.message || 'No se pudo actualizar el usuario.', 'error');
    }
  });
};

window.cambiarEstadoUsuario = async function (id, estado) {
  const ok = await confirmarAccion(
    `¿${estado === 'Activo' ? 'Activar' : 'Desactivar'} este usuario?`,
    estado === 'Activo' ? 'warn' : 'danger'
  );
  if (!ok) return;
  try {
    const { error } = await obtenerBaseDatos().rpc('actualizar_estado_usuario', { p_id_usuario: id, p_estado: estado });
    if (error) throw error;
    cargarUsuarios();
    mostrarToast(`Usuario ${estado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`);
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo actualizar el estado del usuario.', 'error');
  }
};

window.addUsuario = async function () {
  try {
    const { data: roles, error: eRol } = await obtenerBaseDatos().rpc('listar_roles');
    if (eRol) throw eRol;
    if (!roles?.length) { mostrarToast('No hay roles registrados en la base de datos.', 'error'); return; }

    const opciones = roles.map(r => `<option value="${r.id_rol}">${r.nombre_rol}</option>`).join('');

    abrirModal('🔐 Nuevo usuario del sistema', `
      <form id="formUsuario">
        <div class="form-row">
          <div class="form-group"><label>Nombres *</label><input type="text" id="uNombres" required autofocus></div>
          <div class="form-group"><label>Apellidos *</label><input type="text" id="uApellidos" required></div>
        </div>
        <div class="form-group"><label>Usuario (para iniciar sesión) *</label><input type="text" id="uUsuario" required></div>
        <div class="form-group">
          <label>Contraseña *</label>
          <input type="password" id="uPassword" minlength="4" required>
          <span class="form-hint">Mínimo 4 caracteres.</span>
        </div>
        <div class="form-group"><label>Rol *</label><select id="uRol" required>${opciones}</select></div>
        <div class="modal-actions">
          <button type="button" class="btn-sm btn-secondary" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn-sm btn-primary">Crear usuario</button>
        </div>
      </form>
    `);

    document.getElementById('formUsuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombres = document.getElementById('uNombres').value.trim();
      const apellidos = document.getElementById('uApellidos').value.trim();
      const usuario = document.getElementById('uUsuario').value.trim();
      const password = document.getElementById('uPassword').value;
      const idRol = Number(document.getElementById('uRol').value);
      const nombreRol = roles.find(r => r.id_rol === idRol)?.nombre_rol || '';

      try {
        const { error } = await obtenerBaseDatos().rpc('crear_usuario_staff', {
          p_nombres: nombres,
          p_apellidos: apellidos,
          p_usuario: usuario,
          p_password: password,
          p_id_rol: idRol
        });
        if (error) throw error;

        cerrarModal();
        cargarUsuarios();
        mostrarToast(`¡Usuario "${usuario}" creado con rol ${nombreRol}! 🎉`);
      } catch (err) {
        console.error(err);
        mostrarToast('No se pudo crear el usuario. Verifica que el nombre de usuario no esté repetido.', 'error');
      }
    });
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudieron cargar los roles.', 'error');
  }
};
