import { pickRandom, randomInt } from "./rng";
import { ArtistTile, Board, Cell, GRID_SIZE, MultiplierType, Tile } from "./types";

export const STARTER_POS = { row: GRID_SIZE - 1, col: 0 };
export const END_ANCHOR_POS = { row: 0, col: GRID_SIZE - 1 };

// Randomized fresh every level: how many multiplier cells to scatter and
// their relative frequency. Tunable without touching placement logic.
const MULTIPLIER_WEIGHTS: Array<{ type: MultiplierType; weight: number }> = [
  { type: "2X_SONG", weight: 5 },
  { type: "2X_ARTIST", weight: 4 },
  { type: "3X_SONG", weight: 2 },
  { type: "3X_ARTIST", weight: 3 },
  { type: "CHART_BOOST", weight: 2 },
];
// ~20% of non-starter/anchor cells get a multiplier, scaled to board size
// rather than a fixed count so this stays sane if GRID_SIZE changes.
const MULTIPLIER_CELL_RATIO = 0.2;

export function createEmptyBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      rowCells.push({ row, col });
    }
    board.push(rowCells);
  }
  return board;
}

function weightedMultiplierType(rng: () => number): MultiplierType {
  const total = MULTIPLIER_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const { type, weight } of MULTIPLIER_WEIGHTS) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return MULTIPLIER_WEIGHTS[MULTIPLIER_WEIGHTS.length - 1].type;
}

export function scatterMultipliers(board: Board, rng: () => number): void {
  const eligible: Cell[] = [];
  for (const row of board) {
    for (const cell of row) {
      const isStarter = cell.row === STARTER_POS.row && cell.col === STARTER_POS.col;
      const isAnchor = cell.row === END_ANCHOR_POS.row && cell.col === END_ANCHOR_POS.col;
      if (!isStarter && !isAnchor) eligible.push(cell);
    }
  }
  const count = Math.round(eligible.length * MULTIPLIER_CELL_RATIO);
  for (let i = 0; i < count; i++) {
    const idx = randomInt(rng, eligible.length);
    const cell = eligible.splice(idx, 1)[0];
    cell.multiplier = weightedMultiplierType(rng);
  }
}

export function placeStarterAndAnchor(
  board: Board,
  starter: ArtistTile,
  endAnchor: ArtistTile,
): void {
  const starterCell = board[STARTER_POS.row][STARTER_POS.col];
  starterCell.tile = starter;
  starterCell.role = "STARTER";

  const anchorCell = board[END_ANCHOR_POS.row][END_ANCHOR_POS.col];
  anchorCell.tile = endAnchor;
  anchorCell.role = "END_ANCHOR";
}

export function pickTwoDistinctArtists(
  rng: () => number,
  artists: ArtistTile[],
): [ArtistTile, ArtistTile] {
  const a = pickRandom(rng, artists);
  let b = pickRandom(rng, artists);
  let guard = 0;
  while (b.id === a.id && guard++ < 1000) {
    b = pickRandom(rng, artists);
  }
  return [a, b];
}

export function adjacentCells(board: Board, row: number, col: number): Cell[] {
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const result: Cell[] = [];
  for (const [dr, dc] of deltas) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      result.push(board[r][c]);
    }
  }
  return result;
}

export function tileMatchesMultiplierType(tile: Tile, type: MultiplierType): boolean {
  if (type === "CHART_BOOST") return true;
  if (type === "2X_SONG" || type === "3X_SONG") return tile.kind === "SONG";
  return tile.kind === "ARTIST";
}

export function multiplierFactor(type: MultiplierType): number {
  switch (type) {
    case "2X_SONG":
    case "2X_ARTIST":
      return 2;
    case "3X_SONG":
    case "3X_ARTIST":
      return 3;
    case "CHART_BOOST":
      return 1; // flat bonus handled separately, not a multiplier
  }
}

export const CHART_BOOST_FLAT_BONUS = 10;
