# Third-party notices

DataShield itself is licensed under the terms in `LICENSE`. This file lists
the third-party packages it depends on at runtime and their licenses, so a
redistribution under Section 3.d of that license carries the attribution
those packages require.

Generated from `package-lock.json`; do not edit by hand. Regenerate with
`npm run licenses:write`. Build-time-only dependencies are excluded: they
are not part of anything that ships.

Runtime packages: 549.

## Obligations worth knowing

**LGPL-3.0-or-later.** Used as a pre-built shared library (libvips, pulled in by sharp) that is loaded at runtime and never modified. The license reaches the library, not the application linking against it. Redistributing DataShield as software means passing along this notice and the library's own license text; running it as a hosted service triggers nothing.

**MPL-2.0.** File-level copyleft. Only changes made to the MPL-covered files themselves must be published under the MPL. Depending on these packages places no condition on DataShield's own source.

**EPL-2.0.** Weak copyleft at the module level, same shape as the MPL: modifications to the EPL-covered files are covered, surrounding code is not.

**CC-BY-4.0.** Attribution required when the covered material is redistributed. This file is that attribution.

## Packages by license

### MIT (399)

- @authenio/xml-encryption@2.0.2
- @babel/runtime@7.29.7
- @base-ui/react@1.7.0
- @base-ui/utils@0.3.2
- @better-auth/core@1.6.29
- @better-auth/drizzle-adapter@1.6.29
- @better-auth/kysely-adapter@1.6.29
- @better-auth/memory-adapter@1.6.29
- @better-auth/mongo-adapter@1.6.29
- @better-auth/passkey@1.6.29
- @better-auth/prisma-adapter@1.6.29
- @better-auth/sso@1.6.29
- @better-auth/telemetry@1.6.29
- @better-auth/utils@0.4.2
- @better-auth/utils@0.5.0
- @better-fetch/fetch@1.3.1
- @dnd-kit/accessibility@3.1.1
- @dnd-kit/core@6.3.1
- @dnd-kit/sortable@10.0.0
- @dnd-kit/utilities@3.2.2
- @emnapi/core@1.10.0
- @emnapi/core@1.11.1
- @emnapi/runtime@1.10.0
- @emnapi/runtime@1.11.1
- @emnapi/runtime@1.11.3
- @emnapi/wasi-threads@1.2.1
- @emnapi/wasi-threads@1.2.2
- @esbuild/aix-ppc64@0.28.1
- @esbuild/android-arm64@0.28.1
- @esbuild/android-arm@0.28.1
- @esbuild/android-x64@0.28.1
- @esbuild/darwin-arm64@0.28.1
- @esbuild/darwin-x64@0.28.1
- @esbuild/freebsd-arm64@0.28.1
- @esbuild/freebsd-x64@0.28.1
- @esbuild/linux-arm64@0.28.1
- @esbuild/linux-arm@0.28.1
- @esbuild/linux-ia32@0.28.1
- @esbuild/linux-loong64@0.28.1
- @esbuild/linux-mips64el@0.28.1
- @esbuild/linux-ppc64@0.28.1
- @esbuild/linux-riscv64@0.28.1
- @esbuild/linux-s390x@0.28.1
- @esbuild/linux-x64@0.28.1
- @esbuild/netbsd-arm64@0.28.1
- @esbuild/netbsd-x64@0.28.1
- @esbuild/openbsd-arm64@0.28.1
- @esbuild/openbsd-x64@0.28.1
- @esbuild/openharmony-arm64@0.28.1
- @esbuild/sunos-x64@0.28.1
- @esbuild/win32-arm64@0.28.1
- @esbuild/win32-ia32@0.28.1
- @esbuild/win32-x64@0.28.1
- @floating-ui/core@1.8.0
- @floating-ui/dom@1.8.0
- @floating-ui/react-dom@2.1.9
- @floating-ui/utils@0.2.12
- @hexagon/base64@1.1.28
- @img/colour@1.1.0
- @jridgewell/sourcemap-codec@1.5.5
- @levischuck/tiny-cbor@0.2.11
- @napi-rs/wasm-runtime@1.1.6
- @next/env@16.3.0
- @next/swc-darwin-arm64@16.3.0
- @next/swc-darwin-x64@16.3.0
- @next/swc-linux-arm64-gnu@16.3.0
- @next/swc-linux-arm64-musl@16.3.0
- @next/swc-linux-x64-gnu@16.3.0
- @next/swc-linux-x64-musl@16.3.0
- @next/swc-win32-arm64-msvc@16.3.0
- @next/swc-win32-x64-msvc@16.3.0
- @noble/ciphers@1.3.0
- @noble/ciphers@2.2.0
- @noble/hashes@1.8.0
- @noble/hashes@2.2.0
- @noble/hashes@2.3.0
- @nodable/entities@3.0.0
- @oxc-project/types@0.138.0
- @peculiar/asn1-android@2.8.0
- @peculiar/asn1-cms@2.8.0
- @peculiar/asn1-csr@2.8.0
- @peculiar/asn1-ecc@2.8.0
- @peculiar/asn1-pfx@2.8.0
- @peculiar/asn1-pkcs8@2.8.0
- @peculiar/asn1-pkcs9@2.8.0
- @peculiar/asn1-rsa@2.8.0
- @peculiar/asn1-schema@2.8.0
- @peculiar/asn1-x509-attr@2.8.0
- @peculiar/asn1-x509@2.8.0
- @peculiar/utils@2.0.3
- @peculiar/x509@1.14.3
- @radix-ui/primitive@1.1.3
- @radix-ui/react-compose-refs@1.1.2
- @radix-ui/react-primitive@2.1.3
- @radix-ui/react-slot@1.2.3
- @radix-ui/react-toggle@1.1.10
- @radix-ui/react-use-controllable-state@1.2.2
- @radix-ui/react-use-effect-event@0.0.2
- @radix-ui/react-use-layout-effect@1.1.1
- @react-pdf/fns@3.1.3
- @react-pdf/font@4.0.8
- @react-pdf/image@3.1.0
- @react-pdf/layout@4.6.1
- @react-pdf/pdfkit@5.1.1
- @react-pdf/primitives@4.3.0
- @react-pdf/reconciler@2.0.0
- @react-pdf/render@4.5.1
- @react-pdf/renderer@4.5.1
- @react-pdf/stylesheet@6.2.1
- @react-pdf/svg@1.1.0
- @react-pdf/textkit@6.3.0
- @react-pdf/types@2.11.1
- @reduxjs/toolkit@2.12.0
- @rolldown/binding-android-arm64@1.1.4
- @rolldown/binding-darwin-arm64@1.1.4
- @rolldown/binding-darwin-x64@1.1.4
- @rolldown/binding-freebsd-x64@1.1.4
- @rolldown/binding-linux-arm-gnueabihf@1.1.4
- @rolldown/binding-linux-arm64-gnu@1.1.4
- @rolldown/binding-linux-arm64-musl@1.1.4
- @rolldown/binding-linux-ppc64-gnu@1.1.4
- @rolldown/binding-linux-s390x-gnu@1.1.4
- @rolldown/binding-linux-x64-gnu@1.1.4
- @rolldown/binding-linux-x64-musl@1.1.4
- @rolldown/binding-openharmony-arm64@1.1.4
- @rolldown/binding-wasm32-wasi@1.1.4
- @rolldown/binding-win32-arm64-msvc@1.1.4
- @rolldown/binding-win32-x64-msvc@1.1.4
- @rolldown/pluginutils@1.0.1
- @simplewebauthn/browser@13.3.0
- @simplewebauthn/server@13.3.2
- @standard-schema/spec@1.1.0
- @standard-schema/utils@0.3.0
- @tanstack/react-table@8.21.3
- @tanstack/table-core@8.21.3
- @tybys/wasm-util@0.10.3
- @types/chai@5.2.3
- @types/d3-array@3.0.3
- @types/d3-array@3.2.2
- @types/d3-color@3.1.0
- @types/d3-color@3.1.3
- @types/d3-delaunay@6.0.1
- @types/d3-ease@3.0.2
- @types/d3-format@3.0.1
- @types/d3-geo@3.1.0
- @types/d3-interpolate@3.0.1
- @types/d3-interpolate@3.0.4
- @types/d3-path@3.1.1
- @types/d3-scale@4.0.2
- @types/d3-scale@4.0.9
- @types/d3-shape@3.1.7
- @types/d3-shape@3.1.8
- @types/d3-time-format@2.1.0
- @types/d3-time@3.0.0
- @types/d3-time@3.0.4
- @types/d3-timer@3.0.2
- @types/deep-eql@4.0.2
- @types/estree@1.0.9
- @types/geojson@7946.0.16
- @types/lodash@4.17.24
- @types/node@26.2.0
- @types/pg@8.21.0
- @types/react-dom@19.2.4
- @types/react@19.2.18
- @types/use-sync-external-store@0.0.6
- @visx/curve@4.0.1-alpha.0
- @visx/event@4.0.1-alpha.0
- @visx/grid@4.0.1-alpha.0
- @visx/group@4.0.1-alpha.0
- @visx/point@4.0.1-alpha.0
- @visx/responsive@4.0.1-alpha.0
- @visx/scale@4.0.1-alpha.0
- @visx/shape@4.0.1-alpha.0
- @vitest/expect@4.1.10
- @vitest/mocker@4.1.10
- @vitest/pretty-format@4.1.10
- @vitest/runner@4.1.10
- @vitest/snapshot@4.1.10
- @vitest/spy@4.1.10
- @vitest/utils@4.1.10
- @xmldom/is-dom-node@1.0.1
- @xmldom/xmldom@0.8.14
- abs-svg-path@0.1.1
- ajv@8.20.0
- ansi-regex@5.0.1
- ansi-styles@4.3.0
- anynum@1.0.1
- asn1@0.2.6
- assertion-error@2.0.1
- aws-ssl-profiles@1.1.2
- base64-js@0.0.8
- base64-js@1.5.1
- better-auth@1.6.29
- better-call@1.4.0
- better-result@2.10.0
- bidi-js@1.0.3
- bowser@2.14.1
- brotli@1.3.3
- browserify-zlib@0.2.0
- c12@3.3.4
- camelcase@5.3.1
- chai@6.2.2
- chokidar@5.0.0
- classnames@2.5.1
- client-only@0.0.1
- clone@2.1.2
- clsx@2.1.1
- color-convert@2.0.1
- color-name@1.1.4
- color-name@2.1.0
- color-string@2.1.4
- confbox@0.2.4
- convert-source-map@2.0.0
- cross-spawn@7.0.6
- csstype@3.2.3
- decamelize@1.2.0
- decimal.js-light@2.5.1
- defu@6.1.7
- destr@2.0.5
- dfa@1.2.0
- dijkstrajs@1.0.3
- effect@3.20.0
- emoji-regex-xs@1.0.0
- emoji-regex@8.0.0
- empathic@2.0.0
- env-paths@3.0.0
- es-module-lexer@2.1.0
- es-toolkit@1.47.0
- esbuild@0.28.1
- escape-html@1.0.3
- estree-walker@3.0.3
- eventemitter3@5.0.4
- events@3.3.0
- exsolve@1.1.1
- fast-check@3.23.2
- fast-decode-uri-component@1.0.1
- fast-deep-equal@3.1.3
- fast-equals@4.0.3
- fast-querystring@1.1.2
- fast-xml-builder@1.3.1
- fast-xml-parser@5.10.1
- fdir@6.5.0
- fflate@0.8.3
- find-my-way@9.7.0
- find-up@4.1.0
- fontkit@2.0.4
- fsevents@2.3.2
- fsevents@2.3.3
- generate-function@2.3.1
- get-port-please@3.2.0
- giget@3.3.1
- grammex@3.1.13
- graphmatch@1.1.1
- hsl-to-hex@1.0.0
- iconv-lite@0.7.2
- immer@11.1.11
- is-fullwidth-code-point@3.0.0
- is-property@1.0.2
- is-unsafe@2.0.0
- is-url@1.2.4
- jay-peg@1.1.1
- jiti@1.21.7
- jiti@2.7.0
- jose@6.2.4
- js-md5@0.8.3
- js-tokens@4.0.0
- json-schema-traverse@1.0.0
- kysely@0.29.5
- ldapts@9.0.0
- linebreak@1.1.0
- locate-path@5.0.0
- lodash@4.18.1
- loose-envify@1.4.0
- lru.min@1.1.4
- magic-string@0.30.21
- media-engine@1.0.3
- mysql2@3.15.3
- named-placeholders@1.1.6
- nanoid@3.3.18
- nanostores@1.4.2
- next@16.3.0
- node-rsa@1.1.1
- normalize-svg-path@1.1.0
- object-assign@4.1.1
- obug@2.1.3
- ohash@2.0.11
- p-limit@2.3.0
- p-locate@4.1.0
- p-try@2.2.0
- pako@0.2.9
- parse-svg-path@0.1.2
- path-exists@4.0.0
- path-expression-matcher@1.6.2
- path-key@3.1.1
- pathe@2.0.3
- perfect-debounce@2.1.0
- pg-cloudflare@1.4.0
- pg-connection-string@2.14.0
- pg-pool@3.14.0
- pg-protocol@1.15.0
- pg-types@2.2.0
- pg@8.22.0
- pgpass@1.0.5
- picomatch@4.0.4
- picomatch@4.0.5
- pkg-types@2.3.1
- png-js@2.0.0
- pngjs@5.0.0
- postcss-value-parser@4.2.0
- postcss@8.5.23
- postgres-array@2.0.0
- postgres-array@3.0.4
- postgres-bytea@1.0.1
- postgres-date@1.0.7
- postgres-interval@1.2.0
- prop-types@15.8.1
- proper-lockfile@4.1.2
- pure-rand@6.1.0
- pvtsutils@1.3.6
- pvutils@1.1.5
- qrcode@1.5.4
- queue@6.0.2
- rc9@3.0.1
- react-dom@19.2.8
- react-draggable@4.6.0
- react-grid-layout@2.2.4
- react-is@16.13.1
- react-is@19.2.6
- react-redux@9.3.0
- react-resizable@3.2.0
- react@19.2.8
- readdirp@5.0.0
- recharts@3.10.1
- redux-thunk@3.1.0
- redux@5.0.1
- remeda@2.33.4
- require-directory@2.1.1
- require-from-string@2.0.2
- reselect@5.2.0
- resize-observer-polyfill@1.5.1
- restructure@3.0.2
- ret@0.5.0
- retry@0.12.0
- rolldown@1.1.4
- rou3@0.9.2
- safe-buffer@5.2.1
- safe-regex2@5.1.1
- safer-buffer@2.1.2
- samlify@2.13.1
- scheduler@0.25.0-rc-603e6108-20241029
- scheduler@0.27.0
- seq-queue@0.0.5
- set-cookie-parser@3.1.2
- shebang-command@2.0.0
- shebang-regex@3.0.0
- sqlstring@2.3.3
- stackback@0.0.2
- std-env@3.10.0
- std-env@4.1.0
- string-width@4.2.3
- string_decoder@1.3.0
- strip-ansi@6.0.1
- strnum@2.4.2
- styled-jsx@5.1.6
- tailwind-merge@3.6.0
- tiny-inflate@1.0.3
- tiny-invariant@1.3.3
- tinybench@2.9.0
- tinyexec@1.2.4
- tinyglobby@0.2.17
- tinyrainbow@3.1.0
- tldts-core@6.1.86
- tldts@6.1.86
- tsx@4.23.12
- tsyringe@4.10.0
- tw-animate-css@1.4.0
- undici-types@8.3.0
- unicode-properties@1.4.1
- unicode-trie@2.0.0
- use-sync-external-store@1.6.0
- util-deprecate@1.0.2
- valibot@1.4.2
- vite-compatible-readable-stream@3.6.1
- vite@8.1.3
- vitest@4.1.10
- why-is-node-running@2.3.0
- wrap-ansi@6.2.0
- xml-crypto@6.1.2
- xml-escape@1.1.0
- xml-naming@0.3.0
- xml@1.0.1
- xpath@0.0.32
- xpath@0.0.33
- xpath@0.0.34
- xtend@4.0.2
- yargs@15.4.1
- yoga-layout@3.2.1
- zeptomatch@2.1.0
- zod@4.4.3

