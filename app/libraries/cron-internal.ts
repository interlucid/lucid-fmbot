import { CronJob } from 'cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';

import * as leaderboardLib from '~/libraries/leaderboard-lib';
import * as mongodbInternal from '~/libraries/mongodb-internal';

// on the 8th, 15th, and 23rd (roughly dividing the month into fourths)
export const startCurrentMonthUpdateJob = async (client: Client) => {
    new CronJob('0 0 0 8,15,23 * *', async () => {
    // new CronJob('0 */5 * * * *', async () => {
        // get all the values we'll need
        const storedConfig = await mongodbInternal.getConfig();
        const announcementsChannel = (await client.channels.fetch(storedConfig.announcements_channel) as TextChannel);
        const guild = announcementsChannel.guild;
        const leaderboardResponse = await leaderboardLib.getMonthlyLeaderboardData(guild, false);
        const storedLastfmUsers = await mongodbInternal.getAllUsers();

        // update the monthly streaming heir
        leaderboardLib.updateSingletonRole(await guild.members.fetch(leaderboardResponse.leaderboardData[0].userDiscordId), storedConfig.heir_role, storedLastfmUsers, leaderboardResponse.leaderboardData[0].streamsThisMonth > 0)

        const leaderboardEmbed = new EmbedBuilder()
            .setTitle(`Monthly Streaming Heir Leaderboard - ${ DateTime.utc().toLocaleString({ year: 'numeric', month: 'long' }) }`)
            .setColor(storedConfig.embed_color)
            .setDescription(leaderboardResponse.text);
        (await announcementsChannel.send({
            embeds: [
                leaderboardEmbed
            ],
        })).crosspost();
    }, null, true, 'UTC')
}

// on the 1st of every month, update the monarch and remove the heir role
export const startLastMonthFinalCountJob = async (client: Client) => {
    new CronJob('0 0 0 1 * *', async () => {
    // new CronJob('0 28 * * * *', async () => {
        // get all the values we'll need
        const storedConfig = await mongodbInternal.getConfig();
        const announcementsChannel = (await client.channels.fetch(storedConfig.announcements_channel) as TextChannel);
        const guild = announcementsChannel.guild;
        const aDayLastMonth = DateTime.utc().minus({ months: 1 })
        const storedLastfmUsers = await mongodbInternal.getAllUsers();
        const leaderboardResponse = await leaderboardLib.getMonthlyLeaderboardData(
            guild,
            false,
            aDayLastMonth.get('month'),
            aDayLastMonth.get('year')
        );
        const monthlyStreamingMonarch = leaderboardResponse.leaderboardData[0];
        const monthlyStreamingMonarchMember = await guild.members.fetch(leaderboardResponse.leaderboardData[0].userDiscordId)

        // give the monthly streaming monarch role
        leaderboardLib.updateSingletonRole(monthlyStreamingMonarchMember, storedConfig.monarch_role, storedLastfmUsers)
        
        // send the update message
        const leaderboardEmbed = new EmbedBuilder()
            .setTitle(`The Monthly Streaming Monarch for ${
                aDayLastMonth.toLocaleString({ year: 'numeric', month: 'long' }) } is ${
                    monthlyStreamingMonarchMember.displayName } with ${
                        monthlyStreamingMonarch.streamsThisMonth
                    } Interlucid streams!`)
            .setColor(storedConfig.embed_color)
            .setDescription(leaderboardResponse.text);
        (await announcementsChannel.send({
            embeds: [
                leaderboardEmbed
            ],
        }))//.crosspost();
    }, null, true, 'UTC')
}
