import { MongoClient, Collection } from 'mongodb';

import '~/load-env';

const dbUrl = process.env.MONGO_DB_ADDRESS;
console.log(`dbUrl is ${dbUrl}`)
const dbClient = new MongoClient(dbUrl);
const dbName = 'lucid-fm-bot';

let db = null;
let usersCollection: Collection = null;

const dbInit = async () => {
    try {
        // console.log(dbClient);
        await dbClient.connect();
        db = dbClient.db(dbName);
        usersCollection = db.collection('users');
        console.log('Successfully connected to database');
    } catch (e) {
        console.error('Error connecting to database')
        throw e;
    }
}

dbInit();

export interface StoredUser {
    lastfmUsername: string,
    lastfmSessionKey: string,
    discordId: string,
}

// adds user to the database

export const updateUser = async (user: StoredUser) => {
    // update with upsert to add if it doesn't exist
    usersCollection.updateOne({
        discordId: user.discordId,
    }, user, { upsert: true });
}

export const getUserByDiscordId = async (userDiscordId: string) => {
    return usersCollection.findOne({
        discordId: userDiscordId,
    })
}