### Apache-2.0 (67)

- @aws-sdk/client-identitystore@3.1107.0
- @aws-sdk/core@3.977.6
- @aws-sdk/credential-provider-env@3.972.67
- @aws-sdk/credential-provider-http@3.972.69
- @aws-sdk/credential-provider-ini@3.973.12
- @aws-sdk/credential-provider-login@3.972.74
- @aws-sdk/credential-provider-node@3.972.78
- @aws-sdk/credential-provider-process@3.972.67
- @aws-sdk/credential-provider-sso@3.973.11
- @aws-sdk/credential-provider-web-identity@3.972.73
- @aws-sdk/nested-clients@3.997.41
- @aws-sdk/signature-v4-multi-region@3.996.43
- @aws-sdk/token-providers@3.1103.0
- @aws-sdk/types@3.974.2
- @aws-sdk/xml-builder@3.972.37
- @aws/lambda-invoke-store@0.3.0
- @electric-sql/pglite-socket@0.1.3
- @electric-sql/pglite-tools@0.3.3
- @electric-sql/pglite@0.4.3
- @img/sharp-darwin-arm64@0.35.3
- @img/sharp-darwin-x64@0.35.3
- @img/sharp-freebsd-wasm32@0.35.3
- @img/sharp-linux-arm64@0.35.3
- @img/sharp-linux-arm@0.35.3
- @img/sharp-linux-ppc64@0.35.3
- @img/sharp-linux-riscv64@0.35.3
- @img/sharp-linux-s390x@0.35.3
- @img/sharp-linux-x64@0.35.3
- @img/sharp-linuxmusl-arm64@0.35.3
- @img/sharp-linuxmusl-x64@0.35.3
- @img/sharp-webcontainers-wasm32@0.35.3
- @opentelemetry/semantic-conventions@1.43.0
- @playwright/test@1.62.1
- @prisma/adapter-pg@7.9.1
- @prisma/client-runtime-utils@7.9.1
- @prisma/client@7.9.1
- @prisma/config@7.9.1
- @prisma/debug@7.2.0
- @prisma/debug@7.9.1
- @prisma/driver-adapter-utils@7.9.1
- @prisma/engines-version@7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad
- @prisma/engines@7.9.1
- @prisma/fetch-engine@7.9.1
- @prisma/get-platform@7.2.0
- @prisma/get-platform@7.9.1
- @prisma/query-plan-executor@7.2.0
- @prisma/streams-local@0.1.11
- @prisma/studio-core@0.33.0
- @smithy/core@3.31.1
- @smithy/credential-provider-imds@4.4.16
- @smithy/fetch-http-handler@5.6.13
- @smithy/node-http-handler@4.9.13
- @smithy/signature-v4@5.6.12
- @smithy/types@4.16.1
- @swc/helpers@0.5.15
- baseline-browser-mapping@2.10.44
- class-variance-authority@0.7.1
- denque@2.1.0
- detect-libc@2.1.2
- expect-type@1.3.0
- long@5.3.2
- playwright-core@1.62.1
- playwright@1.62.1
- prisma@7.9.1
- reflect-metadata@0.2.2
- sharp@0.35.3
- typescript@5.9.3

