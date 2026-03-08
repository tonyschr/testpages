'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
const CELL_SIZE       = 58;  // pixels per board cell
const BOARD_ROWS      = 10;
const BOARD_COLS      = 10;
const ACTIONS_PER_TURN = 3;

const SVG_NS = 'http://www.w3.org/2000/svg';

// Player colour palettes
const PLAYER_COLORS = {
  1: { fill: '#0d2a50', stroke: '#4a90d9', highlight: '#7eb8f7', label: '#aad4ff' },
  2: { fill: '#500d0d', stroke: '#d94a4a', highlight: '#f77e7e', label: '#ffc0c0' },
};

// ── SVG helpers ───────────────────────────────────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const c of children) if (c) e.appendChild(c);
  return e;
}

// ── Piece class ───────────────────────────────────────────────────────────────
let _nextId = 1;

class Piece {
  constructor(type, player, col, row, rotation = 0) {
    this.id       = _nextId++;
    this.type     = type;     // key in PIECE_TYPES
    this.player   = player;   // 1 or 2
    this.col      = col;
    this.row      = row;
    this.rotation = rotation; // 0–7 clockwise 45° steps
  }

  get typeDef() { return PIECE_TYPES[this.type]; }

  // Convert physical side index to local (accounting for rotation).
  toLocal(physSide) { return ((physSide - this.rotation) % 8 + 8) % 8; }

  // Convert local side index to physical.
  toPhys(localSide) { return (localSide + this.rotation) % 8; }

  // Handle a laser traveling in physical direction travelDir.
  // Returns { destroyed: bool, newDirs: number[] }
  laserInteract(travelDir) {
    const physHitSide  = (travelDir + 4) % 8;
    const localHitSide = this.toLocal(physHitSide);
    const localTravDir = this.toLocal(travelDir);
    const sideType     = this.typeDef.sides[localHitSide];

    if (sideType === SIDE_P) {
      return { destroyed: false, newDirs: [travelDir] }; // pass straight through
    }
    if (sideType === SIDE_V) {
      return { destroyed: true, newDirs: [] };
    }
    // SIDE_R — ask the piece type for the outgoing local direction(s)
    const localOut = this.typeDef.reflect(localTravDir, localHitSide);
    if (localOut === null) return { destroyed: true, newDirs: [] };
    const outs = Array.isArray(localOut) ? localOut : [localOut];
    return { destroyed: false, newDirs: outs.map(d => this.toPhys(d)) };
  }

  // Physical directions from which this piece fires.
  get laserDirs() { return this.typeDef.laserSides.map(s => this.toPhys(s)); }
}

// ── Game state ────────────────────────────────────────────────────────────────
class Game {
  constructor(rows = BOARD_ROWS, cols = BOARD_COLS, actionsPerTurn = ACTIONS_PER_TURN) {
    this.rows           = rows;
    this.cols           = cols;
    this.actionsPerTurn = actionsPerTurn;
    this.pieces         = [];
    this.currentPlayer  = 1;
    this.actionsLeft    = actionsPerTurn;
    this.selected       = null;   // currently selected Piece | null
    this.phase          = 'play'; // 'play' | 'gameover'
    this.winner         = null;
    this.laserPaths     = [];     // last fired laser paths (cleared next turn)
    this._log           = [];
  }

  at(col, row) { return this.pieces.find(p => p.col === col && p.row === row) ?? null; }

  inBounds(col, row) { return col >= 0 && col < this.cols && row >= 0 && row < this.rows; }

  // ── Actions ──

  select(piece) {
    if (piece && piece.player !== this.currentPlayer) return false;
    this.selected = piece;
    return true;
  }

  move(piece, dcol, drow) {
    if (!piece || piece.player !== this.currentPlayer) return false;
    if (this.actionsLeft <= 0 || this.phase !== 'play') return false;
    const nc = piece.col + dcol;
    const nr = piece.row + drow;
    if (!this.inBounds(nc, nr)) return false;

    const target = this.at(nc, nr);
    if (target) {
      if (target.player === piece.player) return false;
      if (!piece.typeDef.canStomp) return false;
      this.removePiece(target);
      this.log(`P${piece.player} stomped ${target.typeDef.name}.`);
    }

    piece.col = nc;
    piece.row = nr;
    this.actionsLeft--;
    this.checkWin();
    return true;
  }

  rotate(piece, steps) {
    if (!piece || piece.player !== this.currentPlayer) return false;
    if (this.actionsLeft <= 0 || this.phase !== 'play') return false;
    piece.rotation = ((piece.rotation + steps) % 8 + 8) % 8;
    this.actionsLeft--;
    return true;
  }

