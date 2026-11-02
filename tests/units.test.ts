import { describe, expect, it } from 'vitest';
import { averageMass, configuration, configurationTex, elementOf, isotopeTex, isUnstable, molesFromGrams, particlesFromMoles, periodOf, valenceElectrons } from '../src/lib/atoms';
import { convert, conversionPower, decimalsOf, density, kmhToMs, materialFor, msToKmh, orderOfMagnitude, parseReading, prefixOf, readWithPrecision, scientific } from '../src/lib/units';

describe('unit lab', () => {
  it('converts between prefixes for lengths, areas and volumes', () => {
    expect(convert(2.5, 3, 0)).toBe(2500); // km → m
    expect(convert(1, 3, -2)).toBe(100000); // km → cm
    expect(convert(35, -3, 0)).toBe(0.035); // mm → m
    expect(convert(1, -2, 0, 2)).toBe(0.0001); // cm² → m²
    expect(convert(1, 0, -2, 3)).toBe(1e6); // m³ → cm³
    expect(convert(500, -2, -1, 3)).toBe(0.5); // 500 cm³ = 0.5 dm³ (litre)
    expect(convert(0.1, 0, -3)).toBe(100); // no 100.00000000000001
    expect(conversionPower(3, -2)).toBe(5);
    expect(conversionPower(-2, 0, 3)).toBe(-6);
    expect(prefixOf(-6).name).toBe('میکرو');
  });

  it('converts speed and writes numbers in scientific notation', () => {
    expect(kmhToMs(72)).toBe(20);
    expect(msToKmh(25)).toBe(90);
    expect(scientific(1000)).toEqual({ a: 1, e: 3 });
    expect(scientific(0.00042)).toEqual({ a: 4.2, e: -4 });
    expect(scientific(-3.6e7)).toEqual({ a: -3.6, e: 7 });
    expect(scientific(0)).toEqual({ a: 0, e: 0 });
  });

  it('estimates the order of magnitude with the book rule (5 or more rounds up)', () => {
    expect(orderOfMagnitude(4.9e3)).toBe(3);
    expect(orderOfMagnitude(5e3)).toBe(4);
    expect(orderOfMagnitude(6.4e6)).toBe(7); // Earth's radius in m
    expect(orderOfMagnitude(0.003)).toBe(-3);
    expect(orderOfMagnitude(0.008)).toBe(-2);
  });

  it('reads what students type and reports a reading to the instrument precision', () => {
    expect(parseReading('۱۲٫۵')).toBe(12.5);
    expect(parseReading('-0.25')).toBe(-0.25);
    expect(parseReading('12a')).toBeNull();
    expect(decimalsOf('12.30')).toBe(2);
    expect(decimalsOf('۷')).toBe(0);
    expect(readWithPrecision(12.347, 0.1)).toEqual({ value: 12.3, decimals: 1 });
    expect(readWithPrecision(12.347, 0.01)).toEqual({ value: 12.35, decimals: 2 });
    expect(readWithPrecision(12.6, 1)).toEqual({ value: 13, decimals: 0 });
  });

  it('computes density and finds the material', () => {
    expect(density(54, 20)).toEqual({ gcm3: 2.7, kgm3: 2700 });
    expect(materialFor(2.7).name).toBe('آلومینیم');
    expect(materialFor(0.92).floats).toBe(true);
    expect(materialFor(7.8).name).toBe('آهن');
    expect(materialFor(7.8).floats).toBe(false);
  });
});

describe('atom lab', () => {
  it('names isotopes and applies the stability rule', () => {
    expect(elementOf(6)?.sym).toBe('C');
    expect(isotopeTex(6, 8)).toBe('{}^{14}_{6}\\mathrm{C}');
    expect(isUnstable(1, 2)).toBe(true); // tritium
    expect(isUnstable(6, 6)).toBe(false);
    expect(isUnstable(1, 1)).toBe(false);
  });

  it('averages isotope masses by abundance', () => {
    expect(averageMass([[35, 75], [37, 25]])).toBe(35.5);
    expect(averageMass([[6, 7.5], [7, 92.5]])).toBeCloseTo(6.925, 6);
    expect(averageMass([[24, 79], [25, 10], [26, 11]])).toBeCloseTo(24.32, 6);
  });

  it('counts moles and particles', () => {
    expect(molesFromGrams(36, 18)).toBe(2);
    expect(particlesFromMoles(0.5)).toBe(3.01e23);
  });

  it('writes electron configurations with the n + l order and the two exceptions', () => {
    expect(configurationTex(11)).toBe('1s^{2}\\,2s^{2}\\,2p^{6}\\,3s^{1}');
    expect(configuration(19).at(-1)).toEqual(['4s', 1]);
    expect(configuration(26)).toEqual([['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 6]]);
    expect(configuration(24).slice(-2)).toEqual([['4s', 1], ['3d', 5]]);
    expect(configuration(29).slice(-2)).toEqual([['4s', 1], ['3d', 10]]);
    expect(valenceElectrons(8)).toBe(6);
    expect(valenceElectrons(17)).toBe(7);
    expect(valenceElectrons(20)).toBe(2);
    expect(periodOf(11)).toBe(3);
    expect(periodOf(2)).toBe(1);
  });
});
