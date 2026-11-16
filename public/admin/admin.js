(function () {
  const $ = (id) => document.getElementById(id);
  let status = null;
  // Opened inside Player 1's phone (play.js): no way back to the TV from here, the phone has its own Close.
  if (/[?&]embed=1\b/.test(location.search)) document.body.classList.add('embed');

  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data.status = res.status;
        return data;
      });
    });
  }

  function isLocal(host) {
    return /^(localhost|127\.|\[::1\])/.test(host);
  }

  function loadMatchCount() {
    fetch('/api/stats').then(function (r) { return r.json(); }).then(function (d) {
      $('match-count').textContent = d.total + ' match' + (d.total === 1 ? '' : 'es') + ' recorded';
    }).catch(function () { $('match-count').textContent = 'Unknown'; });
  }

  /** Online play: the switch, your own address, and what's running now. */
  function showOnline(d) {
    if (!d || d.status === undefined) return;
    $('online-allowed').checked = d.allowed !== false;
    $('tunnel-url').value = d.ownUrl || '';
    const what = d.ownUrl ? 'Using your own address.' : d.status === 'on' ? 'A quick tunnel is running: ' + d.url
      : d.status === 'starting' ? 'A quick tunnel is starting…' : d.status === 'error' ? '⚠ ' + (d.error || 'The tunnel didn\'t start.') : 'Nothing is running.';
    $('online-status').textContent = what + (d.rooms && d.rooms.length ? ' Rooms online: ' + d.rooms.join(', ') + '.' : '');
  }
  function loadOnline() {
    api('GET', '/api/admin/online').then(showOnline);
  }

  function showSettings() {
    $('settings').classList.remove('hidden');
    document.querySelectorAll('input[name="theme"]').forEach(function (r) { r.checked = r.value === status.theme; });
    loadMatchCount();
    loadOnline();
    $('join-url').value = status.joinUrl;
    $('detected').textContent = status.detected.base + (status.detected.guess ? ' (Docker-internal, phones probably can\'t reach it)' : '');
    if (status.envOverride) {
      $('env-note').textContent = 'PUBLIC_URL is set on the server (' + status.envOverride + '). It overrides this setting.';
      $('env-note').classList.remove('hidden');
    }
    $('here-note').textContent = isLocal(location.hostname)
      ? 'Tip: you opened this page as ' + location.host + ', which phones can\'t use. Open it from your phone or another PC via the LAN IP, then press "Use this page\'s address".'
      : '';
  }

  function load() {
    return api('GET', '/api/admin/status').then(function (s) {
      status = s;
      showSettings();
    });
  }

  function save(value) {
    const msg = $('settings-msg');
    api('PUT', '/api/admin/settings', { joinUrl: value }).then(function (r) {
      if (r.error) { msg.className = 'msg err'; msg.textContent = r.error; return; }
      status.joinUrl = r.joinUrl;
      $('join-url').value = r.joinUrl;
      msg.className = 'msg ok';
      msg.textContent = r.joinUrl
        ? 'Saved. The TV now shows a QR code for ' + r.joinUrl
        : 'Saved. Back to automatic.';
    });
  }

  $('settings').addEventListener('submit', function (e) {
    e.preventDefault();
    save($('join-url').value);
  });
  $('themes').addEventListener('change', function (e) {
    if (e.target.name !== 'theme') return;
    api('PUT', '/api/admin/theme', { theme: e.target.value }).then(function (r) {
      $('theme-msg').className = r.status === 200 ? 'msg ok' : 'msg err';
      $('theme-msg').textContent = r.status === 200 ? 'Theme changed on every screen.' : r.error || 'Something went wrong.';
      if (r.status === 200) {
        status.theme = r.theme;
        const link = document.getElementById('ark-theme');
        if (link) link.href = '/theme.css?t=' + Date.now(); // (this page too)
      }
    });
  });
  $('use-here').addEventListener('click', function () { $('join-url').value = location.origin; });
  $('clear').addEventListener('click', function () { $('join-url').value = ''; save(''); });
  $('clear-stats').addEventListener('click', function () {
    if (!window.confirm('Clear every recorded match and the leaderboard? This can\'t be undone.')) return;
    api('POST', '/api/admin/stats/reset').then(function (r) {
      $('stats-msg').className = r.ok ? 'msg ok' : 'msg err';
      $('stats-msg').textContent = r.ok ? 'Match history cleared.' : r.error || 'Something went wrong.';
      loadMatchCount();
    });
  });

  function onlineReply(r) {
    $('online-msg').className = r.status === 200 ? 'msg ok' : 'msg err';
    $('online-msg').textContent = r.status === 200 ? 'Saved.' : r.error || 'Something went wrong.';
    showOnline(r);
  }
  $('online-save').addEventListener('click', function () {
    api('PUT', '/api/admin/online', { allowed: $('online-allowed').checked, tunnelUrl: $('tunnel-url').value }).then(onlineReply);
  });
  $('online-stop').addEventListener('click', function () {
    api('POST', '/api/admin/online/stop').then(onlineReply);
  });

  $('clear-trophies').addEventListener('click', function () {
    if (!window.confirm('Clear everyone\'s trophies and practice records? This can\'t be undone.')) return;
    api('POST', '/api/admin/trophies/reset').then(function (r) {
      $('trophies-msg').className = r.ok ? 'msg ok' : 'msg err';
      $('trophies-msg').textContent = r.ok ? 'Trophies and practice records cleared.' : r.error || 'Something went wrong.';
    });
  });

  load();
})();
