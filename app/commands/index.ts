import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import * as login from './login';
import * as leaderboard from './leaderboard';

export interface CommandImport {
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
    execute: (interaction: ChatInputCommandInteraction) => {}
}

export const commandImports: CommandImport[] = [
    login,
    leaderboard,
]