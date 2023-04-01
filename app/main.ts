import { Client, Collection, Events, GatewayIntentBits, BaseInteraction } from 'discord.js';

import { CommandImport, commandImports } from '~/commands/index';
import * as cronInternal from '~/libraries/cron-internal';
import '~/load-env';

// create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands: Collection<string, CommandImport> = new Collection();

// console.log(JSON.stringify(commandImports, null, 4))
for(let commandImport of Object.values(commandImports)) {
    commands.set(commandImport.data.name, commandImport);
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, (client: any) => {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	cronInternal.startCurrentMonthUpdateJob(client);
	cronInternal.startLastMonthFinalCountJob(client);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing "/${interaction.commandName}" command`);
		console.error(error);
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);