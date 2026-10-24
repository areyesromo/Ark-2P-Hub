// What's new: CHANGELOG.md at the top of the repo, in player-friendly words, one "## x.y.z"
// section per desktop release with a "- " line per change. The desktop app shows the notes since
// the version it last ran (the What's new card); the release workflow uses the same section as
// the GitHub release notes.

/** Version numbers compared part by part (0.1.10 is after 0.1.7). */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** [{ version, items }], in file order (newest first). */
export function parseChangelog(text) {
  const entries = [];
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const heading = line.match(/^##\s+v?(\d+\.\d+\.\d+)\s*$/);
    if (heading) {
      current = { version: heading[1], items: [] };
      entries.push(current);
    } else if (current && /^[-*]\s+/.test(line)) {
      current.items.push(line.replace(/^[-*]\s+/, '').trim());
    } else if (current && current.items.length && /^\s+\S/.test(line)) {
      current.items[current.items.length - 1] += ' ' + line.trim(); // a wrapped line
    } else if (/^#{1,2}\s/.test(line)) {
      current = null; // a heading that isn't a version ends the section
    }
  }
  return entries.filter((e) => e.items.length);
}

/**
 * The entries after `since` up to `current`. With no `since` (a first run), just the current
 * version's.
 */
export function notesSince(entries, since, current) {
  return entries.filter((e) =>
    compareVersions(e.version, current) <= 0 && (since ? compareVersions(e.version, since) > 0 : compareVersions(e.version, current) === 0));
}
