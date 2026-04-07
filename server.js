require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', JSON.stringify(err), err.message, err.stack);
  process.exit(1);
});
