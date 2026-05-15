// =============================================
//  KAWAII STANDS — server.js
//  Backend: Node.js + Express + Stripe
// =============================================

// IMPORTANTE: Cargar dotenv PRIMERO, antes de cualquier otra cosa
require('dotenv').config({ path: './.env' });
const express    = require('express');
const cors       = require('cors');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = 3001;

// Supabase con variables directas (para desarrollo)
const db = createClient(
  'https://tewjxalurcnfuxzuolmm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRld2p4YWx1cmNuZnV4enVvbG1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc3NzIxMywiZXhwIjoyMDk0MzUzMjEzfQ.IP0WwHrNT2X7381m6KdDc6HZTlhdPs_hB3k30uWLLJ8'
);

// ── MIDDLEWARES ────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));

// Webhook de Stripe necesita el body RAW (antes de json())
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── RUTA: Crear sesión de Stripe Checkout ──
app.post('/crear-sesion', async (req, res) => {
  const { items, cliente, pedido_id } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Carrito vacío' });
  }

  try {
    // Construir line_items para Stripe
    const line_items = items.map(item => ({
      price_data: {
        currency:     'mxn',
        product_data: {
          name:   item.nombre,
          images: [`${process.env.FRONTEND_URL || 'http://localhost:5500'}/imgs/${item.imagen_url.split('/').pop()}`],
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

    res.json({ url: session.url, session_id: session.id });

  } catch (err) {
    console.error('Error creando sesión Stripe:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RUTA: Webhook de Stripe ─────────────────
// Stripe llama aquí cuando el pago es completado
app.post('/webhook', async (req, res) => {
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook inválido:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Pago completado
  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object;
    const pedidoId  = session.metadata?.pedido_id;
    const email     = session.customer_email;
    const monto     = session.amount_total / 100; // Convertir centavos a pesos

    console.log(`✅ Pago completado: ${email} — $${monto} MXN`);

    try {
      if (pedidoId) {
        // Actualizar estado del pedido existente
        await db.from('ventas')
          .update({
            estado:            'completed',
            stripe_session_id: session.id,
            updated_at:        new Date().toISOString(),
          })
          .eq('id', pedidoId);
      } else {
        // Crear nuevo registro si no existe
        await db.from('ventas').insert([{
          stripe_session_id:  session.id,
          usuario_email:      email,
          usuario_nombre:     session.metadata?.cliente_nombre ?? '',
          usuario_telefono:   session.metadata?.cliente_tel ?? '',
          usuario_direccion:  session.metadata?.cliente_dir ?? '',
          monto_total:        monto,
          estado:             'completed',
        }]);
      }
    } catch (dbErr) {
      console.error('Error actualizando Supabase:', dbErr.message);
    }
  }

  // Pago fallido
  if (event.type === 'checkout.session.expired') {
    const session  = event.data.object;
    const pedidoId = session.metadata?.pedido_id;
    if (pedidoId) {
      await db.from('ventas').update({ estado: 'cancelled' }).eq('id', pedidoId);
    }
  }

  res.json({ received: true });
});

// ── RUTA: Verificar sesión de pago ──────────
app.get('/verificar-pago/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({
      pagado:  session.payment_status === 'paid',
      email:   session.customer_email,
      monto:   session.amount_total / 100,
      moneda:  session.currency.toUpperCase(),
      status:  session.payment_status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── RUTA: Health check ──────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── ARRANCAR SERVIDOR ───────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Stripe en modo: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'TEST' : 'PRODUCCIÓN'}`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}\n`);
});