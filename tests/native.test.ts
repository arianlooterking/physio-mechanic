import { describe, expect, it } from 'vitest';
import { readVersion, STORES } from '../src/native/state';

describe('readVersion: which store an install came from', () => {
  it('the website APK has a plain version', () => {
    expect(readVersion('1.3.0', 'android')).toEqual({ version: '1.3.0', channel: 'site' });
  });
  it('store builds carry their store', () => {
    expect(readVersion('1.3.0-bazaar', 'android')).toEqual({ version: '1.3.0', channel: 'bazaar' });
    expect(readVersion('1.3.0-myket', 'android')).toEqual({ version: '1.3.0', channel: 'myket' });
  });
  it('an unknown tag is treated as the website APK', () => {
    expect(readVersion('1.3.0-beta', 'android').channel).toBe('site');
  });
  it('every iPhone install is from the App Store', () => {
    expect(readVersion('1.3.0', 'ios')).toEqual({ version: '1.3.0', channel: 'appstore' });
  });
  it('store pages point at the app id', () => {
    expect(STORES.bazaar?.url).toBe('https://cafebazaar.ir/app/com.biomana.app');
    expect(STORES.myket?.url).toBe('https://myket.ir/app/com.biomana.app');
  });
});
