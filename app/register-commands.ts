
// const commands = [
//     {
//         name: 'login',
//         description: 'Log into Last.fm',
//     },
//     {
//         name: 'setServerArtist',
//         description: 'Set the artist that will be tracked for the Monthly Streaming Monarch role',
//     },
//     // {
//     //     name: 'leaderboard',
//     //     description: 'Show the Monthly Streaming Monarch leaderboard for this month',
//     // },
//     // {
//     //     name: 'history',
//     //     description: 'Show the Monthly Streaming Monarch leaderboard history',
//     // },
// ];

import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { json } from 'stream/consumers';

import { CommandImport, commandImports } from '~/commands/index';
import '~/load-env';

// Grab all the command files from the commands directory you created earlier

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment

const commands = commandImports.map((commandImport => {
	return {
		...commandImport.data,
	}
}));
console.log(JSON.stringify(commands, null, 4))

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// and deploy your commands!
(async () => {
	const client = await new Client({ intents: [GatewayIntentBits.Guilds] });
	client.once(Events.ClientReady, (c: any) => {
		console.log(`Ready! Logged in as ${c.user.tag}`);
	});
	await client.login(process.env.DISCORD_TOKEN);
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// just refresh all guilds that we're logged into; if this bot becomes super famous at some point optimize it
		for(const guildTuple of client.guilds.cache) {
			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationGuildCommands(client.user.id, guildTuple[1].id),
				{ body: commands },
			);
		}

		console.log(`Successfully reloaded ${commands.length} application (/) commands in ${client.guilds.cache.size} guilds.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();