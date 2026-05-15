/**
 *
 * Real OTP via Twilio Verify SMS
 
 * Uganda Wildlife Sanctuary — Express Server
 * Admin Dashboard API included
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');




const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');

const twilio = require('twilio');

const app  = express();
const PORT = process.env.PORT || 3000;


if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing");
}

// const sequelize = new Sequelize(process.env.DATABASE_URL, {  
//   dialect: 'postgres',
//   protocol: 'postgres',
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false
//     }
//   }
// });

// sequelize.authenticate()
// .then(() => {
//   console.log('PostgreSQL Connected');
// })
// .catch((err) => {
//   console.log(err);
// });




// const Booking = sequelize.define('Booking', {

//   booking_id: {
//     type: DataTypes.STRING,
//     allowNull: false
//   },

//   park_name: DataTypes.STRING,

//   visit_date: DataTypes.STRING,

//   entry_time: DataTypes.STRING,

//   full_name: DataTypes.STRING,

//   email: DataTypes.STRING,

//   phone_number: DataTypes.STRING,

//   total_amount_usd: DataTypes.FLOAT,

//   payment_status: DataTypes.STRING,

//   status: DataTypes.STRING,

//   payment_id: DataTypes.STRING,

//   booking_reference: DataTypes.STRING

// });


// sequelize.sync({ alter: true })
// .then(() => {
//   console.log('Database Synced');
// });




















app.use(cors({
  origin: [
    "https://ugandaproject.vercel.app",
    "http://localhost:3000"
  ],
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const serviceSid = process.env.TWILIO_SERVICE_SID;


// ── In-memory stores ──────────────────────────────────────────
const users    = {};   // identifier → user object
const bookings = {};   // booking_id → booking object

bookings["demo1"] = {
  booking_id: "WE-DEMO-001",
  park_name: "Bwindi Forest",
  status: "confirmed",
  payment_status: "paid",
  amount_paid: 120,
  total_amount_inr: 120,
  created_at: new Date().toISOString(),
  booking_holder: {
    full_name: "Demo User",
    email: "demo@test.com",
    phone_number: "+911234567890"
  }
};

bookings["demo2"] = {
  booking_id: "WE-DEMO-002",
  park_name: "Queen Elizabeth Park",
  status: "confirmed",
  payment_status: "paid",
  amount_paid: 220,
  total_amount_inr: 120,
  created_at: new Date().toISOString(),
  booking_holder: {
    full_name: "John Visitor",
    email: "john@test.com",
    phone_number: "+911111111111"
  }
};

// ══════════════════════════════════════════════════════════════
// OTP DELIVERY CONFIG
// Set these via environment variables or edit below directly
// ══════════════════════════════════════════════════════════════
const CONFIG = {



  // Admin dashboard password
  ADMIN_SECRET  : process.env.ADMIN_SECRET   || 'uws-admin-2024',


};

// ══════════════════════════════════════════════════════════════
// NODEMAILER — lazy-load so server starts even if not installed
// ══════════════════════════════════════════════════════════════




// ══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['*'] }));
app.use(express.json());
app.use(express.static(__dirname));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use(express.static(path.join(__dirname, 'public')));

// Simple admin auth middleware
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== CONFIG.ADMIN_SECRET) return res.status(401).json({ detail: 'Unauthorized' });
  next();
}

// ── Serve index.html ──────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ══════════════════════════════════════════════════════════════
// OPENAPI SPEC
// ══════════════════════════════════════════════════════════════
const OPENAPI_SPEC = {
  openapi: '3.0.0',
  info: { title: 'WildEye API', version: '2.0.0', description: 'Uganda Wildlife Sanctuary — Real OTP Edition' },
  paths: {
    '/api/v1/auth/send-otp'   : { post: { summary: 'Send real OTP via email or SMS' } },
    '/api/v1/auth/verify-otp' : { post: { summary: 'Verify OTP' } },
    '/api/v1/auth/register'   : { post: { summary: 'Register user' } },
    '/api/v1/bookings'        : { post: { summary: 'Create booking' }, get: { summary: 'List bookings (admin)' } },
    '/api/v1/bookings/{id}'   : { get: { summary: 'Get booking' }, delete: { summary: 'Cancel booking' } },
    '/api/v1/bookings/cancel' : { post: { summary: 'Cancel booking by reference' } },
    '/api/v1/payments/confirm': { post: { summary: 'Confirm payment' } },
    '/api/v1/admin/stats'     : { get: { summary: 'Dashboard stats (admin)' } },
    '/api/v1/admin/bookings'  : { get: { summary: 'All bookings (admin)' } },
  }
};

app.get('/openapi.json',     (req, res) => res.json(OPENAPI_SPEC));
app.get('/api/openapi.json', (req, res) => res.json(OPENAPI_SPEC));

app.get('/docs', (req, res) => {
  res.send(`<!DOCTYPE html><html><head>
    <title>WildEye API Docs</title><meta charset="utf-8"/>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head><body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>SwaggerUIBundle({ url:'/openapi.json', dom_id:'#swagger-ui' })</script>
  </body></html>`);
});

// ══════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════

// POST /api/v1/auth/send-otp
app.post('/api/v1/auth/send-otp', async (req, res) => {

  try {

    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        detail: 'phone_number required'
      });
    }

    await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: phone_number,
        channel: 'sms'
      });

    res.json({
      success: true,
      message: 'OTP Sent Successfully'
    });

  } catch(error){

    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

});

app.post('/api/v1/auth/verify-otp', async (req, res) => {

  try {

    const { phone_number, otp } = req.body;

    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks
      .create({
        to: phone_number,
        code: otp
      });

    if (verificationCheck.status === 'approved') {

      res.json({
        success: true,
        verified: true
      });

    } else {

      res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });

    }

  } catch(error){

    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

});

// POST /api/v1/auth/register
app.post('/api/v1/auth/register', (req, res) => {
  const { name, email, phone_number } = req.body;
  const identifier = (email || phone_number || '').trim();
  if (!identifier) return res.status(400).json({ detail: 'email or phone_number required' });
  if (!users[identifier]) {
    users[identifier] = {
      id         : crypto.randomUUID(),
      name       : name || 'Visitor',
      email      : email || '',
      phone      : phone_number || '',
      created_at : new Date().toISOString(),
    };
  } else if (name) {
    users[identifier].name = name;
  }
  res.json({ success: true, user: users[identifier] });
});

// ══════════════════════════════════════════════════════════════
// BOOKING ENDPOINTS
// ══════════════════════════════════════════════════════════════

// POST /api/v1/bookings
// app.post('/api/v1/bookings', async (req, res) => {

//   try {

//     const data = req.body;

//     const id = 'WE-' + Date.now().toString(36).toUpperCase();

//     const booking = await Booking.create({

//       booking_id: id,

//       park_name: data.park_name,

//       visit_date: data.visit_date,

//       entry_time: data.entry_time,

//       full_name: data.booking_holder?.full_name,

//       email: data.booking_holder?.email,

//       phone_number: data.booking_holder?.phone_number,

//       total_amount_usd: data.total_amount_usd,

//       payment_status: data.payment_status,

//       status: data.status,

//       payment_id: data.payment_id,

//       booking_reference: data.booking_reference

//     });

//     res.status(201).json({
//       success: true,
//       booking
//     });

//   } catch(err) {

//     console.log(err);

//     res.status(500).json({
//       success: false,
//       error: err.message
//     });

//   }

// });

// GET /api/v1/bookings/:id
// app.get('/api/v1/bookings/:id', (req, res) => {
//   const booking = bookings[req.params.id];
//   if (!booking) return res.status(404).json({ detail: 'Booking not found' });
//   res.json(booking);
// });


app.post('/api/v1/bookings', (req, res) => {
  res.json({
    success: true,
    message: "Booking temporarily disabled"
  });
});

app.get('/api/v1/bookings/:id', (req, res) => {
  res.json({
    success: true,
    message: "Booking lookup temporarily disabled"
  });
});

// app.get('/api/v1/bookings/:id', async (req, res) => {

//   try {

//     const booking = await Booking.findOne({
//       where: {
//         booking_id: req.params.id
//       }
//     });

//     if (!booking) {
//       return res.status(404).json({
//         detail: 'Booking not found'
//       });
//     }

//     res.json({
//       success: true,
//       booking
//     });

//   } catch(err) {

//     console.log(err);

//     res.status(500).json({
//       success: false,
//       error: err.message
//     });

//   }

// });








// DELETE /api/v1/bookings/:id
app.delete('/api/v1/bookings/:id', (req, res) => {
  const booking = bookings[req.params.id];
  if (!booking) return res.status(404).json({ detail: 'Booking not found' });
  booking.status       = 'cancelled';
  booking.cancelled_at = new Date().toISOString();
  console.log(`[BOOKING] Cancelled: ${req.params.id}`);
  res.json({ success: true, message: 'Booking cancelled', booking });
});

// POST /api/v1/bookings/cancel
app.post('/api/v1/bookings/cancel', (req, res) => {
  const { booking_reference, ticket_id, cancellation_reason } = req.body;
  const id      = booking_reference || ticket_id;
  const booking = bookings[id];
  if (!booking) return res.json({ success: true, message: 'Cancellation recorded', id });
  booking.status               = 'cancelled';
  booking.cancellation_reason  = cancellation_reason || 'Visitor request';
  booking.cancelled_at         = new Date().toISOString();
  console.log(`[BOOKING] Cancelled: ${id}`);
  res.json({ success: true, message: 'Booking cancelled', booking });
});

// ══════════════════════════════════════════════════════════════
// PAYMENT ENDPOINTS
// ══════════════════════════════════════════════════════════════

// POST /api/v1/payments/confirm
app.post('/api/v1/payments/confirm', (req, res) => {
  const { booking_id, payment_id, amount_paid, currency, payment_method, status } = req.body;
  const booking = bookings[booking_id];
  if (booking) {
    booking.payment_status = status || 'paid';
    booking.payment_id     = payment_id;
    booking.amount_paid    = amount_paid;
    booking.currency       = currency || 'INR';
    booking.paid_at        = new Date().toISOString();
    booking.status         = 'confirmed';
  }
  console.log(`[PAYMENT] ✓ Confirmed — Booking: ${booking_id} | Txn: ${payment_id} | $${amount_paid}`);
  res.json({ success: true, message: 'Payment confirmed', payment_id, booking_id });
});

// ══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD ENDPOINTS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/admin/stats
app.get('/api/v1/admin/stats', adminAuth, (req, res) => {
  const allBookings = Object.values(bookings);
  const uniqueIds   = new Set();
  const deduped     = allBookings.filter(b => {
    if (uniqueIds.has(b.booking_id)) return false;
    uniqueIds.add(b.booking_id);
    return true;
  });

  const confirmed  = deduped.filter(b => b.status === 'confirmed');
  const cancelled  = deduped.filter(b => b.status === 'cancelled');
  const paid       = deduped.filter(b => b.payment_status === 'paid');

  const totalRevenue = paid.reduce((s, b) => s + (Number(b.total_amount_inr) || Number(b.amount_paid) || 0), 0);

  // Park breakdown
  const parkMap = {};
  deduped.forEach(b => {
    const p = b.park_name || 'Unknown';
    if (!parkMap[p]) parkMap[p] = { count: 0, revenue: 0 };
    parkMap[p].count++;
    if (b.payment_status === 'paid') parkMap[p].revenue += Number(b.total_amount_inr) || Number(b.amount_paid) || 0;
  });

  // Daily bookings (last 30 days)
  const dailyMap = {};
  deduped.forEach(b => {
    const day = (b.created_at || '').split('T')[0];
    if (!day) return;
    if (!dailyMap[day]) dailyMap[day] = { bookings: 0, revenue: 0 };
    dailyMap[day].bookings++;
    if (b.payment_status === 'paid') dailyMap[day].revenue += Number(b.total_amount_inr) || Number(b.amount_paid) || 0;
  });

  // Recent bookings (last 10)
  const recent = deduped
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(b => ({
      booking_id     : b.booking_id,
      park_name      : b.park_name,
      holder_name    : b.booking_holder?.full_name || '—',
      email          : b.booking_holder?.email || '—',
      phone          : b.booking_holder?.phone_number || '—',
      total_inr      : b.total_amount_inr || b.amount_paid || 0,
      status         : b.status,
      payment_status : b.payment_status,
      visit_date     : b.visit_date,
      created_at     : b.created_at,
      passengers     : b.passengers?.length || 0,
    }));

  res.json({
    overview: {
      total_bookings    : deduped.length,
      confirmed         : confirmed.length,
      cancelled         : cancelled.length,
      paid              : paid.length,
      total_revenue_inr : Math.round(totalRevenue * 100) / 100,
      total_users       : Object.keys(users).length,
    },
    parks        : Object.entries(parkMap).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.count - a.count),
    daily        : Object.entries(dailyMap).map(([date, d]) => ({ date, ...d })).sort((a,b) => a.date.localeCompare(b.date)),
    recent_bookings: recent,
  });
});

// GET /api/v1/admin/bookings — full list with filters
app.get('/api/v1/admin/bookings', adminAuth, (req, res) => {
  const { status, park, page = 1, limit = 50 } = req.query;
  const uniqueIds = new Set();
  let list = Object.values(bookings).filter(b => {
    if (uniqueIds.has(b.booking_id)) return false;
    uniqueIds.add(b.booking_id);
    return true;
  });
  if (status) list = list.filter(b => b.status === status);
  if (park)   list = list.filter(b => (b.park_name||'').toLowerCase().includes(park.toLowerCase()));
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total  = list.length;
  const offset = (Number(page) - 1) * Number(limit);
  res.json({ total, page: Number(page), limit: Number(limit), bookings: list.slice(offset, offset + Number(limit)) });
});

// ══════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status   : 'ok',
    bookings : Object.keys(bookings).length,
    users    : Object.keys(users).length,
otp_mode : 'Twilio Verify SMS',  });
});


if (process.env.NODE_ENV !== 'production') {


app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: "Server Running"
  });
});

  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

}

module.exports = app;







// });