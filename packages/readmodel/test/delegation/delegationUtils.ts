import { delegationReadModelServiceBuilder } from "../../src/delegation/delegationReadModelService.js";
import { readModelDB } from "../utils.js";

export const delegationReadModelService =
  delegationReadModelServiceBuilder(readModelDB);
