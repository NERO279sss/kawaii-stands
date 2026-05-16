// =============================================
//  KAWAII STANDS — server.js (CORREGIDO)
//  Backend: Node.js + Express + Stripe
// =============================================

// IMPORTANTE: Cargar dotenv PRIMERO, antes de cualquier otra cosa
require('dotenv').config({ path: './.env' });
const express    = require('express');
const cors       = require('cors');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3001;

// Supabase con variables de entorno
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── MIDDLEWARES ────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// Webhook de Stripe necesita el body RAW (antes de json())
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── LOG DE ARRANQUE ────────────────────────
console.log(`\n🚀 KAWAII STANDS BACKEND INICIANDO...`);
console.log(`📦 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? '🧪 TEST' : '🔴 PRODUCCIÓN'}`);
console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
console.log(`⚡ Puerto: ${PORT}\n`);

// ── RUTA: Crear sesión de Stripe Checkout ──
app.post('/crear-sesion', async (req, res) => {
  const { items, cliente, pedido_id } = req.body;

  console.log(`[POST /crear-sesion] Cliente: ${cliente?.email}`);

  if (!items || items.length === 0) {
    console.error('[ERROR] Carrito vacío');
    return res.status(400).json({ error: 'Carrito vacío' });
  }

  try {
    // Construir line_items para Stripe
    const line_items = items.map(item => ({
      price_data: {
        currency:     'mxn',
        product_data: {
          name:   item.nombre,
          images: [
            `${process.env.FRONTEND_URL || 'http://localhost:5500'}/imgs/${item.imagen_url.split('/').pop()}`
          ],
        },
        unit_amount: Math.round(item.precio * 100), // Stripe usa centavos
      },
      quantity: item.cantidad,
    }));

    // Crear sesión en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: cliente.email,
      metadata: {
        pedido_id:  pedido_id?.toString() ?? '',
        cliente_nombre: cliente.nombre,
        cliente_tel:    cliente.telefono ?? '',
        cliente_dir:    cliente.direccion,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5500'}/index.html?cancelado=1`,
      locale: 'es',
    });

    console.log(`[✓] Sesión Stripe creada: ${session.id}`);
    res.json({ url: session.url, session_id: session.id });

  } catch (err) {
    console.error('[ERROR] Creando sesión Stripe:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RUTA: Webhook de Stripe ─────────────────
// Stripe llama aquí cuando el pago es completado
app.post('/webhook', async (req, res) => {
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('[WEBHOOK] Evento recibido de Stripe');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
    console.log(`[✓] Webhook verificado: ${event.type}`);
  } catch (err) {
    console.error('[ERROR] Webhook inválido:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Pago completado
  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object;
    const pedidoId  = session.metadata?.pedido_id;
    const email     = session.customer_email;
    const monto     = session.amount_total / 100; // Convertir centavos a pesos

    console.log(`[✅ PAGO COMPLETADO] ${email} — $${monto} MXN`);

    try {
      if (pedidoId) {
        // Actualizar estado del pedido existente
        const { error } = await db.from('ventas')
          .update({
            estado:            'completed',
            stripe_session_id: session.id,
            updated_at:        new Date().toISOString(),
          })
          .eq('id', pedidoId);
        
        if (error) {
          console.error('[DB ERROR] Actualizando pedido:', error.message);
        } else {
          console.log(`[✓] Pedido ${pedidoId} actualizado en Supabase`);
        }
      } else {
        // Crear nuevo registro si no existe
        const { error } = await db.from('ventas').insert([{
          stripe_session_id:  session.id,
          usuario_email:      email,
          usuario_nombre:     session.metadata?.cliente_nombre ?? '',
          usuario_telefono:   session.metadata?.cliente_tel ?? '',
          usuario_direccion:  session.metadata?.cliente_dir ?? '',
          monto_total:        monto,
          estado:             'completed',
        }]);
        
        if (error) {
          console.error('[DB ERROR] Creando venta:', error.message);
        } else {
          console.log(`[✓] Nueva venta registrada en Supabase`);
        }
      }
    } catch (dbErr) {
      console.error('[ERROR] Guardando en Supabase:', dbErr.message);
    }
  }

  // Pago fallido/expirado
  if (event.type === 'checkout.session.expired') {
    const session  = event.data.object;
    const pedidoId = session.metadata?.pedido_id;
    console.log(`[⏱️  SESIÓN EXPIRADA] Pedido: ${pedidoId}`);
    
    if (pedidoId) {
      await db.from('ventas').update({ estado: 'cancelled' }).eq('id', pedidoId);
    }
  }

  res.json({ received: true });
});

// ── RUTA: Verificar sesión de pago ──────────
app.get('/verificar-pago/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  console.log(`[GET /verificar-pago] Session: ${sessionId}`);
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const resultado = {
      pagado:  session.payment_status === 'paid',
      email:   session.customer_email,
      monto:   session.amount_total / 100,
      moneda:  session.currency.toUpperCase(),
      status:  session.payment_status,
    };
    console.log(`[✓] Sesión verificada:`, resultado);
    res.json(resultado);
  } catch (err) {
    console.error('[ERROR] Verificando pago:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RUTA: Health check ──────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── MANEJO DE ERRORES ───────────────────────
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── ARRANCAR SERVIDOR ───────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Servidor KAWAII STANDS corriendo en puerto ${PORT}`);
  console.log(`🔗 Visitá: http://localhost:${PORT}/health`);
  console.log(`\n🎮 Listo para procesar pagos de soportes kawaii 🐾\n`);
});
