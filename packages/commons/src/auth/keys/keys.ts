import { z } from "zod";

export const KID = z.string().brand("KID");
export type KID = z.infer<typeof KID>;
