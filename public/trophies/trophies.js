// One player's trophies, from /api/trophies/<name> (see server/trophies.js): the ones they've got
// lit, with when, and the rest greyed with how to earn them.
(function () {
  const esc = Ark.escapeHtml;
  const $ = function (id) { return document.getElementById(id); };
  const name = new URLSearchParams(location.search).get('name') || '';

  // From a phone (its menu), back to the phone; else back to the leaderboard.
  if (/\/play\//.test(document.referrer)) $('back').href = '/play/';

  function when(at) {
    return new Date(at).toLocaleDateString();
  }

  function render(d) {
    const got = d.trophies.filter(function (t) { return t.at; });
    const rest = d.trophies.filter(function (t) { return !t.at; });
    const card = function (t) {
      return '<div class="trophy' + (t.at ? '' : ' locked') + '"><span class="icon">' + t.icon + '</span><span><strong>' + esc(t.name) + '</strong>' +
        '<span class="how">' + esc(t.how) + '</span>' + (t.at ? '<br><span class="when">✓ ' + when(t.at) + '</span>' : '') + '</span></div>';
    };
    $('content').innerHTML =
      '<p class="who">' + Ark.avatarHtml(d.profile) + esc(d.name) + ' <span class="count">🏆 ' + d.count + ' / ' + d.total + '</span></p>' +
      (got.length ? '<div class="grid">' + got.map(card).join('') + '</div>' : '<p class="muted">No trophies yet: finish a game to start.</p>') +
      (rest.length ? '<h2 class="muted" style="margin:12px 0 0">Still to earn</h2><div class="grid">' + rest.map(card).join('') + '</div>' : '');
  }

  if (!name) {
    $('content').innerHTML = '<p class="empty">Whose trophies? Open them from the leaderboard or your phone\'s ⋯ menu.</p>';
    return;
  }
  fetch('/api/trophies/' + encodeURIComponent(name))
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () { $('content').innerHTML = '<p class="empty">Could not load the trophies.</p>'; });
})();
