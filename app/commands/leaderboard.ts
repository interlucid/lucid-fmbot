import { SlashCommandBuilder, SlashCommandBooleanOption, EmbedBuilder, PermissionsBitField, ChatInputCommandInteraction } from 'discord.js';
import { DateTime } from 'luxon';

import * as mongodbInternal from '~/libraries/mongodb-internal';
import * as leaderboardLib from '~/libraries/leaderboard-lib';
import '~/types/command-types';

export const data = new SlashCommandBuilder()
    .setName(`leaderboard`)
    .setDescription(`Show the monthly streaming monarch leaderboard for this month`)
    .addBooleanOption(new SlashCommandBooleanOption()
        .setName(`use_cache`)
        .setDescription(`Set to false to disable the cache (true by default, server manager only)`));

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const userUseCache = interaction.options.getBoolean(`use_cache`);
    console.log(`userUseCache is ${ userUseCache }`);
    // userUseCache might be null but we only care if it's false
    if (userUseCache === false && !interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({
            content: `Only uses with server manager permissions can disable the cache for this command`,
            ephemeral: true,
        });
        return;
    }

    const storedConfig = await mongodbInternal.getConfig();

    const replyEmbed = new EmbedBuilder()
        .setColor(storedConfig.embedColor)
        .setDescription(`Fetching leaderboard data...this may take a bit so we don't run into rate limit issues with Last.fm ⏳`);

    await interaction.reply({
        embeds: [
            replyEmbed,
        ],
        // ephemeral: true,
    });

    try {
        // fetch the leaderboard; only use the user cache option if it's explicitly set
        const leaderboardResponse = await leaderboardLib.getMonthlyLeaderboardData(
            leaderboardLib.LeaderboardType.Heir,
            interaction.guild,
            userUseCache === null ? true : userUseCache,
            DateTime.utc().toFormat(`LL`),
            DateTime.utc().toFormat(`y`),
            interaction.user);
        const storedLastfmUsers = await mongodbInternal.getAllUsers();

        // give the current top streamer the Monthly Streaming Heir role
        // we can use the first index of the leaderboardData array since it's sorted
        // only add the heir role if the leader has more than 0 streams
        // console.log(`monthlyStreamingHeir`)
        const monthlyStreamingHeir = leaderboardResponse.leaderboardData[0];
        // console.dir(monthlyStreamingHeir);
        leaderboardLib.updateSingletonRole(await interaction.guild.members.fetch(monthlyStreamingHeir.userDiscordId), storedConfig.heirRole, storedLastfmUsers, monthlyStreamingHeir.serverArtistNormalizedStreamsThisMonth > 0);

        replyEmbed
            .setTitle(`Monthly Streaming Heir Leaderboard - ${ DateTime.utc().toLocaleString({ year: `numeric`, month: `long` }) }`)
            .setDescription(leaderboardResponse.description);

        let footerText = ``;

        // let users know why they may have 0 streams
        if (leaderboardResponse.noStreamsForThisUser) {
            footerText += `Streams not showing up? Make sure they appear on https://last.fm/ and make sure you have streamed music by other artists! You have to stream at least as many songs by other artists as Interlucid for your streams to count on the leaderboard.\n\n`;
        }

        // let users know about the cache if they utilize it
        if (!leaderboardResponse.cacheExpired) {
            footerText += `Data not updating? Results are cached for five minutes to reduce load on Last.fm API.\n\n`;
        }

        // Discord.js gets mad if you try to make the footer an empty string
        if (footerText.length > 0) {
            replyEmbed
                .setFooter({
                    text: footerText,
                });
        }

        await interaction.editReply({
            embeds: [
                replyEmbed,
            ],
        });
    } catch (e) {
        replyEmbed
            .setDescription(`There was an error updating the leaderboard.`);
        await interaction.editReply({
            embeds: [
                replyEmbed,
            ],
        });
        throw e;
    }
};
