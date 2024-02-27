import { readFileSync, writeFileSync } from "fs";

const apiPath = new URL("./src/model/generated/api.ts", import.meta.url);
const apiContent = readFileSync(apiPath, "utf8");

const patch = [
  {
    find: `
        type: "Query",
        schema: z.array(z.string()).optional().default([]),
      },`,
    replace: `
        type: "Query",
        schema: z.string().optional().transform(v => v ? v.split(",") : undefined).pipe(z.array(z.string()).optional().default([])),
      },`,
  },
  {
    find: `{
        name: "states",
        type: "Query",
        schema: z.array(EServiceDescriptorState).optional().default([]),
      }`,
    replace: `{
        name: "states",
        type: "Query",
        schema: z.string().optional().transform(v => v ? v.split(",") : undefined ).pipe(z.array(EServiceDescriptorState).optional().default([])),
      }`,
  },
  {
    find: `{
        name: "agreementStates",
        type: "Query",
        schema: z.array(AgreementState).optional().default([]),
      }`,
    replace: `{
        name: "agreementStates",
        type: "Query",
        schema: z.string().optional().transform(v => v ? v.split(",") : undefined ).pipe(z.array(AgreementState).optional().default([])),
      }`,
  },
];

let newApiContent = apiContent;

for (const { find, replace } of patch) {
  newApiContent = newApiContent.replaceAll(find, replace);
}

writeFileSync(apiPath, newApiContent);
