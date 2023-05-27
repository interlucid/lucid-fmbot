import { Cron } from 'croner';
import { Client } from 'discord.js';

import * as leaderboardLib from '~/libraries/leaderboard-lib';

// on the 10th and 20th of the month (roughly dividing the month into thirds)
export const startCurrentMonthUpdateJob = async (client: Client) => {
    new Cron(`0 0 0 10,20 * *`, {
    // new Cron('0 */5 * * * *', {
        timezone: `UTC`,
    }, () => {
        leaderboardLib.announceLeaderboardUpdate(leaderboardLib.LeaderboardType.Heir, client);
    });
};

// on the 1st of every month, update the monarch and remove the heir role
export const startLastMonthFinalCountJob = async (client: Client) => {
    new Cron(`0 0 0 1 * *`, {
    // new Cron('0 28 * * * *', {
        timezone: `UTC`,
    }, () => {
        leaderboardLib.announceLeaderboardUpdate(leaderboardLib.LeaderboardType.Monarch, client);
    });
};
