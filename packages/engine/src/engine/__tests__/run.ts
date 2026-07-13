import { loadLocalDataset } from "../loadLocalDataset";
import { createEmptyBoard, placeStarterAndAnchor, tileMatchesMultiplierType } from "../board";
import { GRID_SIZE } from "../types";
import { bestConnectionReason, connectionPoints } from "../moves";
import { isStarterPathConnectedToAnchor } from "../graph";
import { GameEngine } from "../engine";
import { decadePoints, tileValue } from "../tileValue";
import { getAllConnections } from "../connections";
import {
  ArtistTile,
  SongTile,
  Dataset,
  ConnectionCategory,
  ConnectionEdge,
  GameStatus,
  MultiplierType,
  WildcardTile,
  WILD_TILE_COST,
} from "../types";

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

interface ResolvedMove {
  legal: boolean;
  finalScore: number;
  connectionScore: number;
  tileValue: number;
  multiplierApplied?: MultiplierType;
  multiplierMissed?: MultiplierType;
  status: GameStatus;
  edge?: ConnectionEdge;
}

/**
 * Drives a full turn through the two-phase gap-placement API: placeTile()
 * followed by placeConnector() with the correct guess (read straight off
 * the edge legalMovesForRackTile() already surfaced - tests are allowed to
 * peek at the answer the way the real engine's own preview does; only the
 * player-facing UI keeps it hidden). No-ops the connector step for the
 * wildcard fast path, which resolves inside placeTile() itself.
 */
function resolveMove(
  engine: GameEngine,
  tileIndex: number,
  move: { row: number; col: number; edges: ConnectionEdge[] },
): ResolvedMove {
  const placeResult = engine.placeTile(tileIndex, move.row, move.col);
  if (!placeResult.legal) {
    return { legal: false, finalScore: 0, connectionScore: 0, tileValue: 0, status: placeResult.status };
  }
  if (placeResult.resolved) {
    return {
      legal: true,
      finalScore: placeResult.finalScore,
      connectionScore: placeResult.connectionScore,
      tileValue: placeResult.tileValue,
      multiplierApplied: placeResult.multiplierApplied,
      multiplierMissed: placeResult.multiplierMissed,
      status: placeResult.status,
      edge: placeResult.edge,
    };
  }
  const reason = move.edges[0].reason as ConnectionCategory;
  const connResult = engine.placeConnector(reason);
  return {
    legal: connResult.legal,
    finalScore: connResult.finalScore,
    connectionScore: connResult.connectionScore,
    tileValue: connResult.tileValue,
    multiplierApplied: connResult.multiplierApplied,
    multiplierMissed: connResult.multiplierMissed,
    status: connResult.status,
    edge: connResult.edge,
  };
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

  // ARTIST-ARTIST: two people who actually worked together -> COLLAB.
  check("Lady Gaga -> Bruno Mars is COLLAB", bestConnectionReason(ladyGaga, brunoMars) === "COLLAB");
  check("Bruno Mars -> Mark Ronson is COLLAB", bestConnectionReason(brunoMars, markRonson) === "COLLAB");

  // ARTIST-SONG: the artist performed on that song -> ARTIST, not COLLAB.
  check("Lady Gaga -> Die With A Smile is ARTIST", bestConnectionReason(ladyGaga, dieWithASmile) === "ARTIST");
  check("Bruno Mars -> Uptown Funk is ARTIST", bestConnectionReason(brunoMars, uptownFunk) === "ARTIST");
  check("Mark Ronson -> Uptown Funk is ARTIST", bestConnectionReason(markRonson, uptownFunk) === "ARTIST");
  check("Kendrick Lamar -> Humble. is ARTIST", bestConnectionReason(kendrickLamar, humble) === "ARTIST");

  check(
    "Two different Cruel Summer songs by unrelated performers do not COLLAB",
    bestConnectionReason(cruelSummerTaylor, cruelSummerBananarama) !== "COLLAB",
  );
  check(
    "Amy Winehouse never collaborated with Mark Ronson or performed on Uptown Funk",
    bestConnectionReason(amyWinehouse, uptownFunk) !== "COLLAB" &&
      bestConnectionReason(amyWinehouse, uptownFunk) !== "ARTIST",
  );
}

