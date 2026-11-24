// A player's own numbers (?name=), from /api/me: runs, favourite games, new records and the last two
// weeks. Without a name, pick a player.
(function () {
  const esc = Ark.escapeHtml;
  const $ = function (id) { return document.getElementById(id); };
  Ark.mountNav('me');
  const name = new URLSearchParams(location.search).get('name') || '';

  const day = function (iso) { return new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }); };
  const when = function (at) { return at ? new Date(at).toLocaleDateString() : ''; };
  const tile = function (n, label) { return '<div class="tile"><strong>' + n + '</strong><span>' + esc(label) + '</span></div>'; };

  function favourite(f) {
    const b = f.board;
    return '<li><span>' + esc(f.gameName) + '<br><span class="sub">' + (b ? 'best ' + esc(Ark.formatScore(b.best, b.unit)) + (b.variant ? ' · ' + esc(b.variant) : '') : 'daily challenges') + ' · last ' + esc(when(f.last)) + '</span></span><span class="num">' + f.plays + (f.plays === 1 ? ' play' : ' plays') + '</span></li>';
  }

  function record(r) {
    return '<li><span>' + esc(r.gameName) + '<br><span class="sub">' + esc(when(r.at)) + (r.variant ? ' · ' + esc(r.variant) : '') + ' · was ' + esc(Ark.formatScore(r.was, r.unit)) + '</span></span><span class="num">' + esc(Ark.formatScore(r.score, r.unit)) + '</span></li>';
  }

  function chart(activity) {
    const max = Math.max.apply(null, activity.map(function (a) { return a.runs; }).concat([1]));
    return '<div class="chart">' + activity.map(function (a) {
      return '<div class="col' + (a.runs ? '' : ' zero') + '" title="' + esc(a.day) + ': ' + a.runs + ' runs"><span class="n">' + (a.runs || '') + '</span><div class="bar" style="height:' + Math.round((a.runs / max) * 100) + '%"></div><span class="d">' + esc(day(a.day)) + '</span></div>';
    }).join('') + '</div>';
  }

  function show(d) {
    if (!d.runs) {
      $('content').innerHTML = '<div class="who">' + Ark.avatarHtml(d.profile, 'big') + '<span class="name">' + esc(d.name) + '</span></div><p class="empty">No finished runs yet. Play something and come back.</p>';
      return;
    }
    $('content').innerHTML =
      '<div class="who">' + Ark.avatarHtml(d.profile, 'big') + '<span class="name">' + esc(d.name) + '</span>' + (d.since ? '<span class="muted">playing since ' + esc(when(d.since)) + '</span>' : '') + '</div>' +
      '<div class="tiles">' + tile(d.runs, 'runs finished') + tile(d.games + ' / ' + d.gamesInHub, 'games tried') + tile(d.activeDays, 'days played') + tile(d.recordCount, 'new personal bests') +
      tile(d.achievements.got + ' / ' + d.achievements.total, 'achievements') + tile(d.daily.current + ' (best ' + d.daily.longest + ')', 'daily challenge streak') + '</div>' +
      '<div class="grid"><section class="panel"><h2>Favourite games</h2><ul class="list">' + d.favourites.map(favourite).join('') + '</ul></section>' +
      '<section class="panel"><h2>Latest personal bests</h2>' + (d.records.length ? '<ul class="list rec">' + d.records.map(record).join('') + '</ul>' : '<p class="note">Beat one of your own scores and it shows up here.</p>') + '</section></div>' +
      '<section class="panel"><h2>Runs in the last two weeks</h2>' + chart(d.activity) + '</section>' +
      '<p class="note">Days are UTC days.' + (d.trimmed ? ' The hub only keeps its latest 5,000 runs, so older ones may be missing from these counts.' : '') + ' Time played isn\'t recorded.</p>';
  }

  function pickPlayer() {
    fetch('/api/solo/players', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.players.length) {
        $('content').innerHTML = '<p class="empty">Nobody has played yet. Finish a run of any game to see your stats.</p>';
        return;
      }
      $('content').innerHTML = '<p class="muted">Whose stats?</p><div class="players">' + d.players.map(function (p) {
        return '<a class="btn" href="/solo/me/?name=' + encodeURIComponent(p.name) + '">' + Ark.avatarHtml((d.profiles || {})[p.name.trim().toLowerCase()], 'small') + ' ' + esc(p.name) + '</a>';
      }).join('') + '</div>';
    });
  }

  if (!name) return pickPlayer();
  fetch('/api/solo/me?name=' + encodeURIComponent(name), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(show).catch(function () {
    $('content').innerHTML = '<p class="empty">Couldn\'t load your stats. Is the hub running?</p>';
  });
})();
