/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UnicodeTrie = require('./');
const pako = require('pako');

var UnicodeTrieBuilder = (function() {
  let SHIFT_1 = undefined;
  let SHIFT_2 = undefined;
  let SHIFT_1_2 = undefined;
  let OMITTED_BMP_INDEX_1_LENGTH = undefined;
  let CP_PER_INDEX_1_ENTRY = undefined;
  let INDEX_2_BLOCK_LENGTH = undefined;
  let INDEX_2_MASK = undefined;
  let DATA_BLOCK_LENGTH = undefined;
  let DATA_MASK = undefined;
  let INDEX_SHIFT = undefined;
  let DATA_GRANULARITY = undefined;
  let INDEX_2_OFFSET = undefined;
  let LSCP_INDEX_2_OFFSET = undefined;
  let LSCP_INDEX_2_LENGTH = undefined;
  let INDEX_2_BMP_LENGTH = undefined;
  let UTF8_2B_INDEX_2_OFFSET = undefined;
  let UTF8_2B_INDEX_2_LENGTH = undefined;
  let INDEX_1_OFFSET = undefined;
  let MAX_INDEX_1_LENGTH = undefined;
  let BAD_UTF8_DATA_OFFSET = undefined;
  let DATA_START_OFFSET = undefined;
  let DATA_NULL_OFFSET = undefined;
  let NEW_DATA_START_OFFSET = undefined;
  let DATA_0800_OFFSET = undefined;
  let INITIAL_DATA_LENGTH = undefined;
  let MEDIUM_DATA_LENGTH = undefined;
  let MAX_DATA_LENGTH = undefined;
  let INDEX_1_LENGTH = undefined;
  MAX_DATA_LENGTH = undefined;
  let INDEX_GAP_OFFSET = undefined;
  let INDEX_GAP_LENGTH = undefined;
  let MAX_INDEX_2_LENGTH = undefined;
  let INDEX_2_NULL_OFFSET = undefined;
  let INDEX_2_START_OFFSET = undefined;
  let MAX_INDEX_LENGTH = undefined;
  let equal_int = undefined;
  UnicodeTrieBuilder = class UnicodeTrieBuilder {
    static initClass() {
      // Shift size for getting the index-1 table offset.
      SHIFT_1 = 6 + 5;

      // Shift size for getting the index-2 table offset.
      SHIFT_2 = 5;

      // Difference between the two shift sizes,
      // for getting an index-1 offset from an index-2 offset. 6=11-5
      SHIFT_1_2 = SHIFT_1 - SHIFT_2;

      // Number of index-1 entries for the BMP. 32=0x20
      // This part of the index-1 table is omitted from the serialized form.
      OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> SHIFT_1;

      // Number of code points per index-1 table entry. 2048=0x800
      CP_PER_INDEX_1_ENTRY = 1 << SHIFT_1;

      // Number of entries in an index-2 block. 64=0x40
      INDEX_2_BLOCK_LENGTH = 1 << SHIFT_1_2;

      // Mask for getting the lower bits for the in-index-2-block offset. */
      INDEX_2_MASK = INDEX_2_BLOCK_LENGTH - 1;

      // Number of entries in a data block. 32=0x20
      DATA_BLOCK_LENGTH = 1 << SHIFT_2;

      // Mask for getting the lower bits for the in-data-block offset.
      DATA_MASK = DATA_BLOCK_LENGTH - 1;

      // Shift size for shifting left the index array values.
      // Increases possible data size with 16-bit index values at the cost
      // of compactability.
      // This requires data blocks to be aligned by DATA_GRANULARITY.
      INDEX_SHIFT = 2;

      // The alignment size of a data block. Also the granularity for compaction.
      DATA_GRANULARITY = 1 << INDEX_SHIFT;

      // The BMP part of the index-2 table is fixed and linear and starts at offset 0.
      // Length=2048=0x800=0x10000>>SHIFT_2.
      INDEX_2_OFFSET = 0;

      // The part of the index-2 table for U+D800..U+DBFF stores values for
      // lead surrogate code _units_ not code _points_.
      // Values for lead surrogate code _points_ are indexed with this portion of the table.
      // Length=32=0x20=0x400>>SHIFT_2. (There are 1024=0x400 lead surrogates.)
      LSCP_INDEX_2_OFFSET = 0x10000 >> SHIFT_2;
      LSCP_INDEX_2_LENGTH = 0x400 >> SHIFT_2;

      // Count the lengths of both BMP pieces. 2080=0x820
      INDEX_2_BMP_LENGTH = LSCP_INDEX_2_OFFSET + LSCP_INDEX_2_LENGTH;

      // The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
      // Length 32=0x20 for lead bytes C0..DF, regardless of SHIFT_2.
      UTF8_2B_INDEX_2_OFFSET = INDEX_2_BMP_LENGTH;
      UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6;  // U+0800 is the first code point after 2-byte UTF-8

      // The index-1 table, only used for supplementary code points, at offset 2112=0x840.
      // Variable length, for code points up to highStart, where the last single-value range starts.
      // Maximum length 512=0x200=0x100000>>SHIFT_1.
      // (For 0x100000 supplementary code points U+10000..U+10ffff.)
      //
      // The part of the index-2 table for supplementary code points starts
      // after this index-1 table.
      //
      // Both the index-1 table and the following part of the index-2 table
      // are omitted completely if there is only BMP data.
      INDEX_1_OFFSET = UTF8_2B_INDEX_2_OFFSET + UTF8_2B_INDEX_2_LENGTH;
      MAX_INDEX_1_LENGTH = 0x100000 >> SHIFT_1;

      // The illegal-UTF-8 data block follows the ASCII block, at offset 128=0x80.
      // Used with linear access for single bytes 0..0xbf for simple error handling.
      // Length 64=0x40, not DATA_BLOCK_LENGTH.
      BAD_UTF8_DATA_OFFSET = 0x80;

      // The start of non-linear-ASCII data blocks, at offset 192=0xc0.
      // !!!!
      DATA_START_OFFSET = 0xc0;

      // The null data block.
      // Length 64=0x40 even if DATA_BLOCK_LENGTH is smaller,
      // to work with 6-bit trail bytes from 2-byte UTF-8.
      DATA_NULL_OFFSET = DATA_START_OFFSET;

      // The start of allocated data blocks.
      NEW_DATA_START_OFFSET = DATA_NULL_OFFSET + 0x40;

      // The start of data blocks for U+0800 and above.
      // Below, compaction uses a block length of 64 for 2-byte UTF-8.
      // From here on, compaction uses DATA_BLOCK_LENGTH.
      // Data values for 0x780 code points beyond ASCII.
      DATA_0800_OFFSET = NEW_DATA_START_OFFSET + 0x780;

      // Start with allocation of 16k data entries. */
      INITIAL_DATA_LENGTH = 1 << 14;

      // Grow about 8x each time.
      MEDIUM_DATA_LENGTH = 1 << 17;

      // Maximum length of the runtime data array.
      // Limited by 16-bit index values that are left-shifted by INDEX_SHIFT,
      // and by uint16_t UTrie2Header.shiftedDataLength.
      MAX_DATA_LENGTH = 0xffff << INDEX_SHIFT;

      INDEX_1_LENGTH = 0x110000 >> SHIFT_1;

      // Maximum length of the build-time data array.
      // One entry per 0x110000 code points, plus the illegal-UTF-8 block and the null block,
      // plus values for the 0x400 surrogate code units.
      MAX_DATA_LENGTH = 0x110000 + 0x40 + 0x40 + 0x400;

      // At build time, leave a gap in the index-2 table,
      // at least as long as the maximum lengths of the 2-byte UTF-8 index-2 table
      // and the supplementary index-1 table.
      // Round up to INDEX_2_BLOCK_LENGTH for proper compacting.
      INDEX_GAP_OFFSET = INDEX_2_BMP_LENGTH;
      INDEX_GAP_LENGTH = ((UTF8_2B_INDEX_2_LENGTH + MAX_INDEX_1_LENGTH) + INDEX_2_MASK) & ~INDEX_2_MASK;

      // Maximum length of the build-time index-2 array.
      // Maximum number of Unicode code points (0x110000) shifted right by SHIFT_2,
      // plus the part of the index-2 table for lead surrogate code points,
      // plus the build-time index gap,
      // plus the null index-2 block.)
      MAX_INDEX_2_LENGTH = (0x110000 >> SHIFT_2) + LSCP_INDEX_2_LENGTH + INDEX_GAP_LENGTH + INDEX_2_BLOCK_LENGTH;

      // The null index-2 block, following the gap in the index-2 table.
      INDEX_2_NULL_OFFSET = INDEX_GAP_OFFSET + INDEX_GAP_LENGTH;

      // The start of allocated index-2 blocks.
      INDEX_2_START_OFFSET = INDEX_2_NULL_OFFSET + INDEX_2_BLOCK_LENGTH;

      // Maximum length of the runtime index array.
      // Limited by its own 16-bit index values, and by uint16_t UTrie2Header.indexLength.
      // (The actual maximum length is lower,
      // (0x110000>>SHIFT_2)+UTF8_2B_INDEX_2_LENGTH+MAX_INDEX_1_LENGTH.)
      MAX_INDEX_LENGTH = 0xffff;

      equal_int = function(a, s, t, length) {
        for (let i = 0, end = length; i < end; i++) {
          if (a[s + i] !== a[t + i]) { return false; }
        }

        return true;
      };
    }

    constructor(initialValue, errorValue) {
      let i, j;
      let end;
      let step;
      let asc, step1;
      let asc1, end1, step2;
      let end2;
      let end3;
      let end4;
      let end5;
      let end6;
      let step3;
      if (initialValue == null) { initialValue = 0; }
      this.initialValue = initialValue;
      if (errorValue == null) { errorValue = 0; }
      this.errorValue = errorValue;
      this.index1 = new Int32Array(INDEX_1_LENGTH);
      this.index2 = new Int32Array(MAX_INDEX_2_LENGTH);
      this.highStart = 0x110000;

      this.data = new Uint32Array(INITIAL_DATA_LENGTH);
      this.dataCapacity = INITIAL_DATA_LENGTH;

      this.firstFreeBlock = 0;
      this.isCompacted = false;

      // Multi-purpose per-data-block table.
      //
      // Before compacting:
      //
      // Per-data-block reference counters/free-block list.
      //  0: unused
      // >0: reference counter (number of index-2 entries pointing here)
      // <0: next free data block in free-block list
      //
      // While compacting:
      //
      // Map of adjusted indexes, used in compactData() and compactIndex2().
      // Maps from original indexes to new ones.
      this.map = new Int32Array(MAX_DATA_LENGTH >> SHIFT_2);

      for (i = 0; i < 0x80; i++) {
        this.data[i] = this.initialValue;
      }

      for (i = i; i < 0xc0; i++) {
        this.data[i] = this.errorValue;
      }

      for (i = DATA_NULL_OFFSET, end = NEW_DATA_START_OFFSET; i < end; i++) {
        this.data[i] = this.initialValue;
      }

      this.dataNullOffset = DATA_NULL_OFFSET;
      this.dataLength = NEW_DATA_START_OFFSET;

      // set the index-2 indexes for the 2=0x80>>SHIFT_2 ASCII data blocks
      i = 0;
      for (j = 0, step = DATA_BLOCK_LENGTH; j < 0x80; j += step) {
        this.index2[i] = j;
        this.map[i++] = 1;
      }

      // reference counts for the bad-UTF-8-data block
      for (j = j, step1 = DATA_BLOCK_LENGTH, asc = step1 > 0; asc ? j < 0xc0 : j > 0xc0; j += step1) {
        this.map[i++] = 0;
      }

      // Reference counts for the null data block: all blocks except for the ASCII blocks.
      // Plus 1 so that we don't drop this block during compaction.
      // Plus as many as needed for lead surrogate code points.
      // i==newTrie->dataNullOffset
      this.map[i++] = ((0x110000 >> SHIFT_2) - (0x80 >> SHIFT_2)) + 1 + LSCP_INDEX_2_LENGTH;
      j += DATA_BLOCK_LENGTH;
      for (j = j, end1 = NEW_DATA_START_OFFSET, step2 = DATA_BLOCK_LENGTH, asc1 = step2 > 0; asc1 ? j < end1 : j > end1; j += step2) {
        this.map[i++] = 0;
      }

      // set the remaining indexes in the BMP index-2 block
      // to the null data block
      for (i = 0x80 >> SHIFT_2, end2 = INDEX_2_BMP_LENGTH; i < end2; i++) {
        this.index2[i] = DATA_NULL_OFFSET;
      }

      // Fill the index gap with impossible values so that compaction
      // does not overlap other index-2 blocks with the gap.
      for (i = 0, end3 = INDEX_GAP_LENGTH; i < end3; i++) {
        this.index2[INDEX_GAP_OFFSET + i] = -1;
      }

      // set the indexes in the null index-2 block
      for (i = 0, end4 = INDEX_2_BLOCK_LENGTH; i < end4; i++) {
        this.index2[INDEX_2_NULL_OFFSET + i] = DATA_NULL_OFFSET;
      }

      this.index2NullOffset = INDEX_2_NULL_OFFSET;
      this.index2Length = INDEX_2_START_OFFSET;

      // set the index-1 indexes for the linear index-2 block
      j = 0;
      for (i = 0, end5 = OMITTED_BMP_INDEX_1_LENGTH; i < end5; i++) {
        this.index1[i] = j;
        j += INDEX_2_BLOCK_LENGTH;
      }

      // set the remaining index-1 indexes to the null index-2 block
      for (i = i, end6 = INDEX_1_LENGTH; i < end6; i++) {
        this.index1[i] = INDEX_2_NULL_OFFSET;
      }

      // Preallocate and reset data for U+0080..U+07ff,
      // for 2-byte UTF-8 which will be compacted in 64-blocks
      // even if DATA_BLOCK_LENGTH is smaller.
      for (i = 0x80, step3 = DATA_BLOCK_LENGTH; i < 0x800; i += step3) {
        this.set(i, this.initialValue);
      }

    }

    set(codePoint, value) {
      if ((codePoint < 0) || (codePoint > 0x10ffff)) {
        throw new Error('Invalid code point');
      }

      if (this.isCompacted) {
        throw new Error('Already compacted');
      }

      const block = this._getDataBlock(codePoint, true);
      this.data[block + (codePoint & DATA_MASK)] = value;
      return this;
    }

    setRange(start, end, value, overwrite) {
      let block, repeatBlock;
      if (overwrite == null) { overwrite = true; }
      if ((start > 0x10ffff) || (end > 0x10ffff) || (start > end)) {
        throw new Error('Invalid code point');
      }

      if (this.isCompacted) {
        throw new Error('Already compacted');
      }

      if (!overwrite && (value === this.initialValue)) {
        return this; // nothing to do
      }

      let limit = end + 1;
      if ((start & DATA_MASK) !== 0) {
        // set partial block at [start..following block boundary
        block = this._getDataBlock(start, true);

        const nextStart = (start + DATA_BLOCK_LENGTH) & ~DATA_MASK;
        if (nextStart <= limit) {
          this._fillBlock(block, start & DATA_MASK, DATA_BLOCK_LENGTH, value, this.initialValue, overwrite);
          start = nextStart;
        } else {
          this._fillBlock(block, start & DATA_MASK, limit & DATA_MASK, value, this.initialValue, overwrite);
          return this;
        }
      }

      // number of positions in the last, partial block
      const rest = limit & DATA_MASK;

      // round down limit to a block boundary
      limit &= ~DATA_MASK;

      // iterate over all-value blocks
      if (value === this.initialValue) {
        repeatBlock = this.dataNullOffset;
      } else {
        repeatBlock = -1;
      }

      while (start < limit) {
        let setRepeatBlock = false;

        if ((value === this.initialValue) && this._isInNullBlock(start, true)) {
          start += DATA_BLOCK_LENGTH; // nothing to do
          continue;
        }

        // get index value
        let i2 = this._getIndex2Block(start, true);
        i2 += (start >> SHIFT_2) & INDEX_2_MASK;

        block = this.index2[i2];
        if (this._isWritableBlock(block)) {
          // already allocated
          if (overwrite && (block >= DATA_0800_OFFSET)) {
            // We overwrite all values, and it's not a
            // protected (ASCII-linear or 2-byte UTF-8) block:
            // replace with the repeatBlock.
            setRepeatBlock = true;
          } else {
            // protected block: just write the values into this block
            this._fillBlock(block, 0, DATA_BLOCK_LENGTH, value, this.initialValue, overwrite);
          }

        } else if ((this.data[block] !== value) && (overwrite || (block === this.dataNullOffset))) {
          // Set the repeatBlock instead of the null block or previous repeat block:
          //
          // If !isWritableBlock() then all entries in the block have the same value
          // because it's the null block or a range block (the repeatBlock from a previous
          // call to utrie2_setRange32()).
          // No other blocks are used multiple times before compacting.
          //
          // The null block is the only non-writable block with the initialValue because
          // of the repeatBlock initialization above. (If value==initialValue, then
          // the repeatBlock will be the null data block.)
          //
          // We set our repeatBlock if the desired value differs from the block's value,
          // and if we overwrite any data or if the data is all initial values
          // (which is the same as the block being the null block, see above).
          setRepeatBlock = true;
        }

        if (setRepeatBlock) {
          if (repeatBlock >= 0) {
            this._setIndex2Entry(i2, repeatBlock);
          } else {
            // create and set and fill the repeatBlock
            repeatBlock = this._getDataBlock(start, true);
            this._writeBlock(repeatBlock, value);
          }
        }

        start += DATA_BLOCK_LENGTH;
      }

      if (rest > 0) {
        // set partial block at [last block boundary..limit
        block = this._getDataBlock(start, true);
        this._fillBlock(block, 0, rest, value, this.initialValue, overwrite);
      }

      return this;
    }

    get(c, fromLSCP) {
      let i2;
      if (fromLSCP == null) { fromLSCP = true; }
      if ((c < 0) || (c > 0x10ffff)) {
        return this.errorValue;
      }

      if ((c >= this.highStart) && (!((c >= 0xd800) && (c < 0xdc00)) || fromLSCP)) {
        return this.data[this.dataLength - DATA_GRANULARITY];
      }

      if (((c >= 0xd800) && (c < 0xdc00)) && fromLSCP) {
        i2 = (LSCP_INDEX_2_OFFSET - (0xd800 >> SHIFT_2)) + (c >> SHIFT_2);
      } else {
        i2 = this.index1[c >> SHIFT_1] + ((c >> SHIFT_2) & INDEX_2_MASK);
      }

      const block = this.index2[i2];
      return this.data[block + (c & DATA_MASK)];
    }

    _isInNullBlock(c, forLSCP) {
      let i2;
      if (((c & 0xfffffc00) === 0xd800) && forLSCP) {
        i2 = (LSCP_INDEX_2_OFFSET - (0xd800 >> SHIFT_2)) + (c >> SHIFT_2);
      } else {
        i2 = this.index1[c >> SHIFT_1] + ((c >> SHIFT_2) & INDEX_2_MASK);
      }

      const block = this.index2[i2];
      return block === this.dataNullOffset;
    }

    _allocIndex2Block() {
      const newBlock = this.index2Length;
      const newTop = newBlock + INDEX_2_BLOCK_LENGTH;
      if (newTop > this.index2.length) {
        // Should never occur.
        // Either MAX_BUILD_TIME_INDEX_LENGTH is incorrect,
        // or the code writes more values than should be possible.
        throw new Error("Internal error in Trie2 creation.");
      }

      this.index2Length = newTop;
      this.index2.set(this.index2.subarray(this.index2NullOffset, this.index2NullOffset + INDEX_2_BLOCK_LENGTH), newBlock);

      return newBlock;
    }

    _getIndex2Block(c, forLSCP) {
      if ((c >= 0xd800) && (c < 0xdc00) && forLSCP) {
        return LSCP_INDEX_2_OFFSET;
      }

      const i1 = c >> SHIFT_1;
      let i2 = this.index1[i1];
      if (i2 === this.index2NullOffset) {
        i2 = this._allocIndex2Block();
        this.index1[i1] = i2;
      }

      return i2;
    }

    _isWritableBlock(block) {
      return (block !== this.dataNullOffset) && (this.map[block >> SHIFT_2] === 1);
    }

    _allocDataBlock(copyBlock) {
      let newBlock;
      if (this.firstFreeBlock !== 0) {
        // get the first free block
        newBlock = this.firstFreeBlock;
        this.firstFreeBlock = -this.map[newBlock >> SHIFT_2];
      } else {
        // get a new block from the high end
        newBlock = this.dataLength;
        const newTop = newBlock + DATA_BLOCK_LENGTH;
        if (newTop > this.dataCapacity) {
          // out of memory in the data array
          let capacity;
          if (this.dataCapacity < MEDIUM_DATA_LENGTH) {
            capacity = MEDIUM_DATA_LENGTH;
          } else if (this.dataCapacity < MAX_DATA_LENGTH) {
            capacity = MAX_DATA_LENGTH;
          } else {
            // Should never occur.
            // Either MAX_DATA_LENGTH is incorrect,
            // or the code writes more values than should be possible.
            throw new Error("Internal error in Trie2 creation.");
          }

          const newData = new Uint32Array(capacity);
          newData.set(this.data.subarray(0, this.dataLength));
          this.data = newData;
          this.dataCapacity = capacity;
        }

        this.dataLength = newTop;
      }

      this.data.set(this.data.subarray(copyBlock, copyBlock + DATA_BLOCK_LENGTH), newBlock);
      this.map[newBlock >> SHIFT_2] = 0;
      return newBlock;
    }

    _releaseDataBlock(block) {
      // put this block at the front of the free-block chain
      this.map[block >> SHIFT_2] = -this.firstFreeBlock;
      return this.firstFreeBlock = block;
    }

    _setIndex2Entry(i2, block) {
      ++this.map[block >> SHIFT_2];  // increment first, in case block == oldBlock!
      const oldBlock = this.index2[i2];
      if (--this.map[oldBlock >> SHIFT_2] === 0) {
        this._releaseDataBlock(oldBlock);
      }

      return this.index2[i2] = block;
    }

    _getDataBlock(c, forLSCP) {
      let i2 = this._getIndex2Block(c, forLSCP);
      i2 += (c >> SHIFT_2) & INDEX_2_MASK;

      const oldBlock = this.index2[i2];
      if (this._isWritableBlock(oldBlock)) {
        return oldBlock;
      }

      // allocate a new data block
      const newBlock = this._allocDataBlock(oldBlock);
      this._setIndex2Entry(i2, newBlock);
      return newBlock;
    }

    _fillBlock(block, start, limit, value, initialValue, overwrite) {
      let i;
      if (overwrite) {
        let end;
        for (i = block+start, end = block+limit; i < end; i++) {
          this.data[i] = value;
        }
      } else {
        let end1;
        for (i = block+start, end1 = block+limit; i < end1; i++) {
          if (this.data[i] === initialValue) {
            this.data[i] = value;
          }
        }
      }

    }

    _writeBlock(block, value) {
      const limit = block + DATA_BLOCK_LENGTH;
      while (block < limit) {
        this.data[block++] = value;
      }

    }

    _findHighStart(highValue) {
      let prevBlock, prevI2Block;
      const data32 = this.data;
      const { initialValue } = this;
      const { index2NullOffset } = this;
      const nullBlock = this.dataNullOffset;

      // set variables for previous range
      if (highValue === initialValue) {
        prevI2Block = index2NullOffset;
        prevBlock = nullBlock;
      } else {
        prevI2Block = -1;
        prevBlock = -1;
      }

      const prev = 0x110000;

      // enumerate index-2 blocks
      let i1 = INDEX_1_LENGTH;
      let c = prev;
      while (c > 0) {
        const i2Block = this.index1[--i1];
        if (i2Block === prevI2Block) {
          // the index-2 block is the same as the previous one, and filled with highValue
          c -= CP_PER_INDEX_1_ENTRY;
          continue;
        }

        prevI2Block = i2Block;
        if (i2Block === index2NullOffset) {
          // this is the null index-2 block
          if (highValue !== initialValue) { return c; }
          c -= CP_PER_INDEX_1_ENTRY;
        } else {
          // enumerate data blocks for one index-2 block
          let i2 = INDEX_2_BLOCK_LENGTH;
          while (i2 > 0) {
            const block = this.index2[i2Block + --i2];
            if (block === prevBlock) {
              // the block is the same as the previous one, and filled with highValue
              c -= DATA_BLOCK_LENGTH;
              continue;
            }

            prevBlock = block;
            if (block === nullBlock) {
              // this is the null data block
              if (highValue !== initialValue) { return c; }
              c -= DATA_BLOCK_LENGTH;
            } else {
              let j = DATA_BLOCK_LENGTH;
              while (j > 0) {
                const value = data32[block + --j];
                if (value !== highValue) { return c; }
                --c;
              }
            }
          }
        }
      }

      // deliver last range
      return 0;
    }

    _findSameDataBlock(dataLength, otherBlock, blockLength) {
      // ensure that we do not even partially get past dataLength
      dataLength -= blockLength;
      let block = 0;
      while (block <= dataLength) {
        if (equal_int(this.data, block, otherBlock, blockLength)) { return block; }
        block += DATA_GRANULARITY;
      }

      return -1;
    }

    _findSameIndex2Block(index2Length, otherBlock) {
      // ensure that we do not even partially get past index2Length
      index2Length -= INDEX_2_BLOCK_LENGTH;
      for (let block = 0, end = index2Length; block <= end; block++) {
        if (equal_int(this.index2, block, otherBlock, INDEX_2_BLOCK_LENGTH)) { return block; }
      }

      return -1;
    }

    _compactData() {
      // do not compact linear-ASCII data
      let newStart = DATA_START_OFFSET;
      let start = 0;
      let i = 0;

      while (start < newStart) {
        this.map[i++] = start;
        start += DATA_BLOCK_LENGTH;
      }

      // Start with a block length of 64 for 2-byte UTF-8,
      // then switch to DATA_BLOCK_LENGTH.
      let blockLength = 64;
      let blockCount = blockLength >> SHIFT_2;
      start = newStart;
      while (start < this.dataLength) {
        // start: index of first entry of current block
        // newStart: index where the current block is to be moved
        //           (right after current end of already-compacted data)
        var mapIndex, movedStart;
        if (start === DATA_0800_OFFSET) {
          blockLength = DATA_BLOCK_LENGTH;
          blockCount = 1;
        }

        // skip blocks that are not used
        if (this.map[start >> SHIFT_2] <= 0) {
          // advance start to the next block
          start += blockLength;

          // leave newStart with the previous block!
          continue;
        }

        // search for an identical block
        if ((movedStart = this._findSameDataBlock(newStart, start, blockLength)) >= 0) {
          // found an identical block, set the other block's index value for the current block
          mapIndex = start >> SHIFT_2;
          for (i = blockCount; i > 0; i--) {
            this.map[mapIndex++] = movedStart;
            movedStart += DATA_BLOCK_LENGTH;
          }

          // advance start to the next block
          start += blockLength;

          // leave newStart with the previous block!
          continue;
        }

        // see if the beginning of this block can be overlapped with the end of the previous block
        // look for maximum overlap (modulo granularity) with the previous, adjacent block
        let overlap = blockLength - DATA_GRANULARITY;
        while ((overlap > 0) && !equal_int(this.data, (newStart - overlap), start, overlap)) {
          overlap -= DATA_GRANULARITY;
        }

        if ((overlap > 0) || (newStart < start)) {
          // some overlap, or just move the whole block
          movedStart = newStart - overlap;
          mapIndex = start >> SHIFT_2;

          for (i = blockCount; i > 0; i--) {
            this.map[mapIndex++] = movedStart;
            movedStart += DATA_BLOCK_LENGTH;
          }

          // move the non-overlapping indexes to their new positions
          start += overlap;
          for (i = blockLength - overlap; i > 0; i--) {
            this.data[newStart++] = this.data[start++];
          }

        } else { // no overlap && newStart==start
          mapIndex = start >> SHIFT_2;
          for (i = blockCount; i > 0; i--) {
            this.map[mapIndex++] = start;
            start += DATA_BLOCK_LENGTH;
          }

          newStart = start;
        }
      }

      // now adjust the index-2 table
      i = 0;
      while (i < this.index2Length) {
        // Gap indexes are invalid (-1). Skip over the gap.
        if (i === INDEX_GAP_OFFSET) { i += INDEX_GAP_LENGTH; }
        this.index2[i] = this.map[this.index2[i] >> SHIFT_2];
        ++i;
      }

      this.dataNullOffset = this.map[this.dataNullOffset >> SHIFT_2];

      // ensure dataLength alignment
      while ((newStart & (DATA_GRANULARITY - 1)) !== 0) { this.data[newStart++] = this.initialValue; }
      this.dataLength = newStart;
    }

    _compactIndex2() {
      // do not compact linear-BMP index-2 blocks
      let end;
      let newStart = INDEX_2_BMP_LENGTH;
      let start = 0;
      let i = 0;

      while (start < newStart) {
        this.map[i++] = start;
        start += INDEX_2_BLOCK_LENGTH;
      }

      // Reduce the index table gap to what will be needed at runtime.
      newStart += UTF8_2B_INDEX_2_LENGTH + ((this.highStart - 0x10000) >> SHIFT_1);
      start = INDEX_2_NULL_OFFSET;
      while (start < this.index2Length) {
        // start: index of first entry of current block
        // newStart: index where the current block is to be moved
        //           (right after current end of already-compacted data)

        // search for an identical block
        var movedStart;
        if ((movedStart = this._findSameIndex2Block(newStart, start)) >= 0) {
          // found an identical block, set the other block's index value for the current block
          this.map[start >> SHIFT_1_2] = movedStart;

          // advance start to the next block
          start += INDEX_2_BLOCK_LENGTH;

          // leave newStart with the previous block!
          continue;
        }

        // see if the beginning of this block can be overlapped with the end of the previous block
        // look for maximum overlap with the previous, adjacent block
        let overlap = INDEX_2_BLOCK_LENGTH - 1;
        while ((overlap > 0) && !equal_int(this.index2, (newStart - overlap), start, overlap)) {
          --overlap;
        }

        if ((overlap > 0) || (newStart < start)) {
          // some overlap, or just move the whole block
          this.map[start >> SHIFT_1_2] = newStart - overlap;

          // move the non-overlapping indexes to their new positions
          start += overlap;
          for (i = INDEX_2_BLOCK_LENGTH - overlap; i > 0; i--) {
            this.index2[newStart++] = this.index2[start++];
          }

        } else { // no overlap && newStart==start
          this.map[start >> SHIFT_1_2] = start;
          start += INDEX_2_BLOCK_LENGTH;
          newStart = start;
        }
      }

      // now adjust the index-1 table
      for (i = 0, end = INDEX_1_LENGTH; i < end; i++) {
        this.index1[i] = this.map[this.index1[i] >> SHIFT_1_2];
      }

      this.index2NullOffset = this.map[this.index2NullOffset >> SHIFT_1_2];

      // Ensure data table alignment:
      // Needs to be granularity-aligned for 16-bit trie
      // (so that dataMove will be down-shiftable),
      // and 2-aligned for uint32_t data.

      // Arbitrary value: 0x3fffc not possible for real data.
      while ((newStart & ((DATA_GRANULARITY - 1) | 1)) !== 0) {
        this.index2[newStart++] = 0x0000ffff << INDEX_SHIFT;
      }

      return this.index2Length = newStart;
    }

    _compact() {
      // find highStart and round it up
      let highValue = this.get(0x10ffff);
      let highStart = this._findHighStart(highValue);
      highStart = (highStart + (CP_PER_INDEX_1_ENTRY - 1)) & ~(CP_PER_INDEX_1_ENTRY - 1);
      if (highStart === 0x110000) {
        highValue = this.errorValue;
      }

      // Set trie->highStart only after utrie2_get32(trie, highStart).
      // Otherwise utrie2_get32(trie, highStart) would try to read the highValue.
      this.highStart = highStart;
      if (this.highStart < 0x110000) {
        // Blank out [highStart..10ffff] to release associated data blocks.
        const suppHighStart = this.highStart <= 0x10000 ? 0x10000 : this.highStart;
        this.setRange(suppHighStart, 0x10ffff, this.initialValue, true);
      }

      this._compactData();
      if (this.highStart > 0x10000) {
        this._compactIndex2();
      }

      // Store the highValue in the data array and round up the dataLength.
      // Must be done after compactData() because that assumes that dataLength
      // is a multiple of DATA_BLOCK_LENGTH.
      this.data[this.dataLength++] = highValue;
      while ((this.dataLength & (DATA_GRANULARITY - 1)) !== 0) {
        this.data[this.dataLength++] = this.initialValue;
      }

      return this.isCompacted = true;
    }

    freeze() {
      let allIndexesLength, i;
      let end;
      let end1;
      let end2;
      let end5;
      if (!this.isCompacted) {
        this._compact();
      }

      if (this.highStart <= 0x10000) {
        allIndexesLength = INDEX_1_OFFSET;
      } else {
        allIndexesLength = this.index2Length;
      }

      const dataMove = allIndexesLength;

      // for shiftedDataLength
      if ((allIndexesLength > MAX_INDEX_LENGTH) ||
         ((dataMove + this.dataNullOffset) > 0xffff) ||
         ((dataMove + DATA_0800_OFFSET) > 0xffff) ||
         ((dataMove + this.dataLength) > MAX_DATA_LENGTH)) {
        throw new Error("Trie data is too large.");
      }

      // calculate the sizes of, and allocate, the index and data arrays
      const indexLength = allIndexesLength + this.dataLength;
      const data = new Int32Array(indexLength);

      // write the index-2 array values shifted right by INDEX_SHIFT, after adding dataMove
      let destIdx = 0;
      for (i = 0, end = INDEX_2_BMP_LENGTH; i < end; i++) {
        data[destIdx++] = ((this.index2[i] + dataMove) >> INDEX_SHIFT);
      }

      // write UTF-8 2-byte index-2 values, not right-shifted
      for (i = 0, end1 = 0xc2 - 0xc0; i < end1; i++) { // C0..C1
        data[destIdx++] = (dataMove + BAD_UTF8_DATA_OFFSET);
      }

      for (i = i, end2 = 0xe0 - 0xc0; i < end2; i++) { // C2..DF
        data[destIdx++] = (dataMove + this.index2[i << (6 - SHIFT_2)]);
      }

      if (this.highStart > 0x10000) {
        let end3;
        let end4;
        const index1Length = (this.highStart - 0x10000) >> SHIFT_1;
        const index2Offset = INDEX_2_BMP_LENGTH + UTF8_2B_INDEX_2_LENGTH + index1Length;

        // write 16-bit index-1 values for supplementary code points
        for (i = 0, end3 = index1Length; i < end3; i++) {
          data[destIdx++] = (INDEX_2_OFFSET + this.index1[i + OMITTED_BMP_INDEX_1_LENGTH]);
        }

        // write the index-2 array values for supplementary code points,
        // shifted right by INDEX_SHIFT, after adding dataMove
        for (i = 0, end4 = this.index2Length - index2Offset; i < end4; i++) {
          data[destIdx++] = ((dataMove + this.index2[index2Offset + i]) >> INDEX_SHIFT);
        }
      }

      // write 16-bit data values
      for (i = 0, end5 = this.dataLength; i < end5; i++) {
        data[destIdx++] = this.data[i];
      }

      const dest = new UnicodeTrie({
        data,
        highStart: this.highStart,
        errorValue: this.errorValue
      });

      return dest;
    }

    // Generates a Buffer containing the serialized and compressed trie.
    // Trie data is compressed twice using the deflate algorithm to minimize file size.
    // Format:
    //   uint32_t highStart;
    //   uint32_t errorValue;
    //   uint32_t uncompressedDataLength;
    //   uint8_t trieData[dataLength];
    toBuffer() {
      const trie = this.freeze();

      const data = new Uint8Array(trie.data.buffer);
      let compressed = pako.deflateRaw(data);
      compressed = pako.deflateRaw(compressed);

      const buf = new Buffer(compressed.length + 12);
      buf.writeUInt32BE(trie.highStart, 0);
      buf.writeUInt32BE(trie.errorValue, 4);
      buf.writeUInt32BE(data.length, 8);
      for (let i = 0; i < compressed.length; i++) {
        const b = compressed[i];
        buf[i + 12] = b;
      }

      return buf;
    }
  };
  UnicodeTrieBuilder.initClass();
  return UnicodeTrieBuilder;
})();

module.exports = UnicodeTrieBuilder;