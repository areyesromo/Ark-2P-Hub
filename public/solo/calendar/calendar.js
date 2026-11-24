// A player's daily challenge calendar (?name=&month=YYYY-MM), from /api/calendar: the days
// they took part in and their streaks. Days are UTC days, laid out by the server.
(function () {
  const esc = Ark.escapeHtml;
  const $ = function (id) { return document.getElementById(id); };
  Ark.mountNav('calendar');
  const params = new URLSearchParams(location.search);
  const name = params.get('name') || '';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const url = function (month) { return '/solo/calendar/?name=' + encodeURIComponent(name) + '&month=' + month; };

  function cell(d) {
    const label = { done: Ark.formatScore(d.score, d.unit), started: 'Started', today: 'Today', missed: '', future: '' }[d.status];
    const icon = { done: '✅ ', started: '🟡 ' }[d.status] || '';
    return '<div class="day ' + d.status + (d.today ? ' is-today' : '') + '" title="' + esc(d.day + (d.gameName ? ' · ' + d.gameName : '')) + '"><span class="n">' + Number(d.day.slice(8)) + '</span>' +
      (d.gameName ? '<span class="g">' + esc(d.gameName) + '</span>' : '') + (label ? '<span class="s">' + icon + esc(label) + '</span>' : '') + '</div>';
  }

  function show(d) {
    const [y, m] = d.month.split('-').map(Number);
    const month = d.days.filter(function (x) { return x.status === 'done' || x.status === 'started'; }).length;
    $('content').innerHTML =
      '<div class="who">' + Ark.avatarHtml(d.profile, 'big') + '<span class="name">' + esc(d.name) + '</span></div>' +
      '<div class="stats">' +
      '<div class="stat"><strong>🔥 ' + d.current + '</strong><span>day streak</span></div>' +
      '<div class="stat"><strong>🏅 ' + d.longest + '</strong><span>longest streak</span></div>' +
      '<div class="stat"><strong>' + d.total + '</strong><span>days played</span></div>' +
      '<div class="stat"><strong>' + month + '</strong><span>this month</span></div></div>' +
      '<div class="months"><a class="btn ghost" aria-disabled="' + (d.prev ? 'false' : 'true') + '" href="' + (d.prev ? url(d.prev) : '#') + '">← ' + (d.prev ? MONTHS[Number(d.prev.slice(5)) - 1] : '') + '</a>' +
      '<h2>' + MONTHS[m - 1] + ' ' + y + '</h2>' +
      '<a class="btn ghost" aria-disabled="' + (d.next ? 'false' : 'true') + '" href="' + (d.next ? url(d.next) : '#') + '">' + (d.next ? MONTHS[Number(d.next.slice(5)) - 1] : '') + ' →</a></div>' +
      '<div class="dow">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
      '<div class="cal">' + '<div></div>'.repeat(d.offset) + d.days.map(cell).join('') + '</div>' +
      '<p class="legend"><span>✅ played and finished</span><span>🟡 started, didn\'t finish</span><span>Days change at midnight UTC · one go a day</span></p>';
  }

  function pickPlayer() {
    fetch('/api/solo/players', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.players.length) {
        $('content').innerHTML = '<p class="empty">Nobody has played yet. Try today\'s daily challenge from the lobby.</p>';
        return;
      }
      $('content').innerHTML = '<p class="muted">Whose calendar?</p><div class="players">' + d.players.map(function (p) {
        return '<a class="btn" href="/solo/calendar/?name=' + encodeURIComponent(p.name) + '">' + Ark.avatarHtml((d.profiles || {})[p.name.trim().toLowerCase()], 'small') + ' ' + esc(p.name) + '</a>';
      }).join('') + '</div>';
    });
  }

  if (!name) return pickPlayer();
  fetch('/api/solo/calendar?name=' + encodeURIComponent(name) + '&month=' + encodeURIComponent(params.get('month') || ''), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(show).catch(function () {
    $('content').innerHTML = '<p class="empty">Couldn\'t load the calendar. Is the hub running?</p>';
  });
})();
