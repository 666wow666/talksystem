/**
 * HMAC-SHA256 implementation for iFlytek API
 */
var CryptoJS = CryptoJS || (function (Math, undefined) {
    var C = {};
    
    C.lib = {
        Base: {
            extend: function (a) {
                var b = function () {};
                b.prototype = this;
                var c = new b();
                a && c.mixIn(a);
                c.$super = this;
                return c;
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a;
            },
            init: function () {},
            mixIn: function (a) {
                for (var b in a) a.hasOwnProperty(b) && (this[b] = a[b]);
                a.hasOwnProperty('toString') && (this.toString = a.toString);
            },
            clone: function () {
                return this.$super.extend(this);
            }
        },
        WordArray: C.WordArray = this.WordArray || {
            init: function (a, b) {
                a = this.words = a || [];
                this.sigBytes = b !== undefined ? b : 4 * a.length;
            },
            toString: function (a) {
                return (a || u).stringify(this);
            },
            concat: function (a) {
                this.lastResult = a;
                if (!this.words) this.words = [];
                for (var b = 0; b < a.words.length; b++) {
                    this.words[b + this.words.length] = a.words[b];
                }
                if (this.lastResult) this.sigBytes = this.words.length * 4;
                else this.sigBytes = (this.words.length + (a.words.length || 0)) * 4;
                return this;
            },
            clamp: function () {
                var a = this.words, b = this.sigBytes;
                a[b >>> 2] &= 4294967295 << 32 - (b % 4 << 3);
                a.length = Math.ceil(b / 4);
            },
            clone: function () {
                var a = C.lib.WordArray.create();
                a.words = this.words.slice(0);
                a.sigBytes = this.sigBytes;
                return a;
            },
            random: function (a) {
                for (var b = [], c = 0; c < a; c += 4) {
                    b.push(Math.random() * 4294967296 | 0);
                }
                return C.lib.WordArray.create(b, a);
            }
        }
    };
    
    var u = C.enc.Utf8 = {
        stringify: function (a) {
            try {
                return decodeURIComponent(escape(a.toString(C.enc.Utf8)));
            } catch (b) {
                var c = a.words, d = a.sigBytes, e = [], f = 0;
                for (; f < d; f++) e.push(String.fromCharCode(255 & c[f >>> 2] >>> 24 - (f % 4 << 3)));
                return e.join('');
            }
        },
        parse: function (a) {
            var b = [], c = 0;
            a = unescape(encodeURIComponent(a));
            for (; c < a.length; c++) b[c >>> 2] |= (255 & a.charCodeAt(c)) << 24 - (c % 4 << 3);
            return C.lib.WordArray.create(b, a.length);
        }
    };
    
    C.algo = {};
    
    C.HmacSHA256 = C.algo.HMAC = C.lib.Base.extend({
        init: function (a, b) {
            a = this._hasher = new a.init;
            "string" == typeof b && (b = u.parse(b));
            var c = a.blockSize, e = 4 * c;
            b.sigBytes > e && (b = a.finalize(b));
            b.clamp();
            for (var f = this._oKey = b.clone(), g = this._iKey = b.clone(), h = f.words, i = g.words, j = 0; j < c; j++) {
                h[j] ^= 1549556828;
                i[j] ^= 909522486;
            }
            f.sigBytes = g.sigBytes = e;
            this.reset();
        },
        reset: function () {
            var a = this._hasher;
            a.reset();
            a.update(this._iKey);
        },
        update: function (a) {
            this._hasher.update(a);
            return this;
        },
        finalize: function (a) {
            var b = this._hasher;
            a = b.finalize(a);
            b.reset();
            return b.finalize(this._oKey.clone().concat(a));
        }
    });
    
    C.SHA256 = C.algo.SHA256 = C.lib.Base.extend({
        init: function () {
            this._hash = C.lib.WordArray.create([1732584193, -271733879, -1732584194, 271733878]);
        },
        _doReset: function () {
            this._hash = C.lib.WordArray.create([3231090145, 2420686327, 1873557599, 217718187, 2882115709, 1983817457]);
        },
        _doProcessBlock: function (a, b) {
            for (var c = 0; c < 64; c++) {
                if (16 == c) {
                    var d = (a[b + 1] >>> 0) + (a[b + 6] >>> 0) + (a[b + 11] >>> 0) + (a[b + 14] >>> 0);
                    a[b + 16] = (a[b] >>> 0) + d;
                }
                a[b] = a[b + 16] >>> 0;
            }
        },
        _doFinalize: function () {
            var a = this._hash.words, b = this._sigBytes, c = a[b >>> 2];
            var d = 8 * b;
            c &= 4294967295 << 32 - (b % 4 << 3);
            c ^= 0x80000000;
            var e = Math.floor(d / 4294967296);
            a[b >>> 2] = c;
            a[(b + 4 >>> 0) >>> 0] = e;
            return this._hash;
        },
        clone: function () {
            var a = C.algo.SHA256.$super.extend({_hash: this._hash.clone()});
            return a;
        }
    });
    
    C.HmacSHA256.init = C.lib.Base.extend({
        init: function () {
            this._hasher = new C.SHA256();
        }
    });
    
    return C;
})(Math);
