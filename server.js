require('dotenv').config();
const { app, ensureDbInitialized } = require('./app');

const PORT = process.env.PORT || 5000;

ensureDbInitialized().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error('DB init failed:', JSON.stringify(err), err.message, err.stack);
  process.exit(1);
});
