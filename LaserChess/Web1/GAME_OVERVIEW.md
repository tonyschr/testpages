## Game Overview

Laser Chess is 2 player turn based game where the players move pieces and fire lasers to defeat the opponent. Similar to chess, some pieces can simply "stomp" another piece to capture it. But more interestingly, some pieces can fire a laser to "shoot" another piece from across the board to destroy it. Each piece has vulnerable sides and reflective (mirror) sides, which affect what happens when being shot by a laser. The reflective side can simply bounce back the laser, rendering it ineffective, or reflect the laser at an angle.

1. Laser Chess is a twp player game, played on an NxM board, similar to chess. The dimensions default to 10x10, but can be configured by the user before starting the game.
2. All pieces can be moved in any direction, up to a certain number of squares: horizontally, vertically, or diagonally.
3. All pieces can be rotated in 45 degree increments.
4. Each rotation and/or each square moved counts as an action, and there are 3 actions (configurable) allowed for a turn.

## Game Pieces

1. Each piece is modeled so that each of the 8 sides can be specified as vulnerable or reflective.

2. Some pieces can shoot lasers out of 1 or more of the 8 sides.

3. A piece that is completely reflective across all of the sides for a given orientation will cause the laser to bounce at an angle.

### Game Piece Types

* Stomper: 8-sided roundish piece, reflective on half of it's sides so that it bounces back a laser for 4 sides, and is vulnerable for the other 4 sides.

* Laser Cannon: Piece that has no reflective sides, but can fire a laser out of the front.

* Laser Tube: Piece that allows a laser through the back, but is reflective on the front. This piece is used in conjunction with the Laser Cannon to protect the Laser Cannon from immediate bounce back from a reflective piece.

* Mirror: Piece that is reflective on 2/8 consecutive flat sides and is used to bounce the laser at a 90 degree angle.

```
|\
| \
|  \
|___\
```

* Splitter: Piece that is triangle shaped and reflective on 2/8 non-consecutive sides and is used to split

```
|\
| \
| /
|/
```

## Strategy

When starting the game, the players agree on the dimensions of the NxM board. There are default starting configurations, but also a battleship-style mode where the players can freely set the configuration for their pieces on their side of the board before the game begins.

Part of the fun of the game is arranging the pieces to amplify the impact of the pieces that can shoot lasers, while protecting those pieces and others from the opponent.

## Technology

### Serverless

Ideally the game is a webpage that can be local or hosted by a static service such as GitHub Pages, and not rely on ASP.NET, etc. The initial version should work with two people on the same computer playing the game.

Eventually I want to evolve the game to allow a local and remote player, but still require minimal server-side logic to set up the communication.

### UI

The pieces, board, and lasers should be SVG to enable artistic creativity and elegant scaling for different devices and screen resolutions (and DPI).

### Architecture

The code should be easy to modify to adjust the appearance and game rules. It should be as self-contained as possible and not rely on a lot of external 3rd party packages.
