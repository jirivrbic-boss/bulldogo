// Polyfilly pro lepší kompatibilitu napříč prohlížeči
// Tento soubor řeší problémy s kompatibilitou v různých prohlížečích

(function() {
    'use strict';
    
    // Polyfill pro Promise.allSettled (pokud není dostupné)
    if (!Promise.allSettled) {
        Promise.allSettled = function(promises) {
            return Promise.all(promises.map(function(promise) {
                return promise.then(function(value) {
                    return { status: 'fulfilled', value: value };
                }).catch(function(reason) {
                    return { status: 'rejected', reason: reason };
                });
            }));
        };
    }
    
    // Polyfill pro Object.assign (pokud není dostupné)
    if (typeof Object.assign !== 'function') {
        Object.assign = function(target) {
            if (target == null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            var to = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var nextSource = arguments[index];
                if (nextSource != null) {
                    for (var nextKey in nextSource) {
                        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        };
    }
    
    // Polyfill pro Array.from (pokud není dostupné)
    if (!Array.from) {
        Array.from = function(arrayLike, mapFn, thisArg) {
            var C = this;
            var items = Object(arrayLike);
            if (arrayLike == null) {
                throw new TypeError('Array.from requires an array-like object - not null or undefined');
            }
            var mapFunction = mapFn;
            var T;
            if (typeof mapFn !== 'undefined') {
                if (typeof mapFn !== 'function') {
                    throw new TypeError('Array.from: when provided, the second argument must be a function');
                }
                if (arguments.length > 2) {
                    T = thisArg;
                }
            }
            var len = parseInt(items.length) || 0;
            var A = typeof C === 'function' ? Object(new C(len)) : new Array(len);
            var k = 0;
            var kValue;
            while (k < len) {
                kValue = items[k];
                if (mapFunction) {
                    A[k] = typeof T === 'undefined' ? mapFunction(kValue, k) : mapFunction.call(T, kValue, k);
                } else {
                    A[k] = kValue;
                }
                k += 1;
            }
            A.length = len;
            return A;
        };
    }
    
    // Polyfill pro String.includes (pokud není dostupné)
    if (!String.prototype.includes) {
        String.prototype.includes = function(search, start) {
            if (typeof start !== 'number') {
                start = 0;
            }
            if (start + search.length > this.length) {
                return false;
            } else {
                return this.indexOf(search, start) !== -1;
            }
        };
    }
    
    // Polyfill pro Array.includes (pokud není dostupné)
    if (!Array.prototype.includes) {
        Array.prototype.includes = function(searchElement, fromIndex) {
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }
            var o = Object(this);
            var len = parseInt(o.length) || 0;
            if (len === 0) {
                return false;
            }
            var n = parseInt(fromIndex) || 0;
            var k;
            if (n >= 0) {
                k = n;
            } else {
                k = len + n;
                if (k < 0) {
                    k = 0;
                }
            }
            function sameValueZero(x, y) {
                return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
            }
            for (; k < len; k++) {
                if (sameValueZero(o[k], searchElement)) {
                    return true;
                }
            }
            return false;
        };
    }
    
    // Polyfill pro CustomEvent (pokud není dostupné)
    if (typeof window.CustomEvent !== 'function') {
        function CustomEvent(event, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        }
        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    }
    
    // Polyfill pro Event constructor (pokud není dostupné)
    if (typeof window.Event !== 'function') {
        window.Event = function(type, options) {
            options = options || { bubbles: false, cancelable: false };
            var event = document.createEvent('Event');
            event.initEvent(type, options.bubbles, options.cancelable);
            return event;
        };
    }
    
    console.log('✅ Polyfilly načteny pro lepší kompatibilitu');
})();
