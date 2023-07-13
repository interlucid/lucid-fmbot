import { SlashCommandBuilder, SlashCommandBooleanOption, ChatInputCommandInteraction } from 'discord.js';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';
import '~/types/command-types';

export const data = new SlashCommandBuilder()
    .setName(`login`)
    .setDescription(`Log into Last.fm`)
    .addBooleanOption(new SlashCommandBooleanOption()
        .setName(`force`)
        .setDescription(`Forces login process to retrieve a new session even if you've logged in before`));

export const execute = async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.options.getBoolean(`force`)) {
        try {
            // if already logged in, let the user know
            const storedUser = await mongodbInternal.getUserByDiscordId(interaction.member.user.id) as unknown as mongodbInternal.StoredUser;
            if (storedUser?.lastfmSessionKey) {
                await interaction.reply({
                    content: `It looks like you're already logged in. If you're having problems you can try this command again with \`force = true\``,
                    ephemeral: true,
                });
                return;
            }
            // console.log(JSON.stringify(storedUser, null, 4))
            console.log(`stored user is`);
            console.dir(storedUser);
        } catch (e) {
            console.log(e, `didn't find user in the database but it's probably fine because this may be their first time logging in`);
        }
    }

    let lastfmTokenData;
    try {
        lastfmTokenData = await lastfmInternal.getToken();
        // console.log(JSON.stringify(lastfmTokenData, null, 4))
        if (`token` in lastfmTokenData) {
            await interaction.reply({
                content: `Click this link to log in: http://www.last.fm/api/auth/?api_key=${ lastfmInternal.LASTFM_API_KEY }&token=${ lastfmTokenData.token }`,
                ephemeral: true,
            });
        } else {
            console.log(`got to the else`);
        }
    } catch (e) {
        await interaction.reply({
            content: `There was an error retrieving an authentication token from Last.fm. Try again later.`,
            ephemeral: true,
        });
        return;
    }

    if (!(`token` in lastfmTokenData)) return;

    try {
        // attempt to get a session
        const session = await lastfmInternal.createSessionFromToken(lastfmTokenData.token) as { user: string, key: string };
        console.log(`success fetching session`, JSON.stringify(session, null, 4));
        // store in database
        mongodbInternal.updateUser({
            lastfmUsername: session.user,
            lastfmSessionKey: session.key,
            discordId: interaction.member.user.id,
        });
        await interaction.editReply(`Successfully authenticated!`);
    } catch (e) {
        console.log(`error fetching session`, JSON.stringify(e, null, 4));
        await interaction.editReply(`There was a problem while trying to authenticate. Try again later`);
    }

};
