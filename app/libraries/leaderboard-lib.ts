import { GuildMember, Guild } from 'discord.js';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';

// give a role that only one member can have to this member
const giveSingletonRole = async (member: GuildMember, roleId: string, users: mongodbInternal.StoredUser[]) => {
    // assume if the given member has the role no one else has it
    if(member.roles.cache.find(role => role.id === roleId)) return;

    // otherwise iterate through the users and remove the role from everyone
    for(let user of users) {
        const otherMember = await member.guild.members.fetch({ user: user.discordId });
        otherMember.roles.remove(roleId);
    }

    // add the role
    member.roles.add(roleId);
}

// use the cache by default
export const getMonthlyLeaderboardText = async (guild: Guild, useCache = true) => {
    const storedConfig = await mongodbInternal.getConfig();

    // get all the Last.fm users in the database
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    // console.log(JSON.stringify(storedLastfmUsers, null, 4));
    const year = (new Date).getUTCFullYear();
    const month = (new Date).getUTCMonth();

    let leaderboardResult: mongodbInternal.LeaderboardResult = {
        month: mongodbInternal.getUTCMonthYearString(month, year),
        // set to 0 so we don't skip grabbing the initial data
        updated: 0,
        leaderboardData: [],
    }
    // use the cache if not disabled
    if(useCache) {
        console.log(`useCache is ${useCache}!`)
        // for each user, query all their data for the specified month (start with current)
        // do this synchronously (using await in a for loop, not a Promise.all map) to avoid rate limit issues
        // if we get null (no data yet), keep the default initilized value
        leaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year) ?? leaderboardResult;
    }

    let leaderboardData: mongodbInternal.LeaderboardDatum[] = leaderboardResult.leaderboardData;
    const cacheExpired = Date.now() - leaderboardResult.updated > 300000;
    // only fetch new data from lastfm if more than five minutes has passed from the last fetch
    if(cacheExpired) {
        for(let user of storedLastfmUsers) {
            const leaderboardDatum = leaderboardData.find((leaderboardDatum: mongodbInternal.LeaderboardDatum) => leaderboardDatum.userDiscordId === user.discordId)
            const userStreamsThisMonth = await lastfmInternal.getUserMonthlyStreamsForArtist(user.lastfmUsername, storedConfig.artist_name, leaderboardResult.updated, month, year);
            // don't add multiples of the same user
            if(leaderboardDatum) {
                leaderboardDatum.streamsThisMonth += userStreamsThisMonth;
            } else {
                // if we don't have the user yet add a new one
                leaderboardData.push({
                    userDiscordId: user.discordId,
                    streamsThisMonth: userStreamsThisMonth,
                })
            }
        }
    }
    // console.dir(Object.keys(leaderboardData[0]));
    
    // cache in database
    mongodbInternal.updateMonthlyLeaderboard(leaderboardData);

    // give the current top streamer the Monthly Streaming Heir role
    // we can use the first index of the leaderboardData array since it's sorted
    giveSingletonRole(await guild.members.fetch(leaderboardData[0].userDiscordId), storedConfig.heir_role, storedLastfmUsers)

    // assemble data
    const text = `
    
${(await Promise.all(leaderboardData
        .sort((a, b) => b.streamsThisMonth - a.streamsThisMonth)
        .map(async (leaderboardDatum, index) => {
            const guildMember =  (await guild.members.fetch(storedLastfmUsers.find(user => user.discordId === leaderboardDatum.userDiscordId).discordId))
            return `${index === 0 ? '👑 ' : `${index + 1}.`} [${
                    guildMember.nickname ?? guildMember.user.username
                }](https://last.fm/user/${ storedLastfmUsers.find(user => user.discordId === leaderboardDatum.userDiscordId).lastfmUsername }) - **${ leaderboardDatum.streamsThisMonth }** ${storedConfig.artist_name} play${ leaderboardDatum.streamsThisMonth === 1 ? '' : 's' }\n`
            })))
        .join('')}
`;
    return {
        text,
        cacheExpired
    }
}
