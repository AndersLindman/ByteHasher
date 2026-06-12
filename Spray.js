// Spray - A 32-bit version of ByteHasher with data-dependent bit rotation and indexing.

const HASH_SIZE_BYTES = 32;
const STATE_SIZE_U32 = 64;
const RATE_U32 = 16;
const RATE_BYTES = RATE_U32 * 4; // 64

const state = new Uint32Array(STATE_SIZE_U32);
const encoder = new TextEncoder();

const ROUND_CONSTANTS = new Uint32Array([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]);

const SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]);

const INITIAL_X = 0xdeadbeef;
const INITIAL_Y = 0xfaceb00c;
const INITIAL_Z = 0x8badf00d;
const INITIAL_W = 0x12345678;

function rnd(data) {
    const n = z & 0x1f;
    let t = ((data >>> n) | (data << (32 - n))) ^ (x << 11);
    x = y; y = z; z = w;
    w = w ^ (w >>> 19) ^ t ^ (t >>> 8);
    return w;
}

function confuse() {
    for (let i = 0; i < STATE_SIZE_U32; i++) {
        const offset = (state[(i + 27) & 63] & 63) | 1; // Always odd, keeping it coprime to 64
        const val = state[i];
        state[i] = (SBOX[(val >>> 24) & 0xff] << 24) |
            (SBOX[(val >>> 16) & 0xff] << 16) |
            (SBOX[(val >>> 8) & 0xff] << 8) |
            SBOX[val & 0xff];
        state[i] ^= state[(i + offset) & 63] >>> 3;
    }
}

function diffuse() {
    for (let i = 0; i < STATE_SIZE_U32; i++) {
        state[i] ^= rnd(state[(i + 37) & 63]);
    }
}

function permute() {
    for (let r = 0; r < 8; r++) {
        state[0] ^= ROUND_CONSTANTS[r];
        diffuse();
        confuse();
    }
}

// ------------------------------
// ABSORB PHASE
// ------------------------------
function absorb(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    // 1. Process all full 64-byte blocks directly from the input buffer (Zero-copy)
    for (; offset + RATE_BYTES <= bytes.length; offset += RATE_BYTES) {
        for (let i = 0; i < RATE_U32; i++) {
            state[i] ^= view.getUint32(offset + (i * 4), true);
        }
        permute();
    }

    // 2. Handle the remaining bytes + padding (Only allocates max 64 bytes)
    let remaining = bytes.length - offset;
    let tailLen = Math.ceil((remaining + 1) / 4) * 4; // Pad to 4-byte boundary
    const tailBlock = new Uint8Array(tailLen);
    tailBlock.set(bytes.subarray(offset)); // Copy ONLY the tail
    tailBlock[remaining] = 0x80;

    const tailView = new DataView(tailBlock.buffer);
    let words = tailLen >>> 2;
    for (let i = 0; i < words; i++) {
        state[i] ^= tailView.getUint32(i * 4, true);
    }
    permute();
}

// ------------------------------
// SQUEEZE PHASE
// ------------------------------
function squeeze(outLen) {
    const out = new Uint8Array(outLen);
    const view = new DataView(out.buffer);
    let pos = 0;

    while (pos < outLen) {
        let chunkBytes = Math.min(RATE_BYTES, outLen - pos);
        let words = chunkBytes >>> 2;

        for (let i = 0; i < words; i++) {
            view.setUint32(pos + (i * 4), state[i], true);
        }

        pos += chunkBytes;
        if (pos < outLen) permute();
    }
    return out;
}

// ------------------------------
// HASH FUNCTION
// ------------------------------
function hash(message) {
    state.fill(0);
    x = INITIAL_X;
    y = INITIAL_Y;
    z = INITIAL_Z;
    w = INITIAL_W;
    const bytes = (message instanceof Uint8Array) ? message : encoder.encode(message);
    absorb(bytes);
    return squeeze(HASH_SIZE_BYTES);
}

// ------------------------------
// DEBUG HELPERS
// ------------------------------
function toHex(u8) {
    return Array.from(u8, b => b.toString(16).padStart(2, "0")).join(" ");
}

