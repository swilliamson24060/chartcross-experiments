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

export type Tile = SongTile | ArtistTile | WildcardTile;
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

export type ConnectionReason = "YEAR" | "PEAK" | "COLLAB" | "WILDCARD";

export const REASON_POINTS: Record<ConnectionReason, number> = {
  YEAR: 5,
  PEAK: 7,
  COLLAB: 20,
  WILDCARD: 0,
};

export interface ConnectionEdge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  reason: ConnectionReason;
  points: number;
}

export interface MoveResult {
  legal: boolean;
  reason?: string;
  edges: ConnectionEdge[];
  baseScore: number;
  multiplierApplied?: MultiplierType;
  connectionScore: number;
  tileValue: number;
  finalScore: number;
  status: GameStatus;
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
