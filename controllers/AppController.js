#!/usr/bin/node
/* eslint-disable import/no-named-as-default */
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AppController {
  static getStatus(req, res) {
    res.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static getStats(req, res) {
    res.status(200).json({
      users: dbClient.nbUsers(),
      files: dbClient.nbFiles(),
    });
  }
}
