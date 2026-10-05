const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaults = getDefaultConfig(__dirname);
const config = {
  resolver: {
    sourceExts: [...defaults.resolver.sourceExts, 'mjs'],
  },
};

module.exports = mergeConfig(defaults, config);
