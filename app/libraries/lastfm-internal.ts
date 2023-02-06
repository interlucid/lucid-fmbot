import { LastFmNode } from 'lastfm';

import type { StoredUser } from '~/libraries/mongodb-internal'
import '~/load-env';

export interface TokenData {
    token: string,
}

export interface SessionData {
    sessionKey: string,
}

export interface ErrorData {
    message: string,
    error: number,
}

const lastfm = new LastFmNode({
    api_key: process.env.LASTFM_API_KEY,
    secret: process.env.LASTFM_SECRET,
    // useragent: 'appname/vX.X MyApp' // optional. defaults to lastfm-node.
});

// it's easier to import this from the library file than .env
export const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

export const getToken = (): Promise<TokenData | ErrorData> => {
    return new Promise((resolve, reject) => {
        lastfm.request('auth.getToken', {
            handlers: {
                success: (data: TokenData) => {
                    // console.log(`successfully got token`)
                    // console.log(JSON.stringify(data, null, 4))
                    resolve(data);
                },
                error: (error: ErrorData) => {
                    // console.error(`encountered an error while getting token`)
                    // console.error(JSON.stringify(error, null, 4))
                    reject(error);
                }
            }
        })
    });
};

export const createSessionFromToken = (token: string) => {
    return new Promise((resolve, reject) => {
        lastfm.session({
            token,
            handlers: {
                success: (session: SessionData) => {
                    // console.log(`inside lastfm.session success, token is`, token);
                    // do stuff here
                    resolve(session)
                },
                error: (error: ErrorData) => {
                    // console.log(`inside lastfm.session error, token is`, token);
                    reject(error);
                }
            }
        })
    })
}

// export const verifySession = (storedUser: StoredUser) => {
//     return new Promise((resolve, reject) => {
//         return lastfm.request('artist.getInfo', {
//             user: storedUser.lastfmUsername,
//             key: storedUser.lastfmSessionKey,
//             artist: 'interlucid',
//             signed: true,
//             handlers: {
//                 success: (result) => {
//                     console.log(`inside lastfm.result success, result is`, result);
//                     // do stuff here
//                     resolve(result)
//                 },
//                 error: (error: ErrorData) => {
//                     console.log(`inside lastfm.session error, error is`, error);
//                     reject(error);
//                 },
//                 retrying: (retry) => {
//                     console.log(`retrying`, JSON.stringify(retry, null, 4));
//                 }
//             }
//         })
//     })
// }

interface LastfmTrackResponse {
    recenttracks: {
        track: LastfmTrack[],
        '@attr': {
            totalPages: string,
        }
    }
}

interface LastfmTrack {
    artist: {
        '#text': string;
    }
    date: {

    }
}

const requestRecentUserStreamsByPage = async (lastfmUser: string, fromTime: number, endTime: number, page: number): Promise<LastfmTrackResponse> => {
    return new Promise((resolve, reject) => {
        lastfm.request('user.getRecentTracks', {
            limit: 200,
            user: lastfmUser,
            page,
            from: fromTime,
            to: endTime,
            handlers: {
                success: (recentTracks: LastfmTrackResponse) => {
                    // console.log(`inside lastfm.request user.getRecentTracks success, recentTracks is`);
                    // console.dir(recentTracks);
                    resolve(recentTracks)
                },
                error: (error: ErrorData) => {
                    // console.log(`inside lastfm.session error, token is`, token);
                    reject(`error with requstRecentUserStreamsByPage: ${JSON.stringify(error)}`);
                }
            }
        })
    })
};

const timeout = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getUserMonthlyStreamsForArtist = (lastfmUser: string, artist: string, updated: number, month: number, year: number): Promise<number> => {
    return new Promise(async (resolve, reject) => {
        if(
            month % 1 != 0 ||
            year % 1 != 0 ||
            month < 1 ||
            month > 12 ||
            year < 2000 ||
            year > 2100
        ) {
            reject(`month or year format invalid (not a whole number, not a usable month or year, etc.)`)
        }
        const firstMillisecondOfMonth = Date.UTC(year, month);
        const lastMillisecondOfMonth = new Date(Date.UTC(year, month + 1, 0)).setUTCHours(23,59,59,999);
        // don't fetch data that we already have in the database
        const fromTime = new Date(Math.max(updated, firstMillisecondOfMonth));
        // don't let end time be past the current time
        const endTime = new Date(Math.min(Date.now(), lastMillisecondOfMonth));
        console.log(`from time is ${fromTime.toUTCString()} and end time is ${endTime.toUTCString()}`)
        let aggregateStreams: LastfmTrack[] = []
        // fetch every page
        let lastPage = 999999999;
        for(let page = 1; page <= lastPage; page++) {
        // for(let page = 1; page <= 8; page++) {
            console.log(`fetching page ${page} of ${lastPage} for lastfmUser ${lastfmUser} from ${ Math.round(fromTime.getTime() / 1000) } to ${ Math.round(endTime.getTime() / 1000) }`)
            // from time and end time expect number of seconds, not milliseconds, from UNIX epoch
            const trackResponse = await requestRecentUserStreamsByPage(lastfmUser, Math.round(fromTime.getTime() / 1000), Math.round(endTime.getTime() / 1000), page)
            lastPage = parseInt(trackResponse.recenttracks['@attr'].totalPages);
            await timeout(1500);
            aggregateStreams = [...aggregateStreams, ...trackResponse.recenttracks.track];
        }
        const lowerCaseArtist = artist.toLowerCase();
        const filteredStreams = aggregateStreams
            .filter((track: LastfmTrack) => {
                // if(track.artist['#text'].toLowerCase().includes(lowerCaseArtist)) console.log(`found interlucid track: ${JSON.stringify(track.date, null, 4)}`)
                return track.artist['#text'].toLowerCase().includes(lowerCaseArtist)
            })
        resolve(filteredStreams.length);
        // resolve(0);
    })
}
