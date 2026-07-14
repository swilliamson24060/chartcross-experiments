import {
  CHART_BOOST_FLAT_BONUS,
  createEmptyBoard,
  GapPair,
  gapNeighbors,
  hasWildRescueOption,
  multiplierFactor,
  pickTwoDistinctArtists,
  placeStarterAndAnchor,
  relocateMultiplier,
  scatterMultipliers,
  tileMatchesMultiplierType,
  wildGapPairing,
} from "./board";
import { buildDataIndex, DataIndex, findArtistCandidatesFor, findCollabCandidatesFor } from "./dataIndex";
import { isStarterPathConnectedToAnchor } from "./graph";
import { bestConnectionReason, connectionPoints } from "./moves";
import { createRng, pickRandom, randomInt } from "./rng";
import { tileValue } from "./tileValue";
import {
  Board,
  ConnectionCategory,
  ConnectionEdge,
  ConnectionReason,
  ConnectorTile,
  Dataset,
  GameStatus,
  GRID_SIZE,
  MultiplierType,
  PendingConnector,
  PendingWildRescue,
  PlaceConnectorResult,
  PlaceTileResult,
  PurchaseResult,
  Tile,
  WildRescueResult,
  WILD_TILE_COST,
  WildcardTile,
  WRONG_CONNECTOR_PENALTY,
} from "./types";

const RACK_SIZE = 5;
const COLLAB_DRAW_CHANCE = 0.1; // probability a refill looks for a COLLAB-connectable tile
const ARTIST_DRAW_CHANCE = 0.3; // probability a refill looks for an ARTIST-connectable tile

export interface GameState {
  board: Board;
  rack: Tile[];
  score: number;
  status: GameStatus;
  levelNumber: number;
  /** Points deducted from the score when the game ended; 0 while playing. */
  penaltyApplied: number;
  /** Set while a placed tile is waiting on a connector guess via placeConnector(). */
  pendingConnector: PendingConnector | null;
  /** Set while a wild-rescued gap is waiting on any rack tile via completeWildRescue(). */
  pendingWildRescue: PendingWildRescue | null;
  /** Wild connector charges bought via buyWildcard(), spendable with useWildcardConnector() or startWildRescue(). */
  wildcardConnectors: number;
  /**
   * True once no rack tile has a legal move and there's no wild rescue to
   * fall back on either (no charges, or no valid rescue spot on the
   * board). The player must buyWildcard() to open up a rescue, or call
   * endStuckGame() to give up. Always false with a guess or rescue already
   * pending - resolve those first.
   */
  awaitingStuckDecision: boolean;
}

interface BestGapEdge {
  gap: GapPair["gap"];
  anchor: GapPair["anchor"];
  reason: ConnectionCategory;
  points: number;
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
  private connectorCounter = 0;
  private wildcardConnectors = 0;
  private pendingConnector: PendingConnector | null = null;
  /** The hidden correct answer for the active pendingConnector; never exposed via getState(). */
  private pendingRequiredReason: ConnectionCategory | null = null;
  private pendingWildRescue: PendingWildRescue | null = null;

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
   * Checks for "bridged", the one way a game ends automatically. It's a
   * pure board condition (tiles are never removed, so once true it stays
   * true) - if the board is already bridged there's no point trying to
   * rescue the rack. Otherwise we make a best effort to keep the rack
   * playable via ensurePlayableRack().
   *
   * Running out of legal moves is *not* handled here anymore - it's no
   * longer an automatic ending. See GameState.awaitingStuckDecision: the
   * player either rescues via a wild connector (buyWildcard() then
   * startWildRescue()/completeWildRescue(), or useWildcardConnector() on an
   * existing pending guess) or explicitly gives up via endStuckGame().
   *
   * No-ops once the game is already over: "bridged" is terminal, so this
   * should only ever actually transition status once per game.
   */
  private updateStatus(): void {
    if (this.status !== "playing") return;
    if (isStarterPathConnectedToAnchor(this.board)) {
      this.endGame("bridged");
      return;
    }
    this.ensurePlayableRack();
  }

