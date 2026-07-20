// ============================================================
//   OroMar – main.js | Web pública informativa
// ============================================================

// ---------- CONEXIÓN CON SUPABASE ----------
async function obtenerSupabase() {
  if (!window.oromarDb) {
    throw new Error(
      'No se encontró la conexión con Supabase. Revisa que supabase.js se cargue antes que main.js'
    );
  }

  return window.oromarDb;
}

function separarNombreCompleto(nombreCompleto) {
  const partes = String(nombreCompleto || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) {
    return { nombres: 'No indicado', apellidos: 'No indicado' };
  }

  if (partes.length === 1) {
    return { nombres: partes[0], apellidos: 'No indicado' };
  }

  if (partes.length === 2) {
    return { nombres: partes[0], apellidos: partes[1] };
  }

  return {
    nombres: partes.slice(0, -2).join(' '),
    apellidos: partes.slice(-2).join(' ')
  };
}

function mensajeErrorSupabase(error) {
  if (!error) return 'Ocurrió un error al conectar con Supabase';

  if (error.code === '23505') {
    return 'Ya existe un registro con esos datos';
  }

  if (error.code === '42501') {
    return 'Supabase bloqueó la operación. Ejecuta el archivo politicas_supabase.sql';
  }

  return error.message || 'No se pudo completar la operación';
}

function bloquearFormulario(form, bloqueado) {
  const boton = form?.querySelector('button[type="submit"], input[type="submit"]');

  if (boton) {
    boton.disabled = bloqueado;
    boton.dataset.textoOriginal ??= boton.textContent || boton.value || '';

    if (boton.tagName === 'INPUT') {
      boton.value = bloqueado ? 'Guardando...' : boton.dataset.textoOriginal;
    } else {
      boton.textContent = bloqueado ? 'Guardando...' : boton.dataset.textoOriginal;
    }
  }
}

async function ejecutarOperacion(form, operacion) {
  bloquearFormulario(form, true);

  try {
    await operacion();
  } catch (error) {
    console.error(error);
    showToast(mensajeErrorSupabase(error), 'error');
  } finally {
    bloquearFormulario(form, false);
  }
}

const navbar = document.getElementById('navbar');
const navLinks = document.getElementById('navLinks');
const hamburger = document.getElementById('hamburger');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);

  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 100) current = section.id;
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
});

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => navLinks?.classList.remove('open'));
});

// ---------- MODO CAMPESTRE ----------
const btnAmbiente = document.getElementById('btnAmbiente');

if (btnAmbiente) {
  btnAmbiente.addEventListener('click', () => {
    document.body.classList.toggle('modo-campestre');

    if (document.body.classList.contains('modo-campestre')) {
      btnAmbiente.textContent = 'Modo oscuro';
      showToast('Modo campestre activado', 'success');
    } else {
      btnAmbiente.textContent = 'Modo campestre';
      showToast('Modo oscuro activado', 'success');
    }
  });
}

// ---------- PARTICLES ----------
const particlesContainer = document.getElementById('particles');
const colors = ['#D4A017', '#F4845F', '#0096C7', '#40916C', '#fbbf24'];

if (particlesContainer) {
  for (let i = 0; i < 40; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 6 + 2;
    particle.className = 'particle';
    particle.style.cssText = `
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${Math.random() * 15 + 10}s;
      animation-delay:-${Math.random() * 15}s;
    `;
    particlesContainer.appendChild(particle);
  }
}

// ---------- CARTA TABS ----------
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const category = button.dataset.cat;
    document.querySelectorAll('.carta-card').forEach(card => {
      card.style.display = card.dataset.cat === category ? 'block' : 'none';
    });
  });
});

// ---------- REGISTRO DE CLIENTE ----------
window.registrarCliente = async function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formRegistroCliente');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombres = document.getElementById('regNombres')?.value.trim();
  const apellidos = document.getElementById('regApellidos')?.value.trim();
  const telefono = document.getElementById('regTelefono')?.value.trim();
  const correo = document.getElementById('regCorreo')?.value.trim();

  await ejecutarOperacion(form, async () => {
    const supabase = await obtenerSupabase();
    const { error } = await supabase.rpc('registrar_cliente_publico', {
      p_nombres: nombres,
      p_apellidos: apellidos,
      p_telefono: telefono,
      p_correo: correo || null
    });

    if (error) throw error;

    showToast('Cliente registrado correctamente', 'success');
    form?.reset();
  });
};

