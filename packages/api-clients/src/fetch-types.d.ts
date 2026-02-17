// BodyInit is a Fetch API type used by Hey API generated client code.
// It's available at runtime in Node.js 18+ but not included in TypeScript's
// es2023 lib. This declaration makes it available for compilation.
type BodyInit =
  | Blob
  | BufferSource
  | FormData
  | URLSearchParams
  | ReadableStream
  | string;
