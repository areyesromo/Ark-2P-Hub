// A player's collection (?name=), from /api/collection: what each game has unlocked
// and what's still locked; without a name, pick a player.
(function () {
  const esc = Ark.escapeHtml;
  const $ = function (id) { return document.getElementById(id); };
  Ark.mountNav('collection');
  const name = new URLSearchParams(location.search).get('name') || '';

  function item(i) {
    return '<div class="item' + (i.open ? ' open' : '') + '"><strong>' + esc(i.label) + '</strong>' +
      (i.open ? '<span class="state">✓ Unlocked</span>' : '<span class="how">🔒 ' + esc(i.how) + '</span>') + '</div>';
  }

  function group(g) {
    let got = 0;
    let total = 0;
    g.rows.forEach(function (r) { r.items.forEach(function (i) { total++; if (i.open) got++; }); });
    return '<section class="panel"><h2>' + esc(g.gameName) + ' <span class="muted">' + got + ' / ' + total + '</span></h2>' +
      g.rows.map(function (r) { return '<h3>' + esc(r.title) + '</h3><div class="items">' + r.items.map(item).join('') + '</div>'; }).join('') + '</section>';
  }

  function showPlayer(d) {
    const pct = d.total ? Math.round((d.got / d.total) * 100) : 0;
    $('content').innerHTML =
      '<div class="who">' + Ark.avatarHtml(d.profile, 'big') + '<span class="name">' + esc(d.name) + '</span><span class="count">🎁 ' + d.got + ' / ' + d.total + ' unlocked</span>' +
      '<span class="bar"><i style="width:' + pct + '%"></i></span></div>' +
      '<div class="grid">' + d.groups.map(group).join('') + '</div>';
  }

  function pickPlayer() {
    fetch('/api/solo/players', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.players.length) {
        $('content').innerHTML = '<p class="empty">Nobody has played yet. Finish a run of any game to start your collection.</p>';
        return;
      }
      $('content').innerHTML = '<p class="muted">Whose collection?</p><div class="players">' + d.players.map(function (p) {
        return '<a class="btn" href="/solo/collection/?name=' + encodeURIComponent(p.name) + '">' + Ark.avatarHtml((d.profiles || {})[p.name.trim().toLowerCase()], 'small') + ' ' + esc(p.name) + '</a>';
      }).join('') + '</div>';
    });
  }

  if (!name) return pickPlayer();
  fetch('/api/solo/collection?name=' + encodeURIComponent(name), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(showPlayer).catch(function () {
    $('content').innerHTML = '<p class="empty">Couldn\'t load the collection. Is the hub running?</p>';
  });
})();
