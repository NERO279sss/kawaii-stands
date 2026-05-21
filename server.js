// =============================================
//  KAWAII STANDS — server.js v3
//  Backend: Node.js + Express + Stripe + Auth
// =============================================

require('dotenv').config({ path: './.env' });
const express  = require('express');
const cors     = require('cors');
const crypto   = require('crypto');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3001;

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── CORS ───────────────────────────────────
const corsOptions = {
  origin: [
    'https://soportes-3d.netlify.app',
    'https://soporte-cel.netlify.app',
    'http://localhost:5500',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'stripe-signature'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Webhook necesita body RAW
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── HELPERS ────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'kawaii_salt_2024').digest('hex');
}

// ── LOG DE ARRANQUE ────────────────────────
console.log(`\n🚀 KAWAII STANDS BACKEND v3 INICIANDO...`);
console.log(`📦 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? '🧪 TEST' : '🔴 PRODUCCIÓN'}`);
console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
console.log(`⚡ Puerto: ${PORT}\n`);

// ── AUTH: REGISTRO ─────────────────────────
app.post('/auth/registro', async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const { data: existe } = await db
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existe) {
      return res.status(409).json({ error: 'Este correo ya está registrado' });
    }

    const password_hash = hashPassword(password);

    const { data, error } = await db
      .from('usuarios')
      .insert([{ nombre, email: email.toLowerCase(), password_hash }])
      .select('id, nombre, email, created_at')
      .single();

    if (error) throw error;

    console.log(`[✓] Usuario registrado: ${email}`);
    res.json({ usuario: data });

  } catch (err) {
    console.error('[ERROR] Registro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH: LOGIN ────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const password_hash = hashPassword(password);

    const { data: usuario, error } = await db
      .from('usuarios')
      .select('id, nombre, email, created_at')
      .eq('email', email.toLowerCase())
      .eq('password_hash', password_hash)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    console.log(`[✓] Login exitoso: ${email}`);
    res.json({ usuario });

  } catch (err) {
    console.error('[ERROR] Login:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH: HISTORIAL DE COMPRAS ─────────────
app.get('/auth/historial/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const { data, error } = await db
      .from('ventas')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ ventas: data || [] });

  } catch (err) {
    console.error('[ERROR] Historial:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── STRIPE: Crear sesión de Checkout ───────
app.post('/crear-sesion', async (req, res) => {
  const { items, cliente, pedido_id } = req.body;

  console.log(`[POST /crear-sesion] Cliente: ${cliente?.email}`);

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Carrito vacío' });
  }

  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: item.nombre,
          images: [`${process.env.FRONTEND_URL || 'http://localhost:5500'}/imgs/${item.imagen_url.split('/').pop()}`],
        },
        unit_amount: Math.round(item.precio * 100),
      },
      quantity: item.cantidad,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: cliente.email,
      metadata: {
        pedido_id:      pedido_id?.toString() ?? '',
        usuario_id:     cliente.usuario_id ?? '',
        cliente_nombre: cliente.nombre,
        cliente_tel:    cliente.telefono ?? '',
        cliente_dir:    cliente.direccion,
        items:          JSON.stringify(items),
      },
      success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/index.html?cancelado=1`,
      locale: 'es',
    });

    console.log(`[✓] Sesión Stripe creada: ${session.id}`);
    res.json({ url: session.url, session_id: session.id });

  } catch (err) {
    console.error('[ERROR] Creando sesión Stripe:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── STRIPE: Webhook ─────────────────────────
app.post('/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[ERROR] Webhook inválido:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object;
    const pedidoId  = session.metadata?.pedido_id;
    const usuarioId = session.metadata?.usuario_id;
    const email     = session.customer_email;
    const monto     = session.amount_total / 100;
    const items     = session.metadata?.items ? JSON.parse(session.metadata.items) : [];

    console.log(`[✅ PAGO COMPLETADO] ${email} — $${monto} MXN`);

    try {
      if (pedidoId) {
        await db.from('ventas')
          .update({ estado: 'completed', stripe_session_id: session.id, updated_at: new Date().toISOString() })
          .eq('id', pedidoId);
      } else {
        await db.from('ventas').insert([{
          stripe_session_id: session.id,
          usuario_id:        usuarioId || null,
          usuario_email:     email,
          usuario_nombre:    session.metadata?.cliente_nombre ?? '',
          usuario_telefono:  session.metadata?.cliente_tel ?? '',
          usuario_direccion: session.metadata?.cliente_dir ?? '',
          monto_total:       monto,
          estado:            'completed',
          items:             items,
        }]);
      }

      // ── DESCONTAR STOCK ───────────────────
      for (const item of items) {
        const { data: producto } = await db
          .from('productos')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (producto) {
          const nuevoStock = Math.max(0, (producto.stock || 0) - (item.cantidad || 1));
          await db.from('productos').update({ stock: nuevoStock }).eq('id', item.id);
          console.log(`[✓] Stock: producto ${item.id} → ${nuevoStock}`);
        }
      }

    } catch (dbErr) {
      console.error('[ERROR] BD:', dbErr.message);
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session  = event.data.object;
    const pedidoId = session.metadata?.pedido_id;
    if (pedidoId) {
      await db.from('ventas').update({ estado: 'cancelled' }).eq('id', pedidoId);
    }
  }

  res.json({ received: true });
});

// ── Verificar pago ──────────────────────────
app.get('/verificar-pago/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    const { data: venta } = await db
      .from('ventas')
      .select('id, items, monto_total, estado, usuario_id')
      .eq('stripe_session_id', session.id)
      .single();

    res.json({
      pagado:   session.payment_status === 'paid',
      email:    session.customer_email,
      monto:    session.amount_total / 100,
      moneda:   session.currency.toUpperCase(),
      status:   session.payment_status,
      venta_id: venta?.id ?? null,
      items:    venta?.items ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}\n`);
});
