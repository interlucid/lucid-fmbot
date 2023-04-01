import { GuildMember, Guild, User } from 'discord.js';
import { DateTime } from 'luxon';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';

// give a role that only one member can have to this member
export const updateSingletonRole = async (member: GuildMember, roleId: string, users: mongodbInternal.StoredUser[], addRole = true) => {
    // assume if the given member has the role no one else has it
    if(member.roles.cache.find(role => role.id === roleId)) return;

    // otherwise iterate through the users and remove the role from everyone
    for(let user of users) {
        const otherMember = await member.guild.members.fetch({ user: user.discordId });
        await otherMember.roles.remove(roleId);
    }

    // add the role
    if(addRole) {
        member.roles.add(roleId);
    }
}

const getNormalizedStreamsForUser = (aggregateStreams: lastfmInternal.LastfmTrack[], lowerCaseArtist: string) => {
    // if there are more than 250 streams in a day (12.5 hours) assume scrobbles were imported that day and divide the scrobbles by the average of the other days
    // build day array
    let daysStreamed: { [key: string]: lastfmInternal.LastfmTrack[] } = {};
    for(let stream of aggregateStreams) {
        // skip songs if no date is found (for example, if it is playing now)
        if(!stream.date) {
            // console.log(`stream has no date, continuing...`)
            continue;
        }
        // console.dir(stream, stream.date);
        const dateStreamed = DateTime.fromSeconds(parseInt(stream.date.uts)).setLocale('utc').toLocaleString(DateTime.DATE_SHORT);
        daysStreamed[dateStreamed] = daysStreamed[dateStreamed] ?? [];
        daysStreamed[dateStreamed].push(stream);
        // console.log(`pushed stream streamed on ${ dateStreamed } to array`)
    }
    console.log(`days streamed is`)
    for(let day in daysStreamed) {
        console.log(`streams: ${ day }, ${ daysStreamed[day].length }`);
    }

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
            const artistTrackCount: number = cur.filter(track => track.artist['#text'].toLowerCase().includes(lowerCaseArtist)).length;
            const normalizedArtistTrackCount = totalTrackCount > maxStreamsInANormalDay ?
                // if we guess the user is uploading scrobbles, take the percentage of artist streams from the upload
                //  and apply it to an average day stream count, avoiding divide by 0 errors
                Math.round(artistTrackCount / Math.max((totalTrackCount / Math.max(averageNormalDayStreams, .1)), 1)) :
                artistTrackCount
            // console.log(`about to return acc of ${acc} + normalizedArtistTrackCount of ${normalizedArtistTrackCount}`)
            return acc + normalizedArtistTrackCount;
        }, 0)
    
    const serverArtistStreams = aggregateStreams
        .filter((track: lastfmInternal.LastfmTrack) => {
            // if(track.artist['#text'].toLowerCase().includes(lowerCaseArtist)) console.log(`found interlucid track: ${JSON.stringify(track.date, null, 4)}`)
            return track.artist['#text'].toLowerCase().includes(lowerCaseArtist)
        })
    // only allow up to 50% of the recorded streams to be counted from this artist (so people don't just stream only the server artist's music all the time)
    // this in-between step gets the normalized streams as if we weren't normalizing for days
    const normalizedArtistStreamCount = Math.min(serverArtistStreams.length, aggregateStreams.length - serverArtistStreams.length);
    const artistNormalizationMultiplier = normalizedArtistStreamCount / Math.max(serverArtistStreams.length, 1);
    const normalizedStreamCount = artistNormalizationMultiplier * dayNormalizedStreamCount;
    
    console.log(`normalizedArtistStreamCount is ${normalizedArtistStreamCount}, artistNormalizationMultiplier is ${artistNormalizationMultiplier}`)
    console.log(`about to store normalized stream count of ${ normalizedStreamCount } instead of raw stream count of ${ serverArtistStreams.length }`)

    return normalizedStreamCount;
}

const leaderboardDataSort = (user1: mongodbInternal.LeaderboardDatum, user2: mongodbInternal.LeaderboardDatum) => {
    // break ties by keeping the defending user
    if(user2.serverArtistNormalizedStreamsThisMonth === user1.serverArtistNormalizedStreamsThisMonth) return 1;
    return user2.serverArtistNormalizedStreamsThisMonth - user1.serverArtistNormalizedStreamsThisMonth;
}

