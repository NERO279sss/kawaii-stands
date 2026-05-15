// =============================================
//  KAWAII STANDS — script.js
//  Supabase + Carrito + Stripe Checkout
// =============================================

// ── CONFIGURACIÓN ──────────────────────────
const SUPABASE_URL  = 'https://tewjxalurcnfuxzuolmm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRld2p4YWx1cmNuZnV4enVvbG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyMTMsImV4cCI6MjA5NDM1MzIxM30.4DgMTn2cmELYVAZ2kkikd5Lr1wRGq8Cf5bkrwGZwCvU';
const BACKEND_URL = 'https://kawaii-stands.onrender.com'; // Cambia por tu URL de producción

// Inicializar Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── ESTADO GLOBAL ──────────────────────────
let cart = JSON.parse(localStorage.getItem('kawaii_cart') || '[]');

// Productos fallback (mientras Supabase carga o si hay error)
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

document.addEventListener('mousemove', e => {
  mX = e.clientX; mY = e.clientY;
  cursor.style.left = mX + 'px';
  cursor.style.top  = mY + 'px';
});

(function animFollower() {
  fX += (mX - fX) * .12;
  fY += (mY - fY) * .12;
  follower.style.left = fX + 'px';
  follower.style.top  = fY + 'px';
  requestAnimationFrame(animFollower);
})();

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.width    = '16px';
    cursor.style.height   = '16px';
    follower.style.width  = '52px';
    follower.style.height = '52px';
  });
  el.addEventListener('mouseleave', () => {
    cursor.style.width    = '10px';
    cursor.style.height   = '10px';
    follower.style.width  = '36px';
    follower.style.height = '36px';
  });
});

// ── NAVBAR SCROLL ──────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── PRODUCTOS ──────────────────────────────
async function cargarProductos() {
  let productos = [];

  try {
    const { data, error } = await db
      .from('productos')
      .select('*')
      .order('especial', { ascending: true })
      .order('nombre',   { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      productos = data;
    } else {
      // Supabase vacío → usar fallback y también insertar
      productos = PRODUCTOS_FALLBACK;
      await insertarProductosFallback();
    }
  } catch (err) {
    console.warn('Supabase no disponible, usando fallback:', err.message);
    productos = PRODUCTOS_FALLBACK;
  }

  renderProductos(productos);
}

async function insertarProductosFallback() {
  try {
    const rows = PRODUCTOS_FALLBACK.map(p => ({
      nombre:      p.nombre,
      descripcion: p.descripcion,
      precio:      p.precio,
      imagen_url:  p.imagen_url,
      especial:    p.especial,
      stock:       p.stock,
    }));
    await db.from('productos').upsert(rows, { onConflict: 'nombre' });
  } catch (e) {
    console.warn('No se pudo insertar fallback en Supabase:', e.message);
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  // Ordenar: normales primero, especiales al final
  const normales  = productos.filter(p => !p.especial);
  const especiales = productos.filter(p => p.especial);
  const ordenados = [...normales, ...especiales];

  ordenados.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'product-card' + (p.especial ? ' special' : '');
    card.style.animationDelay = `${i * 0.05}s`;

    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy"
             onerror="this.src='imgs/CONEJO_S.png'"/>
      </div>
      <div class="card-body">
        <div class="card-name">${p.nombre}</div>
        <div class="card-desc">${p.descripcion}</div>
        <div class="card-stock">Stock: ${p.stock ?? '∞'}</div>
        <div class="card-footer">
          <div>
            <div class="card-price ${p.especial ? 'special-price' : ''}">
              $${Number(p.precio).toFixed(0)} MXN
            </div>
          </div>
          <button class="btn-add" data-id="${p.id}" data-name="${p.nombre}"
                  data-price="${p.precio}" data-img="${p.imagen_url}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Agregar
          </button>
        </div>
      </div>
    `;

    // Efecto tilt 3D en la card
    card.addEventListener('mousemove', e => tiltCard(e, card));
    card.addEventListener('mouseleave', () => resetTilt(card));

    grid.appendChild(card);
  });

  // Evento delegado para botones Agregar
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    agregarAlCarrito({
      id:    btn.dataset.id,
      nombre: btn.dataset.name,
      precio: parseFloat(btn.dataset.price),
      imagen_url: btn.dataset.img,
    });
    btn.textContent = '✓ Agregado';
    btn.classList.add('added');
    setTimeout(() => {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Agregar`;
      btn.classList.remove('added');
    }, 1800);
  });

  // Intersection Observer para animar entrada
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card').forEach(card => {
    card.style.opacity = '0';
    observer.observe(card);
  });
}

