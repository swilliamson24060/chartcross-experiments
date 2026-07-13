import {
  adjacentCells,
  CHART_BOOST_FLAT_BONUS,
  createEmptyBoard,
  multiplierFactor,
  pickTwoDistinctArtists,
  placeStarterAndAnchor,
  scatterMultipliers,
  tileMatchesMultiplierType,
} from "./board";
import { buildDataIndex, DataIndex, findCandidatesFor } from "./dataIndex";
import { isStarterPathConnectedToAnchor } from "./graph";
import { bestConnectionReason, connectionPoints } from "./moves";
import { createRng, pickRandom, randomInt } from "./rng";
import { tileValue } from "./tileValue";
import { Board, ConnectionEdge, Dataset, GameStatus, GRID_SIZE, MoveResult, Tile, WildcardTile } from "./types";

const RACK_SIZE = 5;
const CONNECTABLE_DRAW_BIAS = 0.8; // probability a refill favors a connectable tile
const WILDCARD_DRAW_CHANCE = 0.06; // probability a refill is a wildcard instead of a real tile

export interface GameState {
  board: Board;
  rack: Tile[];
  score: number;
  status: GameStatus;
  levelNumber: number;
  /** Points deducted from the score when the game ended; 0 while playing. */
  penaltyApplied: number;
}

export class GameEngine {
  private dataset: Dataset;
  private index: DataIndex;
  private rng: () => number;
  private board: Board;
  private rack: Tile[] = [];
  private usedIds = new Set<string>();
  private score = 0;
  private status: GameStatus = "playing";
  private penaltyApplied = 0;
  private levelNumber: number;
  private wildcardCounter = 0;

  constructor(dataset: Dataset, levelNumber: number, seed?: number) {
    this.dataset = dataset;
    this.index = buildDataIndex(dataset);
    this.rng = createRng(seed ?? levelNumber * 2654435761);
    this.levelNumber = levelNumber;
    this.board = createEmptyBoard();
    this.setup();
  }

  private setup() {
    const [starter, anchor] = pickTwoDistinctArtists(this.rng, this.dataset.artists);
    placeStarterAndAnchor(this.board, starter, anchor);
    this.usedIds.add(starter.id);
    this.usedIds.add(anchor.id);
    scatterMultipliers(this.board, this.rng);
    for (let i = 0; i < RACK_SIZE; i++) {
      const tile = this.drawTile();
      if (tile) this.rack.push(tile);
    }
    this.updateStatus();
  }

  /**
   * Checks for the two ways a game can end. "Bridged" is a pure board
   * condition (tiles are never removed, so once true it stays true) and is
   * checked first - if the board is already bridged there's no point
   * trying to rescue the rack. Otherwise we make a best effort to keep the
   * rack playable via ensurePlayableRack() before accepting "stuck".
   *
   * No-ops once the game is already over: both end states are terminal, so
   * this should only ever actually transition status once per game.
   */
  private updateStatus(): void {
    if (this.status !== "playing") return;
    if (isStarterPathConnectedToAnchor(this.board)) {
      this.endGame("bridged");
      return;
    }
    this.ensurePlayableRack();
    if (!this.hasAnyLegalMove()) {
      this.endGame("stuck");
    }
  }

  /** Ends the game and docks the score by the value of every tile left in the rack. */
  private endGame(status: "bridged" | "stuck"): void {
    this.status = status;
    this.penaltyApplied = this.rack.reduce((sum, t) => sum + tileValue(t), 0);
    this.score -= this.penaltyApplied;
  }

  /**
   * The weighted draw only biases toward connectable tiles, it doesn't
   * guarantee one. Swap rack slots until at least one has a legal
   * placement somewhere on the board, or give up after a bounded number
   * of attempts (a true dead end is possible late-game and is surfaced
   * via hasAnyLegalMove() for the UI to handle, e.g. offering a reshuffle).
   */
  private ensurePlayableRack(): void {
    let guard = 0;
    while (guard++ < RACK_SIZE * 6 && !this.hasAnyLegalMove()) {
      const idx = randomInt(this.rng, this.rack.length);
      const replacement = this.drawTile();
      if (!replacement) break;
      this.rack[idx] = replacement;
    }
  }

  hasAnyLegalMove(): boolean {
    for (let i = 0; i < this.rack.length; i++) {
      if (this.legalMovesForRackTile(i).length > 0) return true;
    }
    return false;
  }

