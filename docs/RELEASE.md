# Release Readiness

## Queued npm release: 2.1.0

All 12 public npm packages use `2.1.0`, with exact internal dependency
pins and `publishConfig.tag` set to `latest`. The workspace and editor stay private.
No package has been published to the public npm registry as part of this preparation.

After validation, publish each package from its own directory in this order:

1. `@gum-jsx/core`
2. `@gum-jsx/math`, `@gum-jsx/maps`, `@gum-jsx/png`, `@gum-jsx/pdf`, `@gum-jsx/pptx`
3. `@gum-jsx/mp4`, `@gum-jsx/mark`, `@gum-jsx/react`, `@gum-jsx/docs`
4. `@gum-jsx/cli`
5. `gum-jsx`

```sh
npm publish --tag latest --access public
```

After publication, install `gum-jsx@latest`, or pin the exact release:

```sh
npm install -g gum-jsx@2.1.0
gum --version
```

The expected version is `2.1.0`. Publishing with the `latest` tag updates the
stable channel. Plugin manifests have their own release version.

## Changes to call out for 2.1.0

- Replace `<Svg>` with `<Page>` in JSX and `Svg` with `Page` in library code.
  `Document` holds ordered pages with shared defaults; PDF and PPTX export all
  pages, while SVG and PNG need `--page` when more than one page is present.
- Select text and math families with the inherited `font-family` and `math-font`
  props. The CLI loads custom faces with `--font`; the former `--default-font`
  and `--math-font` flags have been removed.
- Theme palettes use `neutral` instead of `grid` and `accent` instead of `area`.
- `Slide` extends `Page`; components adopting either through `define_component`
  retain viewport behavior and work directly inside `Document`.
- React rendering propagates uncaught component errors, schedules hook updates,
  and applies changing `<Gum>` output options without remounting children.
- KaTeX is pinned to `0.18.2`, addressing
  [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).
  The editor build resolves `source-map-js` to `1.2.2`, addressing
  [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

# GitHub Releases

Build the plugin and standalone skill from the workspace root:

```sh
bun run plugin:pack
bun run skill:pack
```

Both artifacts belong to the `gum-jsx` repository: the plugin ZIP is
`gum-jsx/dist/gum-jsx-plugin.zip`, and the skill ZIP is
`gum-jsx/skills/gum-jsx-skill.zip`. Commit regenerated plugin and standalone skills in `gum-jsx`
so marketplace installs receive the same documentation as the release archive.

Gum standalone release commands (run from the `gum-jsx` package directory):

```sh
bun run standalone:pack
gh release create v2.1.0 dist/releases/v2.1.0/* \
  dist/gum-jsx-plugin.zip skills/gum-jsx-skill.zip \
  --title "Gum v2.1.0" \
  --latest \
  --notes "Standalone gum executables for macOS ARM64, macOS x64, Linux x64, and Windows x64."
```

# Current Packages

Current submodule packages:

1. `@gum-jsx/core`
2. `@gum-jsx/math`
3. `@gum-jsx/maps`
4. `@gum-jsx/png`
5. `@gum-jsx/pdf`
6. `@gum-jsx/mp4`
7. `@gum-jsx/pptx`
8. `@gum-jsx/mark`
9. `@gum-jsx/react`
10. `@gum-jsx/docs`
11. `@gum-jsx/cli` (implementation library)
12. `gum-jsx` (commands and executable distribution)

Publish the source dependencies, including `@gum-jsx/mp4`, before
`@gum-jsx/cli`. The `gum-jsx` distribution bundles its implementation and has no
runtime npm dependencies. The rehearsal checks each dependency against its package
manifest.

Testing commands:

```sh
bun install --frozen-lockfile
bun run build
bun run test
bun run typecheck
bun run visual-report
bun run rehearse
```

Rehearsal requires Bun, Node/npm, curl, tar, `setsid`, Chromium, and network access
for Verdaccio and external dependencies. Set `GUM_CHROME` if Chromium is not on
PATH. `KEEP=1 PORT=4874 bun run rehearse` retains artifacts and selects a local
port. All package publishes target the temporary loopback registry; personal npm
configuration and global installations are unchanged.

## Beta.1 validation: 2026-10-09

Validated on Linux with Bun `1.4.2`, Node `26.9.0`, and the official Node `24.0.0`
binary for minimum-runtime CLI checks:

- Frozen workspace installation, all 13 package type checks, workspace builds,
  and the production editor build passed.
- All 1,025 checks passed across 13 packages, with no skips or todos. The core
  and math suites also passed with `GUM_FREEZE=0`; MP4's three Rust tests passed.
- All 195 visual previews passed, including each Document page. Their SVG output
  was unchanged by the KaTeX upgrade; font assets and metric data were identical.
- The beta.1 local-registry rehearsal passed: fresh npm/Bun and isolated global
  installs, strict consumer types, browser bundles, and Chromium rendering.
- Installed CLI tests passed on Node `24.0.0`, including rendering parity with
  Bun and the Linux release executable. `bun audit --json` returned `{}`.
- All four standalone archives, checksums, plugin ZIP, and standalone skill ZIP
  were rebuilt. The Linux executable reports `2.1.0-beta.1` and renders correctly.

Native macOS and Windows testing of `2.1.0-beta.1` also passed, confirmed by Doug
on 2026-10-09.

## Stable release validation: 2026-10-09

- All 12 public package versions and internal dependency pins are `2.1.0`, with
  the `latest` publish tag. Frozen workspace installation passed.
- Workspace builds, all 1,026 checks across 13 packages, and all 13 package type
  checks passed after promotion.
- Plugin and standalone skill archives were regenerated from the current docs.
  All four standalone release archives were rebuilt and their checksums verified.
- The npm CLI and Linux standalone executable report `2.1.0` and produce
  identical SVG output for a Document containing a `define_component` slide.
- PPTX fragment clipping is deferred to the next release in `TODO.md`.

The editor still emits Vite's advisory about chunks larger than 500 kB; its production
build succeeds. Commit and push the package changes before recording the updated
workspace submodule pointers, then publish in the order above.
