(function () {
  const TOKEN_KEY = 'ark.admin';
  const $ = (id) => document.getElementById(id);
  let status = null;

  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode */ }
  }

  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data.status = res.status;
        return data;
      });
    });
  }

  function show(id) {
    ['setup', 'login', 'settings'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  }

  function isLocal(host) {
    return /^(localhost|127\.|\[::1\])/.test(host);
  }

  function loadMatchCount() {
    fetch('/api/stats').then(function (r) { return r.json(); }).then(function (d) {
      $('match-count').textContent = d.total + ' match' + (d.total === 1 ? '' : 'es') + ' recorded';
    }).catch(function () { $('match-count').textContent = 'Unknown'; });
  }

  function showSettings() {
    show('settings');
    loadMatchCount();
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
      if (s.needsSetup) return show('setup');
      $('login-note').textContent = s.passwordFromEnv ? 'The password is set by ADMIN_PASSWORD on the server.' : '';
      if (!token()) return show('login');
      showSettings();
    });
  }

  $('setup').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('setup-pw').value !== $('setup-pw2').value) {
      $('setup-msg').textContent = "Passwords don't match.";
      return;
    }
    api('POST', '/api/admin/setup', { password: $('setup-pw').value }).then(function (r) {
      if (!r.token) { $('setup-msg').textContent = r.error || 'Something went wrong.'; return; }
      setToken(r.token);
      load();
    });
  });

  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    api('POST', '/api/admin/login', { password: $('login-pw').value }).then(function (r) {
      if (!r.token) { $('login-msg').textContent = r.error || 'Something went wrong.'; return; }
      $('login-msg').textContent = '';
      $('login-pw').value = '';
      setToken(r.token);
      showSettings();
    });
  });

  function save(value) {
    const msg = $('settings-msg');
    api('PUT', '/api/admin/settings', { joinUrl: value }).then(function (r) {
      if (r.status === 401) { setToken(''); show('login'); return; }
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
  $('use-here').addEventListener('click', function () { $('join-url').value = location.origin; });
  $('clear').addEventListener('click', function () { $('join-url').value = ''; save(''); });
  $('clear-stats').addEventListener('click', function () {
    if (!window.confirm('Clear every recorded match and the leaderboard? This can\'t be undone.')) return;
    api('POST', '/api/admin/stats/reset').then(function (r) {
      if (r.status === 401) { setToken(''); return show('login'); }
      $('stats-msg').className = r.ok ? 'msg ok' : 'msg err';
      $('stats-msg').textContent = r.ok ? 'Match history cleared.' : r.error || 'Something went wrong.';
      loadMatchCount();
    });
  });

    $('logout').addEventListener('click', function () {
    api('POST', '/api/admin/logout').then(function () { setToken(''); show('login'); });
  });

  load();
})();