console.log("\nBridging (pure touching, independent of any real connection):");
{
  const board = createEmptyBoard();
  const starter = findArtist(dataset, "Lady Gaga");
  const anchor = findArtist(dataset, "Amy Winehouse");
  placeStarterAndAnchor(board, starter, anchor);

  check("Starter placed bottom-left", board[GRID_SIZE - 1][0].tile?.id === starter.id);
  check("Anchor placed top-right", board[0][GRID_SIZE - 1].tile?.id === anchor.id);
  check("Not yet bridged", !isStarterPathConnectedToAnchor(board));

  // isStarterPathConnectedToAnchor only cares about raw tile occupancy and
  // orthogonal touching - not whether the pair scores a connection, and not
  // whether any gap was ever filled by a real connector tile. Prove that
  // directly by hand-placing tiles, bypassing the engine's placement rules.
  const dieWithASmile = findSong(dataset, "Die With A Smile", "Lady Gaga");
  board[GRID_SIZE - 1][1].tile = dieWithASmile;
  check("Still not bridged (chain incomplete)", !isStarterPathConnectedToAnchor(board));

  // Carve a full path of *unrelated* tiles from STARTER to END_ANCHOR - none
  // of them match their neighbors at all, only touch. This is the exact
  // scenario the bridge rule targets: "even if there's no real connection
  // between some of the tiles."
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
}

console.log("\ngetAllConnections reads placed connector tiles:");
{
  const board = createEmptyBoard();
  const starter = findArtist(dataset, "Lady Gaga");
  const brunoMars = findArtist(dataset, "Bruno Mars");
  const anchor = findArtist(dataset, "Amy Winehouse");
  placeStarterAndAnchor(board, starter, anchor);

  check("No connections on a freshly-set-up board", getAllConnections(board).length === 0);

  // Hand-build the exact shape a real gap-placement + correct connector
  // guess leaves behind: a content tile two cells from STARTER, and a
  // connector tile filling the gap cell between them.
  check(
    "Bruno Mars two cells from Lady Gaga is a COLLAB match",
    bestConnectionReason(starter, brunoMars) === "COLLAB",
  );
  board[GRID_SIZE - 1][2].tile = brunoMars; // anchor, 2 cells right of STARTER
  board[GRID_SIZE - 1][1].tile = { kind: "CONNECTOR", id: "test-connector", connectionType: "COLLAB" };

  const connections = getAllConnections(board);
  check("getAllConnections finds exactly the one connector-linked pair", connections.length === 1);
  check("The connection's reason matches the connector's type", connections[0]?.reason === "COLLAB");
  check("The connection is worth the COLLAB point value", connections[0]?.points === connectionPoints("COLLAB"));
  const tileIds = connections.length
    ? new Set([connections[0].tileA.id, connections[0].tileB.id])
    : new Set<string>();
  check(
    "The connection references STARTER and Bruno Mars, not the connector itself",
    tileIds.has(starter.id) && tileIds.has(brunoMars.id) && !tileIds.has("test-connector"),
  );
}

console.log("\nGameEngine integration:");
{
  const engine = new GameEngine(dataset, 45, 12345);
  const state = engine.getState();
  check("Rack has 5 tiles at start", state.rack.length === 5);
  check("Starter tile present", !!state.board[GRID_SIZE - 1][0].tile);
  check("Anchor tile present", !!state.board[0][GRID_SIZE - 1].tile);
  check("No connector pending at start", state.pendingConnector === null);

  const illegal = engine.placeTile(0, 4, 4); // middle of empty board, nothing two cells away yet
  check("Placing in the empty middle of the board is illegal", illegal.legal === false);

  // Try every non-wildcard rack tile against every legal move surfaced by
  // the engine itself; if any exist, placing + correctly guessing its
  // connector should succeed and score > 0 (wildcards always score 0, so
  // they're excluded from this check and covered separately below).
  let placedOk = false;
  for (let i = 0; i < engine.getState().rack.length && !placedOk; i++) {
    if (engine.getState().rack[i].kind === "WILDCARD") continue;
    const moves = engine.legalMovesForRackTile(i);
    if (moves.length > 0) {
      const result = resolveMove(engine, i, moves[0]);
      check(`Legal move for rack tile ${i} succeeds`, result.legal === true);
      check(`Legal move scores > 0`, result.finalScore > 0);
      placedOk = true;
    }
  }
  check("At least one legal move was available and played from the starting rack", placedOk);
  check("Rack refilled back to 5 after a placement", engine.getState().rack.length === 5);
  check("No connector left pending after resolving correctly", engine.getState().pendingConnector === null);
}

