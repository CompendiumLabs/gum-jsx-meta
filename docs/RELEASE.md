# Release Readiness

# GitHub Releases

Standalone GitHub release commands (run from the workspace root):

Plugin release commands (top-level):

```sh
gh release create v2.0.0 dist/gum-jsx-plugin.zip \
  --title "Gum Plugin v2.0.0" \
  --notes "Gum plugin for v2.0.0"
```

Skill release commands (gum-jsx-docs):

```sh
gh release create v2.0.0 dist/gum-jsx-skill.zip \
  --title "Gum Skill v2.0.0" \
  --notes "Gum skill for v2.0.0"
```

Gum standalone release commands (run from the `gum-jsx` package directory):

```sh
bun run standalone:pack
gh release create v2.0.0 dist/releases/v2.0.0/* \
  --title "Gum v2.0.0" \
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
8. `@gum-jsx/react`
9. `@gum-jsx/docs`
10. `@gum-jsx/cli` (implementation library)
11. `gum-jsx` (commands and executable distribution)

Publish the source dependencies, including `@gum-jsx/mp4`, before
`@gum-jsx/cli`. The `gum-jsx` distribution bundles its implementation and has no
runtime npm dependencies. MP4 keeps its own `0.1.0` version; the rehearsal checks
each dependency against its package manifest.

Testing commands:

```sh
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run visual-report
bun run rehearse
```

Rehearsal requires Bun, Node/npm, curl, tar, `setsid`, Chromium, and network access
for Verdaccio and external dependencies. Set `GUM_CHROME` if Chromium is not on
PATH. `KEEP=1 PORT=4874 bun run rehearse` retains artifacts and selects a local
port. All package publishes target the temporary loopback registry; personal npm
configuration and global installations are unchanged.
