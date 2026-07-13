// Minimal ambient types for the parts of aes-js (3.x) we use. The package ships
// no type definitions of its own.
declare module 'aes-js' {
  export class Counter {
    constructor(initialValue: number | Uint8Array);
  }
  export namespace ModeOfOperation {
    class ctr {
      constructor(key: Uint8Array, counter: Counter);
      encrypt(bytes: Uint8Array): Uint8Array;
      decrypt(bytes: Uint8Array): Uint8Array;
    }
  }
  export namespace utils {
    namespace utf8 {
      function toBytes(text: string): Uint8Array;
      function fromBytes(bytes: Uint8Array): string;
    }
    namespace hex {
      function toBytes(text: string): Uint8Array;
      function fromBytes(bytes: Uint8Array): string;
    }
  }
}
