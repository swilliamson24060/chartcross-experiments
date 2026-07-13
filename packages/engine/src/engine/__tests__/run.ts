import { loadLocalDataset } from "../loadLocalDataset";
import { createEmptyBoard, placeStarterAndAnchor, tileMatchesMultiplierType } from "../board";
import { GRID_SIZE } from "../types";
import { bestConnectionReason, connectionPoints } from "../moves";
import { isStarterPathConnectedToAnchor } from "../graph";
import { GameEngine } from "../engine";
import { decadePoints, tileValue } from "../tileValue";
import { getAllConnections } from "../connections";
import { ArtistTile, SongTile, Dataset, MoveResult, WildcardTile } from "../types";

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

function findArtist(dataset: Dataset, name: string): ArtistTile {
  const a = dataset.artists.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!a) throw new Error(`artist not found: ${name}`);
  return a;
}

function findSong(dataset: Dataset, title: string, performerSubstr: string): SongTile {
  const s = dataset.songs.find(
    (x) =>
      x.title.toLowerCase() === title.toLowerCase() &&
      x.performerIds.some((id) => {
        const a = dataset.artistById.get(id);
        return a && a.name.toLowerCase().includes(performerSubstr.toLowerCase());
      }),
  );
  if (!s) throw new Error(`song not found: ${title} / ${performerSubstr}`);
  return s;
}

const dataset = loadLocalDataset();
console.log(`Loaded ${dataset.songs.length} songs, ${dataset.artists.length} artists.\n`);

console.log("Mockup scenario checks:");
{
  const ladyGaga = findArtist(dataset, "Lady Gaga");
  const brunoMars = findArtist(dataset, "Bruno Mars");
  const markRonson = findArtist(dataset, "Mark Ronson");
  const kendrickLamar = findArtist(dataset, "Kendrick Lamar");
  const amyWinehouse = findArtist(dataset, "Amy Winehouse");
  const dieWithASmile = findSong(dataset, "Die With A Smile", "Lady Gaga");
  const uptownFunk = findSong(dataset, "Uptown Funk!", "Mark Ronson");
  const humble = findSong(dataset, "Humble.", "Kendrick Lamar");
  const cruelSummerTaylor = findSong(dataset, "Cruel Summer", "Taylor Swift");
  const cruelSummerBananarama = findSong(dataset, "Cruel Summer", "Bananarama");

  check("Lady Gaga -> Die With A Smile is COLLAB", bestConnectionReason(ladyGaga, dieWithASmile) === "COLLAB");
  check("Bruno Mars -> Uptown Funk is COLLAB", bestConnectionReason(brunoMars, uptownFunk) === "COLLAB");
  check("Mark Ronson -> Uptown Funk is COLLAB", bestConnectionReason(markRonson, uptownFunk) === "COLLAB");
  check("Kendrick Lamar -> Humble. is COLLAB", bestConnectionReason(kendrickLamar, humble) === "COLLAB");
  check(
    "Two different Cruel Summer songs do not COLLAB (song-song has no collab tier)",
    bestConnectionReason(cruelSummerTaylor, cruelSummerBananarama) !== "COLLAB",
  );
  check(
    "Amy Winehouse does not directly collaborate with Mark Ronson's Uptown Funk credit unless co-credited",
    bestConnectionReason(amyWinehouse, uptownFunk) !== "COLLAB",
  );
}

