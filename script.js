// =============================================
//  KAWAII STANDS — script.js v3
//  Auth + Filtros + Stock + Carrito + Stripe
// =============================================

const SUPABASE_URL  = 'https://tewjxalurcnfuxzuolmm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRld2p4YWx1cmNuZnV4enVvbG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyMTMsImV4cCI6MjA5NDM1MzIxM30.4DgMTn2cmELYVAZ2kkikd5Lr1wRGq8Cf5bkrwGZwCvU';
const BACKEND_URL   = 'https://kawaii-stands.onrender.com';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── ESTADO GLOBAL ──────────────────────────
let cart         = JSON.parse(localStorage.getItem('kawaii_cart') || '[]');
let usuarioActual = JSON.parse(localStorage.getItem('kawaii_usuario') || 'null');
let todosLosProductos = [];
let filtroActual = 'todos';

// ── FALLBACK PRODUCTOS ─────────────────────
const PRODUCTOS_FALLBACK = [
  { id:1,  nombre:'Conejo',       descripcion:'Soporte kawaii de conejito blanco',    precio:450, imagen_url:'imgs/CONEJO_S.png',       especial:false, stock:15 },
  { id:2,  nombre:'Elefante',     descripcion:'Soporte kawaii de elefantito gris',    precio:450, imagen_url:'imgs/ELEFANTE_S.png',     especial:false, stock:12 },
  { id:3,  nombre:'Erizo',        descripcion:'Soporte kawaii de ericito marrón',     precio:450, imagen_url:'imgs/ERIZO_S.png',        especial:false, stock:10 },
  { id:4,  nombre:'Gato',         descripcion:'Soporte kawaii de gatito con pescado', precio:450, imagen_url:'imgs/GATO_S.png',         especial:false, stock:14 },
  { id:5,  nombre:'Jirafa',       descripcion:'Soporte kawaii de jirafita amarilla',  precio:450, imagen_url:'imgs/GIRAFA_S.png',       especial:false, stock:8  },
  { id:6,  nombre:'Koala',        descripcion:'Soporte kawaii de koalita gris',       precio:450, imagen_url:'imgs/KOALA_S.png',        especial:false, stock:11 },
  { id:7,  nombre:'Panda',        descripcion:'Soporte kawaii de osito panda',        precio:450, imagen_url:'imgs/PANDA_S.png',        especial:false, stock:13 },
  { id:8,  nombre:'Rana',         descripcion:'Soporte kawaii de ranita verde',       precio:450, imagen_url:'imgs/RANA_S.png',         especial:false, stock:9  },
  { id:9,  nombre:'Pochi',        descripcion:'Soporte kawaii de Shiba Inu naranja',  precio:450, imagen_url:'imgs/POCHI_S.png',        especial:false, stock:7  },
  { id:10, nombre:'Pingüino',     descripcion:'Soporte kawaii de pingüinito negro',   precio:450, imagen_url:'imgs/PINGUINO_S.png',     especial:false, stock:16 },
  { id:11, nombre:'Godzilla',     descripcion:'Edición especial — soporte Godzilla',  precio:650, imagen_url:'imgs/GODZILLA_S.png',     especial:true,  stock:5  },
  { id:12, nombre:'Power Ranger', descripcion:'Edición especial — Red Power Ranger',  precio:700, imagen_url:'imgs/POWER_RANGER_S.png', especial:true,  stock:5  },
];

// ── CURSOR PERSONALIZADO ───────────────────
const cursor   = document.getElementById('cursor');
const follower = document.getElementById('cursorFollower');
let fX = 0, fY = 0, mX = 0, mY = 0;
document.addEventListener('mousemove', e => { mX = e.clientX; mY = e.clientY; cursor.style.left = mX+'px'; cursor.style.top = mY+'px'; });
(function animFollower() { fX += (mX-fX)*.12; fY += (mY-fY)*.12; follower.style.left=fX+'px'; follower.style.top=fY+'px'; requestAnimationFrame(animFollower); })();

// ── NAVBAR SCROLL ──────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40));

