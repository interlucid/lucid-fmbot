import { LastFmNode } from 'lastfm';

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
        uts: string
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
        // for(let page = 1; page <= Math.min(8, lastPage); page++) {
            console.log(`fetching page ${page} of ${lastPage} for lastfmUser ${lastfmUser} from ${ Math.round(fromTime.getTime() / 1000) } to ${ Math.round(endTime.getTime() / 1000) }`)
            // from time and end time expect number of seconds, not milliseconds, from UNIX epoch
            const trackResponse = await requestRecentUserStreamsByPage(lastfmUser, Math.round(fromTime.getTime() / 1000), Math.round(endTime.getTime() / 1000), page)
            lastPage = parseInt(trackResponse.recenttracks['@attr'].totalPages);
            await timeout(1500);
            aggregateStreams = [...aggregateStreams, ...trackResponse.recenttracks.track];
        }
        const lowerCaseArtist = artist.toLowerCase();

        // if there are more than 200 streams in a day (10 hours) assume scrobbles were imported that day and divide the scrobbles by the average of the other days

        // build day array
        let daysStreamed: { [key: string]: LastfmTrack[] } = {};
        for(let track of aggregateStreams) {
            // skip songs if no date is found (for example, if it is playing now)
            if(!track.date) {
                // console.log(`track has no date, continuing...`)
                continue;
            }
            // console.dir(track, track.date);
            const dateStreamed = (new Date(parseInt(track.date.uts) * 1000)).toLocaleDateString('en-US', { timeZone: 'UTC' })
            daysStreamed[dateStreamed] = daysStreamed[dateStreamed] ?? [];
            daysStreamed[dateStreamed].push(track);
            // console.log(`pushed track streamed on ${ dateStreamed } to array`)
        }
        console.log(`days streamed is`)
        for(let day in daysStreamed) {
            console.log(`streams: ${ day }, ${ daysStreamed[day].length }`);
        }

        const maxStreamsInANormalDay = 250;
        const normalDays = Object.values(daysStreamed)
            .filter(day => day.length < maxStreamsInANormalDay);
        const averageNormalDayStreams = normalDays
            .reduce((prev, cur: LastfmTrack[]) => prev + cur.length, 0)
            / Math.max(normalDays.length, 1);
        console.log(`normal days length is ${normalDays.length} and averageNormalDayStreams is ${averageNormalDayStreams}`)
        const normalizedStreamCount = Object.values(daysStreamed)
            .reduce((acc, cur) => {
                const totalTrackCount = cur.length;
                const artistTrackCount = cur.filter(track => track.artist['#text'].toLowerCase().includes(lowerCaseArtist)).length;
                const normalizedArtistTrackCount = totalTrackCount > maxStreamsInANormalDay ?
                    // if we guess the user is uploading scrobbles, take the percentage of artist streams from the upload
                    //  and apply it to an average day stream count, avoiding divide by 0 errors
                    Math.round(artistTrackCount / Math.max((totalTrackCount / Math.max(averageNormalDayStreams, .1)), 1)) :
                    artistTrackCount
                return acc + normalizedArtistTrackCount;
            }, 0)

        
        const filteredStreams = aggregateStreams
            .filter((track: LastfmTrack) => {
                // if(track.artist['#text'].toLowerCase().includes(lowerCaseArtist)) console.log(`found interlucid track: ${JSON.stringify(track.date, null, 4)}`)
                return track.artist['#text'].toLowerCase().includes(lowerCaseArtist)
            })
        console.log(`about to resolve normalized stream count of ${ normalizedStreamCount } instead of raw stream count of ${ filteredStreams.length } for Last.fm user ${ lastfmUser }`)
        resolve(normalizedStreamCount);
        // resolve(0);
    })
}