// ------------------------------
// TEST
// ------------------------------
const result = hash("hello, world");
console.log(toHex(result));
const result2 = hash("hello, world");
console.log(toHex(result2));

function toBits(bytes) {
    const bits = [];
    for (const b of bytes) {
        for (let i = 0; i < 8; i++) {
            bits.push((b >> i) & 1);
        }
    }
    return bits;
}

function bitCount(bytes) {
    let count = 0;
    for (const b of bytes) {
        let x = b;
        while (x) {
            x &= x - 1;
            count++;
        }
    }
    return count;
}

function xorBytes(a, b) {
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] ^ b[i];
    }
    return out;
}

// ------------------------------
// STATISTICAL TEST HELPERS
// ------------------------------

// Seeded PRNG (Mulberry32) for reproducible random tests
function mulberry32(a) {
    return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function randomBytes(length, rng) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(rng() * 256);
    }
    return bytes;
}

// ------------------------------
// REFACTORED TESTS
// ------------------------------

function strictAvalancheTest(trials = 1000, msgLen = 16) {
    const rng = mulberry32(12345);
    const inputBits = msgLen * 8;
    const outputBits = HASH_SIZE_BYTES * 8;
    const totalCells = inputBits * outputBits;

    const flipCounts = Array.from({ length: inputBits }, () => new Uint32Array(outputBits));

    for (let t = 0; t < trials; t++) {
        const msg = randomBytes(msgLen, rng);
        const baseHash = hash(msg);
        const baseBits = toBits(baseHash);

        for (let i = 0; i < inputBits; i++) {
            const mutated = new Uint8Array(msg);
            mutated[i >> 3] ^= (1 << (i & 7));

            const h2 = hash(mutated);
            const h2Bits = toBits(h2);

            for (let j = 0; j < outputBits; j++) {
                if (baseBits[j] !== h2Bits[j]) {
                    flipCounts[i][j]++;
                }
            }
        }
    }

    // Analyze results
    let minProb = 1.0, maxProb = 0.0;
    let sumProb = 0;
    let sacFailures = 0;

    const expectedSigma = 0.5 / Math.sqrt(trials);
    const threshold = 3 * expectedSigma;

    for (let i = 0; i < inputBits; i++) {
        for (let j = 0; j < outputBits; j++) {
            const prob = flipCounts[i][j] / trials;
            sumProb += prob;
            if (prob < minProb) minProb = prob;
            if (prob > maxProb) maxProb = prob;
            if (Math.abs(prob - 0.5) > threshold) {
                sacFailures++;
            }
        }
    }

    const avgProb = sumProb / totalCells;

    // --- THE STATISTICAL FIX ---
    // We EXPECT ~0.27% of the 32,768 cells to fail the 3-sigma test by pure chance.
    const expectedFailures = totalCells * 0.0027;

    console.log(`\n--- Strict Avalanche Criterion (SAC) Test ---`);
    console.log(`Trials: ${trials}, Message Length: ${msgLen} bytes`);
    console.log(`Average flip probability: ${avgProb.toFixed(5)} (Target: 0.50000)`);
    console.log(`SAC outliers (outside 3σ): ${sacFailures} / ${totalCells}`);
    console.log(`Expected outliers by pure chance: ~${expectedFailures.toFixed(0)}`);

    // Check if the number of outliers is within a reasonable margin of the expected value
    if (sacFailures < expectedFailures * 0.3 || sacFailures > expectedFailures * 2.5) {
        console.log("WARNING: The number of outliers is statistically abnormal!");
    } else {
        console.log("PASSED SAC test (outlier count is perfectly normal).");
    }

    // Optional: Prove Min/Max are mathematically perfect
    const minZ = (minProb - 0.5) / expectedSigma;
    const maxZ = (maxProb - 0.5) / expectedSigma;
    console.log(`Min Z-score: ${minZ.toFixed(2)} (Expected for 32k tests: ~ -4.4)`);
    console.log(`Max Z-score: ${maxZ.toFixed(2)} (Expected for 32k tests: ~ +4.4)`);
}

