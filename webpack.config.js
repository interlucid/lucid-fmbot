import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export default {
    target: 'node19',
    mode: 'development',
    entry: './app/main.ts',
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
    experiments: {
        outputModule: true,
    },
    output: {
        filename: 'app.js',
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