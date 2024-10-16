#!/usr/bin/node
import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.isConnected = false;
    this.client.on('error', (err) => {
      console.log('Redis Client Error', err.message || err.toString());
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    const Get = promisify(this.client.get).bind(this.client);
    const val = await Get(key);
    return val;
  }

  async set(key, value, duration) {
    const Set = promisify(this.client.set).bind(this.client);
    await Set(key, value);
    await this.client.expire(key, duration);
  }

  async del(key) {
    const Del = promisify(this.client.del).bind(this.client);
    await Del(key);
  }
}

export const redisClient = new RedisClient();
export default redisClient;
