// Sokoban's warehouse, drawn the same way on the TV and the phone.
(function () {
  function html(v) {
    const floor = {};
    v.floor.forEach(function (i) { floor[i] = true; });
    const walls = {};
    v.walls.forEach(function (i) { walls[i] = true; });
    const targets = {};
    v.targets.forEach(function (i) { targets[i] = true; });
    const boxes = {};
    v.boxes.forEach(function (i) { boxes[i] = true; });
    let out = '<div class="sk-grid" style="--w:' + v.w + ';--h:' + v.h + '">';
    for (let i = 0; i < v.w * v.h; i++) {
      let cls = 'sk-cell';
      let inner = '';
      if (walls[i]) cls += ' wall';
      else if (floor[i]) cls += ' floor';
      if (targets[i]) inner += '<span class="target"></span>';
      if (boxes[i]) inner += '<span class="box' + (targets[i] ? ' home' : '') + '"></span>';
      if (v.worker === i) inner += '<span class="worker">🙂</span>';
      out += '<div class="' + cls + '">' + inner + '</div>';
    }
    return out + '</div>';
  }

  window.ArkSokoban = { html: html };
})();
