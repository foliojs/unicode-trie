# Changelog

## Unreleased

- Replaced `pako` and `tiny-inflate` with `fflate` for trie compression and decompression.
- Use native `zlib` package in Node
- [BREAKING CHANGE] Converted the package to native ECMAScript modules with named exports. The package now declares explicit entry points and requires Node.js 20.17.0 or later.
- [BREAKING CHANGE] Remove double compression of trie data.

## 2.0.0 — 2019-11-17

- Made serialized tries use little-endian data on big-endian machines.
- Replaced deprecated `new Buffer()` usage and corrected the example.

## 1.0.0 — 2019-06-16

- Ported the implementation from CoffeeScript to ES6 JavaScript.

## 0.3.1 — 2015-11-10

- Fixed trie builder compaction bugs that prevented block deduplication and produced unnecessarily large data.

## 0.3.0 — 2015-02-14

- Added typed-array input support and switched decompression from `pako` to `tiny-inflate`.
- Stored the uncompressed data length in the serialized trie header.

## 0.2.0 — 2014-12-16

- Added a smaller compressed binary format for serialized tries.

## 0.1.2 — 2014-07-13

- Added `UnicodeTrie#toJSON()`.

## 0.1.0 — 2014-07-13

- Initial release of the Unicode trie builder and lookup API.
