/* For YouTube's /s/player/cd64615e/tv-player-ias.vflset/tv-player-ias.js: its n transform as yt-dlp's solver 0.8.0 computes it (github.com/yt-dlp/ejs, Unlicense), made ES5 by github.com/aktiwers/bolli-solver */
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
function _toConsumableArray(r){return _arrayWithoutHoles(r)||_iterableToArray(r)||_unsupportedIterableToArray(r)||_nonIterableSpread();}function _nonIterableSpread(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");}function _iterableToArray(r){if("undefined"!=typeof Symbol&&null!=r[Symbol.iterator]||null!=r["@@iterator"])return Array.from(r);}function _arrayWithoutHoles(r){if(Array.isArray(r))return _arrayLikeToArray(r);}function _createForOfIteratorHelper(r,e){var t="undefined"!=typeof Symbol&&r[Symbol.iterator]||r["@@iterator"];if(!t){if(Array.isArray(r)||(t=_unsupportedIterableToArray(r))||e&&r&&"number"==typeof r.length){t&&(r=t);var _n=0,F=function F(){};return{s:F,n:function n(){return _n>=r.length?{done:!0}:{done:!1,value:r[_n++]};},e:function e(r){throw r;},f:F};}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");}var o,a=!0,u=!1;return{s:function s(){t=t.call(r);},n:function n(){var r=t.next();return a=r.done,r;},e:function e(r){u=!0,o=r;},f:function f(){try{a||null==t.return||t.return();}finally{if(u)throw o;}}};}function _unsupportedIterableToArray(r,a){if(r){if("string"==typeof r)return _arrayLikeToArray(r,a);var t={}.toString.call(r).slice(8,-1);return"Object"===t&&r.constructor&&(t=r.constructor.name),"Map"===t||"Set"===t?Array.from(r):"Arguments"===t||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t)?_arrayLikeToArray(r,a):void 0;}}function _arrayLikeToArray(r,a){(null==a||a>r.length)&&(a=r.length);for(var e=0,n=Array(a);e<a;e++)n[e]=r[e];return n;}(function(_result){_result.n=function(_input){var _results=new Set();var errors=[];for(var _i=0,_arr=[function(n){return function(_ref,_url$get){var sig=_ref.sig,n=_ref.n;var url=JS("https://youtube.com/watch?v=yt-dlp-wins","s",sig?encodeURIComponent(sig):undefined);url.set("n",n);var proto=Object.getPrototypeOf(url);var keys=Object.keys(proto).concat(Object.getOwnPropertyNames(proto));var _iterator=_createForOfIteratorHelper(keys),_step;try{for(_iterator.s();!(_step=_iterator.n()).done;){var key=_step.value;if(!["constructor","set","get","clone"].includes(key)){url[key]();break;}}}catch(err){_iterator.e(err);}finally{_iterator.f();}var s=url.get("s");return{sig:s?decodeURIComponent(s):null,n:(_url$get=url.get("n"))!==null&&_url$get!==void 0?_url$get:null};}({n:n}).n;}];_i<_arr.length;_i++){var _generator=_arr[_i];try{_results.add(_generator(_input));}catch(e){errors.push(e);}}if(!_results.size){throw"no solutions: ".concat(errors.join(", "));}if(_results.size!==1){throw"invalid solutions: ".concat(_toConsumableArray(_results).map(function(x){return JSON.stringify(x);}).join(", "));}return _results.values().next().value;};self.__bolliN=_result.n;})({});
