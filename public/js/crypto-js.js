(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory(require("crypto")))
    : typeof define === "function" && define.amd
      ? define(["crypto"], factory)
      : ((global = typeof globalThis !== "undefined" ? globalThis : global || self),
      (global.CryptoJS = factory(global.require$$0)));
})(this, function (require$$0) {
  "use strict";

  function _interopDefaultLegacy(e) {
    return e && typeof e === "object" && "default" in e ? e : { default: e };
  }

  var require$$0__default = /*#__PURE__*/ _interopDefaultLegacy(require$$0);

  var commonjsGlobal =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
        ? window
        : typeof global !== "undefined"
          ? global
          : typeof self !== "undefined"
            ? self
            : {};

  function createCommonjsModule(fn, basedir, module) {
    return (
      (module = {
        path: basedir,
        exports: {},
        require: function (path, base) {
          return commonjsRequire(path, base === undefined || base === null ? module.path : base);
        },
      }),
      fn(module, module.exports),
      module.exports
    );
  }

  function commonjsRequire() {
    throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
  }

  var core = createCommonjsModule(function (module, exports) {
    (function (root, factory) {
      {
        module.exports = factory();
      }
    })(commonjsGlobal, function () {
      var CryptoJS = CryptoJS || (function (Math1, undefined1) {
          var crypto;
          if (typeof window !== "undefined" && window.crypto) {
            crypto = window.crypto;
          }
          if (typeof self !== "undefined" && self.crypto) {
            crypto = self.crypto;
          }
          if (typeof globalThis !== "undefined" && globalThis.crypto) {
            crypto = globalThis.crypto;
          }
          if (!crypto && typeof window !== "undefined" && window.msCrypto) {
            crypto = window.msCrypto;
          }
          if (!crypto && typeof commonjsGlobal !== "undefined" && commonjsGlobal.crypto) {
            crypto = commonjsGlobal.crypto;
          }
          if (!crypto && typeof commonjsRequire === "function") {
            try {
              crypto = require$$0__default["default"];
            } catch (err) {}
          }

          var cryptoSecureRandomInt = function cryptoSecureRandomInt() {
            if (crypto) {
              if (typeof crypto.getRandomValues === "function") {
                try {
                  return crypto.getRandomValues(new Uint32Array(1))[0];
                } catch (err) {}
              }
              if (typeof crypto.randomBytes === "function") {
                try {
                  return crypto.randomBytes(4).readInt32LE()[0];
                } catch (err) {}
              }
            }
            return Math1.floor(Math1.random() * 0x100000000);
          };

          var C = {
            littleEndian: true,
            WordArray: function (words, sigBytes) {
              words = this.words = words || [];
              if (sigBytes != undefined) {
                this.sigBytes = sigBytes;
              } else {
                this.sigBytes = words.length * 4;
              }
              return this;
            },
          };

          C.prototype.clamp = function clamp() {
            var words = this.words;
            var sigBytes = this.sigBytes;
            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
            words.length = Math1.ceil(sigBytes / 4);
          };

          C.prototype.concat = function concat(wordArray) {
            this.clamp();
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            for (var i = 0; i < sigBytes; i++) {
              var w = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
              this.words[(this.sigBytes + i) >>> 2] |= w << (24 - ((this.sigBytes + i) % 4) * 8);
            }
            this.sigBytes += sigBytes;
            return this;
          };

          C.prototype.clone = function clone() {
            var clone = C.extend.call(this);
            clone.words = this.words.slice(0);
            return clone;
          };

          C.prototype.toString = function toString(encoder) {
            return (encoder || Hex).stringify(this);
          };

          C.prototype.swapEndian = function swapEndian(e) {
            for (var t = [], r = 0, n = e.length; r < n; r += 4) {
              t.push(e[r], e[r + 1], e[r + 2], e[r + 3]);
            }
            return t;
          };

          var C_init = C;

          C = {
            init: function init(words, sigBytes) {
              words = this.words = words || [];
              if (sigBytes != undefined) {
                this.sigBytes = sigBytes;
              } else {
                this.sigBytes = words.length * 4;
              }
              return this;
            },
          };

          C.init.prototype = C.prototype;

          C.extend = function extend(overrides) {
            var context = C_init.extend.call(this, overrides);
            context.$super = this;
            return context;
          };

          C.init.prototype.init = function init(words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined) {
              this.sigBytes = sigBytes;
            } else {
              this.sigBytes = words.length * 4;
            }
            return this;
          };

          return C;
        })(Math);

      C.lib.WordArray.init;
      C.enc.Hex.stringify;
      C.enc.Base64.stringify;

      return C;
    });
  });

  return core;
});
