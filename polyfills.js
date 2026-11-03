/* Built-ins the solver's code (with Babel's helpers) uses that old TVs (Chrome 38) lack; only where missing, and not
   enumerable, so the player script's own loops never meet them */
(function () {
    function define(on, name, value) {
        if (!(name in on)) {
            Object.defineProperty(on, name, { value: value, writable: true, configurable: true });
        }
    }
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
})();
