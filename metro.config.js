// PhotoQuote v2 — Metro config.
// The minified production bundle was throwing a fatal JS exception at boot (white screen on
// New Arch / SIGABRT via ExceptionsManager on Old Arch), while the un-minified bundle runs fine
// in Expo Go. So we disable the minifier's name-mangling AND compression to rule out minification
// as the cause (something in the bundle depends on names/structure the minifier was rewriting).
// Bundle gets larger but boots correctly; can be tightened later once the exact offender is known.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = config.transformer || {};
config.transformer.minifierConfig = {
  compress: false,
  mangle: false,
  keep_classnames: true,
  keep_fnames: true,
};

module.exports = config;
