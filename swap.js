const os = require('os');

const swap = (b, n, m) => {
  let i = b[n];
  b[n] = b[m];
  b[m] = i;
};

const swap32 = array => {
  const len = array.length;
  for (let i = 0; i < len; i += 4) {
    swap(array, i, i + 3);
    swap(array, i + 1, i + 2);
  }
};

const swap32BE = array => {
  if (os.endianness() === 'LE') {
    swap32(array);
  }
};

module.exports = {
  swap32BE: swap32BE
};