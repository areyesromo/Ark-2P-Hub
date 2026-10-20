// Kart Race items: names, emoji and what each one does, for the screens (and any future 3D
// module). The rules themselves are on the server (server/games/kart-items.js).
// Sets globalThis.ArkKartItems.
(function () {
  globalThis.ArkKartItems = {
    banana: { name: 'Banana', emoji: '🍌', about: 'Drop it behind you: whoever hits it spins out.' },
    turbo: { name: 'Turbo', emoji: '⚡', about: 'A short boost.' },
    shield: { name: 'Shield', emoji: '🛡️', about: 'Blocks the next hit (5 s).' },
    goldturbo: { name: 'Gold Turbo', emoji: '🌟', about: 'For 5 s, every press boosts.' },
    star: { name: 'Star', emoji: '⭐', about: '6 s: faster, nothing touches you, ram your rival to spin them.' },
    coinbag: { name: 'Coin Bag', emoji: '💰', about: '+5 coins.' },
    magnet: { name: 'Magnet', emoji: '🧲', about: '5 s: pulls in coins and boxes; slipstream behind your rival.' },
    hover: { name: 'Hover', emoji: '🎈', about: '4 s: float over grass and bananas.' },
    thunder: { name: 'Thunder', emoji: '🌩️', about: 'Your rival shrinks for 4 s: slower and lighter.' },
    freeze: { name: 'Freeze', emoji: '🧊', about: "Your rival's tyres ice up for 3 s: hard to turn." },
    swap: { name: 'Swap', emoji: '🔄', about: 'Trade your items with your rival.' },
    web: { name: 'Web', emoji: '🕸️', about: 'Drop it: whoever drives in is held to half speed for 1.5 s.' },
    oil: { name: 'Oil Slick', emoji: '🛢️', about: "Drop it: whoever crosses it can't steer or brake for 1 s." },
    bouncer: { name: 'Bouncer', emoji: '🥏', about: 'Fires straight ahead and bounces off the walls: it spins out anyone it hits (you too!).' },
    seeker: { name: 'Seeker', emoji: '🎯', about: 'Chases your rival round the road; a banana or web in its way stops it.' },
    bomb: { name: 'Bomb', emoji: '💣', about: 'Lobbed ahead: it goes off after 1.5 s and spins out anyone close.' },
  };
})();
