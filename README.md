# Gum development workspace

[Gum](https://github.com/CompendiumLabs/gum-jsx) — installation, quickstart, and user documentation.

This meta repository brings the Gum packages together as a Bun workspace and
Git submodules. Use it to develop the libraries, build executables, generate
documentation and agent skills, and run checks across packages.

## Packages

Each package is a separate repository, developed together through Git submodules.

| Package | Purpose |
| --- | --- |
| [@gum-jsx/core](gum-jsx-core/README.md) | JSX evaluation, layout, shapes, text, plots, networks, and SVG output. |
| [@gum-jsx/math](gum-jsx-math/README.md) | TeX parsing, math layout, and standalone formula exports. |
| [@gum-jsx/png](gum-jsx-png/README.md) | Fragment rasterization to PNG or RGBA through WebAssembly. |
| [@gum-jsx/mp4](gum-jsx-mp4/README.md) | Video frames, timing helpers, and the H.264/MP4 encoder. |
| [@gum-jsx/pdf](gum-jsx-pdf/README.md) | Vector PDF export from laid-out fragments. |
| [@gum-jsx/pptx](gum-jsx-pptx/README.md) | Native PowerPoint shapes and images from laid-out fragments. |
| [@gum-jsx/react](gum-jsx-react/README.md) | React bindings, headless rendering, and the `gum-react` command. |
| [@gum-jsx/mark](gum-jsx-mark/README.md) | Markdown terminal rendering with figures and math. |
| [gum-jsx](gum-jsx/README.md) | The `gum` command, npm bundle, and standalone executables. |
| [@gum-jsx/cli](gum-jsx-cli/README.md) | Command construction, evaluation, layout, and rendering APIs. |
| [@gum-jsx/edit](gum-jsx-edit/README.md) | Browser editor and interactive documentation viewer. |
| [@gum-jsx/docs](gum-jsx-docs/README.md) | Guides, element references, gallery sources, and skill generation. |

## Development

Clone the workspace and its package submodules:

```sh
git clone https://github.com/CompendiumLabs/gum-jsx-meta.git
cd gum-jsx-meta
git -c url."https://github.com/".insteadOf=git@github.com: submodule update --init --recursive
bun install
bun --filter @gum-jsx/png build
```

The submodule command uses HTTPS for the repository's SSH remotes, so a public
checkout does not require a GitHub SSH key.

Run shared commands from the workspace root:

```sh
bun run test                      # Every package's suite, sequentially
bun run typecheck                 # TypeScript checks across all packages
bun run build                     # Build PNG assets and the Gum/Markdown command bundles
bun run perf                      # Core, math, maps, and demos benchmarks, sequentially
bun --filter @gum-jsx/edit build  # Production browser editor and docs viewer
bun run visual-test               # Searchable HTML report of rendered examples
bun run rehearse                  # Publish to a temporary local registry and check fresh installs
bun run --cwd gum-jsx test        # Includes isolated npm CLI installation checks
```

To work on one package, use its scripts, for example
`bun --filter @gum-jsx/core test`. Package READMEs cover additional checks and
dependencies. The [design notes](docs/DESIGN.md) describe implementation
decisions; the [development backlog](docs/TODO.md) tracks planned work.
The [release checklist](docs/RELEASE.md) covers packaging and publication checks.

### Documentation and agent assets

Edit guides and runnable examples in `gum-jsx-docs`, and edit agent instructions
in `gum-jsx-docs/prompt`. Generate the distributable assets from the workspace root:

```sh
bun run plugin:build
bun run plugin:pack
bun run skill:build
bun run skill:pack
```

See the [documentation package](gum-jsx-docs/README.md) for content conventions
and the [plugin README](plugins/gum-jsx/README.md) for packaging and installation
tests. Run `bun --filter @gum-jsx/edit dev` to preview the editor locally.

### Performance

```sh
bun run perf                      # All suites, measured sequentially
bun run --cwd gum-jsx-core perf   # Core only
bun run --cwd gum-jsx-math perf   # Math only
bun run --cwd gum-jsx-maps perf   # Maps only
bun run --cwd gum-jsx-docs perf   # Full JSX demos, split by rendering stage
bun run perf --list               # List case names without preparing fixtures
bun run perf --smoke              # Exercise every case twice without timing
bun run perf --filter '^core/layout/'
bun run perf --json > /tmp/gum-perf.json
```

Each of these packages also exposes `bun run perf` from its own directory, with
the same options. The suites use Mitata for warmup, sampling, and latency
statistics. Inputs are deterministic and maps use bundled atlases. Construction,
fresh-pass layout, SVG serialization, full renders, and cache hits have separate
cases so their costs can be compared. Fonts are warmed except in explicitly named
fresh-provider cases.

See the [core](gum-jsx-core/test/perf/README.md),
[math](gum-jsx-math/test/perf/README.md),
[maps](gum-jsx-maps/test/perf/README.md), and
[demos](gum-jsx-docs/test/perf/README.md) workload notes for exact timing boundaries.
Run on an idle machine, save JSON reports before and after a change, and compare
the same case names on the same hardware and Bun version. JSON timings are in
nanoseconds. Record Git revisions with reports and repeat runs to check noise;
performance results are separate from correctness tests.

Compare freezing modes with the regular benchmark commands:

```sh
GUM_FREEZE=1 bun run perf --json > /tmp/gum-freeze.json
GUM_FREEZE=0 bun run perf --json > /tmp/gum-no-freeze.json
GUM_FREEZE=0 bun run --cwd gum-jsx-docs perf
```

Run modes sequentially and alternate their order across repeats.

For production rendering, `NODE_ENV=production` disables runtime freezing while
retaining input snapshots and validation. `GUM_FREEZE=1` or `0` overrides the
default before Gum loads. Browser builds use `__GUM_FREEZE__`; Studio and the
MCP viewer configure this automatically. See the
[immutability policy](gum-jsx-core/API.md#immutability-policy).
Run the workspace tests with `GUM_FREEZE=1 bun run test` and
`GUM_FREEZE=0 bun run test` to check both modes.

For a CPU profile of selected cases:

```sh
bun --cpu-prof --cpu-prof-dir=/tmp test/perf.ts --filter '^core/layout/'
```