// ── AUTH UI ────────────────────────────────
function actualizarNavAuth() {
  const guest = document.getElementById('authGuest');
  const user  = document.getElementById('authUser');
  if (usuarioActual) {
    guest.style.display = 'none';
    user.style.display  = 'flex';
    document.getElementById('userNombre').textContent = usuarioActual.nombre.split(' ')[0];
  } else {
    guest.style.display = 'flex';
    user.style.display  = 'none';
  }
}

// Abrir/cerrar modales auth
document.getElementById('btnAbrirLogin').addEventListener('click', () => {
  document.getElementById('modalLogin').classList.add('open');
});
document.getElementById('btnAbrirRegistro').addEventListener('click', () => {
  document.getElementById('modalRegistro').classList.add('open');
});
document.getElementById('cerrarLogin').addEventListener('click', () => {
  document.getElementById('modalLogin').classList.remove('open');
});
document.getElementById('cerrarRegistro').addEventListener('click', () => {
  document.getElementById('modalRegistro').classList.remove('open');
});
document.getElementById('switchToRegistro').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('modalLogin').classList.remove('open');
  document.getElementById('modalRegistro').classList.add('open');
});
document.getElementById('switchToLogin').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('modalRegistro').classList.remove('open');
  document.getElementById('modalLogin').classList.add('open');
});

// Cerrar modal al click fuera
['modalLogin', 'modalRegistro', 'modalHistorial'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === document.getElementById(id)) {
      document.getElementById(id).classList.remove('open');
    }
  });
});

// Dropdown usuario
document.getElementById('btnUserMenu').addEventListener('click', () => {
  document.getElementById('userDropdown').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.auth-user')) {
    document.getElementById('userDropdown').classList.remove('open');
  }
});

// Login
document.getElementById('btnLogin').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { mostrarToast('Completa todos los campos ⚠️'); return; }

  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Iniciando...';
  btn.disabled = true;

  try {
    const res  = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    usuarioActual = data.usuario;
    localStorage.setItem('kawaii_usuario', JSON.stringify(usuarioActual));
    actualizarNavAuth();
    document.getElementById('modalLogin').classList.remove('open');
    mostrarToast(`¡Bienvenido, ${usuarioActual.nombre.split(' ')[0]}! 🐾`);
  } catch (err) {
    mostrarToast(err.message + ' ❌');
  } finally {
    btn.textContent = 'Iniciar sesión';
    btn.disabled = false;
  }
});

