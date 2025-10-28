# ByteHasher - A Lightweight, 8-bit Optimized Hash Function



**ByteHasher** is a fast and minimal hash function designed specifically for environments with limited memory and processing power, such as 8-bit microcontrollers (e.g., AVR, PIC) and deeply embedded systems.

**Fixed 256-bit hash output (32 bytes)**, and uses only 8-bit bitwise arithmetic, ideal for power-efficient operation on resource-constrained platforms.

## ✨ Key Features

* **Tiny Footprint:** Minimal code size and zero memory allocations (heap-free).
* **256-bit Output:** Generates a large 32-byte hash for systems constrained to 8-bit arithmetic.
* **High Performance:** Optimized for bitwise operations (XOR and shifts) for maximum speed on low-clock-rate devices.
* **Arithmetic Constraint:** **Exclusively uses 8-bit operations** internally, avoiding costly 16-bit or 32-bit operations on constrained CPUs.
* **Public Domain:** Licensed under CC0, allowing for unrestricted use in any project.

## ⚙️ Usage

The ByteHasher function typically takes a pointer to your data and the length of the data as arguments.

While primarily targeting embedded C and Assembler, this reference implementation is in JavaScript.

