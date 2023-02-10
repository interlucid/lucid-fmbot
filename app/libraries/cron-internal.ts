import { CronJob } from 'cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

import * as leaderboardLib from '~/libraries/leaderboard-lib';
import * as mongodbInternal from '~/libraries/mongodb-internal';

// on the 8th, 15th, and 23rd (roughly dividing the month into fourths)
export const startCurrentMonthUpdateJob = async (client: Client) => {
    const storedConfig = await mongodbInternal.getConfig();
    const announcementsChannel = (await client.channels.fetch(storedConfig.announcements_channel) as TextChannel);
    const guild = announcementsChannel.guild;
    new CronJob('0 0 0 8,15,23 * *', async () => {
    // new CronJob('0 */5 * * * *', async () => {
        const leaderboardEmbed = new EmbedBuilder()
            .setTitle(`Monthly Streaming Monarch Leaderboard - ${ new Date().toLocaleString('default', { month: 'long' }) }`)
            .setColor(storedConfig.embed_color)
            .setDescription((await leaderboardLib.getMonthlyLeaderboardText(guild, false)).text);
        (await announcementsChannel.send({
            embeds: [
                leaderboardEmbed
            ],
        })).crosspost();
    }, null, true, 'UTC')
}