import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ColorResolvable,
    SlashCommandBuilder,
} from 'discord.js';

import * as mongodbInternal from '~/libraries/mongodb-internal';

export const data = new SlashCommandBuilder()
    .setName(`help`)
    .setDescription(`Show how to use this bot`);

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const storedConfig = await mongodbInternal.getConfig();

    const replyEmbed = new EmbedBuilder()
        .setColor(storedConfig.embedColor as ColorResolvable)
        .setTitle(`Help`)
        .setDescription(`
            /login: Log in to Last.fm and connect your account to Lucid.fm Bot
            /leaderboard: See the people who listened to the most Interlucid songs this month ranked

            Note: Interlucid streams are only counted if you have listened to at least as many Interlucid songs as other artists' song. For example if you listen to 50 Interlucid songs and 20 songs by other artists, only 20 streams will be counted.
        `);

    await interaction.reply({
        embeds: [
            replyEmbed,
        ],
        ephemeral: true,
    });
};
