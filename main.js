// ============================================================
//   OroMar – main.js | Web pública informativa
// ============================================================

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
window.registrarCliente = function (event) {
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

  const clientes = JSON.parse(localStorage.getItem('oromar_clientes') || '[]');
  const existe = clientes.some(cliente => cliente.telefono === telefono || cliente.correo.toLowerCase() === correo.toLowerCase());

  if (existe) {
    showToast('Este cliente ya está registrado', 'error');
    return;
  }

  clientes.push({ nombres, apellidos, telefono, correo, fecha_registro: new Date().toISOString() });
  localStorage.setItem('oromar_clientes', JSON.stringify(clientes));

  showToast('Cliente registrado correctamente', 'success');
  form?.reset();
};

// ---------- RESERVAS ----------
window.enviarReserva = function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formReserva');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombre = document.getElementById('resNombre')?.value.trim();
  const telefono = document.getElementById('resTelefono')?.value.trim();
  const correo = document.getElementById('resCorreo')?.value.trim();
  const fecha = document.getElementById('resFecha')?.value;
  const hora = document.getElementById('resHora')?.value;
  const personas = document.getElementById('resPersonas')?.value;
  const comentario = document.getElementById('resComentario')?.value.trim();

  const mensaje =
    `Reserva OroMar\n\n` +
    `Nombre: ${nombre}\n` +
    `Teléfono: ${telefono}\n` +
    `Correo: ${correo}\n` +
    `Fecha: ${fecha}\n` +
    `Hora: ${hora}\n` +
    `Personas: ${personas}\n` +
    (comentario ? `Nota: ${comentario}\n` : '') +
    `\nConfirma nuestra reserva, por favor.`;

  window.open(`https://wa.me/51944123456?text=${encodeURIComponent(mensaje)}`, '_blank');
  showToast('Reserva enviada a WhatsApp', 'success');
  form?.reset();
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
window.guardarComentario = function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formComentario');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombre = document.getElementById('comNombre')?.value.trim();
  const telefono = document.getElementById('comTel')?.value.trim();
  const correo = document.getElementById('comCorreo')?.value.trim();
  const texto = document.getElementById('comTexto')?.value.trim();

  if (selectedStars === 0) {
    showToast('Selecciona una calificación de 1 a 5 estrellas', 'error');
    return;
  }

  const comentarios = JSON.parse(localStorage.getItem('oromar_comentarios') || '[]');
  comentarios.push({ nombre, telefono, correo, texto, calificacion: selectedStars, fecha: new Date().toISOString() });
  localStorage.setItem('oromar_comentarios', JSON.stringify(comentarios));

  showToast('Gracias por tu reseña', 'success');
  form?.reset();
  selectedStars = 0;
  document.querySelectorAll('#starRating span').forEach(item => item.classList.remove('active'));
};

// ---------- CONTACTO ----------
window.enviarContacto = function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formContacto');

  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombre = document.getElementById('ctaNombre')?.value.trim();
  const telefono = document.getElementById('ctaTel')?.value.trim();
  const correo = document.getElementById('ctaCorreo')?.value.trim();
  const mensaje = document.getElementById('ctaMensaje')?.value.trim();

  const texto =
    `Contacto OroMar\n\n` +
    `Nombre: ${nombre}\n` +
    `Teléfono: ${telefono}\n` +
    `Correo: ${correo}\n\n` +
    `Mensaje: ${mensaje}`;

  window.open(`https://wa.me/51944123456?text=${encodeURIComponent(texto)}`, '_blank');
  showToast('Mensaje enviado', 'success');
  form?.reset();
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
