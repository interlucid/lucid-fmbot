import { Client, GuildMember, Guild, TextChannel, EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';

export enum LeaderboardType {
    // temporary; for during the month
    Heir,
    // awarded at the end of the month
    Monarch,
}

// 5 minute global cache time (ms)
const GLOBAL_CACHE_TIME = 5 * 60 * 1000;

export const clearSingletonRole = async (guild: Guild, roleId: string, users: mongodbInternal.StoredUser[]) => {
    // otherwise iterate through the users and remove the role from everyone
    for (const user of users) {
        const otherMember = await guild.members.fetch({ user: user.discordId });
        await otherMember.roles.remove(roleId);
    }
};

// give a role that only one member can have to this member
export const updateSingletonRole = async (member: GuildMember, roleId: string, users: mongodbInternal.StoredUser[], addRole = true) => {
    // assume if the given member has the role no one else has it
    if (member.roles.cache.find(role => role.id === roleId)) return;

    await clearSingletonRole(member.guild, roleId, users);

    // add the role
    if (addRole) {
        console.log(`about to add the role ${roleId} to ${member.displayName}`);
        member.roles.add(roleId);
        console.log(`done adding the role ${roleId} to ${member.displayName}`);
    } else {
        console.log(`NOT adding the role to ${member.displayName}`);
    }
};

const getNormalizedStreamsForUser = (aggregateStreams: lastfmInternal.LastfmTrack[], lowerCaseArtist: string) => {
    // if there are more than 250 streams in a day (12.5 hours) assume scrobbles were imported that day and divide the scrobbles by the average of the other days
    // build day array
    const daysStreamed: { [key: string]: lastfmInternal.LastfmTrack[] } = {};
    for (const stream of aggregateStreams) {
    // skip songs if no date is found (for example, if it is playing now)
        if (!stream.date) {
            // console.log(`stream has no date, continuing...`)
            continue;
        }
        // console.dir(stream, stream.date);
        // const dateStreamed = DateTime.fromSeconds(parseInt(stream.date.uts)).setLocale('utc').toLocaleString(DateTime.DATE_SHORT);
        // if a song is currently streaming it doesn't have a date yet
        if (stream.date) {
            const dateStreamed = DateTime.fromSeconds(parseInt(stream.date.uts)).toLocaleString(DateTime.DATE_SHORT);
            daysStreamed[dateStreamed] = daysStreamed[dateStreamed] ?? [];
            daysStreamed[dateStreamed].push(stream);
        }
    // console.log(`pushed stream streamed on ${ dateStreamed } to array`)
    }
    // console.log(`days streamed is`);
    // for (const day in daysStreamed) {
    //     console.log(`streams: ${ day }, ${ daysStreamed[day].length }`);
    // }

    const maxStreamsInANormalDay = 250;
    const normalDays = Object.values(daysStreamed)
        .filter(day => day.length < maxStreamsInANormalDay);
    const averageNormalDayStreams = normalDays
        .reduce((prev, cur: lastfmInternal.LastfmTrack[]) => prev + cur.length, 0)
        / Math.max(normalDays.length, 1);
    // console.log(`normal days length is ${normalDays.length} and averageNormalDayStreams is ${averageNormalDayStreams}`)
    const dayNormalizedStreamCount = Object.values(daysStreamed)
        .reduce((acc: number, cur) => {
            const totalTrackCount = cur.length;
            const artistTrackCount: number = cur.filter(track => track.artist[`#text`].toLowerCase().includes(lowerCaseArtist)).length;
            // console.log(`adding up days; total streams is ${totalTrackCount} and artist streams is ${artistTrackCount}`);
            const normalizedArtistTrackCount = totalTrackCount > maxStreamsInANormalDay ?
            // if we guess the user is uploading scrobbles, take the percentage of artist streams from the upload
            //  and apply it to an average day stream count, avoiding divide by 0 errors
                Math.round(artistTrackCount / Math.max((totalTrackCount / Math.max(averageNormalDayStreams, 0.1)), 1)) :
                artistTrackCount;
            // console.log(`about to return acc of ${acc} + normalizedArtistTrackCount of ${normalizedArtistTrackCount}`)
            return acc + normalizedArtistTrackCount;
        }, 0);

    const serverArtistStreams = aggregateStreams
        .filter((track: lastfmInternal.LastfmTrack) => {
            // if(track.artist['#text'].toLowerCase().includes(lowerCaseArtist)) console.log(`found interlucid track: ${JSON.stringify(track.date, null, 4)}`)
            return track.artist[`#text`].toLowerCase().includes(lowerCaseArtist);
        });
    // only allow up to 50% of the recorded streams to be counted from this artist (so people don't just stream only the server artist's music all the time)
    // this in-between step gets the normalized streams as if we weren't normalizing for days
    const numOtherArtistStreams = aggregateStreams.length - serverArtistStreams.length;
    const favoriteNormalizedArtistStreamCount = Math.min(serverArtistStreams.length, numOtherArtistStreams);
    const artistNormalizationMultiplier = favoriteNormalizedArtistStreamCount / Math.max(serverArtistStreams.length, 1);
    const favoriteAndDayNormalizedStreamCount = Math.round(artistNormalizationMultiplier * dayNormalizedStreamCount);

    console.log(`favoriteNormalizedArtistStreamCount is ${favoriteNormalizedArtistStreamCount}, numOtherArtistStreams is ${numOtherArtistStreams}, artistNormalizationMultiplier is ${artistNormalizationMultiplier}`);
    console.log(`about to store normalized stream count of ${ favoriteAndDayNormalizedStreamCount } instead of raw artist stream count of ${ serverArtistStreams.length
    } and dayNormalizedStreamCount of ${ dayNormalizedStreamCount }`);

    return favoriteAndDayNormalizedStreamCount;
};

const leaderboardDataSort = (user1: mongodbInternal.LeaderboardDatum, user2: mongodbInternal.LeaderboardDatum) => {
    // break ties by keeping the defending user
    if (user2.serverArtistNormalizedStreamsThisMonth === user1.serverArtistNormalizedStreamsThisMonth) return 1;
    return user2.serverArtistNormalizedStreamsThisMonth - user1.serverArtistNormalizedStreamsThisMonth;
};

const getEmptyLeaderboardDatum = (discordId: string): mongodbInternal.LeaderboardDatum => {
    return {
        userDiscordId: discordId,
        serverArtistNormalizedStreamsThisMonth: 0,
        streamData: [],
    };
};

const getEmptyLeaderboardResult = (month: string, year: string, storedLastfmUsers: mongodbInternal.StoredUser[]): mongodbInternal.LeaderboardResult => {
    return {
        month: mongodbInternal.getUTCMonthYearString(month, year),
        leaderboardData: storedLastfmUsers.map(lastfmUser => {
            return getEmptyLeaderboardDatum(lastfmUser.discordId);
        }),
        updated: 0,
    };
};

const updateMonthlyLeaderboardData = async (useCache: boolean, month: string, year: string) => {
    const storedConfig = await mongodbInternal.getConfig();
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    // for each user, query all their data for the specified month (start with current)
    // do this synchronously (using await in a for loop, not a Promise.all map) to avoid rate limit issues
    // if we get null (no data yet), keep the default initilized value
    const cachedLeaderboardResult: mongodbInternal.LeaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year) ?? getEmptyLeaderboardResult(month, year, storedLastfmUsers);
    // use the cache if not disabled
    const leaderboardResult = useCache ? cachedLeaderboardResult : getEmptyLeaderboardResult(month, year, storedLastfmUsers);

    const leaderboardData: mongodbInternal.LeaderboardDatum[] = leaderboardResult.leaderboardData;
    let globalCacheExpired;

    for (const user of storedLastfmUsers) {
        const cachedLeaderboardDatum = leaderboardData.find((currentLeaderboardDatum: mongodbInternal.LeaderboardDatum) => currentLeaderboardDatum.userDiscordId === user.discordId);
        const leaderboardDatum = cachedLeaderboardDatum ?? getEmptyLeaderboardDatum(user.discordId);
        // if the user wasn't cached, add them to the data which will be cached later
        if (!cachedLeaderboardDatum) {
            leaderboardData.push(leaderboardDatum);
        }
        // console.log(`leaderboardDatum before op is ${JSON.stringify(leaderboardDatum, null, 4)}`);
        // base the cache on each user to account for the time it takes to fetch each user's data
        const latestStreamTime = (parseInt(leaderboardDatum.streamData[0]?.date.uts) || 0) * 1000;
        // only fetch new data from lastfm if more than five minutes has passed from the last fetch
        // const cacheExpired = DateTime.utc().toMillis() - latestStreamTime > 3000;
        const cacheExpired = DateTime.utc().toMillis() - leaderboardResult.updated > GLOBAL_CACHE_TIME;
        // console.log(`current UTC time is ${DateTime.utc().toMillis()}, latest stream time is ${latestStreamTime}, GLOBAL_CACHE_TIME is ${GLOBAL_CACHE_TIME}; cacheExpired is ${cacheExpired}`);
        const lowerCaseArtist = storedConfig.artistName.toLowerCase();
        let newAggregateStreams: lastfmInternal.LastfmTrack[] = [];
        if (cacheExpired) {
            newAggregateStreams = await lastfmInternal.getUserMonthlyStreams(user.lastfmUsername, latestStreamTime, parseInt(month), parseInt(year));
            globalCacheExpired = true;
        }
        const aggregateStreams = [
            ...leaderboardDatum.streamData,
            ...newAggregateStreams,
        ];

        leaderboardDatum.streamData = aggregateStreams;
        const normalizedStreamCount = getNormalizedStreamsForUser(aggregateStreams, lowerCaseArtist);
        leaderboardDatum.serverArtistNormalizedStreamsThisMonth = normalizedStreamCount;
        // console.log(`leaderboardDatum after op is ${JSON.stringify(leaderboardDatum, null, 4)}`);
    }
    // console.dir(Object.keys(leaderboardData[0]));

    // cache in database
    mongodbInternal.updateMonthlyLeaderboard(leaderboardData, month, year);
    return globalCacheExpired;
};

