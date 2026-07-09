const { createDefaultPreset } = require("ts-jest");

/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: false }],
    "^.+\\.m?jsx?$": "babel-jest",
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^uuid$": require.resolve("uuid"),
  },
  transformIgnorePatterns: [
    "node_modules/(?!(rpc-websockets|@solana/web3.js|uuid)/)"
  ],
};