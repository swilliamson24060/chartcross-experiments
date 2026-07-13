import { connectionPoints } from "./moves";
import { adjacentCells } from "./board";
import { Board, ConnectionReason, GRID_SIZE, Tile } from "./types";

export interface BoardConnection {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  tileA: Tile;
  tileB: Tile;
  reason: ConnectionReason;
  points: number;
}

/**
 * One entry per placed connector tile on the board, describing the two
 * content tiles it links. The connection type was already validated at
 * placement time (GameEngine.placeConnector()), so this just reads it back
 * off the connector rather than recomputing a match - it backs both the
 * board's connector-line rendering and the textual connections list.
 *
 * A wildcard's free bridge doesn't go through a connector tile (see
 * GameEngine's wildcard fast path) and isn't a scoring connection, so it's
 * not represented here.
 */
export function getAllConnections(board: Board): BoardConnection[] {
  const connections: BoardConnection[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = board[row][col];
      if (!cell.tile || cell.tile.kind !== "CONNECTOR") continue;

      const contentNeighbors = adjacentCells(board, row, col).filter(
        (n) => n.tile && n.tile.kind !== "CONNECTOR",
      );
      if (contentNeighbors.length < 2) continue;
      const [a, b] = contentNeighbors;
      const reason = cell.tile.connectionType;
      connections.push({
        fromRow: a.row,
        fromCol: a.col,
        toRow: b.row,
        toCol: b.col,
        tileA: a.tile!,
        tileB: b.tile!,
        reason,
        points: connectionPoints(reason),
      });
    }
  }

  return connections;
}
