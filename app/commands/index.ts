import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import * as announce from './announce';
import * as config from './config';
import * as login from './login';
import * as leaderboard from './leaderboard';

export interface CommandImport {
    data: Omit<SlashCommandBuilder, `addSubcommand` | `addSubcommandGroup`>,
    execute: (interaction: ChatInputCommandInteraction) => void
}

export const commandImports: CommandImport[] = [
    announce,
    config,
    login,
    leaderboard,
];