function bitBalanceTest(samples = 100000, msgLen = 32) {
    const rng = mulberry32(54321);
    let ones = 0;
    let total = 0;

    for (let i = 0; i < samples; i++) {
        const msg = randomBytes(msgLen, rng);
        const h = hash(msg);
        ones += bitCount(h);
        total += HASH_SIZE_BYTES * 8;
    }

    const ratio = ones / total;
    const sigma = 0.5 / Math.sqrt(total);

    console.log(`\n--- Bit Balance (Monobit) Test ---`);
    console.log(`Samples: ${samples} (${total.toLocaleString()} total bits)`);
    console.log(`Ratio of 1s: ${ratio.toFixed(6)} (Target: 0.500000)`);
    console.log(`99.7% confidence interval: [${(0.5 - 3*sigma).toFixed(6)}, ${(0.5 + 3*sigma).toFixed(6)}]`);
    if (Math.abs(ratio - 0.5) > 3 * sigma) {
        console.log("WARNING: Failed bit balance test!");
    } else {
        console.log("PASSED bit balance test.");
    }
}

function byteHistogramTest(samples = 100000, msgLen = 16) {
    const rng = mulberry32(98765);
    const hist = new Uint32Array(256);

    for (let i = 0; i < samples; i++) {
        const msg = randomBytes(msgLen, rng);
        const h = hash(msg);
        for (const b of h) hist[b]++;
    }

    const totalBytes = samples * HASH_SIZE_BYTES;
    const expected = totalBytes / 256;

    let chi = 0;
    for (let i = 0; i < 256; i++) {
        const d = hist[i] - expected;
        chi += (d * d) / expected;
    }

    // Degrees of freedom = 255. Mean = 255, Variance = 510, Std Dev ≈ 22.58
    const df = 255;
    const stdDev = Math.sqrt(2 * df);

    console.log(`\n--- Byte Histogram (Chi-Square) Test ---`);
    console.log(`Samples: ${samples} (${totalBytes.toLocaleString()} total bytes)`);
    console.log(`Chi-square statistic: ${chi.toFixed(2)}`);
    console.log(`Expected mean: ${df}, Std Dev: ${stdDev.toFixed(2)}`);
    console.log(`99.7% confidence interval: [${(df - 3*stdDev).toFixed(2)}, ${(df + 3*stdDev).toFixed(2)}]`);

    if (chi < df - 3*stdDev || chi > df + 3*stdDev) {
        console.log("WARNING: Failed chi-square test!");
    } else {
        console.log("PASSED chi-square test.");
    }
}

function collisionStressTest(samples = 100000) {
    const seen = new Set();
    const rng = mulberry32(314159);
    let collisions = 0;

    for (let i = 0; i < samples; i++) {
        const msg = randomBytes(16, rng);
        const h = toHex(hash(msg));

        if (seen.has(h)) {
            collisions++;
        } else {
            seen.add(h);
        }
    }

    console.log(`\n--- Collision Stress Test ---`);
    console.log(`Samples: ${samples.toLocaleString()}`);
    console.log(`Collisions found: ${collisions}`);
    if (collisions > 0) {
        console.log("CRITICAL WARNING: Collisions found in a 256-bit hash! Implementation is severely broken.");
    } else {
        console.log("No collisions found (Expected for a 256-bit hash).");
    }
    console.log("Note: To find real collisions via Birthday Paradox, you need ~2^128 samples.");
}

