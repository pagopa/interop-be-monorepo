import { notificationConfigReadModelServiceBuilder } from "../src/notificationConfigReadModelService.js";
import { readModelDB } from "./utils.js";

export const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);
