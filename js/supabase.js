// ============================================================
//   OroMar – main.js | Con Supabase
//   Esquema basado en supabase.sql (tablas: cliente, reserva,
//   comentario, contacto, etc.)
// ============================================================

// ---------- INICIALIZAR SUPABASE ----------
const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key
);

// ---------- NAVBAR Y SCROLL ----------
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
        btnAmbiente.textContent = document.body.classList.contains('modo-campestre')
            ? 'Modo oscuro'
            : 'Modo campestre';
        showToast(
            document.body.classList.contains('modo-campestre')
                ? 'Modo campestre activado'
                : 'Modo oscuro activado',
            'success'
        );
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

// ============================================================
//   FUNCIÓN AUXILIAR: OBTENER O CREAR CLIENTE (tabla 'cliente')
// ============================================================
async function obtenerOCrearCliente(nombres, apellidos, telefono, correo) {
    // Buscar por teléfono o correo en la tabla 'cliente'
    let { data: cliente, error } = await supabase
        .from('cliente')
        .select('id_cliente')
        .or(`telefono.eq.${telefono},correo.eq.${correo}`)
        .maybeSingle();

    if (error) throw error;

    if (cliente) {
        return cliente.id_cliente;
    } else {
        // Crear nuevo cliente en 'cliente'
        const { data: newCliente, error: insertError } = await supabase
            .from('cliente')
            .insert([{ nombres, apellidos, telefono, correo }])
            .select();
        if (insertError) throw insertError;
        return newCliente[0].id_cliente;
    }
}

// ============================================================
//   1. REGISTRO DE CLIENTE (tabla 'cliente')
// ============================================================
window.registrarCliente = async function (event) {
    if (event) event.preventDefault();
    const form = document.getElementById('formRegistroCliente');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const nombres = document.getElementById('regNombres').value.trim();
    const apellidos = document.getElementById('regApellidos').value.trim();
    const telefono = document.getElementById('regTelefono').value.trim();
    const correo = document.getElementById('regCorreo').value.trim();

    try {
        // Verificar si ya existe en 'cliente'
        const { data: existing, error: searchError } = await supabase
            .from('cliente')
            .select('id_cliente')
            .or(`telefono.eq.${telefono},correo.eq.${correo}`)
            .maybeSingle();

        if (searchError) throw searchError;

        if (existing) {
            showToast('Este cliente ya está registrado', 'error');
            return;
        }

        // Insertar nuevo cliente en 'cliente'
        const { error } = await supabase
            .from('cliente')
            .insert([{ nombres, apellidos, telefono, correo }]);

        if (error) throw error;

        showToast('Cliente registrado correctamente', 'success');
        form.reset();
    } catch (error) {
        console.error('Error al registrar cliente:', error);
        showToast('Error al registrar. Intenta nuevamente.', 'error');
    }
};

// ============================================================
//   2. RESERVAS (tabla 'reserva' + WhatsApp)
// ============================================================
window.enviarReserva = async function (event) {
  if (event) event.preventDefault();
  const form = document.getElementById('formReserva');
  if (form && !form.checkValidity()) { form.reportValidity(); return; }

  const nombre = document.getElementById('resNombre')?.value.trim();
  const telefono = document.getElementById('resTelefono')?.value.trim();
  const correo = document.getElementById('resCorreo')?.value.trim();
  const fecha = document.getElementById('resFecha')?.value;
  const hora = document.getElementById('resHora')?.value;
  const personas = document.getElementById('resPersonas')?.value;
  const comentario = document.getElementById('resComentario')?.value.trim();

  try {
    // Buscar o crear cliente
    let { data: cliente, error: searchError } = await supabase
      .from('cliente')
      .select('id_cliente')
      .or(`telefono.eq.${telefono},correo.eq.${correo}`)
      .maybeSingle();
    if (searchError) throw searchError;

    let id_cliente;
    if (cliente) {
      id_cliente = cliente.id_cliente;
    } else {
      const [nombres, ...resto] = nombre.split(' ');
      const { data: nuevo, error: insErr } = await supabase
        .from('cliente')
        .insert([{ nombres, apellidos: resto.join(' ') || '-', telefono, correo }])
        .select();
      if (insErr) throw insErr;
      id_cliente = nuevo[0].id_cliente;
    }

    // Insertar la reserva (estado y fecha_registro se asignan por defecto en la BD)
    const { error: resErr } = await supabase.from('reserva').insert([{
      fecha, hora, cantidad_personas: personas, observacion: comentario || null, id_cliente
    }]);
    if (resErr) throw resErr;

    showToast('Reserva registrada correctamente', 'success');
    form?.reset();

    // (Opcional) seguir enviando también por WhatsApp
    const mensaje = `Reserva OroMar\n\nNombre: ${nombre}\nTeléfono: ${telefono}\nFecha: ${fecha}\nHora: ${hora}\nPersonas: ${personas}`;
    window.open(`https://wa.me/51944123456?text=${encodeURIComponent(mensaje)}`, '_blank');
  } catch (error) {
    console.error('Error al registrar reserva:', error);
    showToast('Error al reservar. Intenta nuevamente.', 'error');
  }
};

