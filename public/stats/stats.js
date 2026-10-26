// Leaderboard and match history, from /api/stats (see server/stats.js).
(function () {
  const esc = Ark.escapeHtml;
  const $ = function (id) { return document.getElementById(id); };

  // Phones arrive from /play/, the TV from /host/: send each back where it came from.
  if (/\/play\//.test(document.referrer)) $('back').href = '/play/';

  function ago(at) {
    const s = Math.round((Date.now() - at) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    const d = Math.floor(s / 86400);
    return d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(at).toLocaleDateString();
  }

  let profiles = {}; // nameKey -> { avatar, colour }, from /api/stats
  /** A player's avatar, before their name. */
  function av(name) {
    return Ark.avatarHtml(profiles[String(name).trim().toLowerCase()], 'small');
  }

  /** Column heading with a short form for narrow (phone) screens. */
  function head(long, short) {
    return '<th class="num" title="' + long + '"><span class="long">' + long + '</span><span class="short">' + short + '</span></th>';
  }

  function playersTable(players) {
    const ranked = players.filter(function (p) { return p.played; });
    if (!ranked.length) return '<p class="muted">No head-to-head games yet.</p>';
    const titles = ranked.some(function (p) { return p.titles; });
    const cups = ranked.some(function (p) { return p.cups; });
    return '<table><thead><tr><th></th><th>Player</th>' + (titles ? head('Tournaments', '🏆') : '') + (cups ? head('Kart cups', '🏅') : '') + head('Won', 'W') + head('Lost', 'L') + head('Drawn', 'D') + head('Win rate', '%') + '</tr></thead><tbody>' +
      ranked.map(function (p, i) {
        return '<tr><td class="rank' + (i === 0 ? ' gold' : '') + '">' + (i === 0 ? '👑' : i + 1) + '</td>' +
          '<td>' + av(p.name) + '<strong>' + esc(p.name) + '</strong></td>' +
          (titles ? '<td class="num">' + (p.titles ? '🏆 ' + p.titles : '<span class="muted">0</span>') + '</td>' : '') +
          (cups ? '<td class="num">' + (p.cups ? '🏅 ' + p.cups : '<span class="muted">0</span>') + '</td>' : '') +
          '<td class="num">' + p.wins + '</td><td class="num">' + p.losses + '</td><td class="num">' + p.draws + '</td>' +
          '<td class="num">' + p.winPct + '%<span class="bar" style="width:' + Math.round(p.winPct * 0.6) + 'px"></span></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function rivalriesTable(rivalries) {
    if (!rivalries.length) return '<p class="muted">Play a few games to start a rivalry.</p>';
    return '<table><tbody>' + rivalries.map(function (r) {
      const lead = r.wins[0] === r.wins[1] ? -1 : r.wins[0] > r.wins[1] ? 0 : 1;
      const name = function (i) { return '<span class="' + (lead === i ? 'win' : '') + '">' + av(r.names[i]) + esc(r.names[i]) + '</span>'; };
      return '<tr><td>' + name(0) + ' <span class="vs">vs</span> ' + name(1) + '</td>' +
        '<td class="num"><strong>' + r.wins[0] + ' – ' + r.wins[1] + '</strong>' + (r.draws ? ' <span class="muted">(' + r.draws + ' drawn)</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function gamesTable(games) {
    if (!games.length) return '<p class="muted">Nothing played yet.</p>';
    return '<table><thead><tr><th>Game</th><th class="num">Played</th><th>Best</th></tr></thead><tbody>' +
      games.map(function (g) {
        let best = '<span class="muted">—</span>';
        if (g.category === 'casual') best = g.bestStars ? '⭐ ' + g.bestStars + ' stars <span class="tag">team record</span>' : best;
        else if (g.champion) best = '👑 ' + esc(g.champion.name) + ' <span class="muted">(' + g.champion.wins + ' win' + (g.champion.wins === 1 ? '' : 's') + ')</span>';
        return '<tr><td>' + esc(g.name) + '</td><td class="num">' + g.played + '</td><td>' + best + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function tournamentsTable(list) {
    return '<table><tbody>' + list.map(function (t) {
      const name = function (i) { return '<span class="' + (t.winner === i ? 'win' : '') + '">' + (t.winner === i ? '🏆 ' : '') + esc(t.players[i]) + '</span>'; };
      return '<tr><td>' + name(0) + ' <span class="vs">vs</span> ' + name(1) + '</td>' +
        '<td class="num"><strong>' + t.wins[0] + ' – ' + t.wins[1] + '</strong> <span class="muted">best of ' + t.bestOf + '</span></td>' +
        '<td class="when num">' + ago(t.at) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  /** A "3D" tag on Kart Race 3D's records and cups (Kart Race keeps its own). */
  function tag3d(r) {
    return r.game === 'kart-race-3d' ? ' <span class="tag">3D</span>' : '';
  }

  /** The latest Kart Race cups: who won, and the score in races. */
  function cupsTable(list) {
    return '<table><tbody>' + list.map(function (c) {
      const name = function (i) { return '<span class="' + (c.winner === i ? 'win' : '') + '">' + (c.winner === i ? '🏅 ' : '') + esc(c.players[i]) + '</span>'; };
      return '<tr><td>' + name(0) + ' <span class="vs">vs</span> ' + name(1) + '</td>' +
        '<td class="num">' + (c.scores ? '<strong>' + c.scores[0] + ' – ' + c.scores[1] + '</strong> <span class="muted">races</span>' : '') + tag3d(c) + '</td>' +
        '<td class="when num">' + ago(c.at) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  /** The fastest lap ever on each track. */
  function lapsTable(list) {
    return '<table><thead><tr><th>Track</th><th>Holder</th><th class="num">Lap</th><th></th></tr></thead><tbody>' + list.map(function (r) {
      const s = r.ms / 1000;
      const time = Math.floor(s / 60) + ':' + ('0' + (s % 60).toFixed(2)).slice(-5);
      return '<tr><td>' + esc(r.track) + tag3d(r) + '</td><td><strong>' + esc(r.name) + '</strong></td><td class="num">' + time + '</td><td class="when num">' + ago(r.at) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  /** Each player's fastest start (reaction time at the lights). */
  function startsTable(list) {
    return '<table><tbody>' + list.map(function (r, i) {
      return '<tr><td class="rank' + (i === 0 ? ' gold' : '') + '">' + (i === 0 ? '⚡' : i + 1) + '</td><td><strong>' + esc(r.name) + '</strong></td>' +
        '<td class="num">' + (r.ms / 1000).toFixed(2) + ' s</td><td class="when num">' + ago(r.at) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function recentTable(recent) {
    if (!recent.length) return '<p class="muted">No matches yet.</p>';
    return '<table><tbody>' + recent.map(function (m) {
      let result;
      if (m.category === 'casual') {
        result = esc(m.players[0]) + ' &amp; ' + esc(m.players[1]) + ': <strong>' + m.stars + '⭐</strong> <span class="muted">of ' + m.maxStars + '</span>';
      } else {
        const name = function (i) { return '<span class="' + (m.winner === i ? 'win' : '') + '">' + esc(m.players[i]) + '</span>'; };
        result = name(0) + ' <span class="vs">vs</span> ' + name(1) +
          (m.scores ? ' <strong>' + m.scores[0] + ' – ' + m.scores[1] + '</strong>' : '') +
          (m.winner === null ? ' <span class="tag">draw</span>' : '') +
          (m.cup ? ' <span class="tag">🏅 cup</span>' : '');
      }
      return '<tr><td>' + esc(m.gameName) + '</td><td>' + result + '</td><td class="when num">' + ago(m.at) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function render(d) {
    profiles = d.profiles || {};
    if (!d.total) {
      $('content').innerHTML = '<div class="panel empty">🏆 No matches yet.<br>Finish a game and it shows up here.</div>';
      return;
    }
    $('content').innerHTML =
      '<div class="grid">' +
      '<section class="panel"><h2>👑 Players</h2>' + playersTable(d.players) + '</section>' +
      '<section class="panel"><h2>⚔️ Rivalries</h2>' + rivalriesTable(d.rivalries) + '</section>' +
      '<section class="panel"><h2>🎮 Games</h2>' + gamesTable(d.games) + '</section>' +
      (d.tournaments && d.tournaments.length ? '<section class="panel"><h2>🏆 Tournaments</h2>' + tournamentsTable(d.tournaments) + '</section>' : '') +
      (d.lapRecords && d.lapRecords.length ? '<section class="panel"><h2>⏱️ Kart lap records</h2>' + lapsTable(d.lapRecords) + '</section>' : '') +
      (d.bestStarts && d.bestStarts.length ? '<section class="panel"><h2>⚡ Kart best starts</h2>' + startsTable(d.bestStarts) + '</section>' : '') +
      (d.cups && d.cups.length ? '<section class="panel"><h2>🏅 Kart cups</h2>' + cupsTable(d.cups) + '</section>' : '') +
      '<section class="panel wide"><h2>🕑 Recent matches</h2>' + recentTable(d.recent) + '</section>' +
      '</div>' +
      '<p class="muted" style="margin-top:16px">' + d.total + ' match' + (d.total === 1 ? '' : 'es') + ' recorded. Players are matched by name. ' +
      'The history can be cleared in <a href="/admin/">Settings</a>.</p>';
  }

  fetch('/api/stats')
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () { $('content').innerHTML = '<p class="empty">Could not load the leaderboard.</p>'; });
})();
