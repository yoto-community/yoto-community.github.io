export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const MAX32 = 0xffffffff;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let table: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  const values = crcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) {
    crc = values[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertSafePath(path: string): void {
  if (
    path === '' ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').includes('..')
  ) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
}

function dosDateTime(now: Date): { time: number; date: number } {
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    date:
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  };
}

export function zipEntries(entries: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const seen = new Set<string>();
  const locals: Uint8Array[] = [];
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  let offset = 0;

  for (const entry of entries) {
    assertSafePath(entry.path);
    if (seen.has(entry.path)) throw new Error(`Duplicate ZIP entry: ${entry.path}`);
    seen.add(entry.path);

    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, LOCAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, METHOD_STORE, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);

    locals.push(local);
    central.push({ name, crc, size: entry.data.length, offset });
    offset += local.length;
  }

  const centralSize = central.reduce((sum, item) => sum + 46 + item.name.length, 0);
  const out = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const local of locals) {
    out.set(local, cursor);
    cursor += local.length;
  }

  for (const item of central) {
    const view = new DataView(out.buffer, cursor, 46);
    view.setUint32(0, CENTRAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, FLAG_UTF8, true);
    view.setUint16(10, METHOD_STORE, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, item.crc, true);
    view.setUint32(20, item.size, true);
    view.setUint32(24, item.size, true);
    view.setUint16(28, item.name.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, item.offset, true);
    out.set(item.name, cursor + 46);
    cursor += 46 + item.name.length;
  }

  const eocd = new DataView(out.buffer, cursor, 22);
  eocd.setUint32(0, EOCD_SIG, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, central.length, true);
  eocd.setUint16(10, central.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read compressed ZIP entries.');
  }
  // slice() yields an ArrayBuffer-backed copy, which BlobPart requires (TS 5.7+ generics).
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  const minimum = Math.max(0, data.length - 22 - 0xffff);
  for (let index = data.length - 22; index >= minimum; index--) {
    if (view.getUint32(index, true) === EOCD_SIG) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || centralOffset === MAX32) throw new Error('ZIP64 is not supported');

  const result = new Map<string, Uint8Array>();
  let cursor = centralOffset;

  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIG) {
      throw new Error('Broken ZIP central directory');
    }

    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);

    if ([compressedSize, uncompressedSize, localOffset].includes(MAX32)) {
      throw new Error('ZIP64 is not supported');
    }
    if (uncompressedSize > 100 * 1024 * 1024) {
      throw new Error('ZIP entry is too large');
    }

    const name = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    assertSafePath(name);
    if (result.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
      throw new Error('Broken ZIP local header');
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(start, start + compressedSize);
    if (compressed.length !== compressedSize) throw new Error('Truncated ZIP entry');

    let bytes: Uint8Array;
    if (method === METHOD_STORE) bytes = compressed.slice();
    else if (method === METHOD_DEFLATE) bytes = await inflateRaw(compressed);
    else throw new Error(`Unsupported ZIP compression method: ${method}`);

    if (bytes.length !== uncompressedSize) throw new Error('ZIP size mismatch');
    if (crc32(bytes) !== crc) throw new Error('ZIP CRC mismatch');

    result.set(name, bytes);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return result;
}
