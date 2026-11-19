import { houseConfig } from '../config';

export interface HouseRoomLayout {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HouseLayout {
  width: number;
  height: number;
  rooms: HouseRoomLayout[];
}

function comparePath(left: string, right: string): number {
  return left < right ? -houseConfig.one : left > right ? houseConfig.one : houseConfig.zero;
}

export function layoutRoomPaths(roomPaths: readonly string[]): HouseLayout {
  const paths = [...new Set(roomPaths)].sort(comparePath);
  if (paths.length === houseConfig.zero) {
    return { width: houseConfig.minimumCanvasSize, height: houseConfig.minimumCanvasSize, rooms: [] };
  }
  const columns = Math.min(houseConfig.columns, paths.length);
  const rows = Math.ceil(paths.length / columns);
  const width = houseConfig.outerPadding * 2
    + columns * houseConfig.roomWidth
    + Math.max(houseConfig.zero, columns - houseConfig.one) * houseConfig.roomGap;
  const height = houseConfig.outerPadding * 2
    + houseConfig.roofHeight
    + rows * houseConfig.roomHeight
    + Math.max(houseConfig.zero, rows - houseConfig.one) * houseConfig.roomGap;
  const rooms = paths.map((path, index) => ({
    path,
    x: houseConfig.outerPadding + (index % columns) * (houseConfig.roomWidth + houseConfig.roomGap),
    y: houseConfig.outerPadding + houseConfig.roofHeight + Math.floor(index / columns) * (houseConfig.roomHeight + houseConfig.roomGap),
    width: houseConfig.roomWidth,
    height: houseConfig.roomHeight,
  }));
  return { width, height, rooms };
}
