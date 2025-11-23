/**
 * ByteHasher - A simple, lightweight hash function for constrained 8-bit environments.
 *
 * @version 1.0.1
 * @author Anders Lindman
 * @license CC0-1.0 (Public Domain)
 *
 * This work is dedicated to the public domain under the Creative Commons Zero 1.0 Universal license.
 * For details, see: https://creativecommons.org/publicdomain/zero/1.0/
 */

const HASH_SIZE = 32 // 256-bit hash value size
const STATE_SIZE = 128 // 1024-bit internal state

// PRNG state variables
let x = 0
let y = 0
let z = 0
let w = 0

const digest = new Uint8Array(HASH_SIZE) // Hash output value
const state = new Uint8Array(STATE_SIZE)

// Data-dependent 8-bit Xorshift
function rnd(data) {
  const t = ((x ^ data) ^ (x << 3)) & 0xff // 8-bit mask
  x = y
  y = z
  z = w
  w = (w ^ (w >> 1) ^ t ^ ((t << 2) & 0xff)) & 0xff
  return w
}

function setSeed(a, b, c, d) {
  x = a & 0xff
  y = b & 0xff
  z = c & 0xff
  w = d & 0xff
}

function absorbMessage(message) {
  state.fill(0)
  let pos = 0
  setSeed(message[0], message[1], message[2], message[3])
  for (let i = 4; i < message.length; i++) {
    pos = i % STATE_SIZE
    state[pos] ^= rnd(message[i])
  }
  // Two last rounds to absorb bits at the end of the message. 
  for (let i = 0; i < STATE_SIZE * 2; i++) {
    const index = pos % STATE_SIZE
    state[index] ^= rnd(state[index])
    pos++
  }
}

// Finalizing phase to obfuscate the internal state.
function finalizeState() {
  for (let i = 0; i < STATE_SIZE; i += 4) {
    setSeed(state[i], state[i + 1], state[i + 2], state[i + 3])
    for (let j = 0; j < STATE_SIZE; j++) {
      state[j] ^= rnd(0)
    }
  }
}

function foldState() {
  let feedback = 0

  for (let i = 0; i < HASH_SIZE; i++) {
    let acc =
        state[i]
      + state[i + HASH_SIZE]
      + state[i + HASH_SIZE * 2]
      + state[i + HASH_SIZE * 3]
      + feedback
    acc &= 0xff
    digest[i] = acc
    feedback = acc // feedback
  }

  return digest
}

function pkcs7Pad(data, blockSize) {
    const padLength = blockSize - (data.length % blockSize)
    const padded = new Uint8Array(data.length + padLength)
    
    padded.set(data)
    
    for (let i = data.length; i < padded.length; i++) {
        padded[i] = padLength
    }
    
    return padded 
}

function byteHasher(message) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(message)
  const padded = pkcs7Pad(bytes, 4)

  absorbMessage(padded)
  finalizeState()

  return foldState()
}

function logHex(uint8Array) {
    const hex = Array.from(uint8Array, byte => 
        byte.toString(16).padStart(2, '0')
    ).join(' ')
    console.log(hex)
}

const hashValue = byteHasher("hello world")
logHex(hashValue)