  fireLasers() {
    if (this.phase !== 'play') return;
    this.laserPaths = [];
    const toDestroy = new Set();

    for (const piece of this.pieces) {
      if (piece.player !== this.currentPlayer) continue;
      for (const dir of piece.laserDirs) {
        const { path, destroyed } = this._traceLaser(piece.col, piece.row, dir, new Set());
        this.laserPaths.push({ origin: { col: piece.col, row: piece.row }, path });
        destroyed.forEach(p => toDestroy.add(p));
      }
    }

    if (toDestroy.size) {
      const names = [...toDestroy].map(p => p.typeDef.name).join(', ');
      this.log(`Laser destroyed: ${names}.`);
      toDestroy.forEach(p => this.removePiece(p));
    } else {
      this.log('Lasers fired — nothing destroyed.');
    }

    this.checkWin();
  }

  // Returns { path: [{col,row}], destroyed: Piece[] }
  _traceLaser(startCol, startRow, dir, visited) {
    const path      = [];
    const destroyed = [];
    let col = startCol, row = startRow, curDir = dir;
    const MAX = this.rows * this.cols * 3;

    for (let i = 0; i < MAX; i++) {
      const [dc, dr] = DIR_VECTORS[curDir];
      col += dc; row += dr;
      if (!this.inBounds(col, row)) break;

      path.push({ col, row });

      const key = `${col},${row},${curDir}`;
      if (visited.has(key)) break; // prevent infinite loops
      visited.add(key);

      const piece = this.at(col, row);
      if (!piece) continue;

      const result = piece.laserInteract(curDir);

      if (result.destroyed) {
        destroyed.push(piece);
        break;
      }
      if (result.newDirs.length === 0) break;

      // Handle split beams (Splitter creates multiple outgoing directions)
      for (let j = 1; j < result.newDirs.length; j++) {
        const sub = this._traceLaser(col, row, result.newDirs[j], visited);
        path.push(...sub.path);
        destroyed.push(...sub.destroyed);
      }
      curDir = result.newDirs[0];
    }

    return { path, destroyed };
  }

  endTurn() {
    this.laserPaths    = [];
    this.selected      = null;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.actionsLeft   = this.actionsPerTurn;
    this.log(`--- Player ${this.currentPlayer}'s turn ---`);
  }

  removePiece(piece) {
    this.pieces = this.pieces.filter(p => p !== piece);
  }

  checkWin() {
    const p1 = this.pieces.some(p => p.player === 1);
    const p2 = this.pieces.some(p => p.player === 2);
    if (!p1) { this.phase = 'gameover'; this.winner = 2; }
    if (!p2) { this.phase = 'gameover'; this.winner = 1; }
  }

  log(msg) {
    this._log.unshift(msg); // newest first
    if (this._log.length > 30) this._log.pop();
  }
}

// ── Default board setup ───────────────────────────────────────────────────────
function setupDefault(game) {
  const R = game.rows - 1; // bottom row index

  // Helper shorthands
  const p1 = (type, col, row, rot = 0)  => game.pieces.push(new Piece(type, 1, col, row, rot));
  const p2 = (type, col, row, rot = 4)  => game.pieces.push(new Piece(type, 2, col, row, rot));

  // Player 1 — bottom two rows, facing North (rotation 0)
  p1('LASER_CANNON', 0, R);
  p1('LASER_TUBE',   1, R);
  p1('MIRROR',       2, R);
  p1('STOMPER',      3, R);
  p1('SPLITTER',     4, R);
  p1('STOMPER',      5, R);
  p1('MIRROR',       6, R);
  p1('LASER_TUBE',   7, R);
  p1('LASER_CANNON', 9, R);

  p1('STOMPER', 1, R - 1);
  p1('STOMPER', 3, R - 1);
  p1('STOMPER', 6, R - 1);
  p1('STOMPER', 8, R - 1);

  // Player 2 — top two rows, facing South (rotation 4)
  p2('LASER_CANNON', 9, 0);
  p2('LASER_TUBE',   8, 0);
  p2('MIRROR',       7, 0);
  p2('STOMPER',      6, 0);
  p2('SPLITTER',     5, 0);
  p2('STOMPER',      4, 0);
  p2('MIRROR',       3, 0);
  p2('LASER_TUBE',   2, 0);
  p2('LASER_CANNON', 0, 0);

  p2('STOMPER', 8, 1);
  p2('STOMPER', 6, 1);
  p2('STOMPER', 3, 1);
  p2('STOMPER', 1, 1);
}

// ── SVG rendering ─────────────────────────────────────────────────────────────
function cellCenter(col, row) {
  return [col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2];
}

