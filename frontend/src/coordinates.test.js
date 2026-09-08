import assert from 'node:assert/strict';
import test from 'node:test';
import { wgs84ToGcj02 } from './coordinates.js';

test('GCJ conversion preserves overseas coordinates and converts Shanghai', () => {
  assert.deepEqual(wgs84ToGcj02(-74, 40), { lng: -74, lat: 40 });
  const shanghai = wgs84ToGcj02(121.4737, 31.2304);
  assert.ok(Math.abs(shanghai.lng - 121.478223) < 0.000001);
  assert.ok(Math.abs(shanghai.lat - 31.228458) < 0.000001);
});
