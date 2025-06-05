// const commands = [
//     {
//         name: 'history',
//         description: 'Show the Monthly Streaming Monarch leaderboard history',
//     },
// ];

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

import { commandImports } from '~/commands/index';
import '~/load-env';

// Grab all the command files from the commands directory you created earlier

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment

const commands = commandImports.map((commandImport => {
    return {
        ...commandImport.data,
    };
}));
console.log(JSON.stringify(commands, null, 4));

// Construct and prepare an instance of the REST module
const rest = new REST({ version: `10` }).setToken(process.env.DISCORD_TOKEN);

// and deploy your commands!
(async () => {
    const client = await new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    try {

        console.log(`Started refreshing ${ commands.length } application (/) commands.`);
        // just refresh all guilds that we're logged into; if this bot becomes super famous at some point optimize it
        await Promise.all(client.guilds.cache.map(async (guild) => {
            // The put method is used to fully refresh all commands in the guild with the current set
            rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands },
            );
        }));

        // get rid of any global commands
        // client.application.commands.set([]);

        console.log(`Successfully reloaded ${ commands.length } application (/) commands in ${ client.guilds.cache.size } guilds.`);

        client.destroy();
        // console.log(`Logged out ${client.user.tag}`);
        console.log(`Logged out`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