// Map piece type keys to their SVG symbol IDs (defined in index.html <defs>).
const PIECE_SYMBOL_ID = {
  STOMPER:      'piece-stomper',
  LASER_CANNON: 'piece-laser-cannon',
  LASER_TUBE:   'piece-laser-tube',
  MIRROR:       'piece-mirror',
  SPLITTER:     'piece-splitter',
};

// Draw a complete piece as an SVG <g> element.
//
// Artwork comes from the <symbol> elements authored in index.html (or
// the matching files in pieces/).  This function only adds the selection
// ring, applies player colours via CSS custom properties, and attaches
// the orientation tick — all purely programmatic concerns.
function drawPiece(piece, isSelected) {
  const [cx, cy] = cellCenter(piece.col, piece.row);
  const c        = PLAYER_COLORS[piece.player];
  const angleDeg = piece.rotation * 45;

  // The group's transform centres the piece on its cell and applies rotation.
  // CSS custom properties --pf / --ps propagate into the <use> shadow content
  // so the <symbol> artwork can reference them with var(--pf) / var(--ps).
  const group = el('g', {
    transform: `translate(${cx},${cy}) rotate(${angleDeg})`,
    style:     `--pf:${c.fill};--ps:${c.stroke}`,
    cursor:    'pointer',
  });

  // Selection ring — drawn at a fixed radius regardless of piece shape.
  if (isSelected) {
    group.appendChild(el('circle', {
      cx: 0, cy: 0, r: 28,
      fill: 'none', stroke: '#00ff99', 'stroke-width': 2, 'stroke-dasharray': '4 3',
    }));
  }

  // Piece artwork — referenced from the <symbol> in index.html.
  // x/y of -24 combined with width/height of 48 and the symbol's
  // viewBox="-24 -24 48 48" centres the artwork at the group's origin.
  group.appendChild(el('use', {
    href:   `#${PIECE_SYMBOL_ID[piece.type]}`,
    x: -24, y: -24, width: 48, height: 48,
  }));

  // Orientation tick — small line protruding from the local North edge,
  // so players can always see which way the piece is facing.
  group.appendChild(el('line', {
    x1: 0, y1: -24, x2: 0, y2: -30,
    stroke: c.highlight, 'stroke-width': 2, 'stroke-linecap': 'round',
  }));

  return group;
}

function drawLaserPaths(svg, game) {
  if (!game.laserPaths.length) return;
  const g = el('g', { id: 'laser-layer' });

  for (const lp of game.laserPaths) {
    const pts = [lp.origin, ...lp.path];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = cellCenter(pts[i].col,     pts[i].row);
      const [x2, y2] = cellCenter(pts[i + 1].col, pts[i + 1].row);
      g.appendChild(el('line', {
        x1, y1, x2, y2,
        stroke: '#ff4422', 'stroke-width': 2.5,
        'stroke-linecap': 'round', opacity: 0.85,
      }));
    }
  }
  svg.appendChild(g);
}

// ── Main render ───────────────────────────────────────────────────────────────
function render(game) {
  const svg = document.getElementById('board');
  const W   = game.cols * CELL_SIZE;
  const H   = game.rows * CELL_SIZE;

  svg.setAttribute('width',   W);
  svg.setAttribute('height',  H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  // ── Board grid ──
  const gridG = el('g');
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const x = c * CELL_SIZE, y = r * CELL_SIZE;
      const light = (r + c) % 2 === 0;
      gridG.appendChild(el('rect', {
        x, y, width: CELL_SIZE, height: CELL_SIZE,
        fill:   light ? '#1e2040' : '#161830',
        stroke: '#252545', 'stroke-width': 0.5,
      }));
    }
  }
  svg.appendChild(gridG);

  // ── Column / row coordinate labels ──
  const labelG = el('g');
  const labelStyle = { fill: '#3a4060', 'font-size': '9px', 'font-family': 'monospace', 'text-anchor': 'middle', 'pointer-events': 'none' };
  for (let c = 0; c < game.cols; c++) {
    const x = c * CELL_SIZE + CELL_SIZE / 2;
    labelG.appendChild(Object.assign(el('text', { ...labelStyle, x, y: 8 }), { textContent: c }));
  }
  for (let r = 0; r < game.rows; r++) {
    const y = r * CELL_SIZE + CELL_SIZE / 2 + 3;
    labelG.appendChild(Object.assign(el('text', { ...labelStyle, x: 6, y }), { textContent: r }));
  }
  svg.appendChild(labelG);

  // ── Laser paths (drawn under pieces) ──
  drawLaserPaths(svg, game);

  // ── Pieces ──
  const piecesG = el('g');
  for (const piece of game.pieces) {
    const pieceEl = drawPiece(piece, game.selected === piece);
    pieceEl.addEventListener('click', e => { e.stopPropagation(); onPieceClick(piece); });
    piecesG.appendChild(pieceEl);
  }
  svg.appendChild(piecesG);

  // ── Click on empty cell → move selected piece ──
  svg.onclick = onBoardClick;
}

