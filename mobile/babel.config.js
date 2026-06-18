module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 ships its worklet transformer via react-native-worklets.
    // The plugin must be listed LAST in plugins.
    plugins: ["react-native-worklets/plugin"],
  };
};
