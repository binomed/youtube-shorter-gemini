import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing-helpers';
import { YtsPrecisionMultiTimeline } from './yts-precision-multi-timeline.element.js';
import './yts-precision-multi-timeline.element.js';
import type { VideoSegment } from '@youtube-shorter/shared';

describe('YtsPrecisionMultiTimeline', () => {
  const getMockSegment = (): VideoSegment => ({
    startTime: 10,
    endTime: 20,
    layoutTimeline: []
  });

  it('renders with segment data', async () => {
    const segment = getMockSegment();
    const el = await fixture<YtsPrecisionMultiTimeline>(html`
      <yts-precision-multi-timeline
        .duration=${100}
        .segment=${segment}
        .currentTime=${15}
      ></yts-precision-multi-timeline>
    `);

    expect(el.duration).toBe(100);
    expect(el.segment?.startTime).toBe(10);
    expect(el.segment?.endTime).toBe(20);
    expect(el.currentTime).toBe(15);
  });

  it('sets IN point exactly to cursor when within bounds', async () => {
    const segment = getMockSegment();
    const el = await fixture<YtsPrecisionMultiTimeline>(html`
      <yts-precision-multi-timeline
        .duration=${100}
        .segment=${segment}
        .currentTime=${12}
        .fps=${30}
      ></yts-precision-multi-timeline>
    `);

    const changeSpy = vi.fn();
    const settledSpy = vi.fn();
    el.addEventListener('segment-change', changeSpy);
    el.addEventListener('segment-settled', settledSpy);

    // Call private method _setInToCursor
    (el as unknown as Record<string, () => void>)._setInToCursor();

    expect(el.segment?.startTime).toBe(12);
    expect(el.segment?.endTime).toBe(20); // Unchanged

    expect(changeSpy).toHaveBeenCalled();
    expect(settledSpy).toHaveBeenCalled();
    expect(changeSpy.mock.calls[0][0].detail.edge).toBe('start');
  });

  it('sets IN point to cursor and pushes OUT forward when cursor crosses OUT', async () => {
    const segment = getMockSegment();
    const el = await fixture<YtsPrecisionMultiTimeline>(html`
      <yts-precision-multi-timeline
        .duration=${100}
        .segment=${segment}
        .currentTime=${25}
        .fps=${30}
      ></yts-precision-multi-timeline>
    `);

    (el as unknown as Record<string, () => void>)._setInToCursor();

    expect(el.segment?.startTime).toBe(25);
    // OUT should be pushed forward by 1 frame (1/30 = 0.0333s)
    expect(el.segment?.endTime).toBeCloseTo(25 + 1/30, 4);
  });

  it('sets OUT point exactly to cursor when within bounds', async () => {
    const segment = getMockSegment();
    const el = await fixture<YtsPrecisionMultiTimeline>(html`
      <yts-precision-multi-timeline
        .duration=${100}
        .segment=${segment}
        .currentTime=${18}
        .fps=${30}
      ></yts-precision-multi-timeline>
    `);

    const changeSpy = vi.fn();
    el.addEventListener('segment-change', changeSpy);

    (el as unknown as Record<string, () => void>)._setOutToCursor();

    expect(el.segment?.endTime).toBe(18);
    expect(el.segment?.startTime).toBe(10); // Unchanged
    expect(changeSpy).toHaveBeenCalled();
    expect(changeSpy.mock.calls[0][0].detail.edge).toBe('end');
  });

  it('sets OUT point to cursor and pulls IN backward when cursor crosses IN', async () => {
    const segment = getMockSegment();
    const el = await fixture<YtsPrecisionMultiTimeline>(html`
      <yts-precision-multi-timeline
        .duration=${100}
        .segment=${segment}
        .currentTime=${5}
        .fps=${30}
      ></yts-precision-multi-timeline>
    `);

    (el as unknown as Record<string, () => void>)._setOutToCursor();

    expect(el.segment?.endTime).toBe(5);
    // IN should be pulled backward by 1 frame (5 - 1/30)
    expect(el.segment?.startTime).toBeCloseTo(5 - 1/30, 4);
  });
});
