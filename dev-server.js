import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

import authHandler from './api/auth.js';
import therapistsHandler from './api/therapists.js';
import bookingsHandler from './api/bookings.js';
import aiBookingHandler from './api/ai-booking-assistant.js';

app.all('/api/auth', (req, res) => authHandler(req, res));
app.all('/api/therapists', (req, res) => therapistsHandler(req, res));
app.get('/api/therapists/validate', (req, res) => therapistsHandler(req, res));
app.all('/api/bookings', (req, res) => bookingsHandler(req, res));
app.all('/api/ai-booking-assistant', (req, res) => aiBookingHandler(req, res));

app.listen(PORT, () => {
  console.log(`Development API server running on http://localhost:${PORT}`);
});