function updateStatusUI(game) {
  const pi = document.getElementById('player-indicator');
  pi.textContent = `Player ${game.currentPlayer}'s Turn`;
  pi.className   = `player-${game.currentPlayer}`;

  document.getElementById('actions-count').textContent = game.actionsLeft;

  const hasSel = !!game.selected && game.phase === 'play' && game.actionsLeft > 0;
  document.getElementById('btn-rotate-ccw').disabled = !hasSel;
  document.getElementById('btn-rotate-cw').disabled  = !hasSel;
  document.getElementById('btn-fire').disabled        = game.phase !== 'play';

  const sel = game.selected;
  const info = document.getElementById('selected-piece-details');
  if (sel) {
    const td = sel.typeDef;
    info.innerHTML = `
      <b>${td.name}</b><br>
      Player: ${sel.player}<br>
      Position: ${sel.col}, ${sel.row}<br>
      Rotation: ${sel.rotation * 45}&deg;<br>
      ${td.laserSides.length ? '<em>Can fire laser</em><br>' : ''}
      ${td.canStomp         ? '<em>Can stomp</em>'          : ''}
    `;
  } else {
    info.textContent = 'Click a piece to select it.';
  }

  // Log
  const logEl = document.getElementById('log-entries');
  logEl.innerHTML = game._log.map(m => `<div>${m}</div>`).join('');

  // Game over
  if (game.phase === 'gameover') {
    document.getElementById('winner-text').textContent = `Player ${game.winner} Wins!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
  }
}

function fullUpdate(game) {
  render(game);
  updateStatusUI(game);
}

// ── Event handlers ────────────────────────────────────────────────────────────
let game; // global game instance

function onPieceClick(piece) {
  if (game.phase !== 'play') return;

  // If we have a selection and click an enemy → try to stomp
  if (game.selected && game.selected !== piece && piece.player !== game.currentPlayer) {
    const sel = game.selected;
    const dc  = piece.col - sel.col;
    const dr  = piece.row - sel.row;
    if (Math.abs(dc) <= 1 && Math.abs(dr) <= 1) {
      if (game.move(sel, dc, dr)) { fullUpdate(game); return; }
    }
  }

  // Toggle selection
  game.select(game.selected === piece ? null : piece);
  fullUpdate(game);
}

function onBoardClick(e) {
  if (game.phase !== 'play' || !game.selected) return;

  const svg  = document.getElementById('board');
  const rect = svg.getBoundingClientRect();
  const scaleX = game.cols * CELL_SIZE / rect.width;
  const scaleY = game.rows * CELL_SIZE / rect.height;
  const col  = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
  const row  = Math.floor((e.clientY - rect.top)  * scaleY / CELL_SIZE);

  if (!game.inBounds(col, row)) return;
  if (game.at(col, row)) return; // piece click handled by piece listener

  const sel = game.selected;
  const dc  = col - sel.col;
  const dr  = row - sel.row;
  if (Math.abs(dc) <= 1 && Math.abs(dr) <= 1 && (dc !== 0 || dr !== 0)) {
    game.move(sel, dc, dr);
    fullUpdate(game);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function initGame() {
  document.getElementById('game-over-modal').classList.add('hidden');
  game = new Game();
  setupDefault(game);
  game.log("--- Player 1's turn ---");
  game.log('Click a piece to select, then click a cell to move (1 action). Use rotate buttons to orient pieces.');
  fullUpdate(game);
}

function initControls() {
  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    if (game.selected) { game.rotate(game.selected, -1); fullUpdate(game); }
  });
  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    if (game.selected) { game.rotate(game.selected, 1); fullUpdate(game); }
  });
  document.getElementById('btn-fire').addEventListener('click', () => {
    game.fireLasers();
    fullUpdate(game);
    // Auto-clear laser overlay after 1.8 s
    setTimeout(() => { game.laserPaths = []; render(game); }, 1800);
  });
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    game.endTurn(); fullUpdate(game);
  });
  document.getElementById('btn-new-game').addEventListener('click', initGame);
  document.getElementById('btn-modal-new-game').addEventListener('click', initGame);
}

document.addEventListener('DOMContentLoaded', () => {
  initControls();
  initGame();
});
