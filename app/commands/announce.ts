import { SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, PermissionsBitField, ChatInputCommandInteraction } from 'discord.js';

import * as mongodbInternal from '~/libraries/mongodb-internal';
import * as leaderboardLib from '~/libraries/leaderboard-lib';
import '~/types/command-types';

const leaderboardChoiceMap: { [key: string]: leaderboardLib.LeaderboardType } = {
    heir: leaderboardLib.LeaderboardType.Heir,
    monarch: leaderboardLib.LeaderboardType.Monarch,
};

export const data = new SlashCommandBuilder()
    .setName(`announce`)
    .setDescription(`Trigger a post in the configured announcements channel (server manager only)`)
    .addStringOption(new SlashCommandStringOption()
        .setRequired(true)
        .setName(`leaderboard_type`)
        .setDescription(`Choose whether to announce the current heir or monarch`)
        .addChoices(
            { name: `Heir`, value: `heir` },
            { name: `Monarch`, value: `monarch` },
        ));

export const execute = async (interaction: ChatInputCommandInteraction) => {
    // only allow server managers to make announcements
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({
            content: `Only uses with server manager permissions can use this command`,
            ephemeral: true,
        });
        return;
    }

    const storedConfig = await mongodbInternal.getConfig();
    const replyEmbed = new EmbedBuilder()
        .setColor(storedConfig.embedColor)
        .setDescription(`Queued announcement post...this may take a bit so we don't run into rate limit issues with Last.fm ⏳`);

    const leaderboardType = leaderboardChoiceMap[interaction.options.getString(`leaderboard_type`)];
    console.log(`leaderboardType is ${leaderboardType}`);

    await interaction.reply({
        embeds: [
            replyEmbed,
        ],
        ephemeral: true,
    });

    try {
        await leaderboardLib.announceLeaderboardUpdate(leaderboardType, interaction.client);

        // only add the heir role if the leader has more than 0 streams
        replyEmbed.setDescription(`Announcement post sent!`);

        await interaction.editReply({
            embeds: [
                replyEmbed,
            ],
        });
    }
    catch (e) {
        replyEmbed
            .setDescription(`There was an error making an announcement leaderboard post.`);
        await interaction.editReply({
            embeds: [
                replyEmbed,
            ],
        });
        throw e;
    }
};
