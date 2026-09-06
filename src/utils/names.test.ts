import { describe, expect, it } from 'vitest';

import { getSongName, getSongSecondaryName } from './names';

describe('localized names', () => {
  it('uses English names for regional English locales', () => {
    expect(getSongName('日本語の名前', 'English Name', 'en-US')).toBe('English Name');
  });

  it('keeps Japanese names for Japanese locales', () => {
    expect(getSongName('日本語の名前', 'English Name', 'ja-JP')).toBe('日本語の名前');
  });

  it('keeps Japanese names for underscore-formatted Japanese locales', () => {
    expect(getSongName('日本語の名前', 'English Name', 'ja_JP')).toBe('日本語の名前');
  });

  it('uses English names for non-Japanese locales', () => {
    expect(getSongName('日本語の名前', 'English Name', 'de-DE')).toBe('English Name');
  });

  it('uses the opposite title as the secondary name in either locale case', () => {
    expect(getSongSecondaryName('日本語の名前', 'English Name', 'ja-JP')).toBe('English Name');
    expect(getSongSecondaryName('日本語の名前', 'English Name', 'de-DE')).toBe('日本語の名前');
  });
});
