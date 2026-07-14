import { Dataset, SongTile, Tile } from "./types";

export interface DataIndex {
  /** Every song a given artist ID performed on, keyed by that performer ID. */
  byPerformer: Map<string, SongTile[]>;
}

function addTo(map: Map<string, SongTile[]>, key: string, song: SongTile) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(song);
}

export function buildDataIndex(dataset: Dataset): DataIndex {
  const byPerformer = new Map<string, SongTile[]>();
  for (const song of dataset.songs) {
    for (const performerId of song.performerIds) {
      addTo(byPerformer, performerId, song);
    }
  }
  return { byPerformer };
}

/**
 * Every tile that would form a COLLAB connection with `tile` - ARTIST-ARTIST
 * only, via collaboratorIds (see moves.ts isCollab). A SongTile never has
 * COLLAB candidates of its own.
 */
export function findCollabCandidatesFor(tile: Tile, dataset: Dataset): Tile[] {
  if (tile.kind !== "ARTIST") return [];
  const result: Tile[] = [];
  for (const id of tile.collaboratorIds) {
    const a = dataset.artistById.get(id);
    if (a) result.push(a);
  }
  return result;
}

/**
 * Every tile that would form an ARTIST connection with `tile` - shared
 * performer, via performerIds (see moves.ts isSameArtist): other songs by
 * the same performer(s), or the performing artist's own tile.
 */
export function findArtistCandidatesFor(tile: Tile, dataset: Dataset, index: DataIndex): Set<Tile> {
  const result = new Set<Tile>();
  if (tile.kind === "SONG") {
    for (const performerId of tile.performerIds) {
      for (const song of index.byPerformer.get(performerId) ?? []) {
        if (song.id !== tile.id) result.add(song);
      }
      const artist = dataset.artistById.get(performerId);
      if (artist) result.add(artist);
    }
  } else if (tile.kind === "ARTIST") {
    for (const song of index.byPerformer.get(tile.id) ?? []) {
      result.add(song);
    }
  }
  return result;
}
