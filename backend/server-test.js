import express from 'express';

const app = express();
const PORT = 3001;

app.use((req, res, next) => {
  console.log(`Request ${req.method} ${req.url} - params:`, req.params);
  next();
});

app.post('/api/pods/:namespace/:name/restart', (req, res) => {
  console.log('Params in restart:', req.params);
  const { namespace, name } = req.params;

  if (!namespace || !name) {
    return res.status(400).json({ error: 'Missing namespace or name', params: req.params });
  }

  // Risposta di test per confermare che params siano corretti
  res.json({ message: 'Restart endpoint called', namespace, name });
});

app.listen(PORT, () => {
  console.log(`Test server listening on http://localhost:${PORT}`);
});
