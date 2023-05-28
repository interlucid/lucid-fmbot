import {
    SlashCommandBuilder,
    SlashCommandChannelOption,
    SlashCommandMentionableOption,
    SlashCommandStringOption,
    ChatInputCommandInteraction,
    PermissionsBitField,
    EmbedBuilder,
    Role,
    ColorResolvable,
} from 'discord.js';

import * as mongodbInternal from '~/libraries/mongodb-internal';
import '~/types/command-types';

const snakeToCamel = (str: string) => {
    return str.toLowerCase().replace(/([-_][a-z])/g, (group: string) =>
        group
            .toUpperCase()
            .replace(`-`, ``)
            .replace(`_`, ``),
    );
};

const channelOptions = [
    {
        name: `announcements_channel`,
        displayName: `Announcements channel`,
        description: `The channel where monthly and other periodic leaderboards will be shown`,
    },
];

const mentionableOptions = [
    {
        name: `monarch_role`,
        displayName: `Monthly Streaming Monarch role`,
        description: `The role the Monthly Streaming Monarch will have`,
    },
    {
        name: `heir_role`,
        displayName: `Monthly Streaming Heir role`,
        description: `The role the Monthly Streaming Heir will have`,
    },
];

const stringOptions = [
    {
        name: `artist_name`,
        displayName: `Artist name`,
        description: `The name of the artist tracked in this server`,
    },
    {
        name: `embed_color`,
        displayName: `Embed color`,
        description: `The color of the embed border (hex)`,
    },
];

export const data = new SlashCommandBuilder()
    .setName(`config`)
    .setDescription(`Get or set config values for this server`);

for (const option of channelOptions) {
    data.addChannelOption(new SlashCommandChannelOption()
        .setName(option.name)
        .setDescription(option.description));
}

for (const option of mentionableOptions) {
    data.addMentionableOption(new SlashCommandMentionableOption()
        .setName(option.name)
        .setDescription(option.description));
}

for (const option of stringOptions) {
    data.addStringOption(new SlashCommandStringOption()
        .setName(option.name)
        .setDescription(option.description));
}

const hasOptions = (interaction: ChatInputCommandInteraction) => {
    for (const option of channelOptions) {
        if (interaction.options.getChannel(option.name)) return true;
    }
    for (const option of mentionableOptions) {
        if (interaction.options.getMentionable(option.name)) return true;
    }
    for (const option of stringOptions) {
        if (interaction.options.getString(option.name)) return true;
    }
    return false;
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const newStoredConfig: mongodbInternal.Config = await mongodbInternal.getConfig() as unknown as mongodbInternal.Config;
    if (hasOptions(interaction)) {
        // only let server managers change options
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({
                content: `Only uses with server manager permissions can update the server config`,
                ephemeral: true,
            });
            return;
        }

        for (const option of channelOptions) {
            // if the option exists, add it to the database object
            const channel = interaction.options.getChannel(option.name);
            if (channel) {
                newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config] = channel.id;
            }
        }

        for (const option of mentionableOptions) {
            const mentionable = interaction.options.getMentionable(option.name);
            // if the option exists, add it to the database object
            if (mentionable) {
                newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config] = (mentionable as Role).id;
            }
        }

        for (const option of stringOptions) {
            const stringOption = interaction.options.getString(option.name);
            // if the option exists, add it to the database object
            if (stringOption) {
                newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config] = stringOption;
            }
        }

        mongodbInternal.setConfig(newStoredConfig);
    }

    const configTable = `${
        (await Promise.all(channelOptions.map(async option => `${option.displayName}: <#${
            (await interaction.guild.channels.fetch(newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config])).id}>\n`)))
            .join(``) }${
        (await Promise.all(mentionableOptions.map(async option => `${option.displayName}: **${
            (await interaction.guild.roles.fetch(newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config])).name}**\n`)))
            .join(``) }${
        stringOptions.map(option => `${option.displayName}: **${newStoredConfig[snakeToCamel(option.name) as keyof mongodbInternal.Config]}**\n`).join(``)
    }`;

    const replyEmbed = new EmbedBuilder()
        .setColor(newStoredConfig.embedColor as ColorResolvable)
        .setTitle(`Config`)
        .setDescription(configTable);

    // anyone can view config
    await interaction.reply({
        embeds: [
            replyEmbed,
        ],
        ephemeral: true,
    });
};
