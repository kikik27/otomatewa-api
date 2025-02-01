const app = require('./app');
require('./api/devices/devices.clients');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});

// Tambahkan ini sebelum middlewares.notFound
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API'
  });
});
