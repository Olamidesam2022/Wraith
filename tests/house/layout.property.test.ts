import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { layoutRoomPaths } from '../../src/house/layout';

describe('house room layout', () => {
  it('never overlaps rooms for generated folder trees', () => {
    const segment = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
    const folderTree = fc.uniqueArray(
      fc.array(segment, { minLength: 1, maxLength: 4 }).map((parts) => parts.join('/')),
      { maxLength: 100 },
    );
    fc.assert(fc.property(folderTree, (paths) => {
      const { rooms } = layoutRoomPaths(paths);
      for (let leftIndex = 0; leftIndex < rooms.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < rooms.length; rightIndex += 1) {
          const left = rooms[leftIndex];
          const right = rooms[rightIndex];
          const separated = left.x + left.width <= right.x
            || right.x + right.width <= left.x
            || left.y + left.height <= right.y
            || right.y + right.height <= left.y;
          expect(separated).toBe(true);
        }
      }
    }), { numRuns: 250 });
  });
});
