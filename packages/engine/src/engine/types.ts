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

export type Tile = SongTile | ArtistTile;

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

export type ConnectionReason = "YEAR" | "PEAK" | "COLLAB";

export const REASON_POINTS: Record<ConnectionReason, number> = {
  YEAR: 5,
  PEAK: 7,
  COLLAB: 20,
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
  finalScore: number;
  won: boolean;
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