function longMessageDiffusionTest(trials = 1000, numBlocks = 10) {
    const rng = mulberry32(77777); // Seeded PRNG
    const msgLen = numBlocks * RATE_U32; // 10 blocks * 64 bytes = 640 bytes
    const outputBits = HASH_SIZE_BYTES * 8; // 256 bits

    let totalFlipped = 0;
    let totalBits = 0;

    let minFlipRatio = 1.0;
    let maxFlipRatio = 0.0;
    let singleTrialFailures = 0;

    // Standard deviation for a SINGLE trial's bit flip ratio (Binomial distribution)
    // For 256 bits, sigma = sqrt(p * (1-p) / N) = sqrt(0.25 / 256) = 0.5 / 16 = 0.03125
    const singleSigma = 0.5 / Math.sqrt(outputBits);
    const singleThreshold = 3 * singleSigma; // 99.7% bounds for a single hash comparison

    for (let t = 0; t < trials; t++) {
        // 1. Generate a random 640-byte message
        const msg = randomBytes(msgLen, rng);

        // 2. Hash the original message
        const baseHash = hash(msg);

        // 3. Pick a random bit strictly within the FIRST block (indices 0 to RATE-1)
        const byteIndex = Math.floor(rng() * RATE_U32);
        const bitIndex = Math.floor(rng() * 8);

        // 4. Mutate and hash
        const mutated = new Uint8Array(msg);
        mutated[byteIndex] ^= (1 << bitIndex);
        const mutatedHash = hash(mutated);

        // 5. Measure the difference
        const diff = xorBytes(baseHash, mutatedHash);
        const flipped = bitCount(diff);

        totalFlipped += flipped;
        totalBits += outputBits;

        const ratio = flipped / outputBits;
        if (ratio < minFlipRatio) minFlipRatio = ratio;
        if (ratio > maxFlipRatio) maxFlipRatio = ratio;

        // Check if this specific trial fell outside the 3-sigma bounds
        if (Math.abs(ratio - 0.5) > singleThreshold) {
            singleTrialFailures++;
        }
    }

    const avgRatio = totalFlipped / totalBits;

    // Overall standard deviation for the AVERAGE of all 1,000 trials combined
    const overallSigma = 0.5 / Math.sqrt(totalBits);

    console.log(`\n--- Long-Message Diffusion Test ---`);
    console.log(`Trials: ${trials}, Message Length: ${msgLen} bytes (${numBlocks} blocks)`);
    console.log(`Action: Flipping 1 random bit in the FIRST block.`);
    console.log(`Average flip ratio: ${avgRatio.toFixed(5)} (Target: 0.50000)`);
    console.log(`Min ratio: ${minFlipRatio.toFixed(5)}, Max ratio: ${maxFlipRatio.toFixed(5)}`);
    console.log(`Expected 99.7% bounds for a SINGLE trial: [${(0.5 - singleThreshold).toFixed(5)}, ${(0.5 + singleThreshold).toFixed(5)}]`);
    console.log(`Single trials outside bounds: ${singleTrialFailures} / ${trials} (Expected ~${(trials * 0.0027).toFixed(1)})`);

    // Check if the overall average is within the strict bounds
    if (Math.abs(avgRatio - 0.5) > 3 * overallSigma) {
        console.log("WARNING: Long-message diffusion failed! Entropy is not propagating fully across blocks.");
    } else {
        console.log("PASSED long-message diffusion test.");
    }
}

function bitIndependenceCriterionTest(trials = 1000, msgLen = 16) {
    const rng = mulberry32(99999);
    const outputBits = HASH_SIZE_BYTES * 8;

    // We will test a sample of input bits to keep runtime reasonable
    const inputBitsToTest = [0, 7, 64, 127];
    let totalBicScore = 0;
    let pairsTested = 0;

    for (const iBit of inputBitsToTest) {
        // Matrix to count co-occurrences: bicCounts[j][k] = times bit j and k BOTH flipped
        const bicCounts = Array.from({ length: outputBits }, () => new Uint32Array(outputBits));
        const flipCounts = new Uint32Array(outputBits);

        for (let t = 0; t < trials; t++) {
            const msg = randomBytes(msgLen, rng);
            const baseHash = hash(msg);
            const baseBits = toBits(baseHash);

            const mutated = new Uint8Array(msg);
            mutated[iBit >> 3] ^= (1 << (iBit & 7));

            const h2 = hash(mutated);
            const h2Bits = toBits(h2);

            const flippedIndices = [];
            for (let j = 0; j < outputBits; j++) {
                if (baseBits[j] !== h2Bits[j]) {
                    flippedIndices.push(j);
                    flipCounts[j]++;
                }
            }

            // Record co-occurrences
            for (let a = 0; a < flippedIndices.length; a++) {
                for (let b = a + 1; b < flippedIndices.length; b++) {
                    const j = flippedIndices[a];
                    const k = flippedIndices[b];
                    bicCounts[j][k]++;
                }
            }
        }

        // Analyze BIC
        for (let j = 0; j < outputBits; j++) {
            for (let k = j + 1; k < outputBits; k++) {
                // P(j and k flip | i flipped) should be ~0.25
                // We calculate: (Count of both flipping) / (Total trials)
                // Note: Strict BIC divides by flipCounts[j], but for a well-diffused hash,
                // flipCounts[j] ≈ trials/2, so dividing by trials gives ≈ 0.25.
                const prob = bicCounts[j][k] / trials;
                totalBicScore += Math.abs(prob - 0.25);
                pairsTested++;
            }
        }
    }

    const avgDeviation = totalBicScore / pairsTested;
    console.log(`\n--- Bit Independence Criterion (BIC) Test ---`);
    console.log(`Average deviation from ideal 0.25 probability: ${avgDeviation.toFixed(5)}`);
    console.log(`(Target: < 0.01000. Lower is better.)`);

    if (avgDeviation > 0.015) {
        console.log("WARNING: High BIC deviation detected! Output bits are correlating.");
    } else {
        console.log("PASSED BIC test. Output bits flip independently.");
    }
}

