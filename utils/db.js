#!/usr/bin/node
import { mongodb } from "mongodb";

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';
        const dbURL = `mongodb://${host}:${port}/${database}`;

        this.client = new mongodb.MongoClient(dbURL, { useUnifiedTopology: true});
        this.client.connect().then(() => {
            this.db = this.client.db(`${database}`);
        }).catch((err) => {
            console.log(err);
        });
    }

    isAlive() {
        return this.client.isConnected();
    }

    async nbUsers() {
        const users = this.db.collection('users');
        const usersCount = await users.countDocuments();
        return usersCount;
    }

    async nbFiles() {
        const files = this.db.collection('files');
        const fileCount = await files.countDocuments();
        return fileCount;
    }
}

export const dbClient = new DBClient();
export default dbClient; 