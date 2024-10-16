#!/usr/bin/node
import AppController from "../controllers/AppController";
import UsersController from "../controllers/UsersController";
import AuthController from "../controllers/AuthController";
import FilesController from "../controllers/FilesController";
import { basicAuthenticate, xTokenAuthenticate } from "../middlewares/auth";

const injectRoutes = (api) => {
  api.get("/status", AppController.getStatus);
  api.get("/stats", AppController.getStats);

  api.post("/users", UsersController.postNew);
  api.get("/users/me", xTokenAuthenticate, UsersController.getMe);

  api.get("/connect", basicAuthenticate, AuthController.getConnect);
  api.get("/disconnect", xTokenAuthenticate, AuthController.getDisconnect);

  api.post("/files", xTokenAuthenticate, FilesController.postUpload);
  api.get("/files/:id", FilesController.getShow);

  api.get("/files", FilesController.getIndex);
  api.put("/files/:id/publish", FilesController.putPublish);
  api.put("/files/:id/unpublish", FilesController.putUnpublish);
  api.get("/files/:id/data", FilesController.getFile);
};

export default injectRoutes;
