import { tileDecades } from "./moves";
import { ConnectionReason, Dataset, MatchableTile, SongTile } from "./types";

export interface DecadeExplanation {
  reason: "DECADE";
  /** This tile's full charted-decade list (one entry for a SONG, one per distinct decade across a career for an ARTIST), sorted ascending. */
  tileADecades: number[];
  tileBDecades: number[];
  /** The decade(s) both tiles share - always non-empty for a real DECADE connection. */
  sharedDecades: number[];
}

export interface ArtistExplanation {
  reason: "ARTIST";
  /** Both tiles are SONGs: the performer(s) credited on both. */
  sharedPerformerNames?: string[];
  /** One tile is an ARTIST, the other the SONG they performed. */
  artistName?: string;
  songTitle?: string;
}

export interface CollabExplanation {
  reason: "COLLAB";
  /** The song(s) both artists are jointly credited on. */
  songs: Array<{ id: string; title: string }>;
}

export interface WildcardExplanation {
  reason: "WILDCARD";
}

export type ConnectionExplanation =
  | DecadeExplanation
  | ArtistExplanation
  | CollabExplanation
  | WildcardExplanation;

function intersect<T>(a: T[], b: T[]): T[] {
  const set = new Set(a);
  return b.filter((v) => set.has(v));
}

/** Human-readable explanation of why two content tiles satisfy a given connection reason - powers the connector-tile info popup. */
export function explainConnection(
  tileA: MatchableTile,
  tileB: MatchableTile,
  reason: ConnectionReason,
  dataset: Dataset,
): ConnectionExplanation {
  if (reason === "WILDCARD") {
    return { reason: "WILDCARD" };
  }

  if (reason === "DECADE") {
    const tileADecades = tileDecades(tileA);
    const tileBDecades = tileDecades(tileB);
    return {
      reason: "DECADE",
      tileADecades,
      tileBDecades,
      sharedDecades: intersect(tileADecades, tileBDecades),
    };
  }

  if (reason === "COLLAB") {
    // Only ARTIST-ARTIST reaches here (see isCollab in moves.ts).
    const a = tileA.kind === "ARTIST" ? tileA : null;
    const b = tileB.kind === "ARTIST" ? tileB : null;
    const sharedSongIds = a && b ? intersect(a.songIds, b.songIds) : [];
    const songs = sharedSongIds
      .map((id) => dataset.songById.get(id))
      .filter((s): s is SongTile => !!s)
      .map((s) => ({ id: s.id, title: s.title }));
    return { reason: "COLLAB", songs };
  }

  // ARTIST
  if (tileA.kind === "SONG" && tileB.kind === "SONG") {
    const sharedPerformerIds = intersect(tileA.performerIds, tileB.performerIds);
    const sharedPerformerNames = sharedPerformerIds
      .map((id) => dataset.artistById.get(id)?.name)
      .filter((name): name is string => !!name);
    return { reason: "ARTIST", sharedPerformerNames };
  }
  const artist = tileA.kind === "ARTIST" ? tileA : tileB.kind === "ARTIST" ? tileB : null;
  const song = tileA.kind === "SONG" ? tileA : tileB.kind === "SONG" ? tileB : null;
  return { reason: "ARTIST", artistName: artist?.name, songTitle: song?.title };
}
