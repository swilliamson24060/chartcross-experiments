import { connectionPoints } from "./moves";
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
 * describing the two content tiles it links. Both the connection type and
 * the linked cells were recorded directly on the tile at placement time
 * (GameEngine.placeConnector() / useWildcardConnector() /
 * startWildRescue()), so this just reads them back rather than inferring
 * the pair from adjacency - a gap cell can end up with more than two
 * occupied orthogonal neighbors once the board fills up, so "nearest two
 * tiles" would sometimes report the wrong pair for the right reason.
 */
export function getAllConnections(board: Board): BoardConnection[] {
  const connections: BoardConnection[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = board[row][col].tile;
      if (!tile) continue;
      if (tile.kind !== "CONNECTOR" && tile.kind !== "WILDCARD") continue;
      if (tile.contentRow === undefined || tile.contentCol === undefined) continue; // bare test object, not a real placement
      const anchorRow = tile.anchorRow!;
      const anchorCol = tile.anchorCol!;

      const a = board[tile.contentRow][tile.contentCol];
      const b = board[anchorRow][anchorCol];
      if (!a.tile || !b.tile) continue; // defensive - shouldn't happen for a resolved connection

      const reason: ConnectionReason = tile.kind === "CONNECTOR" ? tile.connectionType : "WILDCARD";
      connections.push({
        fromRow: a.row,
        fromCol: a.col,
        toRow: b.row,
        toCol: b.col,
        tileA: a.tile,
        tileB: b.tile,
        reason,
        points: connectionPoints(reason),
      });
    }
  }

  return connections;
}
