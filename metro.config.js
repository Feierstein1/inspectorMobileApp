const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit parallel workers to reduce peak memory on Windows
config.maxWorkers = 1;

module.exports = config;