  private allPlacedTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (const row of this.board) {
      for (const cell of row) {
        if (cell.tile) tiles.push(cell.tile);
      }
    }
    return tiles;
  }

  private connectableCandidates(): Tile[] {
    const placed = this.allPlacedTiles();
    const merged = new Set<Tile>();
    for (const p of placed) {
      for (const c of findCandidatesFor(p, this.dataset, this.index)) {
        merged.add(c);
      }
    }
    const result: Tile[] = [];
    for (const t of merged) {
      if (!this.usedIds.has(t.id) && !this.rack.some((r) => r.id === t.id)) {
        result.push(t);
      }
    }
    return result;
  }

  private createWildcardTile(): WildcardTile {
    return { kind: "WILDCARD", id: `wild-${this.wildcardCounter++}` };
  }

  private drawTile(): Tile | null {
    if (this.rng() < WILDCARD_DRAW_CHANCE) return this.createWildcardTile();

    const useConnectable = this.rng() < CONNECTABLE_DRAW_BIAS;
    if (useConnectable) {
      const candidates = this.connectableCandidates();
      if (candidates.length > 0) return pickRandom(this.rng, candidates);
    }
    // Fall back to a pure random draw from the full dataset.
    const pool: Tile[] = this.rng() < 0.5 ? this.dataset.songs : this.dataset.artists;
    let guard = 0;
    while (guard++ < 200) {
      const candidate = pickRandom(this.rng, pool);
      if (!this.usedIds.has(candidate.id) && !this.rack.some((r) => r.id === candidate.id)) {
        return candidate;
      }
    }
    return null;
  }

  getState(): GameState {
    return {
      board: this.board,
      rack: [...this.rack],
      score: this.score,
      status: this.status,
      levelNumber: this.levelNumber,
      penaltyApplied: this.penaltyApplied,
    };
  }

  /** All legal (row, col) targets for a given rack tile, with the score it would earn. */
  legalMovesForRackTile(tileIndex: number): Array<{ row: number; col: number; edges: ConnectionEdge[]; finalScore: number }> {
    const tile = this.rack[tileIndex];
    if (!tile) return [];
    const moves: Array<{ row: number; col: number; edges: ConnectionEdge[]; finalScore: number }> = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.board[row][col];
        if (cell.tile) continue;
        const preview = this.evaluatePlacement(tile, row, col);
        if (preview.edges.length > 0) {
          moves.push({ row, col, edges: preview.edges, finalScore: preview.finalScore });
        }
      }
    }
    return moves;
  }

  private evaluatePlacement(
    tile: Tile,
    row: number,
    col: number,
  ): { edges: ConnectionEdge[]; baseScore: number; connectionScore: number; tileValue: number; finalScore: number } {
    const edges: ConnectionEdge[] = [];
    for (const neighbor of adjacentCells(this.board, row, col)) {
      if (!neighbor.tile) continue;
      const reason = bestConnectionReason(tile, neighbor.tile);
      if (reason) {
        edges.push({
          fromRow: row,
          fromCol: col,
          toRow: neighbor.row,
          toCol: neighbor.col,
          reason,
          points: connectionPoints(reason),
        });
      }
    }
    const baseScore = edges.reduce((sum, e) => sum + e.points, 0);
    const cell = this.board[row][col];
    let connectionScore = baseScore;
    if (cell.multiplier && baseScore > 0 && tileMatchesMultiplierType(tile, cell.multiplier)) {
      connectionScore =
        cell.multiplier === "CHART_BOOST"
          ? baseScore + CHART_BOOST_FLAT_BONUS
          : baseScore * multiplierFactor(cell.multiplier);
    }
    const value = tileValue(tile);
    return { edges, baseScore, connectionScore, tileValue: value, finalScore: connectionScore + value };
  }

  placeTile(tileIndex: number, row: number, col: number): MoveResult {
    const tile = this.rack[tileIndex];
    const illegal = (reason: string): MoveResult => ({
      legal: false,
      reason,
      edges: [],
      baseScore: 0,
      connectionScore: 0,
      tileValue: 0,
      finalScore: 0,
      status: this.status,
    });

    if (this.status !== "playing") {
      return illegal(
        this.status === "bridged"
          ? "Game over — STARTER and END_ANCHOR are bridged by a path of touching tiles."
          : "Game over — no legal moves remain.",
      );
    }
    if (!tile) return illegal("No tile at that rack index.");
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return illegal("Cell out of bounds.");
    }
    const cell = this.board[row][col];
    if (cell.tile) return illegal("Cell already occupied.");

    const { edges, baseScore, connectionScore, tileValue: value, finalScore } = this.evaluatePlacement(
      tile,
      row,
      col,
    );
    if (edges.length === 0) {
      return illegal(
        "Must be orthogonally adjacent to a tile it shares a year, peak position, or collaboration with.",
      );
    }

    cell.tile = tile;
    this.usedIds.add(tile.id);
    this.rack.splice(tileIndex, 1);
    const refill = this.drawTile();
    if (refill) this.rack.push(refill);

    this.score += finalScore;
    this.updateStatus();

    return {
      legal: true,
      edges,
      baseScore,
      multiplierApplied: cell.multiplier,
      connectionScore,
      tileValue: value,
      finalScore,
      status: this.status,
    };
  }

  shuffleRack(): void {
    for (let i = this.rack.length - 1; i > 0; i--) {
      const j = randomInt(this.rng, i + 1);
      [this.rack[i], this.rack[j]] = [this.rack[j], this.rack[i]];
    }
  }
}
