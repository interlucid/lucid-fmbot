import { GuildMember, SlashCommandBuilder, SlashCommandBooleanOption, EmbedBuilder, PermissionsBitField, ChatInputCommandInteraction } from 'discord.js';

import * as mongodbInternal from '~/libraries/mongodb-internal';
import * as leaderboardLib from '~/libraries/leaderboard-lib';
import '~/types/command-types';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the monthly streaming monarch leaderboard for this month (server manager only)')
    .addBooleanOption(new SlashCommandBooleanOption()
        .setName('use_cache')
        .setDescription(`Set to false to disable the cache. True by default.`));

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const userUseCache = interaction.options.getBoolean('use_cache');
    if(!userUseCache && !interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({
            content: `Only uses with server manager permissions can disable the cache for this command`,
            ephemeral: true,
        });
        return;
    }
    console.log(`userUseCache is ${userUseCache}`)

    const storedConfig = await mongodbInternal.getConfig();

    const replyEmbed = new EmbedBuilder()
        .setColor(storedConfig.embed_color)
        .setDescription(`Fetching leaderboard data...this may take a bit so we don't run into rate limit issues with Last.fm ⏳`)

    await interaction.reply({
        embeds: [
            replyEmbed
        ],
        ephemeral: true,
    });

    // fetch the leaderboard; only use the user cache option if it's explicitly set
    const leaderboardText = await leaderboardLib.getMonthlyLeaderboardText(interaction.guild, userUseCache === null ? true : userUseCache);

    replyEmbed
        .setTitle(`Monthly Streaming Monarch Leaderboard - ${ new Date().toLocaleString('default', { month: 'long' }) }`)
        .setDescription(leaderboardText.text)
    
    // let users know about the cache if they utilize it
    if(!leaderboardText.cacheExpired) {
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