console.log("\nBoard + adjacency + bridge-check:");
{
  const board = createEmptyBoard();
  const starter = findArtist(dataset, "Lady Gaga");
  const anchor = findArtist(dataset, "Amy Winehouse");
  placeStarterAndAnchor(board, starter, anchor);

  check("Starter placed bottom-left", board[GRID_SIZE - 1][0].tile?.id === starter.id);
  check("Anchor placed top-right", board[0][GRID_SIZE - 1].tile?.id === anchor.id);
  check("Not yet bridged", !isStarterPathConnectedToAnchor(board));

  // Hand-build a straight adjacent chain across row GRID_SIZE-1 upward to
  // prove the pure-adjacency bridge check works (still short of the anchor).
  const dieWithASmile = findSong(dataset, "Die With A Smile", "Lady Gaga");
  board[GRID_SIZE - 1][1].tile = dieWithASmile; // adjacent to starter, COLLAB match
  check("Still not bridged (chain incomplete)", !isStarterPathConnectedToAnchor(board));

  // Directly wire a matching path up to the anchor's row/col to validate BFS,
  // using Bruno Mars (co-credited on Die With A Smile) then a song/artist
  // chain that eventually reaches Amy Winehouse's own year/peak set.
  const brunoMars = findArtist(dataset, "Bruno Mars");
  board[GRID_SIZE - 2][1].tile = brunoMars; // adjacent above dieWithASmile, COLLAB match
  check(
    "Bruno Mars connects up from Die With A Smile",
    bestConnectionReason(dieWithASmile, brunoMars) === "COLLAB",
  );

  const connections = getAllConnections(board);
  check("getAllConnections finds exactly the 2 matching adjacent pairs", connections.length === 2);
  check(
    "Every found connection is COLLAB worth 20 points",
    connections.every((c) => c.reason === "COLLAB" && c.points === 20),
  );
  const tileIds = new Set(connections.flatMap((c) => [c.tileA.id, c.tileB.id]));
  check(
    "Connections reference starter, Die With A Smile, and Bruno Mars",
    tileIds.has(starter.id) && tileIds.has(dieWithASmile.id) && tileIds.has(brunoMars.id),
  );
  check("Amy Winehouse (isolated anchor) has no connections yet", !tileIds.has(anchor.id));

  // Carve a full path of *unrelated* tiles from STARTER to END_ANCHOR - none
  // of them match their neighbors on year/peak/collab, only touch. This is
  // the exact scenario the bridge rule targets: "even if there are no
  // connections between some of the tiles."
  const pathBoard = createEmptyBoard();
  placeStarterAndAnchor(pathBoard, starter, anchor);
  const filler = dataset.songs
    .filter((s) => s.id !== dieWithASmile.id)
    .slice(0, GRID_SIZE - 2 + GRID_SIZE - 1); // enough unrelated songs to fill an L-shaped path
  let fillerIdx = 0;
  for (let row = GRID_SIZE - 2; row >= 0; row--) {
    pathBoard[row][0].tile = filler[fillerIdx++];
  }
  for (let col = 1; col < GRID_SIZE - 1; col++) {
    pathBoard[0][col].tile = filler[fillerIdx++];
  }
  check(
    "Unrelated, non-matching tiles still bridge STARTER to END_ANCHOR by touching alone",
    isStarterPathConnectedToAnchor(pathBoard),
  );
  const pathConnections = getAllConnections(pathBoard);
  check(
    "...even though most of those adjacent pairs score no scoring connection at all",
    pathConnections.length < filler.length,
  );
}

console.log("\nGameEngine integration:");
{
  const engine = new GameEngine(dataset, 45, 12345);
  const state = engine.getState();
  check("Rack has 5 tiles at start", state.rack.length === 5);
  check("Starter tile present", !!state.board[GRID_SIZE - 1][0].tile);
  check("Anchor tile present", !!state.board[0][GRID_SIZE - 1].tile);

  const illegal = engine.placeTile(0, 4, 4); // middle of empty board, not adjacent to anything placed
  check("Placing in the empty middle of the board is illegal", illegal.legal === false);

  // Try every non-wildcard rack tile against every legal move surfaced by
  // the engine itself; if any exist, placing one should succeed and score
  // > 0 (wildcards always score 0, so they're excluded from this check and
  // covered separately below).
  let placedOk = false;
  for (let i = 0; i < engine.getState().rack.length && !placedOk; i++) {
    if (engine.getState().rack[i].kind === "WILDCARD") continue;
    const moves = engine.legalMovesForRackTile(i);
    if (moves.length > 0) {
      const move = moves[0];
      const result = engine.placeTile(i, move.row, move.col);
      check(`Legal move for rack tile ${i} succeeds`, result.legal === true);
      check(`Legal move scores > 0`, result.finalScore > 0);
      placedOk = true;
    }
  }
  check("At least one legal move was available and played from the starting rack", placedOk);
  check("Rack refilled back to 5 after a placement", engine.getState().rack.length === 5);
}

console.log("\nWildcard tile checks:");
{
  const wildcard: WildcardTile = { kind: "WILDCARD", id: "wild-test" };
  const brunoMars = findArtist(dataset, "Bruno Mars");
  const uptownFunk = findSong(dataset, "Uptown Funk!", "Mark Ronson");

  check("Wildcard connects to an artist", bestConnectionReason(wildcard, brunoMars) === "WILDCARD");
  check("Wildcard connects to a song", bestConnectionReason(uptownFunk, wildcard) === "WILDCARD");
  check("Wildcard connection is worth 0 points", connectionPoints("WILDCARD") === 0);
  check("Wildcard never triggers a multiplier", !tileMatchesMultiplierType(wildcard, "2X_SONG"));
  check(
    "Wildcard never triggers CHART_BOOST either",
    !tileMatchesMultiplierType(wildcard, "CHART_BOOST"),
  );

  // Find a seed whose starting rack actually contains a wildcard, then
  // play it end-to-end through the real engine to prove the full path
  // (draw -> legal move enumeration -> placement -> scoring) works.
  let wildcardEngine: GameEngine | null = null;
  let wildcardIndex = -1;
  for (let seed = 0; seed < 2000 && !wildcardEngine; seed++) {
    const candidate = new GameEngine(dataset, 1, seed);
    const idx = candidate.getState().rack.findIndex((t) => t.kind === "WILDCARD");
    if (idx !== -1) {
      wildcardEngine = candidate;
      wildcardIndex = idx;
    }
  }

  if (wildcardEngine && wildcardIndex !== -1) {
    const moves = wildcardEngine.legalMovesForRackTile(wildcardIndex);
    check("A wildcard in the starting rack has legal moves", moves.length > 0);
    if (moves.length > 0) {
      const result = wildcardEngine.placeTile(wildcardIndex, moves[0].row, moves[0].col);
      check("Placing a wildcard is legal", result.legal === true);
      check("Placing a wildcard scores exactly 0", result.finalScore === 0);
      check(
        "All edges from the wildcard placement are WILDCARD-reasoned",
        result.edges.every((e) => e.reason === "WILDCARD"),
      );
    }
  } else {
    check("Found a seed with a wildcard in the starting rack within 2000 tries", false);
  }
}