// use the cache by default
export const getMonthlyLeaderboardData = async (
    leaderboardType: LeaderboardType,
    guild: Guild,
    useCache = true,
    month = DateTime.utc().toFormat(`LL`),
    year = DateTime.utc().toFormat(`y`),
) => {
    const storedConfig = await mongodbInternal.getConfig();

    // get all the Last.fm users in the database
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    // console.log(JSON.stringify(storedLastfmUsers, null, 4));
    // get the current heir from the cached result, otherwise it will show the messages for claiming the crown when cache is manually disabled
    const cachedLeaderboardResult: mongodbInternal.LeaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year);
    const currentHeir = cachedLeaderboardResult?.leaderboardData?.length && cachedLeaderboardResult?.leaderboardData.reduce((acc, leaderboardDatum) => acc + leaderboardDatum.serverArtistNormalizedStreamsThisMonth, 0) ? cachedLeaderboardResult.leaderboardData.sort(leaderboardDataSort)[0] : null;

    const globalCacheExpired = await updateMonthlyLeaderboardData(useCache, month, year);
    const updatedLeaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year);
    const leaderboardData = updatedLeaderboardResult?.leaderboardData ? updatedLeaderboardResult.leaderboardData : getEmptyLeaderboardResult(month, year, storedLastfmUsers).leaderboardData;

    // assemble data
    const currentHeirDiscordUser = currentHeir ? await guild.members.fetch(currentHeir.userDiscordId) : null;
    const sortedLeaderboardData = leaderboardData.sort(leaderboardDataSort);
    const newHeirDiscordUser = await guild.members.fetch(sortedLeaderboardData[0].userDiscordId);
    // console.log(`current heir has Discord ID ${currentHeirDiscordUser ?? currentHeirDiscordUser.id} and new heir has Discord ID ${sortedLeaderboardData[0].userDiscordId}`);
    let title;
    if (leaderboardType === LeaderboardType.Heir) {
        title = `Monthly Streaming Heir Leaderboard - ${ DateTime.utc().toLocaleString({ year: `numeric`, month: `long` }) }`;
    } else if (leaderboardType === LeaderboardType.Monarch) {
        const aDayLastMonth = DateTime.utc().minus({ months: 1 });
        const monthlyStreamingMonarch = leaderboardData[0];
        const monthlyStreamingMonarchMember = await guild.members.fetch(leaderboardData[0].userDiscordId);
        title = `The Monthly Streaming Monarch for ${
            aDayLastMonth.toLocaleString({ year: `numeric`, month: `long` }) } is ${
            monthlyStreamingMonarchMember.displayName } with ${
            monthlyStreamingMonarch.serverArtistNormalizedStreamsThisMonth
        } Interlucid streams!`;
    }
    let description;
    if (sortedLeaderboardData[0].serverArtistNormalizedStreamsThisMonth === 0) {
        description = `No one has listened to any Interlucid songs yet this month. That means to become the heir to the throne, you just have to listen to one song!`;
    } else {
        description = `
        
    ${(await Promise.all(sortedLeaderboardData
        .map(async (leaderboardDatum, index) => {
            const guildMember = (await guild.members.fetch(leaderboardDatum.userDiscordId));
            return `${index === 0 ? `👑 ` : `${index + 1}.`} [${
                guildMember.displayName
            }](https://last.fm/user/${ storedLastfmUsers.find(user => user.discordId === leaderboardDatum.userDiscordId).lastfmUsername }) - **${ leaderboardDatum.serverArtistNormalizedStreamsThisMonth }** ${storedConfig.artistName} play${ leaderboardDatum.serverArtistNormalizedStreamsThisMonth === 1 ? `` : `s` }\n`;
        })))
        .join(``)}
    ${ currentHeir === null ? `${newHeirDiscordUser.displayName} is the new heir to the throne!` : `` }${
    currentHeir && currentHeir.userDiscordId !== sortedLeaderboardData[0].userDiscordId ? `${newHeirDiscordUser.displayName} overtook ${currentHeirDiscordUser.displayName} and is now heir to the throne!` : ``
}
    `;
    }
    return {
        title,
        description,
        cacheExpired: globalCacheExpired,
        leaderboardData,
    };
};

export const announceLeaderboardUpdate = async (leaderboardType: LeaderboardType, client: Client) => {
    const storedConfig = await mongodbInternal.getConfig();
    const announcementsChannel = (await client.channels.fetch(storedConfig.announcementsChannel) as TextChannel);
    const guild = announcementsChannel.guild;

    // get data using leaderboard library
    let leaderboardResponse;
    let roleToUpdate;
    if (leaderboardType === LeaderboardType.Heir) {
        leaderboardResponse = await getMonthlyLeaderboardData(
            leaderboardType,
            guild,
            false,
        );
        roleToUpdate = storedConfig.heirRole;
    } else if (leaderboardType === LeaderboardType.Monarch) {
        const aDayLastMonth = DateTime.utc().minus({ months: 1 });
        leaderboardResponse = await getMonthlyLeaderboardData(
            leaderboardType,
            guild,
            false,
            aDayLastMonth.toFormat(`LL`),
            aDayLastMonth.toFormat(`y`),
        );
        roleToUpdate = storedConfig.monarchRole;
    }

    // update the Discord user for the member in the lead
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    const leadingMember = await guild.members.fetch(leaderboardResponse.leaderboardData[0].userDiscordId);
    updateSingletonRole(leadingMember, roleToUpdate, storedLastfmUsers, leaderboardResponse.leaderboardData[0].serverArtistNormalizedStreamsThisMonth > 0);

    // send the update message
    const leaderboardEmbed = new EmbedBuilder()
        .setTitle(leaderboardResponse.title)
        .setColor(storedConfig.embedColor)
        .setDescription(leaderboardResponse.description);
    (await announcementsChannel.send({
        embeds: [
            leaderboardEmbed,
        ],
    // }));
    })).crosspost();
};
