const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withAbiFilter(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    // Add ndk abiFilters inside defaultConfig block
    if (!contents.includes('abiFilters')) {
      config.modResults.contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        ndk {\n            abiFilters "arm64-v8a"\n        }`
      );
    }
    return config;
  });
};
