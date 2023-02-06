import { MongoClient, Collection, ObjectId } from 'mongodb';

import '~/load-env';

const dbUrl = process.env.MONGO_DB_ADDRESS;
console.log(`dbUrl is ${dbUrl}`)
const dbClient = new MongoClient(dbUrl);
const dbName = 'lucid-fm-bot';

let db = null;
let usersCollection: Collection = null;
let monthlyLeaderboardsCollection: Collection = null;

export const getUTCMonthYearString = (month?: number, year?: number) => {
    const dbYear = year ?? (new Date).getUTCFullYear();
    const dbMonth = month ?? (new Date).getUTCMonth();
    return `${ dbYear }-${ String(dbMonth).padStart(2, '0') }`;
}

const dbInit = async () => {
    try {
        // console.log(dbClient);
        await dbClient.connect();
        db = dbClient.db(dbName);
        usersCollection = db.collection('users');
        monthlyLeaderboardsCollection = db.collection('monthlyLeaderboards');
        console.log('Successfully connected to database');
    } catch (e) {
        console.error('Error connecting to database')
        throw e;
    }
}

dbInit();

export interface StoredUser {
    _id?: ObjectId,
    lastfmUsername: string,
    lastfmSessionKey: string,
    discordId: string,
}

export interface LeaderboardDatum {
    storedUserId: ObjectId;
    streamsThisMonth: number;
}

export interface LeaderboardResult {
    month: string,
    leaderboardData: LeaderboardDatum[],
    updated: number,
}

// adds user to the database

export const updateUser = async (user: StoredUser) => {
    // update with upsert to add if it doesn't exist
    usersCollection.updateOne({
        discordId: user.discordId,
    }, {
        $set: user
    }, {
        upsert: true
    });
}

export const getUserByDiscordId = async (userDiscordId: string) => {
    return usersCollection.findOne({
        discordId: userDiscordId,
    })
}

export const getAllUsers = async () => {
    return usersCollection.find().toArray() as unknown as Promise<StoredUser[]>;
}

export const getMonthlyLeaderboard = async (month?: number, year?: number): Promise<LeaderboardResult> => {
    const monthYearString = getUTCMonthYearString(month, year)
    return monthlyLeaderboardsCollection.findOne({
        month: monthYearString,
    }) as unknown as Promise<LeaderboardResult>;
}

// defaults to current month if month and year are not specified
export const updateMonthlyLeaderboard = async (data: LeaderboardDatum[], month?: number, year?: number) => {
    const monthYearString = getUTCMonthYearString(month, year)
    monthlyLeaderboardsCollection.updateOne({
        month: monthYearString,
    }, {
        $set: {
            month: monthYearString,
            updated: Date.now(),
            leaderboardData: data,
        }
    }, {
        upsert: true,
    })
}