console.log("\nGap-placement + connector guessing:");
{
  const engine = new GameEngine(dataset, 46, 999);
  let tested = false;
  for (let i = 0; i < engine.getState().rack.length && !tested; i++) {
    if (engine.getState().rack[i].kind === "WILDCARD") continue;
    const moves = engine.legalMovesForRackTile(i);
    if (moves.length === 0) continue;
    const move = moves[0];
    const required = move.edges[0].reason as ConnectionCategory;
    const wrongGuess = (["COLLAB", "ARTIST", "DECADE"] as ConnectionCategory[]).find((c) => c !== required)!;

    const placeResult = engine.placeTile(i, move.row, move.col);
    check("Placing a tile two cells from a matching anchor is legal", placeResult.legal === true);
    check("A real connection type leaves the placement unresolved", placeResult.resolved === false);
    check("pendingConnector is now set", engine.getState().pendingConnector !== null);
    check("Rack is not refilled while a connector is pending", engine.getState().rack.length === 4);

    const scoreBeforeGuess = engine.getState().score;
    const wrong = engine.placeConnector(wrongGuess);
    check("A wrong connector guess is still a legal call", wrong.legal === true);
    check("A wrong guess is reported as incorrect", wrong.correct === false);
    check("A wrong guess costs exactly the wrong-connector penalty", wrong.pointsDelta === -2);
    check(
      "A wrong guess docks the score by exactly 2",
      engine.getState().score === scoreBeforeGuess - 2,
    );
    check("The pending connector stays open after a wrong guess", engine.getState().pendingConnector !== null);
    check("The rack is still not refilled after a wrong guess", engine.getState().rack.length === 4);

    const scoreBeforeRetry = engine.getState().score;
    const correct = engine.placeConnector(required);
    check("Retrying with the correct type succeeds", correct.legal === true);
    check("The correct guess is reported as correct", correct.correct === true);
    check("The correct guess scores > 0", correct.finalScore > 0);
    check(
      "The score increases by exactly the correct guess's finalScore",
      engine.getState().score === scoreBeforeRetry + correct.finalScore,
    );
    check("pendingConnector clears once resolved", engine.getState().pendingConnector === null);
    check("The rack refills back to 5 once resolved", engine.getState().rack.length === 5);

    tested = true;
  }
  check("Found a rack tile with a real (non-wildcard) connection to test guessing against", tested);
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
  // (draw -> legal move enumeration -> placement -> free auto-bridge)
  // works without ever requiring a connector guess.
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
      check("Placing a wildcard resolves immediately - no connector needed", result.resolved === true);
      check("No connector is left pending after a wildcard placement", wildcardEngine.getState().pendingConnector === null);
      check("Placing a wildcard scores exactly 0", result.finalScore === 0);
      check("The wildcard placement's edge is WILDCARD-reasoned", result.edge?.reason === "WILDCARD");
      check("Rack refills immediately after a wildcard placement", wildcardEngine.getState().rack.length === 5);
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
      const result = resolveMove(engine, i, moves[0]);
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
    let lastResult: ResolvedMove | null = null;
    let scoreBeforeLastMove = engine.getState().score;
    while (engine.getState().status === "playing" && guard++ < 200) {
      const rack = engine.getState().rack;
      let played = false;
      for (let i = 0; i < rack.length; i++) {
        const moves = engine.legalMovesForRackTile(i);
        if (moves.length > 0) {
          scoreBeforeLastMove = engine.getState().score;
          lastResult = resolveMove(engine, i, moves[0]);
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

console.log("\nBuy wildcard checks:");
{
  // A fresh game starts at score 0, so buying should fail until enough
  // points are earned from real placements.
  const engine = new GameEngine(dataset, 4, 42);
  const zero = engine.buyWildcard();
  check("Cannot buy a wildcard at 0 points", zero.success === false);
  check("Failed purchase leaves score untouched", engine.getState().score === 0);
  check("Failed purchase leaves rack size untouched", engine.getState().rack.length === 5);

  // Play real moves (greedy first-legal-move) until there's enough score to
  // afford one, or the game ends first.
  let guard = 0;
  while (
    engine.getState().score < WILD_TILE_COST &&
    engine.getState().status === "playing" &&
    guard++ < 200
  ) {
    const rack = engine.getState().rack;
    let played = false;
    for (let i = 0; i < rack.length; i++) {
      const moves = engine.legalMovesForRackTile(i);
      if (moves.length > 0) {
        resolveMove(engine, i, moves[0]);
        played = true;
        break;
      }
    }
    if (!played) break;
  }

  if (engine.getState().status === "playing" && engine.getState().score >= WILD_TILE_COST) {
    const scoreBefore = engine.getState().score;
    const rackSizeBefore = engine.getState().rack.length;
    const result = engine.buyWildcard();
    check("Purchase succeeds when affordable", result.success === true);
    check("Purchase costs exactly WILD_TILE_COST", result.cost === WILD_TILE_COST);
    check("Score drops by exactly WILD_TILE_COST", engine.getState().score === scoreBefore - WILD_TILE_COST);
    check("scoreAfter matches the new score", result.scoreAfter === engine.getState().score);
    check("Rack grows by exactly one tile", engine.getState().rack.length === rackSizeBefore + 1);
    check(
      "The newly added tile is a wildcard",
      engine.getState().rack[engine.getState().rack.length - 1].kind === "WILDCARD",
    );

    // Play any one tile down and confirm the rack settles back to RACK_SIZE
    // (5) instead of ballooning further.
    const rack = engine.getState().rack;
    let settled = false;
    for (let i = 0; i < rack.length; i++) {
      const moves = engine.legalMovesForRackTile(i);
      if (moves.length > 0) {
        resolveMove(engine, i, moves[0]);
        settled = true;
        break;
      }
    }
    check("Found a move to confirm the rack settles back down", settled);
    if (settled) {
      check("Rack settles back to 5 after playing a tile post-purchase", engine.getState().rack.length === 5);
    }
  } else {
    check("Reached enough score to test a successful purchase within 200 moves", false);
  }
}

console.log("\nBuy wildcard blocked once game is over:");
{
  // Reuse a seed already known (from the game-ending checks above) to end
  // via bridging.
  const engine = new GameEngine(dataset, 3, 0);
  let guard = 0;
  while (engine.getState().status === "playing" && guard++ < 200) {
    const rack = engine.getState().rack;
    let played = false;
    for (let i = 0; i < rack.length; i++) {
      const moves = engine.legalMovesForRackTile(i);
      if (moves.length > 0) {
        resolveMove(engine, i, moves[0]);
        played = true;
        break;
      }
    }
    if (!played) break;
  }
  check("Game reached a terminal state to test purchase blocking", engine.getState().status !== "playing");
  const blocked = engine.buyWildcard();
  check("Purchase rejected once the game is over", blocked.success === false);
}

console.log("\nMultiplier applied/missed reporting checks:");
{
  // Sweep many seeds, greedily playing whatever move each rack tile finds
  // first, and inspect every placement that landed on a bonus cell.
  // Confirms multiplierApplied/multiplierMissed are mutually exclusive,
  // correctly reflect whether the bonus cell's type matched the tile, and
  // that the score math (connectionScore vs the edge's raw points) agrees
  // with which one fired.
  let sawApplied = false;
  let sawMissed = false;
  for (let seed = 0; seed < 60 && (!sawApplied || !sawMissed); seed++) {
    const engine = new GameEngine(dataset, 5, seed);
    let guard = 0;
    while (engine.getState().status === "playing" && guard++ < 200) {
      const rack = engine.getState().rack;
      let played = false;
      for (let i = 0; i < rack.length; i++) {
        const tile = rack[i];
        const moves = engine.legalMovesForRackTile(i);
        if (moves.length === 0) continue;
        const move = moves[0];
        const cellBefore = engine.getState().board[move.row][move.col];
        const cellMultiplier = cellBefore.multiplier;
        const points = move.edges[0]?.points ?? 0;
        const result = resolveMove(engine, i, move);
        played = true;

        if (cellMultiplier) {
          check(
            "Bonus cell placement sets exactly one of multiplierApplied/multiplierMissed",
            (result.multiplierApplied !== undefined) !== (result.multiplierMissed !== undefined),
          );
          if (result.multiplierApplied) {
            sawApplied = true;
            check("multiplierApplied matches the cell's bonus type", result.multiplierApplied === cellMultiplier);
            check(
              "multiplierApplied only fires when the tile type matches the bonus",
              tileMatchesMultiplierType(tile, cellMultiplier),
            );
            check(
              "connectionScore reflects the applied bonus (boosted above the edge's raw points)",
              points > 0 && result.connectionScore > points,
            );
          } else if (result.multiplierMissed) {
            sawMissed = true;
            check("multiplierMissed matches the cell's bonus type", result.multiplierMissed === cellMultiplier);
            check(
              "multiplierMissed fires when the tile type doesn't match the bonus, it's a wildcard, or the edge is worth 0",
              tile.kind === "WILDCARD" ||
                !tileMatchesMultiplierType(tile, cellMultiplier) ||
                points === 0,
            );
            check(
              "connectionScore is untouched when the bonus misses",
              result.connectionScore === points,
            );
          }
        } else {
          check(
            "Non-bonus cell placement sets neither multiplierApplied nor multiplierMissed",
            result.multiplierApplied === undefined && result.multiplierMissed === undefined,
          );
        }
        break;
      }
      if (!played) break;
    }
  }
  check("Observed at least one applied-bonus placement across the seed sweep", sawApplied);
  check("Observed at least one missed-bonus placement across the seed sweep", sawMissed);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
