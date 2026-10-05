# Release Readiness

## Queued npm beta: 2.1.0-beta.0

All 12 public npm packages use `2.1.0-beta.0`, with exact internal dependency
pins and `publishConfig.tag` set to `beta`. The workspace and editor stay private.
No package has been published as part of preparing these manifests.

After validation, publish each package from its own directory in this order:

1. `@gum-jsx/core`
2. `@gum-jsx/math`, `@gum-jsx/maps`, `@gum-jsx/png`, `@gum-jsx/pdf`, `@gum-jsx/pptx`
3. `@gum-jsx/mp4`, `@gum-jsx/mark`, `@gum-jsx/react`, `@gum-jsx/docs`
4. `@gum-jsx/cli`
5. `gum-jsx`

```sh
npm publish --tag beta --access public
```

After publication, install `gum-jsx@beta`, or pin the exact candidate:

```sh
npm install -g gum-jsx@2.1.0-beta.0
gum --version
```

The expected version is `2.1.0-beta.0`. Publishing with the `beta` tag keeps the
stable `latest` channel unchanged. Plugin manifests have their own release version.

# GitHub Releases

Standalone GitHub release commands (run from the workspace root):

Plugin release commands (top-level, versioned separately):

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
gh release create v2.1.0-beta.0 dist/releases/v2.1.0-beta.0/* \
  --title "Gum v2.1.0-beta.0" \
  --prerelease --latest=false \
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
