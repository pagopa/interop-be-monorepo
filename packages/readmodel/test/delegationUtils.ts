import { delegationReadModelServiceBuilder } from "../src/delegationReadModelService.js";
import { readModelDB } from "./utils.js";

export const delegationReadModelService =
  delegationReadModelServiceBuilder(readModelDB);
