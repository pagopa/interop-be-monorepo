# PDND typefaces

These unmodified WOFF2 files match the PDND frontend's `@pagopa/mui-italia`
`theme/fonts.js` imports:

- Titillium Web 300, 400, 600 and 700: `@fontsource/titillium-web` 4.5.9.
- DM Mono 400: `@fontsource/dm-mono` 4.5.10.

Latin and Latin Extended subsets use the same Unicode ranges as Fontsource.
The dashboard serves them locally so the typefaces work offline, without adding
MUI or an external font request.

The font binaries are licensed under the SIL Open Font License 1.1. Copyright
notices and complete licenses are in `titillium-web-OFL.txt` and `dm-mono-OFL.txt`,
from the Google Fonts distribution:

- https://github.com/google/fonts/blob/main/ofl/titilliumweb/OFL.txt
- https://github.com/google/fonts/blob/main/ofl/dmmono/OFL.txt
