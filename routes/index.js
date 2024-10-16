#!/usr/bin/node
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';

const injectRoutes = (api) => {
  api.get('/status', AppController.getStatus);
  api.get('/stats', AppController.getStats);

  api.post('/users', UsersController.postNew);
};

export default injectRoutes;
