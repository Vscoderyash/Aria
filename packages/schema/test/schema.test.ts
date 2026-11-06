import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { actionSchema, bridgeMessageSchema, pageModelSchema } from '../src/index';

const ajv = new Ajv2020({ allErrors: true, strict: false });

describe('shared JSON contracts', () => {
  it('accepts a complete PageModel and rejects an invalid version', () => {
    const validate = ajv.compile(pageModelSchema);
    const page = {
      version: 1, url: 'https://example.test/article', title: 'Article', lang: 'en', pageType: 'article',
      capturedAt: '2026-11-06T00:00:00.000Z', viewport: { w: 1280, h: 800, scrollY: 0, scrollMax: 0 },
      outline: [{ level: 1, text: 'Title', ref: 'e1' }], mainText: 'Text', mainTextTruncated: false,
      elements: [], forms: [], tables: [], media: [], overlays: [], redactions: ['password fields'],
    };
    expect(validate(page), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...page, version: 2 })).toBe(false);
  });

  it('requires the safety risk and rejects unknown action properties', () => {
    const validate = ajv.compile(actionSchema);
    expect(validate({ id: 'a1', type: 'click', target: 'e1', args: {}, risk: 'low' })).toBe(true);
    expect(validate({ id: 'a1', type: 'click', args: {} })).toBe(false);
    expect(validate({ id: 'a1', type: 'click', args: {}, risk: 'low', surprise: true })).toBe(false);
  });

  it('accepts versioned bridge messages and rejects unknown message types', () => {
    const validate = ajv.compile(bridgeMessageSchema);
    expect(validate({ type: 'hello', v: 1, device: 'desktop', caps: ['voice'] })).toBe(true);
    expect(validate({ type: 'command', id: 'job-1', text: 'open youtube', target: 'browser' })).toBe(true);
    expect(validate({ type: 'execute', command: 'open youtube' })).toBe(false);
  });
});