// ---------- RESERVAS ----------
window.enviarReserva = async function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formReserva');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombreCompleto = document.getElementById('resNombre')?.value.trim();
  const telefono = document.getElementById('resTelefono')?.value.trim();
  const correo = document.getElementById('resCorreo')?.value.trim();
  const fecha = document.getElementById('resFecha')?.value;
  const hora = document.getElementById('resHora')?.value;
  const personas = Number(document.getElementById('resPersonas')?.value);
  const comentario = document.getElementById('resComentario')?.value.trim();
  const { nombres, apellidos } = separarNombreCompleto(nombreCompleto);

  await ejecutarOperacion(form, async () => {
    const supabase = await obtenerSupabase();
    const { error } = await supabase.rpc('registrar_reserva_publica', {
      p_nombres: nombres,
      p_apellidos: apellidos,
      p_telefono: telefono,
      p_correo: correo || null,
      p_fecha: fecha,
      p_hora: hora,
      p_cantidad_personas: personas,
      p_observacion: comentario || null
    });

    if (error) throw error;

    const mensaje =
      `Reserva OroMar\n\n` +
      `Nombre: ${nombreCompleto}\n` +
      `Teléfono: ${telefono}\n` +
      `Correo: ${correo || 'No indicado'}\n` +
      `Fecha: ${fecha}\n` +
      `Hora: ${hora}\n` +
      `Personas: ${personas}\n` +
      (comentario ? `Nota: ${comentario}\n` : '') +
      `\nLa reserva ya fue registrada en el sistema.`;

    showToast('Reserva registrada correctamente', 'success');
    form?.reset();

    window.open(
      `https://wa.me/51944123456?text=${encodeURIComponent(mensaje)}`,
      '_blank',
      'noopener,noreferrer'
    );
  });
};

// ---------- CALIFICACIÓN ----------
let selectedStars = 0;

document.querySelectorAll('#starRating span').forEach(star => {
  star.addEventListener('click', () => {
    selectedStars = Number(star.dataset.val);
    document.querySelectorAll('#starRating span').forEach((item, index) => {
      item.classList.toggle('active', index < selectedStars);
    });
  });
});

// ---------- COMENTARIOS ----------
window.guardarComentario = async function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formComentario');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombreCompleto = document.getElementById('comNombre')?.value.trim();
  const telefono = document.getElementById('comTel')?.value.trim();
  const correo = document.getElementById('comCorreo')?.value.trim();
  const texto = document.getElementById('comTexto')?.value.trim();
  const { nombres, apellidos } = separarNombreCompleto(nombreCompleto);

  if (selectedStars === 0) {
    showToast('Selecciona una calificación de 1 a 5 estrellas', 'error');
    return;
  }

  await ejecutarOperacion(form, async () => {
    const supabase = await obtenerSupabase();
    const { error } = await supabase.rpc('registrar_comentario_publico', {
      p_nombres: nombres,
      p_apellidos: apellidos,
      p_telefono: telefono,
      p_correo: correo || null,
      p_comentario: texto,
      p_calificacion: selectedStars
    });

    if (error) throw error;

    showToast('Gracias por tu reseña', 'success');
    form?.reset();
    selectedStars = 0;
    document.querySelectorAll('#starRating span').forEach(item => item.classList.remove('active'));
  });
};

// ---------- CONTACTO ----------
window.enviarContacto = async function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formContacto');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombreCompleto = document.getElementById('ctaNombre')?.value.trim();
  const telefono = document.getElementById('ctaTel')?.value.trim();
  const correo = document.getElementById('ctaCorreo')?.value.trim();
  const mensaje = document.getElementById('ctaMensaje')?.value.trim();
  const { nombres, apellidos } = separarNombreCompleto(nombreCompleto);

  await ejecutarOperacion(form, async () => {
    const supabase = await obtenerSupabase();
    const { error } = await supabase.rpc('registrar_contacto_publico', {
      p_nombres: nombres,
      p_apellidos: apellidos,
      p_telefono: telefono,
      p_correo: correo || null,
      p_mensaje: mensaje
    });

    if (error) throw error;

    const texto =
      `Contacto OroMar\n\n` +
      `Nombre: ${nombreCompleto}\n` +
      `Teléfono: ${telefono}\n` +
      `Correo: ${correo || 'No indicado'}\n\n` +
      `Mensaje: ${mensaje}`;

    showToast('Mensaje registrado correctamente', 'success');
    form?.reset();

    window.open(
      `https://wa.me/51944123456?text=${encodeURIComponent(texto)}`,
      '_blank',
      'noopener,noreferrer'
    );
  });
};



window.openWhatsApp = function () {
  window.open('https://wa.me/51944123456?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20OroMar', '_blank');
};

// ---------- ASISTENTE VIRTUAL ----------
const chatBody = document.getElementById('chatBody');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
let chatOpen = true;

