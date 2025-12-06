/**
 * ByteHasher - A simple, ultra-lightweight hash function for constrained 8-bit environments.
 *
 * @version 1.0.3
 * @author Anders Lindman
 * @license CC0-1.0 (Public Domain)
 *
 * This work is dedicated to the public domain under the Creative Commons Zero 1.0 Universal license.
 * For details, see: https://creativecommons.org/publicdomain/zero/1.0/
 */

const HASH_SIZE = 32; // 256-bit hash value size
const STATE_SIZE = 128; // 1024-bit internal state

// PRNG state variables (Global variables to eliminate extra reference overhead.)
let x = 0;
let y = 0;
let z = 0;
let w = 0;

const state = new Uint8Array(STATE_SIZE);

// Data-dependent 8-bit Xorshift PRNG
function rnd(data) {
  const t = ((x + data) ^ (x << 3)) & 0xff; 
  x = y;
  y = z;
  z = w;
  w = (w ^ (w >> 1) ^ t ^ ((t << 2) & 0xff)) & 0xff;
  return w;
}

function setSeed(a, b, c, d) {
  x = a & 0xff;
  y = b & 0xff;
  z = c & 0xff;
  w = d & 0xff;
}

function absorbMessage(message) {
  state.fill(0); 
  let pos = 0;

  // 1. Seed the PRNG with the first 4 bytes. 
  setSeed(message[0], message[1], message[2], message[3]);
  
  // 2. Absorb phase starts at index 4
  for (let i = 4; i < message.length; i++) {
    pos = i % STATE_SIZE;
    state[pos] ^= rnd(message[i]);
  }
  
  // 3. Finalization rounds
  for (let i = 0; i < STATE_SIZE * 8; i++) {
    const index = pos % STATE_SIZE;
    state[index] ^= rnd(state[index]);
    pos++;
  }
}

// --- HELPER FUNCTIONS ---

function pkcs7Pad(data, blockSize) {
  const padLength = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padLength);

  padded.set(data);

  for (let i = data.length; i < padded.length; i++) {
    padded[i] = padLength;
  }

  return padded;
}

function logHex(uint8Array) {
  return Array.from(uint8Array, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join(' ');
}

function hash8(message) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(message)
  const padded = pkcs7Pad(bytes, 4)
  absorbMessage(padded)
  return state.slice(0, HASH_SIZE)
}

function logHex(uint8Array) {
    const hex = Array.from(uint8Array, byte => 
        byte.toString(16).padStart(2, '0')
    ).join(' ')
    console.log(hex)
}

const hashValue = hash8("hello world")
logHex(hashValue)
