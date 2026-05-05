import { notificationConfigReadModelServiceBuilder } from "../../src/notification-config/notificationConfigReadModelService.js";
import { readModelDB } from "../utils.js";

export const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);
