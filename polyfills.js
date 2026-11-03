/* Built-ins the solver's code (or Babel's helpers for it) may use that old TVs (Chrome 38) lack; only where missing,
   and not enumerable, so the player script's own loops never meet them */
(function () {
    var global = Function('return this')();
    function define(on, name, value) {
        if (!(name in on)) {
            Object.defineProperty(on, name, { value: value, writable: true, configurable: true });
        }
    }
    define(global, 'globalThis', global);
    define(Array, 'from', function (items, map) {
        var out = [];
        var it = typeof Symbol !== 'undefined' && items != null && items[Symbol.iterator];
        if (it) {
            var iter = it.call(items);
            for (var step = iter.next(); !step.done; step = iter.next()) {
                out.push(step.value);
            }
        } else {
            for (var i = 0; i < items.length; i++) {
                out.push(items[i]);
            }
        }
        return map ? out.map(map) : out;
    });
    define(Array.prototype, 'includes', function (value) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value || value !== value && this[i] !== this[i]) {
                return true;
            }
        }
        return false;
    });
    define(Array.prototype, 'find', function (test, self) {
        for (var i = 0; i < this.length; i++) {
            if (test.call(self, this[i], i, this)) {
                return this[i];
            }
        }
        return undefined;
    });
    define(Array.prototype, 'findIndex', function (test, self) {
        for (var i = 0; i < this.length; i++) {
            if (test.call(self, this[i], i, this)) {
                return i;
            }
        }
        return -1;
    });
    define(String.prototype, 'includes', function (part, from) {
        return String(this).indexOf(part, from || 0) >= 0;
    });
    define(String.prototype, 'startsWith', function (part, at) {
        part = String(part);
        return String(this).substr(at || 0, part.length) === part;
    });
    define(String.prototype, 'endsWith', function (part, end) {
        var s = String(this);
        end = end === undefined ? s.length : Math.min(end, s.length);
        part = String(part);
        return end >= part.length && s.substring(end - part.length, end) === part;
    });
    define(Object, 'assign', function (to) {
        for (var i = 1; i < arguments.length; i++) {
            var from = arguments[i];
            for (var k in from) {
                if (Object.prototype.hasOwnProperty.call(from, k)) {
                    to[k] = from[k];
                }
            }
        }
        return to;
    });
    define(Object, 'entries', function (o) {
        return Object.keys(o).map(function (k) { return [k, o[k]]; });
    });
    define(Object, 'values', function (o) {
        return Object.keys(o).map(function (k) { return o[k]; });
    });
})();
