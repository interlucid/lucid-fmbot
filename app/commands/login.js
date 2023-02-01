const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Log into Last.fm'),
	async execute(interaction) {
		await interaction.reply({
            content: `Click this link to log in: `,
            ephemeral: true,
        });
	},
};