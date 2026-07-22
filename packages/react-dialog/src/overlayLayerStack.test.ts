import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VEIT_DIALOG_Z_STACK_STEP,
  acquireOverlayLayer,
  releaseOverlayLayer,
} from './overlayLayerStack.js';

describe('overlayLayerStack', () => {
  it('assigns increasing bases and resets when empty', () => {
    const a = {};
    const b = {};
    const baseA = acquireOverlayLayer(a);
    const baseB = acquireOverlayLayer(b);
    assert.equal(baseB, baseA + VEIT_DIALOG_Z_STACK_STEP);
    releaseOverlayLayer(a);
    releaseOverlayLayer(b);
    const baseC = acquireOverlayLayer({});
    assert.equal(baseC, 200 + VEIT_DIALOG_Z_STACK_STEP);
  });
});
