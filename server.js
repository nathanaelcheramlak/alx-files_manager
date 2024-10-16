#!/usr/bin/node
import { express } from 'express';
import { router } from './routes/index'

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.use('/', router); // Binds routes from local file.
app.use(express.json()); // Converts the incoming JSON to an Obj


app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`)
})

export default app;