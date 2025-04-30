import { readModelSetupEnv } from "../src/config/config.js";

Object.entries(readModelSetupEnv).forEach(([key, value]) => {
  // eslint-disable-next-line functional/immutable-data
  process.env[key] = value;
});
