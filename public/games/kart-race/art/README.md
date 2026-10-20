# Kart Race art

Cut from the character and top-down kart sheets; replace any file with a clean
version of the same name and size and it shows up as is.

- `portraits/<racer id>.webp`: the round coin token, gold frame included, 160×160.
- `karts/<racer id>.webp`: the kart seen from above, **nose pointing up**, transparent
  background, wheels included, 256 px tall. Drawn 1.25 field units long on the track.
  Only racers listed in `SPRITES` in `../racers.js` use a picture; the rest are drawn as shapes.
  To add one, add the file and the racer's id to `SPRITES`. These show the driver in the seat.
- `karts/empty/<racer id>.webp`: the same kart with nobody in it, same format. Not used in 2D;
  kept for the 3D module.

Racer ids: rex, roxy, zip, zara, swift, sky, boulder, bella, dash, dot, rascal, ruby.
