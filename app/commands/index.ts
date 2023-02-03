import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import * as login from './login';

export interface CommandImport {
    data: SlashCommandBuilder,
    execute: (interaction: ChatInputCommandInteraction) => {}
}

export const commandImports: CommandImport[] = [
    login,
]