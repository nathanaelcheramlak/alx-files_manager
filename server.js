#!/usr/bin/node
import { express } from 'express';
import injectRoutes from './routes';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json()); // Converts the incoming JSON to an Obj

injectRoutes(app);

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
