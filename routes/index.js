#!/usr/bin/node
import AppController from '../controllers/AppController';

const injectRoutes = (api) => {
  api.get('/status', AppController.getStatus);
  api.get('/stats', AppController.getStats);
};

export default injectRoutes;
