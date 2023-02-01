const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config({path: `${__dirname}/../.env`});
const commands = require('./commands');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

console.log(JSON.stringify(commands, null, 4))
for(command of Object.values(commands)) {
    client.commands.set(command.data.name, command);
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

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