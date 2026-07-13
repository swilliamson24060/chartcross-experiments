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
 * One entry per placed connector or wild-connector tile on the board,
 * describing the two content tiles it links. The connection type was
 * already validated at placement time (GameEngine.placeConnector() /
 * useWildcardConnector()), so this just reads it back off the gap tile
 * rather than recomputing a match - it backs both the board's
 * connector-line rendering and the textual connections list.
 */
export function getAllConnections(board: Board): BoardConnection[] {
  const connections: BoardConnection[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = board[row][col];
      if (!cell.tile || (cell.tile.kind !== "CONNECTOR" && cell.tile.kind !== "WILDCARD")) continue;

      const contentNeighbors = adjacentCells(board, row, col).filter(
        (n) => n.tile && n.tile.kind !== "CONNECTOR",
      );
      if (contentNeighbors.length < 2) continue;
      const [a, b] = contentNeighbors;
      const reason: ConnectionReason = cell.tile.kind === "CONNECTOR" ? cell.tile.connectionType : "WILDCARD";
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
