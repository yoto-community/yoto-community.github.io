import { describe, expect, it } from 'vitest';
import { crc32, readZip, zipEntries } from './cover-zip';

const NATIVE_FIXTURE =
  'UEsDBBQAAAAIAISWZl0PG+hqzwAAAEgDAAAMAAAAcHJvamVjdC5qc29u7Y7NbgIxDIRfZZUzbJMKLr2uxAlOIBWEOETghUhZGxKn5Ue8O3Gh7L4D3Dwznk9zUTWFxrL6KkyvUHEHILdi+sXI7thP0WiVE29PlP6i6SHZABX9QPh2vJs59iAfgRJuYFNRQAgxf3JIkP19cMhV4rFDaF2W2oiQp+4sthlkk+o6As+bJhv6qRdPHT2xkJcX5Rq7ld79iB9r2VPucStTzkRSMeXnUAZYnAug1A+1yKqvS/M/QzAT56269oqWjMn7DqsDaim6i3jXX7W+ut4AUEsDBBQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAaW1hZ2VzL2NvdmVyLnBuZ4lQTkcNChoKAAAADUlIRFIAAAABAAAAAQgEAAAAtRwMAgAAAAtJREFUeNpj/P8fAAMDAgDvv6fbAAAAAElFTkSuQmCCUEsBAhQDFAAAAAgAhJZmXQ8b6GrPAAAASAMAAAwAAAAAAAAAAAAAAIABAAAAAHByb2plY3QuanNvblBLAQIUAxQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAAAAAAAAAAACAAfkAAABpbWFnZXMvY292ZXIucG5nUEsFBgAAAAACAAIAeAAAAGsBAAAAAA==';

const base64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

describe('zipEntries', () => {
  it('round-trips stored entries and UTF-8 names', async () => {
    const zip = zipEntries([
      { path: 'project.json', data: new TextEncoder().encode('{"format":1}') },
      { path: 'images/café.png', data: new Uint8Array([1, 2, 3]) },
    ]);
    const entries = await readZip(zip);
    expect(new TextDecoder().decode(entries.get('project.json'))).toBe('{"format":1}');
    expect([...entries.get('images/café.png')!]).toEqual([1, 2, 3]);
  });

  it('rejects duplicates and unsafe paths', () => {
    const data = new Uint8Array([1]);
    expect(() =>
      zipEntries([
        { path: 'a', data },
        { path: 'a', data },
      ]),
    ).toThrow();
    expect(() => zipEntries([{ path: '../a', data }])).toThrow();
  });
});

describe('readZip', () => {
  it('reads the native fixture with deflate and stored entries', async () => {
    const entries = await readZip(base64(NATIVE_FIXTURE));
    expect([...entries.keys()]).toEqual(['project.json', 'images/cover.png']);
    const project = JSON.parse(new TextDecoder().decode(entries.get('project.json')));
    expect(project.layout).toBe('SquareCoverWithTitle');
    expect(project.slots[0].title).toBe('Mila');
    expect(entries.get('images/cover.png')).toHaveLength(68);
  });

  it('rejects a truncated archive', async () => {
    await expect(readZip(base64(NATIVE_FIXTURE).slice(0, 40))).rejects.toThrow();
  });
});

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
