/**
 * Tests for Stdin Transform Stream
 *
 * Tests the Transform stream that intercepts stdin data and translates
 * Shift+Enter escape sequences before they reach readline.
 */
import { describe, test, expect } from 'vitest';
import { createShiftEnterTransform } from './stdin-transform.js';
import { SHIFT_ENTER_MARKER } from './shift-enter.js';

describe('Stdin Transform Stream', () => {
  test('passes normal text through unchanged', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transform.write(Buffer.from('hello'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('hello');
  });

  test('translates Ghostty Shift+Enter sequence', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transform.write(Buffer.from('\x1b[27;2;13~'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe(SHIFT_ENTER_MARKER);
  });

  test('translates Konsole Shift+Enter sequence', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transform.write(Buffer.from('\x1bOM'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe(SHIFT_ENTER_MARKER);
  });

  test('preserves other escape sequences', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Arrow up key
    transform.write(Buffer.from('\x1b[A'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('\x1b[A');
  });

  test('handles mixed data with Shift+Enter', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transform.write(Buffer.from('text\x1b[27;2;13~more'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('text' + SHIFT_ENTER_MARKER + 'more');
  });

  test('handles Enter (carriage return) unchanged', async () => {
    const transform = createShiftEnterTransform();
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transform.write(Buffer.from('\r'));
    transform.end();

    await new Promise<void>((resolve) => transform.on('end', resolve));

    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('\r');
  });
});