### ISC (41)

- @prisma/dev@0.24.17
- cliui@6.0.0
- d3-array@3.2.1
- d3-array@3.2.4
- d3-color@3.1.0
- d3-delaunay@6.0.2
- d3-format@3.1.0
- d3-format@3.1.2
- d3-geo@3.1.0
- d3-interpolate@3.0.1
- d3-path@3.1.0
- d3-scale@4.0.2
- d3-shape@3.2.0
- d3-time-format@4.1.0
- d3-time@3.1.0
- d3-timer@3.0.1
- delaunator@5.1.0
- foreground-child@3.3.1
- get-caller-file@2.0.5
- graceful-fs@4.2.11
- hsl-to-rgb-for-reals@1.1.1
- hyphen@1.14.1
- inherits@2.0.4
- internmap@2.0.3
- isexe@2.0.0
- lucide-react@1.31.0
- pg-int8@1.0.1
- picocolors@1.1.1
- require-main-filename@2.0.0
- semver@7.8.5
- set-blocking@2.0.0
- siginfo@2.0.0
- signal-exit@3.0.7
- signal-exit@4.1.0
- split2@4.2.0
- strict-event-emitter-types@2.0.0
- svg-arc-to-cubic-bezier@3.2.0
- which-module@2.0.1
- which@2.0.2
- y18n@4.0.3
- yargs-parser@18.1.3

