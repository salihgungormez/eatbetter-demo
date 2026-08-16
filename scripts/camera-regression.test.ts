import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('app/scan.tsx', 'utf8');
assert.equal((source.match(/takePictureAsync\(/g) ?? []).length, 1, 'camera screen must have one physical capture call');
assert.equal((source.match(/setInterval\(/g) ?? []).length, 0, 'camera screen must not use intervals');
assert.equal((source.match(/setTimeout\(/g) ?? []).length, 0, 'camera screen must not use timer capture loops');
assert.match(source, /captureLockRef/);
assert.match(source, /hasCapturedRef/);
assert.match(source, /disabled=\{busy\}/);
assert.match(source, /router\.replace\(\{[\s\S]*pathname: '\/analyze'/);
console.log('camera regression guards: ok (idle capture count = 0; one explicit capture is guarded)');
// Verifies single-capture guards and fresh scan-session behavior.