function lowEntropyStressTest(trials = 100) {
    console.log(`\n--- Improved Low-Entropy Stress Test (${trials} trials/pattern) ---`);

    const patterns = [
        { name: "All Zeros", data: new Uint8Array(128).fill(0x00) },
        { name: "All Ones", data: new Uint8Array(128).fill(0xFF) },
        { name: "Alternating", data: new Uint8Array(128).map((_, i) => i % 2 === 0 ? 0xAA : 0x55) },
        { name: "Sequential", data: new Uint8Array(128).map((_, i) => i) }
    ];

    for (const p of patterns) {
        let totalFlipRatio = 0;

        for (let t = 0; t < trials; t++) {
            const base = hash(p.data);

            // Randomly pick a bit to flip across the whole message
            const mutated = new Uint8Array(p.data);
            const byteIndex = Math.floor(Math.random() * p.data.length);
            const bitIndex = Math.floor(Math.random() * 8);
            mutated[byteIndex] ^= (1 << bitIndex);

            const h2 = hash(mutated);
            const diff = xorBytes(base, h2);
            totalFlipRatio += bitCount(diff) / (HASH_SIZE_BYTES * 8);
        }

        const avgRatio = totalFlipRatio / trials;
        console.log(`${p.name.padEnd(12)} | Avg Flip Ratio: ${avgRatio.toFixed(4)} (Target: 0.5000)`);
    }
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function cycleDetectionTest(maxIterations = 1000000) {
    console.log(`\n--- Functional Graph Cycle Detection ---`);
    console.log(`Running up to ${maxIterations.toLocaleString()} iterations...`);

    // Floyd's Tortoise and Hare algorithm (O(1) memory)
    const seed = new TextEncoder().encode("cycle detection seed");
    let tortoise = hash(seed);
    let hare = hash(hash(seed));

    let steps = 0;
    // Added the missing '{' here:
    while (!arraysEqual(tortoise, hare) && steps < maxIterations) {
        tortoise = hash(tortoise);
        hare = hash(hash(hare));
        steps++;
    }

    if (steps >= maxIterations) {
        console.log(`PASSED: No short cycles detected up to ${maxIterations.toLocaleString()} iterations.`);
        console.log(`(This is the expected behavior for a 256-bit hash).`);
    } else {
        console.log(`CRITICAL FAILURE: Short cycle detected at step ${steps.toLocaleString()}!`);
        console.log(`The internal state is collapsing. Increase permutation rounds or check diffusion.`);
    }
}

function runAllTests() {
    console.log("=== Rigorous Sponge Hash Test Suite ===");

    // Run faster tests first
    strictAvalancheTest(1000, 16); // 1000 trials = 128,000 hashes
    bitBalanceTest(100000, 32);
    byteHistogramTest(100000, 16); // 100k is enough for Chi-square, increase to 1M in Node if needed
    collisionStressTest(100000);   // 100k to avoid memory issues in browser
    longMessageDiffusionTest(1000, 10);
    bitIndependenceCriterionTest(10000, 16);
    lowEntropyStressTest();
    cycleDetectionTest(1000000);

    console.log("\n=== Done ===");
}

runAllTests();
