# Release Recommendation — Rust CLI Binaries

**Date:** 2026-07-26  
**Branch:** `research/rust-rewrite`  
**Target:** `gh-ai-workflows` Rust CLI rewrite

## Recommendation: `cargo-dist` (axodotdev)

`cargo-dist` (v0.32.0) is the de facto standard for Rust binary releases. It generates its own CI, handles plan→build→host→publish→announce, creates tarballs/zip archives with sha256 checksums, and supports shell/powershell installers. It's used by bindgen, biome, cargo-audit, and hundreds of other Rust projects.

Run `cargo dist init` once — it produces `.github/workflows/release.yml` and a `[workspace.metadata.dist]` section in `Cargo.toml`.

## Target Platforms

| Target triple | Runner | Cross needed? |
|---|---|---|
| `x86_64-unknown-linux-gnu` | `ubuntu-latest` | No |
| `aarch64-unknown-linux-gnu` | `ubuntu-latest` | Yes (`cross`) |
| `x86_64-apple-darwin` | `macos-latest` | No |
| `aarch64-apple-darwin` | `macos-latest` | No (native ARM runner) |
| `x86_64-pc-windows-msvc` | `windows-latest` | No |

For linux/arm64 on x86 runners, use `cross` (Docker-based cross-compiler). For native ARM speed, use `ubuntu-24.04-arm` runners (GitHub hosted, GA since 2025).

## Cross-Compilation: `cross` vs alternatives

- **`cross`** (cross-rs): Docker-based, zero setup. Best for linux/arm64 from x86. Slower (Downloads toolchain containers). Use when native ARM runner isn't feasible.
- **`cargo-zigbuild`**: Faster than `cross` for musl targets. Uses Zig as linker. Good if you need fully static musl binaries.
- **Native matrix**: macOS ARM/Intel builds run natively on macOS runners. Windows builds natively on Windows runners. No cross tool needed.

**Recommendation:** Use `cross` only for linux/arm64 via Docker. Everything else builds natively on native runners.

## Biome's Release Pipeline (Reference Implementation)

Biome's `release_cli.yml` (290 lines) at `.github/workflows/release_cli.yml`:

- **Check job:** Detects version changes in `package.json`, sets prerelease flags.
- **Build matrix:** linux-x64-musl, linux-arm64-musl, darwin-x64, darwin-arm64, windows-x64. Each runs on the appropriate native runner (depot for ARM, macOS for darwin, Windows for Windows).
- **Stripping:** `RUSTFLAGS="-C strip=symbols -C codegen-units=1"`
- **Provenance:** `actions/attest-build-provenance@v4` — Sigstore keyless signing per binary.
- **Artifact naming:** `biome-{code-target}` (e.g. `biome-linux-x64-musl`).
- **Publish:** Downloads all artifacts → creates GitHub Release via `softprops/action-gh-release@v3` → attaches binaries. Tag pattern: `cli/v{version}`.

## Binary Signing and Provenance

Two-layer approach:

1. **SHA256 checksums** (built into `cargo-dist`): Every archive gets a `.sha256` file and a unified `sha256.sum`. Verifiable with `sha256sum -c`.

2. **Sigstore keyless attestations** (via `actions/attest-build-provenance`): GitHub's built-in action. Uses OIDC to get short-lived signing certs. No key management. Produces SLSA-compliant provenance. Verifiable with `gh attestation verify`.

**Recommendation:** Use both. `cargo-dist` for checksums + `actions/attest-build-provenance` for provenance.

## Versioning Strategy

- **Source of truth:** `Cargo.toml` `version` field.
- **Tag pattern:** `v{version}` (e.g. `v1.2.3`).
- **Embed version in binary:** `env!('CARGO_PKG_VERSION')` at compile time, or pass via `RUSTFLAGS` / `build.rs` for custom formats.
- **Trigger:** Push of a semver tag (`v*`).

## Recommended Workflow YAML

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write
  id-token: write
  attestations: write

env:
  CARGO_TERM_COLOR: always

jobs:
  build:
    name: Build (${{ matrix.target }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            ext: ""
          - os: ubuntu-latest
            target: aarch64-unknown-linux-gnu
            ext: ""
            cross: true
          - os: macos-latest
            target: x86_64-apple-darwin
            ext: ""
          - os: macos-latest
            target: aarch64-apple-darwin
            ext: ""
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            ext: ".exe"
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install cross
        if: matrix.cross
        uses: taiki-e/install-action@cross

      - name: Build (native)
        if: ${{ !matrix.cross }}
        run: cargo build --release --target ${{ matrix.target }}

      - name: Build (cross)
        if: matrix.cross
        run: cross build --release --target ${{ matrix.target }}

      - name: Package
        shell: bash
        run: |
          BINARY_NAME="my-cli"
          mkdir -p dist
          cp "target/${{ matrix.target }}/release/${BINARY_NAME}${{ matrix.ext }}" "dist/${BINARY_NAME}-${{ matrix.target }}${{ matrix.ext }}"
          cd dist
          if [ "${{ matrix.ext }}" = ".exe" ]; then
            7z a "${BINARY_NAME}-${{ matrix.target }}.zip" "${BINARY_NAME}-${{ matrix.target }}${{ matrix.ext }}"
          else
            tar czf "${BINARY_NAME}-${{ matrix.target }}.tar.gz" "${BINARY_NAME}-${{ matrix.target }}${{ matrix.ext }}"
          fi
          sha256sum "${BINARY_NAME}-${{ matrix.target }}.tar.gz" > "${BINARY_NAME}-${{ matrix.target }}.tar.gz.sha256" 2>/dev/null || true

      - name: Attest build provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: dist/*

      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.target }}
          path: dist/
          if-no-files-found: error

  release:
    name: Create Release
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - uses: softprops/action-gh-release@v2
        with:
          files: artifacts/**/*
          generate_release_notes: true
```

## Cargo.toml addition

```toml
[profile.dist]
inherits = "release"
lto = "thin"
codegen-units = 1

[workspace.metadata.dist]
cargo-dist-version = "0.32.0"
ci = ["github"]
installers = ["shell", "powershell"]
targets = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
]
```

## Key Decisions

- **cargo-dist over hand-written workflow:** cargo-dist generates the workflow, handles edge cases (installers, manifests, changelogs), and self-updates. Hand-written workflows are fragile.
- **cross only for linux/arm64:** All other targets build natively. macOS has native ARM runners. Windows builds natively.
- **Sigstore over Cosign CLI:** `actions/attest-build-provenance` requires no key management, no extra dependency, and produces SLSA-compliant attestations GitHub can verify.
- **No Homebrew/NPM/PyPI publishing initially:** Cargo-dist can add these later. Start with GitHub Releases + installers.
