import { ArtistTile, Dataset, SongTile, Tile } from "./types";

export interface DataIndex {
  byYear: Map<number, Tile[]>;
  byPeak: Map<number, Tile[]>;
}

function addTo(map: Map<number, Tile[]>, key: number, tile: Tile) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(tile);
}

export function buildDataIndex(dataset: Dataset): DataIndex {
  const byYear = new Map<number, Tile[]>();
  const byPeak = new Map<number, Tile[]>();

  for (const song of dataset.songs) {
    addTo(byYear, song.peakYear, song);
    addTo(byPeak, song.peakPos, song);
  }
  for (const artist of dataset.artists) {
    for (const y of artist.years) addTo(byYear, y, artist);
    for (const p of artist.peaks) addTo(byPeak, p, artist);
  }
  return { byYear, byPeak };
}

/**
 * All tiles that could legally connect to `tile` via ANY rule (year, peak,
 * or collaboration), independent of board geometry. Used to bias rack draws
 * toward a solvable board, not to validate an actual placement.
 */
export function findCandidatesFor(
  tile: Tile,
  dataset: Dataset,
  index: DataIndex,
): Set<Tile> {
  const result = new Set<Tile>();
  if (tile.kind === "WILDCARD" || tile.kind === "CONNECTOR") return result; // no year/peak/collab data to bias toward

  const years = tile.kind === "SONG" ? [tile.peakYear] : tile.years;
  const peaks = tile.kind === "SONG" ? [tile.peakPos] : tile.peaks;
  for (const y of years) for (const t of index.byYear.get(y) ?? []) result.add(t);
  for (const p of peaks) for (const t of index.byPeak.get(p) ?? []) result.add(t);

  if (tile.kind === "ARTIST") {
    for (const id of tile.collaboratorIds) {
      const a = dataset.artistById.get(id);
      if (a) result.add(a);
    }
    for (const id of tile.songIds) {
      const s = dataset.songById.get(id);
      if (s) result.add(s);
    }
  } else {
    for (const id of tile.performerIds) {
      const a = dataset.artistById.get(id);
      if (a) result.add(a);
    }
  }

  result.delete(tile);
  return result;
}
