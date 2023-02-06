import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChatInputCommandInteraction } from 'discord.js';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';
import '~/types/command-types';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the monthly streaming monarch leaderboard for this month (server manager only)');

export const execute = async (interaction: ChatInputCommandInteraction) => {
    // if(!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
    //     await interaction.reply({
    //         content: `Only uses with server manager permissions can execute this command`,
    //         ephemeral: true,
    //     });
    //     return;
    // }

    const replyEmbed = new EmbedBuilder()
        .setColor('#ffa000')
        .setDescription(`Fetching leaderboard data...this may take a bit so we don't run into rate limit issues with Last.fm ⏳`)

    await interaction.reply({
        embeds: [
            replyEmbed
        ],
        // ephemeral: true,
    });

    // get all the Last.fm users in the database
    const storedLastfmUsers = await mongodbInternal.getAllUsers();
    // console.log(JSON.stringify(storedLastfmUsers, null, 4));
    const year = (new Date).getUTCFullYear();
    const month = (new Date).getUTCMonth();
    // for each user, query all their data for the specified month (start with current)
    // do this synchronously (using await in a for loop, not a Promise.all map) to avoid rate limit issues
    const leaderboardResult: mongodbInternal.LeaderboardResult = await mongodbInternal.getMonthlyLeaderboard(month, year) ?? {
        month: mongodbInternal.getUTCMonthYearString(month, year),
        // set to 0 so we don't skip grabbing the initial data
        updated: 0,
        leaderboardData: [],
    }



    let leaderboardData: mongodbInternal.LeaderboardDatum[] = leaderboardResult.leaderboardData;
    const cacheExpired = Date.now() - leaderboardResult.updated > 300000;
    // only fetch new data from lastfm if more than five minutes has passed from the last fetch
    if(cacheExpired) {
        for(let user of storedLastfmUsers) {
            const leaderboardDatum = leaderboardData.find((leaderboardDatum: mongodbInternal.LeaderboardDatum) => leaderboardDatum.storedUserId.equals(user._id))
            const userStreamsThisMonth = await lastfmInternal.getUserMonthlyStreamsForArtist(user.lastfmUsername, 'interlucid', leaderboardResult.updated, month, year);
            // don't add multiples of the same user
            if(leaderboardDatum) {
                leaderboardDatum.streamsThisMonth += userStreamsThisMonth;
            } else {
                // if we don't have the user yet add a new one
                leaderboardData.push({
                    storedUserId: user._id,
                    streamsThisMonth: userStreamsThisMonth,
                })
            }
        }
    }
    // console.dir(Object.keys(leaderboardData[0]));
    
    // cache in database
    mongodbInternal.updateMonthlyLeaderboard(leaderboardData);

    // assemble data
    const replyContent = `
    
${(await Promise.all(leaderboardData
        .sort((a, b) => b.streamsThisMonth - a.streamsThisMonth)
        .map(async (leaderboardDatum, index) => {
            return `${index === 0 ? '👑 ' : `${index + 1}.`} ${
                    (await interaction.client.users.fetch(storedLastfmUsers.find(user => user._id.equals(leaderboardDatum.storedUserId)).discordId)).username
                } - **${ leaderboardDatum.streamsThisMonth }** Interlucid play${ leaderboardDatum.streamsThisMonth === 1 ? '' : 's' }\n`
            })))
        .join('')}
`;
    replyEmbed
        .setTitle(`Monthly Streaming Monarch Leaderboard - ${ new Date().toLocaleString('default', { month: 'long' }) }`)
        .setDescription(replyContent)
    
    if(!cacheExpired) {
        replyEmbed
            .setFooter({
                text: `Data not updating? Results are cached for five minutes to reduce load on Last.fm API.`,
            });
    }

    await interaction.editReply({
        embeds: [
            replyEmbed
        ],
    });
}