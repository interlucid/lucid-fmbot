import { LastFmNode } from 'lastfm';
import { DateTime } from 'luxon';

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
        lastfm.request(`auth.getToken`, {
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
                },
            },
        });
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
                    resolve(session);
                },
                error: (error: ErrorData) => {
                    // console.log(`inside lastfm.session error, token is`, token);
                    reject(error);
                },
            },
        });
    });
};

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
        // eslint-disable-next-line quotes
        '@attr': {
            totalPages: string,
        }
    }
}

export interface LastfmTrack {
    artist: {
        // eslint-disable-next-line quotes
        '#text': string
    }
    date?: {
        uts: string
    }
}

const requestRecentUserStreamsByPage = async (lastfmUser: string, fromTime: number, endTime: number, page: number): Promise<LastfmTrackResponse> => {
    return new Promise((resolve, reject) => {
        lastfm.request(`user.getRecentTracks`, {
            limit: 200,
            user: lastfmUser,
            page,
            from: fromTime,
            to: endTime,
            handlers: {
                success: (recentTracks: LastfmTrackResponse) => {
                    // console.log(`inside lastfm.request user.getRecentTracks success, recentTracks is`);
                    // console.dir(recentTracks);
                    resolve(recentTracks);
                },
                error: (error: ErrorData) => {
                    // console.log(`inside lastfm.session error, token is`, token);
                    reject(`error with requestRecentUserStreamsByPage: ${ JSON.stringify(error) }`);
                },
            },
        });
    });
};

const timeout = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

export const getUserMonthlyStreams = async (lastfmUser: string, updated: number, month: number, year: number): Promise<LastfmTrack[]> => {
    if (
        month % 1 != 0
            || year % 1 != 0
            || month < 1
            || month > 12
            || year < 2000
            || year > 2100
    ) {
        throw new Error(`month or year format invalid (not a whole number, not a usable month or year, etc.)`);
    }
    const firstMillisecondOfMonth = DateTime.utc(year, month).toMillis();
    const lastMillisecondOfMonth = DateTime.utc(year, month + 1).minus({ millisecond: 1 }).toMillis();
    // don't fetch data that we already have in the database
    const fromTime = DateTime.fromMillis(Math.max(updated, firstMillisecondOfMonth));
    // don't let end time be past the current time
    const endTime = DateTime.fromMillis(Math.min(DateTime.utc().toMillis(), lastMillisecondOfMonth));
    // console.log(`month is ${month} and year is ${year}`);
    console.log(`from time is ${ fromTime.toUTC() } and end time is ${ endTime.toUTC() }; lastfmUser is ${ lastfmUser }`);
    let aggregateStreams: LastfmTrack[] = [];
    // fetch every page
    let lastPage = 999999999;
    for (let page = 1; page <= lastPage; page++) {
        // for(let page = 1; page <= Math.min(8, lastPage); page++) {
        console.log(`fetching page ${ page } of ${ lastPage }`);
        // from time and end time expect number of seconds, not milliseconds, from UNIX epoch
        const trackResponse = await requestRecentUserStreamsByPage(lastfmUser, Math.round(fromTime.toSeconds()), Math.round(endTime.toSeconds()), page);
        if (!trackResponse.recenttracks?.track?.length && trackResponse.recenttracks?.track?.length !== 0) {
            console.log(`skipping invalid iterable thing which is`, trackResponse.recenttracks.track);
            // if there are no recenttracks there should only be a current track so this should be safe
            lastPage = 0;
            continue;
        }
        lastPage = parseInt(trackResponse.recenttracks[`@attr`].totalPages);
        // Last.fm rate limits at 1 second, wait 1.2 seconds to be generous
        await timeout(1200);
        aggregateStreams = [...aggregateStreams, ...trackResponse.recenttracks.track];
    }

    return aggregateStreams.map(stream => {
        return {
            artist: stream.artist,
            date: stream.date ? stream.date : undefined,
        };
    });
};