// ============================================================
//   3. COMENTARIOS / RESEÑAS (tabla 'comentario')
// ============================================================
let selectedStars = 0;

document.querySelectorAll('#starRating span').forEach(star => {
    star.addEventListener('click', () => {
        selectedStars = Number(star.dataset.val);
        document.querySelectorAll('#starRating span').forEach((item, index) => {
            item.classList.toggle('active', index < selectedStars);
        });
    });
});

window.guardarComentario = async function (event) {
    if (event) event.preventDefault();
    const form = document.getElementById('formComentario');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const nombre = document.getElementById('comNombre').value.trim();
    const telefono = document.getElementById('comTel').value.trim();
    const correo = document.getElementById('comCorreo').value.trim();
    const texto = document.getElementById('comTexto').value.trim();

    if (selectedStars === 0) {
        showToast('Selecciona una calificación de 1 a 5 estrellas', 'error');
        return;
    }

    try {
        // Obtener o crear cliente (tabla 'cliente')
        const id_cliente = await obtenerOCrearCliente(nombre, '', telefono, correo);

        // Insertar comentario en 'comentario' (estado, fecha y respuesta_admin por defecto)
        const { error } = await supabase
            .from('comentario')
            .insert([{
                comentario: texto,
                calificacion: selectedStars,
                id_cliente
            }]);

        if (error) throw error;

        showToast('Gracias por tu reseña', 'success');
        form.reset();
        selectedStars = 0;
        document.querySelectorAll('#starRating span').forEach(item => item.classList.remove('active'));
    } catch (error) {
        console.error('Error al guardar comentario:', error);
        showToast('Error al enviar la reseña. Intenta nuevamente.', 'error');
    }
};

// ============================================================
//   4. CONTACTO (tabla 'contacto' + WhatsApp)
// ============================================================
window.enviarContacto = async function (event) {
    if (event) event.preventDefault();
    const form = document.getElementById('formContacto');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const nombre = document.getElementById('ctaNombre').value.trim();
    const telefono = document.getElementById('ctaTel').value.trim();
    const correo = document.getElementById('ctaCorreo').value.trim();
    const mensaje = document.getElementById('ctaMensaje').value.trim();

    try {
        // Obtener o crear cliente (tabla 'cliente')
        const id_cliente = await obtenerOCrearCliente(nombre, '', telefono, correo);

        // Guardar mensaje en 'contacto' (estado y fecha por defecto)
        const { error } = await supabase
            .from('contacto')
            .insert([{
                mensaje,
                id_cliente
            }]);

        if (error) throw error;

        // Enviar WhatsApp
        const textoWA =
            `Contacto OroMar\n\n` +
            `Nombre: ${nombre}\n` +
            `Teléfono: ${telefono}\n` +
            `Correo: ${correo}\n\n` +
            `Mensaje: ${mensaje}`;

        window.open(`https://wa.me/51944123456?text=${encodeURIComponent(textoWA)}`, '_blank');

        showToast('Mensaje enviado y guardado', 'success');
        form.reset();
    } catch (error) {
        console.error('Error al guardar contacto:', error);
        showToast('Error al enviar el mensaje. Intenta nuevamente.', 'error');
    }
};

// Botón flotante de WhatsApp
window.openWhatsApp = function () {
    window.open('https://wa.me/51944123456?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20OroMar', '_blank');
};

// ============================================================
//   ASISTENTE VIRTUAL
// ============================================================
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

// ============================================================
//   SCROLL REVEAL
// ============================================================
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

// ============================================================
//   TOAST
// ============================================================
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.className = 'toast', 3000);
}

// ============================================================
//   INIT
// ============================================================
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
