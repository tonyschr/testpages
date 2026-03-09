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
  // Right isoceles triangle with "/" hypotenuse.  Right angle at local SE.
  // Vertices (rotation 0): SW(-17,17), NE(17,-17), SE(17,17).
  //
  // The "/" hypotenuse spans 3 consecutive face slots (W, NW, N) — all reflective.
  // The two legs (S face, E face) are vulnerable.
  //
  // With rotation 0:
  //   W  face (hit by laser going E)  → exits going N   (90°)
  //   N  face (hit by laser going S)  → exits going W   (90°)
  //   NW face (hit by laser going SE) → exits going NW  (back-scatter)
  //
  // Rotate the mirror to redirect lasers from any angle.
  MIRROR: {
    name: 'Mirror',
    //     N        NE       E        SE       S        SW       W        NW
    sides: [SIDE_R, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_V, SIDE_R, SIDE_R],
    reflect(localDir /*, localHitSide */) {
      return REFLECT_SLASH[localDir];
    },
    laserSides: [],
    maxMoves: 1,
    canStomp: false,
  },

  // ── Splitter ──
  // Small northward-pointing triangle.  The two diagonal faces (NW and NE)
  // are reflective; the base (S) is the only vulnerable side.  East and West
  // lasers pass straight through because the triangle has no E/W faces.
  //
  // With rotation 0:
  //   N  face — hit by laser going S → splits into E + W beams
  //   NE face — hit by laser going SW → bounces back SW  ("/" reflection)
  //   NW face — hit by laser going SE → bounces back SE  ("\" reflection)
  //   E, SE, SW, W faces — SIDE_P: laser passes through (no face there)
  //   S  face — SIDE_V: vulnerable
  SPLITTER: {
    name: 'Splitter',
    //     N        NE       E        SE       S        SW       W        NW
    sides: [SIDE_R, SIDE_R, SIDE_P, SIDE_P, SIDE_V, SIDE_P, SIDE_P, SIDE_R],
    reflect(localDir, localHitSide) {
      if (localHitSide === 0) return [2, 6];               // N apex → split E + W
      if (localHitSide === 1) return REFLECT_SLASH[localDir];     // NE "/" face
      if (localHitSide === 7) return REFLECT_BACKSLASH[localDir]; // NW "\" face
      return null;
    },
    laserSides: [],
    maxMoves: 1,
    canStomp: false,
  },
};
