'use strict';

// ── Direction system ──────────────────────────────────────────────────────────
//
// 8 directions indexed clockwise from North:
//   0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
//
// Coordinate system: +x = East, +y = South (screen coords)

const DIR_VECTORS = [
  [ 0, -1], // 0: N
  [ 1, -1], // 1: NE
  [ 1,  0], // 2: E
  [ 1,  1], // 3: SE
  [ 0,  1], // 4: S
  [-1,  1], // 5: SW
  [-1,  0], // 6: W
  [-1, -1], // 7: NW
];

const DIR_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ── Side types ────────────────────────────────────────────────────────────────
const SIDE_V = 'V'; // Vulnerable  — laser destroys the piece
const SIDE_R = 'R'; // Reflective  — laser redirects
const SIDE_P = 'P'; // Pass-through — laser continues unaffected

// ── Reflection helpers ────────────────────────────────────────────────────────
//
// All reflect functions operate in the piece's LOCAL frame (rotation already
// removed from the incoming direction by the caller).  They return a local
// outgoing direction (number) or array of directions for a split beam.

// Flat perpendicular surface → straight bounce-back.
function reflectFlat(dir) { return (dir + 4) % 8; }

// "\" surface (NW–SE diagonal, y = x in screen coords).
// Reflection: swap dx and dy  →  (a,b) → (b,a).
// Lookup: N→W, NE→SW, E→S, SE→SE*, S→E, SW→NE, W→N, NW→NW*  (* = back-scatter)
const REFLECT_BACKSLASH = [6, 5, 4, 3, 2, 1, 0, 7];

// "/" surface (NE–SW diagonal, y = -x in screen coords).
// Reflection: negate and swap  →  (a,b) → (-b,-a).
// Lookup: N→E, NE→NE*, E→N, SE→NW, S→W, SW→SW*, W→S, NW→SE
const REFLECT_SLASH = [2, 1, 0, 7, 6, 5, 4, 3];

// ── Piece type catalogue ──────────────────────────────────────────────────────
//
// sides[i]  — side property at LOCAL index i (rotation 0).
//             Index follows the same N=0…NW=7 convention.
//
// reflect(localTravelDir, localHitSide)
//             Given the laser's travel direction and the hit side (both in local
//             frame), return the outgoing direction(s) in local frame.
//             Return null if the interaction should destroy (shouldn't happen
//             for SIDE_R, but kept as a safety valve).
//
// laserSides — LOCAL side indices from which this piece fires lasers.
// maxMoves   — max squares the piece may move per action (TODO: enforce).
// canStomp   — whether moving onto an enemy piece captures it.

const PIECE_TYPES = {

  // ── Stomper ──
  // Octagonal piece. The three "front" faces (NW, N, NE) are reflective flat
  // surfaces that bounce lasers straight back. The remaining five sides are
  // vulnerable. Rotating the piece changes which sides face the enemy.
  STOMPER: {
    name: 'Stomper',
    //                  N        NE       E        SE       S        SW       W        NW
    sides: [SIDE_R, SIDE_R, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_R],
    reflect(localDir /*, localHitSide */) { return reflectFlat(localDir); },
    laserSides: [],
    maxMoves: 2,
    canStomp: true,
  },

  // ── Laser Cannon ──
  // Fires a laser from its front (local N face at rotation 0).
  // All sides vulnerable — destroying a cannon is a key strategic objective.
  LASER_CANNON: {
    name: 'Laser Cannon',
    sides: [SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V],
    reflect() { return null; },
    laserSides: [0], // fires from local N
    maxMoves: 1,
    canStomp: false,
  },

  // ── Laser Tube ──
  // Placed in front of a Laser Cannon to protect it.
  // Front (local N): reflective — enemy lasers bounce back.
  // Back  (local S): pass-through — own cannon's laser travels through.
  LASER_TUBE: {
    name: 'Laser Tube',
    sides: [SIDE_R, SIDE_V, SIDE_V, SIDE_V, SIDE_P, SIDE_V, SIDE_V, SIDE_V],
    reflect(localDir, localHitSide) {
      if (localHitSide === 0) return reflectFlat(localDir); // front: flat bounce
      return null;
    },
    laserSides: [],
    maxMoves: 1,
    canStomp: false,
  },

  // ── Mirror ──
  // Has two consecutive reflective sides (local W and local NW) that redirect
  // an incoming laser 90° clockwise.
  //
  // With rotation 0:
  //   Local W  face (hit by laser going E) → redirected to go S  (90° CW)
  //   Local NW face (hit by laser going SE) → redirected to go SW (90° CW)
  //
  // Rotate the mirror to redirect lasers from any cardinal/diagonal angle.
  MIRROR: {
    name: 'Mirror',
    sides: [SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_R, SIDE_R],
    reflect(localDir /*, localHitSide */) {
      // 90° clockwise redirect for any incoming direction
      return (localDir + 2) % 8;
    },
    laserSides: [],
    maxMoves: 1,
    canStomp: false,
  },

  // ── Splitter ──
  // Two non-consecutive reflective sides (local NE and local SE) that split
  // the incoming laser into two beams: one going 90° CW and one 90° CCW.
  //
  // With rotation 0:
  //   Local NE face (hit by laser going SW): splits into NW + SE beams
  //   Local SE face (hit by laser going NW): splits into NE + SW beams
  SPLITTER: {
    name: 'Splitter',
    sides: [SIDE_V, SIDE_R, SIDE_V, SIDE_R, SIDE_V, SIDE_V, SIDE_V, SIDE_V],
    reflect(localDir /*, localHitSide */) {
      const cw  = (localDir + 2) % 8;
      const ccw = (localDir + 6) % 8;
      return [cw, ccw]; // split into two perpendicular beams
    },
    laserSides: [],
    maxMoves: 1,
    canStomp: false,
  },
};
