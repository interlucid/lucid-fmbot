import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import * as lastfmInternal from '~/libraries/lastfm-internal';
import * as mongodbInternal from '~/libraries/mongodb-internal';
import '~/types/command-types';

export const data = new SlashCommandBuilder()
    .setName('login')
    .setDescription('Log into Last.fm');
    
export const execute = async (interaction: ChatInputCommandInteraction) => {
    try {
        // if already logged in, let the user know
        const storedUser = await mongodbInternal.getUserByDiscordId(interaction.member.user.id) as unknown as mongodbInternal.StoredUser;
        console.log(JSON.stringify(storedUser, null, 4))
        const lastFmSessionData = await lastfmInternal.verifySession(storedUser);
        console.log(JSON.stringify(lastFmSessionData, null, 4))
        
    } catch (e) {
        console.log(e, `error creating session but this might be just because this user hasn't logged in before`)
    }
    

    let lastfmTokenData;
    try {
        lastfmTokenData = await lastfmInternal.getToken();
        // console.log(JSON.stringify(lastfmTokenData, null, 4))
        if('token' in lastfmTokenData) {
            await interaction.reply({
                content: `Click this link to log in: http://www.last.fm/api/auth/?api_key=${ lastfmInternal.LASTFM_API_KEY }&token=${ lastfmTokenData.token }`,
                ephemeral: true,
            });
        } else {
            console.log(`got to the else`)
        }
    } catch (e) {
        await interaction.reply({
            content: `There was an error retrieving an authentication token from Last.fm. Try again later.`,
            ephemeral: true,
        });
        return;
    }

    if(!('token' in lastfmTokenData)) return;

    try {
        // attempt to get a session
        const session = await lastfmInternal.createSessionFromToken(lastfmTokenData.token) as { user: string, key: string };
        console.log(`success fetching session`, JSON.stringify(session, null, 4))
        // store in database
        mongodbInternal.updateUser({
            lastfmUsername: session.user,
            lastfmSessionKey: session.key,
            discordId: interaction.member.user.id,
        })
        await interaction.editReply('Successfully authenticated!');
    } catch(e) {
        console.log(`error fetching session`, JSON.stringify(e, null, 4))
        await interaction.editReply('There was a problem while trying to authenticate. Try again later');
    }

}
