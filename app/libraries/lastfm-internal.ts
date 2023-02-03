import { LastFmNode } from 'lastfm';

import type { StoredUser } from '~/libraries/mongodb-internal'
import '~/load-env';

export interface tokenData {
    token: string,
}

export interface sessionData {
    sessionKey: string,
}

export interface errorData {
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

export const getToken = (): Promise<tokenData | errorData> => {
    return new Promise(function(resolve, reject) {
        lastfm.request('auth.getToken', {
            handlers: {
                success: (data: tokenData) => {
                    // console.log(`successfully got token`)
                    // console.log(JSON.stringify(data, null, 4))
                    resolve(data);
                },
                error: (error: errorData) => {
                    // console.error(`encountered an error while getting token`)
                    // console.error(JSON.stringify(error, null, 4))
                    reject(error);
                }
            }
        })
    });
};

export const createSessionFromToken = (token: string) => {
    return new Promise(function(resolve, reject) {
        lastfm.session({
            token,
            handlers: {
                success: function(session: sessionData) {
                    // console.log(`inside lastfm.session success, token is`, token);
                    // do stuff here
                    resolve(session)
                },
                error: (error: errorData) => {
                    // console.log(`inside lastfm.session error, token is`, token);
                    reject(error);
                }
            }
        })
    })
}

export const verifySession = (storedUser: StoredUser) => {
    return new Promise(function(resolve, reject) {
        lastfm.session({
            user: storedUser.lastfmUsername,
            session: storedUser.lastfmSessionKey,
            handlers: {
                success: function(session: sessionData) {
                    console.log(`inside lastfm.session success, session is`, session);
                    // do stuff here
                    resolve(session)
                },
                error: (error: errorData) => {
                    console.log(`inside lastfm.session error, error is`, error);
                    reject(error);
                }
            }
        })
    })
}
