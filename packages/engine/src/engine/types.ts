export const GRID_SIZE = 7;

export interface SongTile {
  kind: "SONG";
  id: string;
  title: string;
  performerIds: string[];
  peakYear: number;
  peakPos: number;
  debutYear: number;
}

export interface ArtistTile {
  kind: "ARTIST";
  id: string;
  name: string;
  years: number[];
  peaks: number[];
  collaboratorIds: string[];
  songIds: string[];
}

export interface WildcardTile {
  kind: "WILDCARD";
  id: string;
}

/** One of the three always-available connection-type tiles. */
export type ConnectionCategory = "COLLAB" | "ARTIST" | "DECADE";

export const CONNECTION_CATEGORIES: ConnectionCategory[] = ["COLLAB", "ARTIST", "DECADE"];

export interface ConnectorTile {
  kind: "CONNECTOR";
  id: string;
  connectionType: ConnectionCategory;
}

export type Tile = SongTile | ArtistTile | WildcardTile | ConnectorTile;
export type MatchableTile = SongTile | ArtistTile;

export type MultiplierType =
  | "2X_SONG"
  | "3X_SONG"
  | "2X_ARTIST"
  | "3X_ARTIST"
  | "CHART_BOOST";

export type CellRole = "STARTER" | "END_ANCHOR";

export interface Cell {
  row: number;
  col: number;
  multiplier?: MultiplierType;
  tile?: Tile;
  role?: CellRole;
}

export type Board = Cell[][]; // board[row][col]

/**
 * "playing" until the game ends, which happens one of two ways - both are
 * penalties, there is no "win":
 *  - "bridged": STARTER and END_ANCHOR become joined by a path of merely
 *    touching (adjacent) placed tiles, whether or not they score anything
 *    together.
 *  - "stuck": no rack tile has any legal placement left.
 * Both are terminal - once set, no further placements are accepted, and
 * the player loses points equal to the value of every tile still in their
 * rack (see GameState.penaltyApplied).
 */
export type GameStatus = "playing" | "bridged" | "stuck";

export type ConnectionReason = ConnectionCategory | "WILDCARD";

export const REASON_POINTS: Record<ConnectionReason, number> = {
  DECADE: 5,
  ARTIST: 12,
  COLLAB: 20,
  WILDCARD: 0,
};

/** Points lost each time a connector guess is wrong; the pending gap stays open to retry. */
export const WRONG_CONNECTOR_PENALTY = 2;

export interface ConnectionEdge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  reason: ConnectionReason;
  points: number;
}

/**
 * A content tile has been placed two cells from an anchor tile, and the gap
 * cell between them is waiting for a connector guess via
 * GameEngine.placeConnector().
 */
export interface PendingConnector {
  contentRow: number;
  contentCol: number;
  gapRow: number;
  gapCol: number;
  anchorRow: number;
  anchorCol: number;
}

export interface PlaceTileResult {
  legal: boolean;
  reason?: string;
  /** True once the placement is fully scored - either it resolved immediately (wildcard) or a connector was never needed. False while a connector guess is pending. */
  resolved: boolean;
  pendingConnector?: PendingConnector;
  edge?: ConnectionEdge;
  /** Set only when landing on a bonus cell actually boosted the score. */
  multiplierApplied?: MultiplierType;
  /** Set when the tile landed on a bonus cell but the bonus didn't apply (wrong tile type, wildcard, or a zero-point connection). */
  multiplierMissed?: MultiplierType;
  connectionScore: number;
  tileValue: number;
  finalScore: number;
  status: GameStatus;
}

export interface PlaceConnectorResult {
  legal: boolean;
  reason?: string;
  /** Whether the guessed connection type matched the hidden required reason. */
  correct: boolean;
  /** Score change from this guess: -WRONG_CONNECTOR_PENALTY when wrong, the placement's finalScore when right. */
  pointsDelta: number;
  edge?: ConnectionEdge;
  multiplierApplied?: MultiplierType;
  multiplierMissed?: MultiplierType;
  connectionScore: number;
  tileValue: number;
  finalScore: number;
  status: GameStatus;
}

/** Cost in points to buy a wildcard tile via GameEngine.buyWildcard(). */
export const WILD_TILE_COST = 15;

export interface PurchaseResult {
  success: boolean;
  reason?: string;
  cost: number;
  scoreAfter: number;
}

export interface Dataset {
  songs: SongTile[];
  artists: ArtistTile[];
  songById: Map<string, SongTile>;
  artistById: Map<string, ArtistTile>;
}

export function buildDataset(
  rawSongs: Array<{
    id: string;
    title: string;
    performer_ids: string[];
    peak_year: number;
    peak_pos: number;
    debut_year: number;
  }>,
  rawArtists: Array<{
    id: string;
    name: string;
    years: number[];
    peaks: number[];
    collaborator_ids: string[];
    song_ids: string[];
  }>,
): Dataset {
  const songs: SongTile[] = rawSongs.map((s) => ({
    kind: "SONG",
    id: s.id,
    title: s.title,
    performerIds: s.performer_ids,
    peakYear: s.peak_year,
    peakPos: s.peak_pos,
    debutYear: s.debut_year,
  }));
  const artists: ArtistTile[] = rawArtists.map((a) => ({
    kind: "ARTIST",
    id: a.id,
    name: a.name,
    years: a.years,
    peaks: a.peaks,
    collaboratorIds: a.collaborator_ids,
    songIds: a.song_ids,
  }));
  return {
    songs,
    artists,
    songById: new Map(songs.map((s) => [s.id, s])),
    artistById: new Map(artists.map((a) => [a.id, a])),
  };
}