window.toggleChat = function () {
  chatOpen = !chatOpen;
  if (chatBody) chatBody.style.display = chatOpen ? 'block' : 'none';
  const toggleButton = document.getElementById('chatToggleBtn');
  if (toggleButton) toggleButton.textContent = chatOpen ? '▼' : '▲';
};

const botResponses = {
  horario: 'Nuestro horario es:\n• Lun–Vie: 10:00 – 18:00\n• Sáb–Dom: 10:00 – 20:00\n¡Te esperamos!',
  reservar: 'Puedes reservar desde la sección Reservas o escribirnos por WhatsApp. Solo completa tus datos y confirma la mesa.',
  ubicacion: 'Estamos en: Ctra. Panamericana N 170.\nReferencia: entrada a Pacanguilla. Contamos con ambiente campestre y estacionamiento.',
  plato: 'Algunos platos que preparamos son: Ceviche Mixto, Langostinos al Ajillo, Parrilla Campestre, Lomo Saltado y postres de casa.',
  precio: 'La carta de la web es informativa y no muestra precios. Para precios actualizados, consulta directamente con el restaurante.',
  delivery: 'Por el momento la web muestra los platos preparados. Para consultas de recojo o atención, escríbenos por WhatsApp.',
  pago: 'Aceptamos efectivo, tarjeta, Yape y Plin.',
  wifi: 'Sí, contamos con WiFi para los clientes.',
  estacionamiento: 'Sí, tenemos estacionamiento para nuestros visitantes.',
  default: 'No tengo esa respuesta exacta. Puedes escribirnos por WhatsApp para atención personalizada.'
};

function getBotReply(input) {
  const lower = input.toLowerCase();
  if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto')) return botResponses.horario;
  if (lower.includes('reserv')) return botResponses.reservar;
  if (lower.includes('ubicac') || lower.includes('dónde') || lower.includes('donde') || lower.includes('dirección')) return botResponses.ubicacion;
  if (lower.includes('plato') || lower.includes('pedido') || lower.includes('recomiend') || lower.includes('popular')) return botResponses.plato;
  if (lower.includes('precio') || lower.includes('cuánto') || lower.includes('costo')) return botResponses.precio;
  if (lower.includes('delivery') || lower.includes('domicilio') || lower.includes('recojo')) return botResponses.delivery;
  if (lower.includes('pago') || lower.includes('tarjeta') || lower.includes('yape') || lower.includes('efectivo')) return botResponses.pago;
  if (lower.includes('wifi') || lower.includes('internet')) return botResponses.wifi;
  if (lower.includes('estacion') || lower.includes('parking') || lower.includes('carro')) return botResponses.estacionamiento;
  return botResponses.default;
}

function appendMsg(text, type) {
  if (!chatMessages) return;
  const message = document.createElement('div');
  message.className = type === 'bot' ? 'bot-msg' : 'user-msg';
  message.innerHTML = text.replace(/\n/g, '<br>');
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendChat = function () {
  const value = chatInput?.value.trim();
  if (!value) return;
  appendMsg(value, 'user');
  chatInput.value = '';
  setTimeout(() => appendMsg(getBotReply(value), 'bot'), 600);
};

window.quickAsk = function (question) {
  appendMsg(question, 'user');
  setTimeout(() => appendMsg(getBotReply(question), 'bot'), 600);
};

// ---------- SCROLL REVEAL ----------
const revealItems = document.querySelectorAll('.carta-card, .gal-item, .comentario-card, .valor, .info-item, .section-header, .hero-image-card');
revealItems.forEach(item => item.classList.add('reveal'));

const observer = new IntersectionObserver(entries => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), index * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealItems.forEach(item => observer.observe(item));

// ---------- TOAST ----------
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.className = 'toast', 3000);
}

// ---------- INIT ----------
const reservaFecha = document.getElementById('resFecha');
if (reservaFecha) reservaFecha.min = new Date().toISOString().split('T')[0];


// ---------- CONTADOR DE CARACTERES ----------
function activarContadorCaracteres(idTextarea, idContador, maximo) {
  const textarea = document.getElementById(idTextarea);
  const contador = document.getElementById(idContador);

  if (!textarea || !contador) return;

  const actualizarContador = () => {
    const cantidad = textarea.value.length;
    contador.textContent = `${cantidad} / ${maximo} caracteres`;
    contador.classList.toggle('limite', cantidad >= maximo);
  };

  textarea.addEventListener('input', actualizarContador);

  if (textarea.form) {
    textarea.form.addEventListener('reset', () => {
      setTimeout(actualizarContador, 0);
    });
  }

  actualizarContador();
}

activarContadorCaracteres('resComentario', 'contadorResComentario', 300);
activarContadorCaracteres('comTexto', 'contadorComTexto', 500);
activarContadorCaracteres('ctaMensaje', 'contadorCtaMensaje', 500);
