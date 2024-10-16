#!/usr/bin/node
import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    /**
     * Creates a new RedisClient instance.
     */
    this.client = createClient();
    this.isConnected = false; // Start with not connected
    this.client.on('error', (err) => {
      console.log('Redis Client Error', err);
      this.isConnected = false;
    });
    this.client.on('connect', () => {
      console.log('Connected to Redis');
      this.isConnected = true;
    });
    // Connect the client
    // this.client.connect().catch(err => {
    //     console.error('Could not connect to Redis', err);
    // });
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
