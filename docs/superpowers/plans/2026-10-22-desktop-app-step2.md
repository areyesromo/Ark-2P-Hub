# Desktop App, Step 2: GitHub Builds the AppImage and the Windows Installer

**Goal:** no local builds. GitHub Actions builds the Steam Deck AppImage and the Windows installer.
- Making a release attaches both files to a GitHub Release.
- Every pull request that touches the desktop app also builds both, so the Windows build is
  tested, since it can't be built in the Linux session.

## Design

New workflow: `.github/workflows/desktop.yml`, "Desktop app".

**Triggers**
- **Run workflow** (`workflow_dispatch`, from the Actions tab or by Claude) with a `version` input,
  for example `0.2.0`. This builds both files and publishes the release `v0.2.0`.
- **Pull requests** that change `desktop/**`, `package.json`, `package-lock.json` or this
  workflow: build both and upload them as workflow artifacts only. Nothing is published.

**Build job**, a matrix of `ubuntu-latest` (AppImage) and `windows-latest` (NSIS installer):
- checkout, Node 22, `npm ci`;
- on a release, set the version with `npm version <v> --no-git-tag-version`, so the files are
  named for it;
- `npm run dist:linux` or `npm run dist:win`, with `--publish never` so electron-builder never
  uploads anything itself, and `CSC_IDENTITY_AUTO_DISCOVERY=false` because we have no signing
  certificate yet;
- `node desktop/check-package.mjs <unpacked resources>` on both platforms;
- upload the AppImage or installer as an artifact.

**Release job** (Run workflow only):
- needs both builds;
- downloads the artifacts and runs `gh release create v<version>` against the commit that was
  built, with both files attached and short notes on how to install them.

**Safety**
- the version input is checked as `X.Y.Z` before it's used, and it's passed through `env`, not
  pasted into scripts;
- only the release job gets `contents: write`.

**Windows:** the installer isn't signed, so Windows SmartScreen will warn ("More info → Run
anyway"). The README says so; signing can come later.

## Tasks
- [ ] `desktop/check-package.mjs` takes the resources folder of either platform (it already takes
  a path); check it works on `dist/win-unpacked` paths too.
- [ ] Write the workflow. Validate the YAML locally. Run the Linux build with `--publish never`.
- [ ] README and desktop/README: download from Releases, how to make a release, the SmartScreen
  note.
- [ ] Review; PR. The PR's own run builds both platforms, so it is the real test of the Windows
  build. Merge on green.
- [ ] After merge, with the owner's go-ahead: run the workflow for the first release, v0.1.0.