console.log("\nTile value (decade points) checks:");
{
  check("2020s decade is worth 1 point", decadePoints(2023) === 1);
  check("2010s decade is worth 2 points", decadePoints(2015) === 2);
  check("2000s decade is worth 3 points", decadePoints(2004) === 3);
  check("1950s decade is worth 8 points", decadePoints(1958) === 8);

  const songSameDecade: SongTile = {
    kind: "SONG",
    id: "test-song-1",
    title: "T",
    performerIds: [],
    debutYear: 2014,
    peakYear: 2015,
    peakPos: 1,
  };
  check("Song within a single decade uses that decade's points", tileValue(songSameDecade) === 2);

  const songCrossesDecades: SongTile = {
    kind: "SONG",
    id: "test-song-2",
    title: "T",
    performerIds: [],
    debutYear: 2009,
    peakYear: 2020,
    peakPos: 1,
  };
  check(
    "Song crossing decades takes the lower (more recent) point value",
    tileValue(songCrossesDecades) === 1,
  );

  const artistMultiDecade: ArtistTile = {
    kind: "ARTIST",
    id: "test-artist-1",
    name: "A",
    years: [1985, 1999, 2021],
    peaks: [],
    collaboratorIds: [],
    songIds: [],
  };
  check(
    "Artist spanning decades takes the lowest (most recent) point value",
    tileValue(artistMultiDecade) === 1,
  );

  const wildcardForValue: WildcardTile = { kind: "WILDCARD", id: "wild-value-test" };
  check("Wildcard has 0 tile value", tileValue(wildcardForValue) === 0);
}

console.log("\nTile value wired into engine scoring:");
{
  const engine = new GameEngine(dataset, 2, 777);
  let placed = false;
  for (let i = 0; i < engine.getState().rack.length && !placed; i++) {
    const moves = engine.legalMovesForRackTile(i);
    if (moves.length > 0) {
      const before = engine.getState().score;
      const result = engine.placeTile(i, moves[0].row, moves[0].col);
      check("finalScore equals connectionScore + tileValue", result.finalScore === result.connectionScore + result.tileValue);
      check("Total score increases by exactly finalScore", engine.getState().score === before + result.finalScore);
      placed = true;
    }
  }
  check("Found a move to verify tile-value scoring wiring", placed);
}

console.log("\nGame-ending status checks:");
{
  let bridgedCount = 0;
  let stuckCount = 0;

  for (let seed = 0; seed < 15; seed++) {
    const engine = new GameEngine(dataset, 3, seed);
    let guard = 0;
    let lastResult: MoveResult | null = null;
    let scoreBeforeLastMove = engine.getState().score;
    while (engine.getState().status === "playing" && guard++ < 200) {
      const rack = engine.getState().rack;
      let played = false;
      for (let i = 0; i < rack.length; i++) {
        const moves = engine.legalMovesForRackTile(i);
        if (moves.length > 0) {
          scoreBeforeLastMove = engine.getState().score;
          lastResult = engine.placeTile(i, moves[0].row, moves[0].col);
          played = true;
          break;
        }
      }
      if (!played) break; // status is "playing" but no move found - shouldn't happen
    }

    const finalState = engine.getState();
    const expectedPenalty = finalState.rack.reduce((sum, t) => sum + tileValue(t), 0);

    if (finalState.status === "bridged" || finalState.status === "stuck") {
      const label = finalState.status;
      if (label === "bridged") {
        bridgedCount++;
        check(
          `Seed ${seed}: bridged status matches pure-adjacency connectivity`,
          isStarterPathConnectedToAnchor(finalState.board),
        );
      } else {
        stuckCount++;
        check(`Seed ${seed}: stuck status matches hasAnyLegalMove()`, !engine.hasAnyLegalMove());
      }
      check(
        `Seed ${seed}: penaltyApplied equals the tile value of everything left in the rack`,
        finalState.penaltyApplied === expectedPenalty,
      );
      if (lastResult) {
        check(
          `Seed ${seed}: final score reflects the last move's points minus the penalty`,
          finalState.score === scoreBeforeLastMove + lastResult.finalScore - finalState.penaltyApplied,
        );
      }
      const blocked = engine.placeTile(0, 0, 0);
      check(
        `Seed ${seed}: further placement rejected once ${label}`,
        blocked.legal === false && blocked.status === label,
      );
    }
  }

  console.log(`  (info) of 15 seeds: ${bridgedCount} bridged, ${stuckCount} stuck, ${15 - bridgedCount - stuckCount} still playing after 200 moves`);
  check("At least one game reached a terminal state across 15 seeds", bridgedCount + stuckCount > 0);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
