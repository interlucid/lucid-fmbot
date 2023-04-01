import { MongoClient, Collection, ObjectId } from 'mongodb';
import { DateTime } from 'luxon';

import { LastfmTrack } from '~/libraries/lastfm-internal';

import '~/load-env';

const dbUrl = process.env.MONGO_DB_ADDRESS;
console.log(`dbUrl is ${dbUrl}`)
const dbClient = new MongoClient(dbUrl);
const dbName = 'lucid-fm-bot';

let db = null;
let usersCollection: Collection = null;
let monthlyLeaderboardsCollection: Collection = null;
let serverConfigCollection: Collection = null;

export const getUTCMonthYearString = (month: string, year: string) => {
    // console.log(`input month and year are ${ year }-${ month }`)
    console.log(`utc month string is ${ year }-${ month }`)
    return `${ year }-${ month }`;
}

const dbInit = async () => {
    try {
        // console.log(dbClient);
        await dbClient.connect();
        db = dbClient.db(dbName);
        usersCollection = db.collection('users');
        monthlyLeaderboardsCollection = db.collection('monthlyLeaderboards');
        serverConfigCollection = db.collection('serverConfig');
        console.log('Successfully connected to database');
        // initialize serverConfig
        const serverConfig = await getConfig();
        if(!serverConfig) setConfig({})
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
    userDiscordId: string;
    serverArtistNormalizedStreamsThisMonth: number;
    streamData: LastfmTrack[];
}

export interface LeaderboardResult {
    month: string,
    leaderboardData: LeaderboardDatum[],
    updated: number,
}

export interface Config {
    [name: string]: string,
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

export const getMonthlyLeaderboard = async (month: string, year: string): Promise<LeaderboardResult> => {
    const monthYearString = getUTCMonthYearString(month, year)
    return monthlyLeaderboardsCollection.findOne({
        month: monthYearString,
    }) as unknown as Promise<LeaderboardResult>;
}

// defaults to current month if month and year are not specified
export const updateMonthlyLeaderboard = async (data: LeaderboardDatum[], month: string, year: string) => {
    const monthYearString = getUTCMonthYearString(month, year)
    monthlyLeaderboardsCollection.updateOne({
        month: monthYearString,
    }, {
        $set: {
            month: monthYearString,
            updated: DateTime.utc().toMillis(),
            leaderboardData: data,
        }
    }, {
        upsert: true,
    })
}

export const getConfig = async () => {
    return serverConfigCollection.findOne({
        _id: 1,
    })
}

export const setConfig = async (config: Config) => {
    return serverConfigCollection.updateOne({
        _id: 1,
    }, {
        $set: config,
    }, {
        upsert: true,
    })
}
