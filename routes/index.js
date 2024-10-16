#!/usr/bin/node
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';

const injectRoutes = (api) => {
  api.get('/status', AppController.getStatus);
  api.get('/stats', AppController.getStats);

  api.post('/users', UsersController.postNew);
  api.get('/users/me', UsersController.getMe);

  api.get('/connect', AuthController.getConnect);
  api.get('/disconnect', AuthController.getDisconnect);
};

export default injectRoutes;