// Registro
document.getElementById('btnRegistro').addEventListener('click', async () => {
  const nombre   = document.getElementById('reg-nombre').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!nombre || !email || !password) { mostrarToast('Completa todos los campos ⚠️'); return; }

  const btn = document.getElementById('btnRegistro');
  btn.textContent = 'Creando cuenta...';
  btn.disabled = true;

  try {
    const res  = await fetch(`${BACKEND_URL}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    usuarioActual = data.usuario;
    localStorage.setItem('kawaii_usuario', JSON.stringify(usuarioActual));
    actualizarNavAuth();
    document.getElementById('modalRegistro').classList.remove('open');
    mostrarToast(`¡Cuenta creada! Bienvenido, ${usuarioActual.nombre.split(' ')[0]}! 🎉`);
  } catch (err) {
    mostrarToast(err.message + ' ❌');
  } finally {
    btn.textContent = 'Crear cuenta';
    btn.disabled = false;
  }
});

// Cerrar sesión
document.getElementById('btnCerrarSesion').addEventListener('click', e => {
  e.preventDefault();
  usuarioActual = null;
  localStorage.removeItem('kawaii_usuario');
  actualizarNavAuth();
  mostrarToast('Sesión cerrada 👋');
});

// Ver historial
document.getElementById('btnVerHistorial').addEventListener('click', async e => {
  e.preventDefault();
  document.getElementById('userDropdown').classList.remove('open');
  document.getElementById('modalHistorial').classList.add('open');
  await cargarHistorial();
});

document.getElementById('cerrarHistorial').addEventListener('click', () => {
  document.getElementById('modalHistorial').classList.remove('open');
});

async function cargarHistorial() {
  const content = document.getElementById('historialContent');
  content.innerHTML = '<div class="grid-loading"><div class="spinner"></div><p>Cargando historial...</p></div>';

  try {
    const res  = await fetch(`${BACKEND_URL}/auth/historial/${usuarioActual.id}`);
    const data = await res.json();

    const ventasFiltradas = (data.ventas || []).filter(v => v.estado === 'completed' || v.estado === 'cancelled');

    if (ventasFiltradas.length === 0) {
      content.innerHTML = '<div class="hist-empty"><p>🛒 Aún no tienes compras completadas</p></div>';
      return;
    }

    content.innerHTML = ventasFiltradas.map(v => {
      const fecha  = new Date(v.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
      let items = [];
      try {
        if (v.items) {
          items = typeof v.items === 'string' ? JSON.parse(v.items) : v.items;
        }
      } catch(e) { items = []; }
      const estado = v.estado === 'completed' ? '✅ Completado' : v.estado === 'pending' ? '⏳ Pendiente' : '❌ Cancelado';

      return `
        <div class="hist-card">
          <div class="hist-head">
            <div>
              <span class="hist-id">ID: #${String(v.id).padStart(6, '0')}</span>
              <span class="hist-fecha">${fecha}</span>
            </div>
            <div class="hist-right">
              <span class="hist-estado">${estado}</span>
              <span class="hist-monto">$${Number(v.monto_total).toFixed(0)} MXN</span>
            </div>
          </div>
          ${items.length > 0 ? `
            <div class="hist-items">
              ${items.map(item => `
                <div class="hist-item">
                  <img src="${item.imagen_url}" alt="${item.nombre}" onerror="this.src='imgs/CONEJO_S.png'"/>
                  <div class="hist-item-info">
                    <div class="hist-item-name">${item.nombre}</div>
                    <div class="hist-item-qty">Cantidad: ${item.cantidad}</div>
                  </div>
                  <span class="hist-item-price">$${(item.precio * item.cantidad).toFixed(0)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    content.innerHTML = '<p style="color:red;text-align:center">Error cargando historial</p>';
  }
}

// ── FILTROS ────────────────────────────────
document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = btn.dataset.filtro;
    aplicarFiltro();
  });
});

function aplicarFiltro() {
  let filtrados = todosLosProductos;
  if (filtroActual === 'normal')   filtrados = todosLosProductos.filter(p => !p.especial);
  if (filtroActual === 'especial') filtrados = todosLosProductos.filter(p => p.especial);
  renderProductos(filtrados);
}

