import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export default {
    target: 'node19',
    mode: 'development',
    entry: {
        main: './app/main.ts',
        registerCommands: './app/register-commands.ts',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            '~': path.resolve('app/'),
            'underscore': 'underscore/underscore.js',
        },
    },
    ignoreWarnings: [
        {
            module: /node_modules/
        },
    ],
    experiments: {
        outputModule: true,
    },
    output: {
        filename: '[name].js',
        path: path.resolve(dirname(fileURLToPath(import.meta.url)), 'dist'),
        library: {
            type: 'module',
        }
    },
    watchOptions: {
        ignored: '**/node_modules',
        poll: 1000,
    },
};