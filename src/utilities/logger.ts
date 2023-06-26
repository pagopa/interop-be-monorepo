import * as winston from "winston";
import "winston-daily-rotate-file";
import { config } from "./config.js";

export const logger = winston.createLogger({
  level: config.logLevel,
  transports: [
    new winston.transports.Console(),
    new winston.transports.DailyRotateFile({
      filename: "%DATE%.log",
      dirname: "./logs",
      datePattern: "YYYY-MM-DD-HH",
      maxSize: "20m",
      maxFiles: "365d",
    }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  silent: process.env.NODE_ENV === "test",
});