  private canWildRescue(): boolean {
    return this.wildcardConnectors > 0 && hasWildRescueOption(this.board);
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

  private unusedCandidates(merged: Set<Tile> | Tile[]): Tile[] {
    const result: Tile[] = [];
    for (const t of merged) {
      if (!this.usedIds.has(t.id) && !this.rack.some((r) => r.id === t.id)) {
        result.push(t);
      }
    }
    return result;
  }

  /** Every not-yet-drawn tile that would COLLAB-connect to something already on the board. */
  private collabCandidates(): Tile[] {
    const merged = new Set<Tile>();
    for (const p of this.allPlacedTiles()) {
      for (const c of findCollabCandidatesFor(p, this.dataset)) merged.add(c);
    }
    return this.unusedCandidates(merged);
  }

  /** Every not-yet-drawn tile that would ARTIST-connect to something already on the board. */
  private artistCandidates(): Tile[] {
    const merged = new Set<Tile>();
    for (const p of this.allPlacedTiles()) {
      for (const c of findArtistCandidatesFor(p, this.dataset, this.index)) merged.add(c);
    }
    return this.unusedCandidates(merged);
  }

  /**
   * The link coords are optional only so bare test/preview objects can omit
   * them - every real gap-fill placement always passes the two cells it
   * links, since getAllConnections() reads them directly rather than
   * inferring from adjacency (see WildcardTile.contentRow).
   */
  private createWildcardTile(link?: { contentRow: number; contentCol: number; anchorRow: number; anchorCol: number }): WildcardTile {
    return { kind: "WILDCARD", id: `wild-${this.wildcardCounter++}`, ...link };
  }

  private createConnectorTile(
    connectionType: ConnectionCategory,
    link: { contentRow: number; contentCol: number; anchorRow: number; anchorCol: number },
  ): ConnectorTile {
    return { kind: "CONNECTOR", id: `connector-${this.connectorCounter++}`, connectionType, ...link };
  }

  /**
   * Wildcards are never drawn - they're only obtainable via buyWildcard()
   * and only ever usable as a connector (see useWildcardConnector()), not
   * as a rack tile a player places directly.
   *
   * The rest of the time (COLLAB_DRAW_CHANCE + ARTIST_DRAW_CHANCE = 40%),
   * this looks for a tile that would connect to something already on the
   * board via that specific category, biasing toward a solvable board -
   * COLLAB is checked first since it's rarer and worth more. Falls through
   * to a pure random draw whenever the roll misses both, or the biased
   * pool for that category comes up empty.
   */
  private drawTile(): Tile | null {
    const roll = this.rng();
    if (roll < COLLAB_DRAW_CHANCE) {
      const candidates = this.collabCandidates();
      if (candidates.length > 0) return pickRandom(this.rng, candidates);
    } else if (roll < COLLAB_DRAW_CHANCE + ARTIST_DRAW_CHANCE) {
      const candidates = this.artistCandidates();
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
      pendingConnector: this.pendingConnector,
      pendingWildRescue: this.pendingWildRescue,
      wildcardConnectors: this.wildcardConnectors,
      awaitingStuckDecision:
        this.status === "playing" &&
        !this.pendingConnector &&
        !this.pendingWildRescue &&
        !this.hasAnyLegalMove() &&
        !this.canWildRescue(),
    };
  }

  /** Tops the rack back up to RACK_SIZE after a tile leaves it. */
  private refillRack(): void {
    if (this.rack.length < RACK_SIZE) {
      const refill = this.drawTile();
      if (refill) this.rack.push(refill);
    }
  }

  /**
   * Among the empty-gap/occupied-anchor pairs gapNeighbors() finds around
   * (row, col), the single highest-scoring one this tile could legally
   * connect through, or null if none match. Only one edge is ever used per
   * placement - unlike the old adjacency rule, connections aren't summed.
   *
   * A previously-placed wildcard or connector tile is never a valid anchor
   * here (bestConnectionReason() already returns null for them) - a wild
   * connector links only its own original two neighbors, once, and is
   * otherwise inert for new placements.
   */
  private bestGapEdge(tile: Tile, row: number, col: number): BestGapEdge | null {
    let best: BestGapEdge | null = null;
    for (const { gap, anchor } of gapNeighbors(this.board, row, col)) {
      const reason = bestConnectionReason(tile, anchor.tile!);
      if (!reason || reason === "WILDCARD") continue;
      const points = connectionPoints(reason);
      if (!best || points > best.points) {
        best = { gap, anchor, reason, points };
      }
    }
    return best;
  }

  /** The score a correct connector guess would earn for this tile/edge, factoring in the landing cell's multiplier. */
  private scoreForEdge(
    tile: Tile,
    landingCell: { multiplier?: MultiplierType },
    points: number,
  ): { connectionScore: number; tileValue: number; finalScore: number; multiplierApplied?: MultiplierType; multiplierMissed?: MultiplierType } {
    let connectionScore = points;
    let multiplierApplied: MultiplierType | undefined;
    let multiplierMissed: MultiplierType | undefined;
    if (landingCell.multiplier) {
      if (points > 0 && tileMatchesMultiplierType(tile, landingCell.multiplier)) {
        connectionScore =
          landingCell.multiplier === "CHART_BOOST"
            ? points + CHART_BOOST_FLAT_BONUS
            : points * multiplierFactor(landingCell.multiplier);
        multiplierApplied = landingCell.multiplier;
      } else {
        multiplierMissed = landingCell.multiplier;
      }
    }
    const value = tileValue(tile);
    return { connectionScore, tileValue: value, finalScore: connectionScore + value, multiplierApplied, multiplierMissed };
  }

  /** All legal (row, col) targets for a given rack tile, with the score a correct connector guess would earn. */
  legalMovesForRackTile(tileIndex: number): Array<{ row: number; col: number; edges: ConnectionEdge[]; finalScore: number }> {
    const tile = this.rack[tileIndex];
    if (!tile || this.pendingConnector || this.pendingWildRescue) return [];
    const moves: Array<{ row: number; col: number; edges: ConnectionEdge[]; finalScore: number }> = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.board[row][col].tile) continue;
        const best = this.bestGapEdge(tile, row, col);
        if (!best) continue;
        const edge: ConnectionEdge = {
          fromRow: row,
          fromCol: col,
          toRow: best.anchor.row,
          toCol: best.anchor.col,
          reason: best.reason,
          points: best.points,
        };
        const { finalScore } = this.scoreForEdge(tile, this.board[row][col], best.points);
        moves.push({ row, col, edges: [edge], finalScore });
      }
    }
    return moves;
  }

  placeTile(tileIndex: number, row: number, col: number): PlaceTileResult {
    const tile = this.rack[tileIndex];
    const illegal = (reason: string): PlaceTileResult => ({
      legal: false,
      reason,
      resolved: false,
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
    if (this.pendingConnector) {
      return illegal("Resolve the pending connector guess before placing another tile.");
    }
    if (this.pendingWildRescue) {
      return illegal("Resolve the pending rescue placement before placing another tile.");
    }
    if (!tile) return illegal("No tile at that rack index.");
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return illegal("Cell out of bounds.");
    }
    const cell = this.board[row][col];
    if (cell.tile) return illegal("Cell already occupied.");

    const best = this.bestGapEdge(tile, row, col);
    if (!best) {
      return illegal(
        "Must be exactly two cells from a tile it can connect to, with an empty gap between them.",
      );
    }

    cell.tile = tile;
    this.usedIds.add(tile.id);
    this.rack.splice(tileIndex, 1);

    // A real connection type is required - don't score or reveal the
    // answer yet. The gap cell and content tile stay on the board while
    // placeConnector() waits for a guess.
    this.pendingConnector = {
      contentRow: row,
      contentCol: col,
      gapRow: best.gap.row,
      gapCol: best.gap.col,
      anchorRow: best.anchor.row,
      anchorCol: best.anchor.col,
    };
    this.pendingRequiredReason = best.reason;

    return {
      legal: true,
      resolved: false,
      pendingConnector: this.pendingConnector,
      connectionScore: 0,
      tileValue: 0,
      finalScore: 0,
      status: this.status,
    };
  }

  /**
   * Answers the active pendingConnector with a guessed connection type. A
   * wrong guess costs WRONG_CONNECTOR_PENALTY and leaves the pending gap
   * open to retry; a correct guess fills the gap, scores the placement, and
   * refills the rack.
   */
  placeConnector(guess: ConnectionCategory): PlaceConnectorResult {
    const illegal = (reason: string): PlaceConnectorResult => ({
      legal: false,
      reason,
      correct: false,
      pointsDelta: 0,
      connectionScore: 0,
      tileValue: 0,
      finalScore: 0,
      status: this.status,
    });

    if (this.status !== "playing") {
      return illegal("Game over — no more moves allowed.");
    }
    if (!this.pendingConnector || !this.pendingRequiredReason) {
      return illegal("No connector placement is pending.");
    }

    const pending = this.pendingConnector;
    const required = this.pendingRequiredReason;

    if (guess !== required) {
      this.score -= WRONG_CONNECTOR_PENALTY;
      return {
        legal: true,
        correct: false,
        pointsDelta: -WRONG_CONNECTOR_PENALTY,
        connectionScore: 0,
        tileValue: 0,
        finalScore: 0,
        status: this.status,
      };
    }

    const contentCell = this.board[pending.contentRow][pending.contentCol];
    const gapCell = this.board[pending.gapRow][pending.gapCol];
    const tile = contentCell.tile!;
    const points = connectionPoints(required);
    const { connectionScore, tileValue: value, finalScore, multiplierApplied, multiplierMissed } =
      this.scoreForEdge(tile, contentCell, points);

    gapCell.tile = this.createConnectorTile(required, {
      contentRow: pending.contentRow,
      contentCol: pending.contentCol,
      anchorRow: pending.anchorRow,
      anchorCol: pending.anchorCol,
    });
    relocateMultiplier(this.board, this.rng, gapCell);
    this.score += finalScore;
    this.pendingConnector = null;
    this.pendingRequiredReason = null;
    this.refillRack();
    this.updateStatus();

    return {
      legal: true,
      correct: true,
      pointsDelta: finalScore,
      edge: {
        fromRow: pending.contentRow,
        fromCol: pending.contentCol,
        toRow: pending.anchorRow,
        toCol: pending.anchorCol,
        reason: required,
        points,
      },
      multiplierApplied,
      multiplierMissed,
      connectionScore,
      tileValue: value,
      finalScore,
      status: this.status,
    };
  }

  /**
   * Spends one bought wild connector charge to resolve the active
   * pendingConnector without guessing - always succeeds, but scores the
   * connection at 0 points (same as any other wildcard connection) since
   * it's a rescue tool, not a scoring play.
   */
  useWildcardConnector(): PlaceConnectorResult {
    const illegal = (reason: string): PlaceConnectorResult => ({
      legal: false,
      reason,
      correct: false,
      pointsDelta: 0,
      connectionScore: 0,
      tileValue: 0,
      finalScore: 0,
      status: this.status,
    });

    if (this.status !== "playing") {
      return illegal("Game over — no more moves allowed.");
    }
    if (!this.pendingConnector) {
      return illegal("No connector placement is pending.");
    }
    if (this.wildcardConnectors <= 0) {
      return illegal("No wild connectors available — buy one first.");
    }

    const pending = this.pendingConnector;
    const contentCell = this.board[pending.contentRow][pending.contentCol];
    const gapCell = this.board[pending.gapRow][pending.gapCol];
    const tile = contentCell.tile!;
    const { connectionScore, tileValue: value, finalScore } = this.scoreForEdge(tile, contentCell, 0);

    gapCell.tile = this.createWildcardTile({
      contentRow: pending.contentRow,
      contentCol: pending.contentCol,
      anchorRow: pending.anchorRow,
      anchorCol: pending.anchorCol,
    });
    relocateMultiplier(this.board, this.rng, gapCell);
    this.wildcardConnectors--;
    this.score += finalScore;
    this.pendingConnector = null;
    this.pendingRequiredReason = null;
    this.refillRack();
    this.updateStatus();

    return {
      legal: true,
      correct: true,
      pointsDelta: finalScore,
      edge: {
        fromRow: pending.contentRow,
        fromCol: pending.contentCol,
        toRow: pending.anchorRow,
        toCol: pending.anchorCol,
        reason: "WILDCARD",
        points: 0,
      },
      connectionScore,
      tileValue: value,
      finalScore,
      status: this.status,
    };
  }

  /**
   * Every empty cell that could currently serve as a rescue gap - a placed
   * tile immediately on one side, empty space immediately on the other.
   * Only meaningful while hasAnyLegalMove() is false; the UI uses this to
   * highlight valid taps for startWildRescue().
   */
  legalWildRescueGapCells(): Array<{ row: number; col: number }> {
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.board[row][col].tile) continue;
        if (wildGapPairing(this.board, row, col)) cells.push({ row, col });
      }
    }
    return cells;
  }

  /**
   * Last-resort rescue when no rack tile has a real legal move: drops a
   * wild connector into (row, col) - which must be empty, with a placed
   * tile on one side and empty space on the other - then waits for any
   * rack tile via completeWildRescue(). Only offered while stuck (see
   * updateStatus()/canWildRescue()), so it's blocked otherwise to keep it
   * a genuine last resort rather than a shortcut around real placements.
   */
  startWildRescue(row: number, col: number): WildRescueResult {
    const illegal = (reason: string): WildRescueResult => ({ legal: false, reason, status: this.status });

    if (this.status !== "playing") {
      return illegal(
        this.status === "bridged"
          ? "Game over — STARTER and END_ANCHOR are bridged by a path of touching tiles."
          : "Game over — no legal moves remain.",
      );
    }
    if (this.pendingConnector) {
      return illegal("Resolve the pending connector guess before starting a rescue.");
    }
    if (this.pendingWildRescue) {
      return illegal("A rescue placement is already pending.");
    }
    if (this.hasAnyLegalMove()) {
      return illegal("A rescue is only available when no tile has a legal move.");
    }
    if (this.wildcardConnectors <= 0) {
      return illegal("No wild connectors available — buy one first.");
    }
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return illegal("Cell out of bounds.");
    }

    const pairing = wildGapPairing(this.board, row, col);
    if (!pairing) {
      return illegal("That cell must be empty, next to a placed tile, with empty space on the far side.");
    }

    pairing.gap.tile = this.createWildcardTile({
      contentRow: pairing.content.row,
      contentCol: pairing.content.col,
      anchorRow: pairing.anchor.row,
      anchorCol: pairing.anchor.col,
    });
    relocateMultiplier(this.board, this.rng, pairing.gap);
    this.wildcardConnectors--;
    this.pendingWildRescue = {
      gapRow: pairing.gap.row,
      gapCol: pairing.gap.col,
      contentRow: pairing.content.row,
      contentCol: pairing.content.col,
      anchorRow: pairing.anchor.row,
      anchorCol: pairing.anchor.col,
    };

    return { legal: true, status: this.status };
  }

  /**
   * Finishes an active rescue by dropping any rack tile into the
   * predetermined content cell - no match is required. Scores nothing: a
   * rescue is a lifeline to keep the game going, not a way to earn points.
   * Relocates a multiplier on the content cell rather than wasting it,
   * same as every other non-scoring placement.
   */
  completeWildRescue(tileIndex: number): WildRescueResult {
    const illegal = (reason: string): WildRescueResult => ({ legal: false, reason, status: this.status });

    if (this.status !== "playing") {
      return illegal("Game over — no more moves allowed.");
    }
    if (!this.pendingWildRescue) {
      return illegal("No rescue placement is pending.");
    }
    const tile = this.rack[tileIndex];
    if (!tile) return illegal("No tile at that rack index.");

    const pending = this.pendingWildRescue;
    const contentCell = this.board[pending.contentRow][pending.contentCol];

    contentCell.tile = tile;
    this.usedIds.add(tile.id);
    this.rack.splice(tileIndex, 1);
    relocateMultiplier(this.board, this.rng, contentCell);
    this.pendingWildRescue = null;
    this.refillRack();
    this.updateStatus();

    return { legal: true, status: this.status };
  }

  shuffleRack(): void {
    for (let i = this.rack.length - 1; i > 0; i--) {
      const j = randomInt(this.rng, i + 1);
      [this.rack[i], this.rack[j]] = [this.rack[j], this.rack[i]];
    }
  }

  /**
   * Spends WILD_TILE_COST points for one wild connector charge, spendable
   * via useWildcardConnector() to resolve a pending guess for free.
   * Repeatable as long as the player can afford it.
   */
  buyWildcard(): PurchaseResult {
    if (this.status !== "playing") {
      return { success: false, reason: "Game over — no purchases allowed.", cost: WILD_TILE_COST, scoreAfter: this.score };
    }
    if (this.score < WILD_TILE_COST) {
      return {
        success: false,
        reason: `Not enough points — buying a wild connector costs ${WILD_TILE_COST}.`,
        cost: WILD_TILE_COST,
        scoreAfter: this.score,
      };
    }
    this.score -= WILD_TILE_COST;
    this.wildcardConnectors++;
    return { success: true, cost: WILD_TILE_COST, scoreAfter: this.score };
  }

  /**
   * Voluntarily ends the game while stuck with no wild rescue available -
   * the alternative to buyWildcard() (see GameState.awaitingStuckDecision).
   * Docks the same rack-value penalty as any other stuck ending.
   */
  endStuckGame(): WildRescueResult {
    const illegal = (reason: string): WildRescueResult => ({ legal: false, reason, status: this.status });

    if (this.status !== "playing") {
      return illegal("Game is already over.");
    }
    if (this.pendingConnector || this.pendingWildRescue) {
      return illegal("Resolve the pending connector guess or rescue placement first.");
    }
    if (this.hasAnyLegalMove() || this.canWildRescue()) {
      return illegal("A move is still available - this is only for when you're truly stuck.");
    }

    this.endGame("stuck");
    return { legal: true, status: this.status };
  }
}
