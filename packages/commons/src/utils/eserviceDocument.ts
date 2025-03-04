// import { z } from "zod";
// import YAML from "yaml";
// import { Technology } from "pagopa-interop-models";
// import { match, P } from "ts-pattern";
// import { FileManager } from "../index.js";

// export const allowedFileType = {
//   json: "json",
//   yaml: "yaml",
//   wsdl: "wsdl",
//   xml: "xml",
// } as const;
// export const AllowedFileType = z.enum([
//   Object.values(allowedFileType)[0],
//   ...Object.values(allowedFileType).slice(1),
// ]);
// export type AllowedFileType = z.infer<typeof AllowedFileType>;

// const Wsdl = z.object({
//   definitions: z.object({
//     binding: z.array(
//       z.object({
//         operation: z.array(
//           z.object({
//             name: z.string(),
//           })
//         ),
//       })
//     ),
//     service: z.object({
//       port: z.array(
//         z.object({
//           address: z.object({ location: z.string() }),
//         })
//       ),
//     }),
//   }),
// });

// const getFileType = (name: string): AllowedFileType | undefined =>
//   match(name.toLowerCase())
//     .with(P.string.endsWith("json"), () => "json" as const)
//     .with(
//       P.string.endsWith("yaml"),
//       P.string.endsWith("yml"),
//       () => "yaml" as const
//     )
//     .with(P.string.endsWith("wsdl"), () => "wsdl" as const)
//     .with(P.string.endsWith("xml"), () => "xml" as const)
//     .otherwise(() => undefined);

// // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// const parseOpenApi = (
//   fileType: Omit<AllowedFileType, "wsdl" | "xml">,
//   file: string,
//   eServiceId: string
// ) =>
//   match(fileType)
//     .with("json", () => JSON.parse(file))
//     .with("yaml", () => YAML.parse(file))
//     .otherwise(() => {
//       throw invalidInterfaceFileDetected(eServiceId);
//     });

// // eslint-disable-next-line max-params
// export async function verifyAndCreateDocument<T>(
//   fileManager: FileManager,
//   id: string,
//   technology: Technology,
//   prettyName: string,
//   kind: "INTERFACE" | "DOCUMENT",
//   doc: File,
//   documentId: string,
//   documentContainer: string,
//   documentPath: string,
//   createDocumentHandler: (
//     path: string,
//     serverUrls: string[],
//     checksum: string
//   ) => Promise<T>,
//   logger: Logger
// ): Promise<T> {
//   const contentType = doc.type;
//   if (!contentType) {
//     throw invalidInterfaceContentTypeDetected(id, "invalid", technology);
//   }

//   const serverUrls = await handleEServiceDocumentProcessing(
//     {
//       prettyName,
//       kind,
//       doc,
//     },
//     technology,
//     id
//   );
//   const filePath = await fileManager.storeBytes(
//     {
//       bucket: documentContainer,
//       path: documentPath,
//       resourceId: documentId,
//       name: doc.name,
//       content: Buffer.from(await doc.arrayBuffer()),
//     },
//     logger
//   );

//   const checksum = await calculateChecksum(Readable.from(doc.stream()));
//   try {
//     return await createDocumentHandler(filePath, serverUrls, checksum);
//   } catch (error) {
//     await fileManager.delete(documentContainer, filePath, logger);
//     throw error;
//   }
// }
