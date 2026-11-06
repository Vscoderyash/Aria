import golden from './parse-golden.json';
import { describe, expect, it } from 'vitest';
import { normalizeSpokenText, parseCmd, scoreLabel, splitCmds } from '../src/index';

describe('parseCmd golden fixtures', () => {
  it.each(golden)('parses "$text"', ({ text, expected }) => {
    expect(parseCmd(text)).toMatchObject(expected);
  });

  it('returns null for a request outside the instant grammar', () => {
    expect(parseCmd('compare the prices of these three products')).toBeNull();
  });
});

describe('spoken text normalization', () => {
  it.each([
    ['next tap', 'next tab'],
    ['neeche scroll karo', 'scroll down'],
    ['upar scroll karo', 'scroll up'],
    ['agla tab', 'next tab'],
    ['youtube kholo', 'open youtube'],
    ['gmail tab kholo', 'open gmail tab'],
  ])('normalizes %s', (spoken, expected) => {
    expect(normalizeSpokenText(spoken)).toBe(expected);
  });

  it('applies learned voice aliases after built-in corrections', () => {
    expect(normalizeSpokenText('open gmale', { gmale: 'gmail' })).toBe('open gmail');
    expect(normalizeSpokenText('open fooXbar', { 'foo.bar': 'gmail' })).toBe('open fooXbar');
    expect(normalizeSpokenText('open foo.bar', { 'foo.bar': 'gmail' })).toBe('open gmail');
  });
});

describe('fuzzy label scoring', () => {
  it('tolerates a one-character spelling error and rewards exact substrings', () => {
    expect(scoreLabel('Gmail', 'Gmaile')).toBe(1);
    expect(scoreLabel('Sign in', 'sign in')).toBe(1.5);
  });

  it('returns zero when either side has no tokens', () => {
    expect(scoreLabel('', 'save')).toBe(0);
    expect(scoreLabel('Save', '!?')).toBe(0);
  });
});

describe('splitCmds golden behavior', () => {
  it.each([
    ['open youtube and search lo-fi then click the first video', ['open youtube and search lo-fi', 'click the first video']],
    ['scroll down and click the second video', ['scroll down', 'click the second video']],
    ['switch to the next tab', ['switch to the next tab']],
    ['go to youtube and search lo-fi', ['go to youtube and search lo-fi']],
  ])('splits "%s"', (input, expected) => {
    expect(splitCmds(input)).toEqual(expected);
  });

  it('keeps each step of a chained open/search/click request parseable', () => {
    const commands = splitCmds('go to youtube and search lo-fi then click first video');
    expect(commands.every((command) => parseCmd(command) !== null)).toBe(true);
    expect(commands).toEqual(['go to youtube and search lo-fi', 'click first video']);
  });

  it('preserves shortcut training phrases as a single command', () => {
    const input = 'when I say good morning, open gmail then open youtube';
    expect(splitCmds(input)).toEqual([input]);
  });
});
