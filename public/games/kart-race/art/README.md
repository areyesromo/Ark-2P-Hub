# Kart Race art

Placeholder art, cropped from the character and kart sheets; replace any file with a clean
version of the same name and size and it shows up as is.

- `portraits/<racer id>.webp`: square, round face (the screens add the gold rim), 160×160.
- `karts/<racer id>.webp`: the kart seen from above, **nose pointing up**, transparent
  background, wheels included, 256 px tall. Drawn 1.25 field units long on the track.
  Only racers listed in `SPRITES` in `../racers.js` use a picture; the rest are drawn as shapes.
  To add one, add the file and the racer's id to `SPRITES`.

Racer ids: rex, roxy, zip, zara, swift, sky, boulder, bella, dash, dot, rascal, ruby.

Notes on the placeholders: Roxy, Zara, Sky, Bella, Dot and Ruby's karts are recolours of
their partner's kart (Zara's still says ZIP on the nose and Sky's says SWIFT on the rear wing).