// ── PRODUCTOS ──────────────────────────────
async function cargarProductos() {
  try {
    const { data, error } = await db
      .from('productos')
      .select('*')
      .order('especial', { ascending: true })
      .order('nombre',   { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      todosLosProductos = data;
    } else {
      todosLosProductos = PRODUCTOS_FALLBACK;
      await insertarProductosFallback();
    }
  } catch (err) {
    console.warn('Supabase no disponible, usando fallback:', err.message);
    todosLosProductos = PRODUCTOS_FALLBACK;
  }

  aplicarFiltro();
}

async function insertarProductosFallback() {
  try {
    const rows = PRODUCTOS_FALLBACK.map(p => ({
      nombre: p.nombre, descripcion: p.descripcion,
      precio: p.precio, imagen_url: p.imagen_url,
      especial: p.especial, stock: p.stock,
    }));
    await db.from('productos').upsert(rows, { onConflict: 'nombre' });
  } catch (e) {
    console.warn('No se pudo insertar fallback:', e.message);
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  if (productos.length === 0) {
    grid.innerHTML = '<p style="text-align:center;padding:3rem;opacity:.5">No hay productos en esta categoría</p>';
    return;
  }

  const normales   = productos.filter(p => !p.especial);
  const especiales = productos.filter(p => p.especial);
  const ordenados  = [...normales, ...especiales];

  ordenados.forEach((p, i) => {
    const agotado = (p.stock !== null && p.stock !== undefined) && p.stock <= 0;
    const card = document.createElement('div');
    card.className = 'product-card' + (p.especial ? ' special' : '') + (agotado ? ' agotado' : '');
    card.style.animationDelay = `${i * 0.05}s`;

    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy" onerror="this.src='imgs/CONEJO_S.png'"/>
        ${agotado ? '<div class="agotado-badge">AGOTADO</div>' : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${p.nombre}</div>
        <div class="card-desc">${p.descripcion}</div>
        <div class="card-stock ${agotado ? 'stock-agotado' : ''}">
          ${agotado ? '😔 Agotado' : `Stock: ${p.stock ?? '∞'}`}
        </div>
        <div class="card-footer">
          <div class="card-price ${p.especial ? 'special-price' : ''}">
            $${Number(p.precio).toFixed(0)} MXN
          </div>
          ${agotado
            ? `<button class="btn-add btn-agotado" disabled>Agotado</button>`
            : `<button class="btn-add" data-id="${p.id}" data-name="${p.nombre}" data-price="${p.precio}" data-img="${p.imagen_url}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Agregar
               </button>`
          }
        </div>
      </div>
    `;

    card.addEventListener('mousemove', e => tiltCard(e, card));
    card.addEventListener('mouseleave', () => resetTilt(card));
    grid.appendChild(card);
  });

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add:not(.btn-agotado)');
    if (!btn) return;
    agregarAlCarrito({
      id:         btn.dataset.id,
      nombre:     btn.dataset.name,
      precio:     parseFloat(btn.dataset.price),
      imagen_url: btn.dataset.img,
    });
    btn.textContent = '✓ Agregado';
    btn.classList.add('added');
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Agregar`;
      btn.classList.remove('added');
    }, 1800);
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.style.opacity='1'; observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card').forEach(card => { card.style.opacity='0'; observer.observe(card); });
}

// ── TILT 3D ────────────────────────────────
function tiltCard(e, card) {
  const rect = card.getBoundingClientRect();
  const dx   = (e.clientX - rect.left - rect.width/2)  / (rect.width/2);
  const dy   = (e.clientY - rect.top  - rect.height/2) / (rect.height/2);
  card.style.transform = `perspective(800px) rotateX(${-dy*6}deg) rotateY(${dx*6}deg) translateY(-10px) scale(1.02)`;
}
function resetTilt(card) { card.style.transform = ''; }

// ── CARRITO ────────────────────────────────
function guardarCarrito()   { localStorage.setItem('kawaii_cart', JSON.stringify(cart)); }
function actualizarContador() {
  const total = cart.reduce((acc, i) => acc + i.cantidad, 0);
  const el    = document.getElementById('cartCount');
  el.textContent = total;
  if (total > 0) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 300); }
}

function agregarAlCarrito(producto) {
  const existente = cart.find(i => i.id === producto.id);
  if (existente) {
    existente.cantidad++;
  } else {
    cart.push({ ...producto, cantidad: 1 });
  }
  guardarCarrito();
  renderCarrito();
  actualizarContador();
  abrirCarrito();
}

function renderCarrito() {
  const container = document.getElementById('cartItems');
  const footer    = document.getElementById('cartBottom');
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty"><div>🛒</div><p>Tu carrito está vacío</p><small>Agrega soportes kawaii</small></div>`;
    footer.style.display = 'none';
    return;
  }
  footer.style.display = 'block';
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.imagen_url}" alt="${item.nombre}"/>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-price">$${(item.precio * item.cantidad).toFixed(0)} MXN</div>
        <div class="cart-item-actions">
          <button class="qty-btn" onclick="cambiarCantidad('${item.id}', -1)">−</button>
          <span class="qty-num">${item.cantidad}</span>
          <button class="qty-btn" onclick="cambiarCantidad('${item.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-remove" onclick="eliminarDelCarrito('${item.id}')">✕</button>
    </div>
  `).join('');
  const total = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  document.getElementById('cartTotal').textContent = `$${total.toFixed(0)} MXN`;
}

function cambiarCantidad(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) cart = cart.filter(i => i.id !== id);
  guardarCarrito(); renderCarrito(); actualizarContador();
}

function eliminarDelCarrito(id) {
  cart = cart.filter(i => i.id !== id);
  guardarCarrito(); renderCarrito(); actualizarContador();
}

// ── ABRIR / CERRAR CARRITO ─────────────────
function abrirCarrito() {
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function cerrarCarrito() {
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('cartTrigger').addEventListener('click', abrirCarrito);
document.getElementById('cartClose').addEventListener('click', cerrarCarrito);
document.getElementById('cartOverlay').addEventListener('click', cerrarCarrito);

// ── MODAL CHECKOUT ─────────────────────────
function abrirModal() {
  if (cart.length === 0) { mostrarToast('Tu carrito está vacío 😅'); return; }

  // VERIFICAR LOGIN OBLIGATORIO
  if (!usuarioActual) {
    cerrarCarrito();
    mostrarToast('Debes iniciar sesión para comprar 🔒');
    setTimeout(() => document.getElementById('modalLogin').classList.add('open'), 500);
    return;
  }

  cerrarCarrito();

  // Mostrar datos del usuario en el checkout
  document.getElementById('checkoutUserInfo').innerHTML = `
    <div class="user-info-checkout">
      <div><strong>👤 ${usuarioActual.nombre}</strong></div>
      <div>📧 ${usuarioActual.email}</div>
    </div>
  `;

  // Llenar resumen
  const summary = document.getElementById('orderSummary');
  summary.innerHTML = cart.map(item => `
    <div class="order-item">
      <img src="${item.imagen_url}" alt="${item.nombre}"/>
      <span class="order-item-name">${item.nombre}</span>
      <span class="order-item-qty">×${item.cantidad}</span>
      <span class="order-item-price">$${(item.precio * item.cantidad).toFixed(0)}</span>
    </div>
  `).join('');

  const total = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  document.getElementById('modalTotal').textContent = `$${total.toFixed(0)} MXN`;
  document.getElementById('modalBg').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  document.getElementById('modalBg').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnGoCheckout').addEventListener('click', abrirModal);
document.getElementById('modalClose').addEventListener('click', cerrarModal);
document.getElementById('modalBg').addEventListener('click', e => {
  if (e.target === document.getElementById('modalBg')) cerrarModal();
});

// ── FORMULARIO Y PAGO ──────────────────────
document.getElementById('checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();

  const direccion = document.getElementById('inp-dir').value.trim();
  if (!direccion) { mostrarToast('Ingresa tu dirección de envío ⚠️'); return; }

  const btnPay   = document.getElementById('btnPay');
  const payText  = document.getElementById('payText');
  const paySpinn = document.getElementById('paySpinner');
  btnPay.disabled = true;
  payText.style.display  = 'none';
  paySpinn.style.display = 'block';

  try {
    const total = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

    // Guardar pedido en Supabase con usuario_id
    const { data: pedido, error: pedidoError } = await db
      .from('ventas')
      .insert([{
        usuario_id:       usuarioActual.id,
        usuario_nombre:   usuarioActual.nombre,
        usuario_email:    usuarioActual.email,
        usuario_direccion: direccion,
        monto_total:      total,
        estado:           'pending',
        items:            cart,
      }])
      .select()
      .single();

    if (pedidoError) console.warn('Error guardando pedido:', pedidoError.message);

    // Llamar al backend para crear sesión de Stripe
    const response = await fetch(`${BACKEND_URL}/crear-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        cliente: {
          nombre:     usuarioActual.nombre,
          email:      usuarioActual.email,
          telefono:   '',
          direccion,
          usuario_id: usuarioActual.id,
        },
        pedido_id: pedido?.id ?? null,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al crear sesión de pago');
    }

    const { url } = await response.json();
    window.location.href = url;

  } catch (err) {
    console.error('Error en checkout:', err);
    mostrarToast(`Error: ${err.message} ❌`);
    btnPay.disabled = false;
    payText.style.display  = 'block';
    paySpinn.style.display = 'none';
  }
});

// ── TOAST ──────────────────────────────────
let toastTimeout;
function mostrarToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  actualizarNavAuth();
  cargarProductos();
  renderCarrito();
  actualizarContador();
});
