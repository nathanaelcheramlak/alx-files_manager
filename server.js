#!/usr/bin/node
import express from 'express';
import injectRoutes from './routes';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json({ limit: '200mb' }));

injectRoutes(app);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