### MPL-2.0 (12)

- lightningcss-android-arm64@1.32.0
- lightningcss-darwin-arm64@1.32.0
- lightningcss-darwin-x64@1.32.0
- lightningcss-freebsd-x64@1.32.0
- lightningcss-linux-arm-gnueabihf@1.32.0
- lightningcss-linux-arm64-gnu@1.32.0
- lightningcss-linux-arm64-musl@1.32.0
- lightningcss-linux-x64-gnu@1.32.0
- lightningcss-linux-x64-musl@1.32.0
- lightningcss-win32-arm64-msvc@1.32.0
- lightningcss-win32-x64-msvc@1.32.0
- lightningcss@1.32.0

### LGPL-3.0-or-later (10)

- @img/sharp-libvips-darwin-arm64@1.3.2
- @img/sharp-libvips-darwin-x64@1.3.2
- @img/sharp-libvips-linux-arm64@1.3.2
- @img/sharp-libvips-linux-arm@1.3.2
- @img/sharp-libvips-linux-ppc64@1.3.2
- @img/sharp-libvips-linux-riscv64@1.3.2
- @img/sharp-libvips-linux-s390x@1.3.2
- @img/sharp-libvips-linux-x64@1.3.2
- @img/sharp-libvips-linuxmusl-arm64@1.3.2
- @img/sharp-libvips-linuxmusl-x64@1.3.2

### BSD-3-Clause (6)

- asn1js@3.0.10
- bcryptjs@3.0.3
- d3-ease@3.0.1
- deepmerge-ts@7.1.5
- fast-uri@3.1.5
- source-map-js@1.2.1

### Apache-2.0 AND LGPL-3.0-or-later (3)

- @img/sharp-win32-arm64@0.35.3
- @img/sharp-win32-ia32@0.35.3
- @img/sharp-win32-x64@0.35.3

### MIT AND ISC (2)

- @visx/vendor@4.0.0-alpha.0
- victory-vendor@37.3.6

### Unlicense (2)

- postgres@3.4.7
- robust-predicates@3.0.3

### 0BSD (2)

- tslib@1.14.1
- tslib@2.8.1

### Apache-2.0 AND LGPL-3.0-or-later AND MIT (1)

- @img/sharp-wasm32@0.35.3

### CC-BY-4.0 (1)

- caniuse-lite@1.0.30001806

### BSD-2-Clause (1)

- dotenv@17.4.2

### EPL-2.0 (1)

- elkjs@0.11.1

### (MIT AND Zlib) (1)

- pako@1.0.11
