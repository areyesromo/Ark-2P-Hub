# Bucket list

Ideas parked for later. They're not on the roadmap: they come back only when the owner asks for the bucket list.

## Online without the TV's computer (a cloud hub)

Play online with nothing running at home, as Jackbox does: this same hub hosted on a small cloud server
(about $5 a month, or a free tier that sleeps). Anyone opens the site on a TV or laptop, gets a room code, and
friends join from their phones anywhere.

- The game code barely changes. The work is making it safe on the open internet: limits on rooms and requests,
  rooms that expire, no admin page or household stats there (leaderboards per room, or none), and a "play
  online" choice in the desktop app alongside "host here".
- The lighter alternative, a relay only: the hub at home still runs the game but connects out to a small cloud
  relay for a fixed short address (no Cloudflare tunnel). It still needs the home hub and still needs a server.
- Parked because it needs a paid server. Today online play works through the hub's own Cloudflare quick tunnel
  (free), while the hub is on.