// use the cache by default
export const getMonthlyLeaderboardData = async (
    guild: Guild,
    useCache = true,
    month = DateTime.utc().toFormat('LL'),
    year = DateTime.utc().toFormat('y'),
) => {
    const storedConfig = await mongodbInternal.getConfig();

    // get all the Last.fm users in the database
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    // console.log(JSON.stringify(storedLastfmUsers, null, 4));

    const emptyLeaderboardResult: mongodbInternal.LeaderboardResult = {
        month: mongodbInternal.getUTCMonthYearString(month, year),
        // set to 0 so we don't skip grabbing the initial data
        updated: 0,
        leaderboardData: [],
    }
    console.log(`at empty leaderboard result`)
    // for each user, query all their data for the specified month (start with current)
    // do this synchronously (using await in a for loop, not a Promise.all map) to avoid rate limit issues
    // if we get null (no data yet), keep the default initilized value
    // TODO: fix issue where new users don't have an entry in the database
    const cachedLeaderboardResult: mongodbInternal.LeaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year) ?? emptyLeaderboardResult;
    // use the cache if not disabled
    const leaderboardResult = useCache ? cachedLeaderboardResult : emptyLeaderboardResult;
    // get the current heir from the cached result, otherwise it will show the messages for claiming the crown when cache is manually disabled
    const currentHeir = cachedLeaderboardResult.leaderboardData.length ? cachedLeaderboardResult.leaderboardData.sort(leaderboardDataSort)[0] : null;

    const leaderboardData: mongodbInternal.LeaderboardDatum[] = leaderboardResult.leaderboardData;
    const cacheExpired = DateTime.utc().toMillis() - leaderboardResult.updated > 300000;
    // only fetch new data from lastfm if more than five minutes has passed from the last fetch
    for(let user of storedLastfmUsers) {
        const leaderboardDatum = leaderboardData.find((leaderboardDatum: mongodbInternal.LeaderboardDatum) => leaderboardDatum.userDiscordId === user.discordId)
        const lowerCaseArtist = storedConfig.artist_name.toLowerCase();
        let newAggregateStreams: lastfmInternal.LastfmTrack[] = [];
        if(cacheExpired) {
            newAggregateStreams = await lastfmInternal.getUserMonthlyStreams(user.lastfmUsername, leaderboardResult.updated, parseInt(month), parseInt(year));
        }
        const aggregateStreams = [
            ...(leaderboardDatum ? leaderboardDatum.streamData : []),
            ...newAggregateStreams,
        ]

        const normalizedStreamCount = getNormalizedStreamsForUser(aggregateStreams, lowerCaseArtist);

        // don't add multiples of the same user
        if(leaderboardDatum) {
            leaderboardDatum.serverArtistNormalizedStreamsThisMonth = normalizedStreamCount;
        } else {
            // if we don't have the user yet add a new one
            leaderboardData.push({
                userDiscordId: user.discordId,
                serverArtistNormalizedStreamsThisMonth: normalizedStreamCount,
                streamData: aggregateStreams,
            })
        }
    }
    // console.dir(Object.keys(leaderboardData[0]));
    
    // cache in database
    mongodbInternal.updateMonthlyLeaderboard(leaderboardData, month, year);

    // assemble data
    const currentHeirDiscordUser = currentHeir ? await guild.members.fetch(currentHeir.userDiscordId) : null;
    const sortedLeaderboardData = leaderboardData.sort(leaderboardDataSort);
    const newHeirDiscordUser = await guild.members.fetch(sortedLeaderboardData[0].userDiscordId);
    console.log(`current heir has Discord ID ${currentHeirDiscordUser} and new heir has Discord ID ${sortedLeaderboardData[0].userDiscordId}`)
    const text = `
    
${(await Promise.all(sortedLeaderboardData
        .map(async (leaderboardDatum, index) => {
            const guildMember =  (await guild.members.fetch(leaderboardDatum.userDiscordId))
            return `${index === 0 ? '👑 ' : `${index + 1}.`} [${
                    guildMember.displayName
                }](https://last.fm/user/${ storedLastfmUsers.find(user => user.discordId === leaderboardDatum.userDiscordId).lastfmUsername }) - **${ leaderboardDatum.serverArtistNormalizedStreamsThisMonth }** ${storedConfig.artist_name} play${ leaderboardDatum.serverArtistNormalizedStreamsThisMonth === 1 ? '' : 's' }\n`
            })))
        .join('')}
${ currentHeir === null ? `${newHeirDiscordUser.displayName} is the new heir to the throne!` : `` }${
    currentHeir && currentHeir.userDiscordId !== sortedLeaderboardData[0].userDiscordId ? `${newHeirDiscordUser.displayName} overtook ${currentHeirDiscordUser.displayName} and is now heir to the throne!` : ``
}
`;
    return {
        text,
        cacheExpired,
        leaderboardData,
    }
}
