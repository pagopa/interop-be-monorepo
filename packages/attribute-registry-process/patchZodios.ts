// This script patch the auto-generated zodios decoder to support query array parameters with style `form` non-exploded.
//
// behavior without this patch:
// ?ids=[1,2,3] -> accepted
// ?ids=1,2,3 -> not accepted
// ?ids=1&ids=2&ids=3 -> accepted
//
// behavior with this patch:
// ?ids=[1,2,3] -> not accepted
// ?ids=1,2,3 -> accepted
// ?ids=1&ids=2&ids=3 -> accepted
//
// This fix has two major downsides:
// - this script to patch the autogenerated zodios definition is more a hack than a real solution 
// - these changes reduce the type safety of the generated zodios client. When we specify 
//   a query array parameter we need to pass a string comma-separated and we cannot send a "real" array
//
// ```typescript
// const client = createApiClient("http://0.0.0.0:3000", {
//   axiosConfig: {
//     paramsSerializer: {
//       serialize: (params) => qs.stringify(params, { arrayFormat: "comma" }),
//     },
//   },
// });
//
// const eservices = await client.getEServices({
//   headers: { ... },
//   queries: { offset: 0, limit: 10, eservicesIds: "1,2" },
// });
// ```

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
        name: "kinds",
        type: "Query",
        schema: z.array(AttributeKind),
      }`,
    replace: `{
        name: "kinds",
        type: "Query",
        schema: z.string().transform(v => v.split(",")).pipe(z.array(AttributeKind)),
      }`,
  },
];

let newApiContent = apiContent;

for (const { find, replace } of patch) {
  newApiContent = newApiContent.replaceAll(find, replace);
}

writeFileSync(apiPath, newApiContent);
