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
    .then(function (d) {
      render(d);
      return fetch('/api/solo/achievements?name=' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(renderSolo);
    })
    .catch(function () { $('content').innerHTML = '<p class="empty">Could not load the trophies.</p>'; });

  // The solo games' achievements (the 1 player mode, see server/solo/achievements.js): what they've
  // got, then the rest by game, folded away, with links to the other solo pages.
  function renderSolo(d) {
    const q = '?name=' + encodeURIComponent(name);
    const card = function (a) {
      return '<div class="trophy' + (a.at ? '' : ' locked') + '"><span class="icon">' + esc(a.icon) + '</span><span><strong>' + esc(a.name) + '</strong>' +
        '<span class="how">' + esc(a.desc) + '</span>' + (a.at ? '<br><span class="when">✓ ' + when(a.at) + '</span>' : '') + '</span></div>';
    };
    const got = d.list.filter(function (a) { return a.at; });
    const groups = {};
    d.list.filter(function (a) { return !a.at; }).forEach(function (a) {
      const g = a.gameName || '👤 The hub';
      (groups[g] = groups[g] || []).push(a);
    });
    const el = document.createElement('section');
    el.className = 'solo';
    el.innerHTML =
      '<h2 class="who" style="margin-top:28px">👤 Solo achievements <span class="count">⭐ ' + d.got + ' / ' + d.total + '</span></h2>' +
      '<p class="solo-links"><a class="btn ghost" href="/solo/me/' + q + '">📊 My stats</a> <a class="btn ghost" href="/solo/collection/' + q + '">🎁 Collection</a> <a class="btn ghost" href="/solo/calendar/' + q + '">📅 Daily calendar</a></p>' +
      (got.length ? '<div class="grid">' + got.map(card).join('') + '</div>' : '<p class="muted">None yet: play a game in the lobby\'s 👤 1 player mode.</p>') +
      '<h2 class="muted" style="margin:12px 0 0">Still to earn</h2>' +
      Object.keys(groups).map(function (g) {
        return '<details class="solo-game"><summary>' + esc(g) + ' <span class="muted">· ' + groups[g].length + '</span></summary><div class="grid">' + groups[g].map(card).join('') + '</div></details>';
      }).join('');
    $('content').appendChild(el);
  }
})();