// ── EFECTO TILT 3D ─────────────────────────
function tiltCard(e, card) {
  const rect   = card.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const dx     = (e.clientX - cx) / (rect.width  / 2);
  const dy     = (e.clientY - cy) / (rect.height / 2);
  const rotX   = -dy * 6;
  const rotY   =  dx * 6;
  card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-10px) scale(1.02)`;
}
function resetTilt(card) {
  card.style.transform = '';
}

// ── CARRITO ────────────────────────────────
function agregarAlCarrito(producto) {
  const existente = cart.find(item => item.id === producto.id);
  if (existente) {
    existente.cantidad++;
  } else {
    cart.push({ ...producto, cantidad: 1 });
  }
  guardarCarrito();
  renderCarrito();
  actualizarContador();
  mostrarToast(`${producto.nombre} agregado 🎉`);
  abrirCarrito();
}

function guardarCarrito() {
  localStorage.setItem('kawaii_cart', JSON.stringify(cart));
}

function actualizarContador() {
  const total = cart.reduce((acc, i) => acc + i.cantidad, 0);
  const el = document.getElementById('cartCount');
  el.textContent = total;
  if (total > 0) {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 300);
  }
}

function renderCarrito() {
  const container = document.getElementById('cartItems');
  const footer    = document.getElementById('cartBottom');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div>🛒</div>
        <p>Tu carrito está vacío</p>
        <small>Agrega soportes kawaii</small>
      </div>`;
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
  if (item.cantidad <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  guardarCarrito();
  renderCarrito();
  actualizarContador();
}

function eliminarDelCarrito(id) {
  cart = cart.filter(i => i.id !== id);
  guardarCarrito();
  renderCarrito();
  actualizarContador();
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
  if (cart.length === 0) {
    mostrarToast('Tu carrito está vacío 😅');
    return;
  }
  cerrarCarrito();

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
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre   = document.getElementById('inp-nombre').value.trim();
  const email    = document.getElementById('inp-email').value.trim();
  const telefono = document.getElementById('inp-tel').value.trim();
  const direccion = document.getElementById('inp-dir').value.trim();

  // Validación básica
  let valid = true;
  [['inp-nombre', nombre], ['inp-email', email], ['inp-dir', direccion]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!val) { el.classList.add('error'); valid = false; }
    else       { el.classList.remove('error'); }
  });
  if (!valid) { mostrarToast('Completa los campos requeridos ⚠️'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('inp-email').classList.add('error');
    mostrarToast('Correo inválido ⚠️');
    return;
  }

  // Mostrar spinner
  const btnPay   = document.getElementById('btnPay');
  const payText  = document.getElementById('payText');
  const paySpinn = document.getElementById('paySpinner');
  btnPay.disabled  = true;
  payText.style.display  = 'none';
  paySpinn.style.display = 'block';

  try {
    // Guardar pedido en Supabase con estado "pending"
    const total = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

    const { data: pedido, error: pedidoError } = await db
      .from('ventas')
      .insert([{
        usuario_nombre:  nombre,
        usuario_email:   email,
        usuario_telefono: telefono,
        usuario_direccion: direccion,
        monto_total:     total,
        estado:          'pending',
        items:           JSON.stringify(cart),
      }])
      .select()
      .single();

    if (pedidoError) {
      console.warn('Error guardando pedido:', pedidoError.message);
      // Continuar de todos modos con el pago
    }

    // Llamar al backend para crear sesión de Stripe
    const response = await fetch(`${BACKEND_URL}/crear-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        cliente: { nombre, email, telefono, direccion },
        pedido_id: pedido?.id ?? null,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al crear sesión de pago');
    }

    const { url } = await response.json();
    window.location.href = url; // Redirigir a Stripe Checkout

  } catch (err) {
    console.error('Error en checkout:', err);
    mostrarToast(`Error: ${err.message} ❌`);
    btnPay.disabled  = false;
    payText.style.display  = 'block';
    paySpinn.style.display = 'none';
  }
});

// ── TOAST ──────────────────────────────────
let toastTimeout;
function mostrarToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
  renderCarrito();
  actualizarContador();
});
