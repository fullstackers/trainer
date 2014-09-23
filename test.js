if (typeof String.prototype.format === 'undefined') {
  String.prototype.format = function () {
    var parts = this.split(/\%[a-z]/g);
    var out = [];
    Array.prototype.slice.call(arguments).forEach(function (item) {
      if (parts.length > 0) out.push(parts.shift());
      out.push(item);
    });
    return out.join('');
  };
}

var debug = require('debug')('trainer:frame');
var util = require('util');

/**
 * Represents an Width X Height slice of data.
 * It can be scaled up and down.
 *
 * @param {Number} w
 * @param {Number} h
 * @return Frame
 */

function Frame (w,h) {
  if (!(this instanceof Frame)) return new Frame(w,h);
  this.w = w || 1;
  this.h = h || 1;
  this.size = h * w;
  this.data = new Array(this.size);
}

/**
 * Sets the item in the x,y coord
 * 
 * @param {number} x
 * @param {number} y
 * @param {mixed} y
 * @return Frame
 */

Frame.prototype.set = function (x, y, item) {
  debug('set %s, %s : %s', x, y, item);
  this.data[this.index(x,y)] = item;
  return this;
};

/**
 * Gets the item from the x, y
 *
 * @param {number} x
 * @param {number} y
 * @return mixed
 */

Frame.prototype.get = function (x, y) {
  var data = this.data[this.index(x,y)];
  debug('get %s, %s => %s', x, y, data);
  return data;
};

/**
 * Iterates over each cell calling the passed function with
 * the cell and the current index
 *
 * @param {function} fn
 * @return Frame
 */

Frame.prototype.each = function (fn) {
  debug('each %s',fn);
  for (var i=0; i<this.size; i++) if (fn(this.cell(i), i) === false) break; 
  return this;
};

/**
 * Calculates the index given the x and y
 *
 * @param {number} x
 * @param {number} y
 * @return number
 */

Frame.prototype.index = function (x, y) {
  var index = (((this.h) * y) + x);
  if (index < 0 || index > this.size) throw Error('coords out of bounds %s, %s contraints are %s, %s'.format(x, y, this.h, this.w));
  debug('index (((h) * y) + x) = (((%s) * %s) + %s) => %s', this.h, y, x, index);
  return index;
};

/**
 * Given an index returns the cell
 *
 * @param {number} index
 * @return Object
 */

Frame.prototype.cell = function (index) {
  var cell = {
    x: index % this.h,
    y: Math.floor(index / this.h),
    data: this.data[index]
  };
  debug('cell %s => %o', index, cell);
  return cell;
}

/**
 * Increments the value given the x, y and the amount
 *
 * @param {number} x
 * @param {number} y
 * @param {mixed} amount
 * @return Frame
 */

Frame.prototype.inc = function (x, y, amount) {
  debug('inc %s, %s, %s', x, y, amount);
  if (typeof amount === 'undefined') amount = 1;
  var data = this.get(x, y);
  if (typeof data === 'undefined') data = 0;
  return this.set(x, y, data + amount);
};

/**
 * Normalizes each data in the cell by running the value through the bound
 * method and populating a new Frame
 *
 * @return Frame
 */

Frame.prototype.normalize = function () {
  var n = new Frame(this.h, this.w);
  for (var i=0; i<this.data.length; i++) {
    n.data[i] = this.bound(this.data[i]);
  }
  debug('normalize =>', n);
  return n;
};

/**
 * Bounds a value using a sigmod function
 *
 * @param {number}
 * @return number
 */

Frame.prototype.bound = function (t) {
  var bound = 1 / (1+Math.pow(Math.E, -t));
  debug('bound %s => %s', t, bound);
  return bound;
};

/**
 * Access to a frames cols given a row
 *
 * @param {number} y
 * @return Object
 */

Frame.prototype.row = function (y) {
  var self = this;
  return {
    cols: function (fn) {
      for (var i=0; i<self.w; i++) {
        fn.apply(self, self.get(i, y));
        return self;
      }
    }
  };
};

/**
 * Access to a frames rows given a col
 *
 * @param {number} x
 * @return Object
 */

Frame.prototype.col = function (x) {
  var self = this;
  return {
    rows: function (fn) {
      for (var i=0; i<self.h; i++) {
        fn.apply(self, self.get(x, i));
        return self;
      }
    }
  };
};

/**
 * Scales this frame to a new frame given the width and height
 *
 * @param {number} w
 * @param {number} h
 * @return Frame
 */

Frame.prototype.scale = function (w, h) {
  var frame = Frame(w, h);
  var s = this.size / frame.size;
  var sh = this.h / h;
  var sw = this.w / w; 
  this.each(function (cell, index) {
    var x, y, d, i;
    if (typeof cell.data === 'undefined') return;
    d = cell.data;
    debug('cell.data %s s %s d %s', cell.data, s, d);
    if (sh < 0) {
      y = Math.floor(cell.y * sh);
    }
    else if (sh > 0) {
      y = Math.floor(cell.y / sh);
    }

    if (sw < 0) {
      x = Math.floor(cell.x * sw);
    }
    else if (sw > 0) {
      x = Math.floor(cell.x / sw);
    }
    if (s < 1) {
      for (var i=0; i<1/sw; i++) {
        for (var j=0; j<1/sh; j++) {
          frame.inc(x+i,y+j,d*s);
        }
      }
    }
    else {
      frame.inc(x, y, d);
    }
  });
  return frame;
};

module.exports = Frame;

if (process.argv[2] !== 'test') return;

var ok = require('assert').equal;

(function () {

  console.log('test even frames');

  (function test_scale_equal () {
      console.log('assert scale equal');

      var a = Frame(4,4);
      a.inc(0,0);
      debug('a.inc(0,0) => %o', a);
      a.inc(1,1);
      debug('a.inc(1,1) => %o', a);
      a.inc(2,2);
      debug('a.inc(2,2) => %o', a);
      a.inc(3,3);
      debug('a.inc(3,3) => %o', a);

      var b = a.scale(4,4);
      ok(b.get(0,0), 1);
      ok(b.get(1,1), 1);
      ok(b.get(2,2), 1);
      ok(b.get(3,3), 1);

  })();

  (function test_scale_down () {

      console.log('assert scale down');

      var a = Frame(4,4);
      a.inc(0,0);
      debug('a.inc(0,0) => %o', a);
      a.inc(1,1);
      debug('a.inc(1,1) => %o', a);
      a.inc(2,2);
      debug('a.inc(2,2) => %o', a);
      a.inc(3,3);
      debug('a.inc(3,3) => %o', a);

      var c = a.scale(2,2);
      ok(c.get(0,0), 2);
      debug('c.get(0,0) => %o', c);
      ok(c.get(1,1), 2);
      debug('c.get(1,1) => %o', c);

  })();

  (function test_scale_up () {

      console.log('assert scale up');

      var a = Frame(2,2);
      a.inc(0,0, 2);
      a.inc(1,1, 2);

      b = a.scale(4,4);
      console.log(b);
      ok(b.get(0,0), .5);
      ok(b.get(1,0), .5);
      ok(b.get(0,1), .5);
      ok(b.get(1,1), .5);
      ok(b.get(2,2), .5);
      ok(b.get(3,2), .5);
      ok(b.get(2,3), .5);
      ok(b.get(3,3), .5);
  })();

})();

(function () {

  console.log('test odd frames');

  (function test_scale_up_odd () {

      console.log('assert scale up odd');

      var a = Frame(3,3);
      a.inc(0,0);
      a.inc(1,1);
      a.inc(2,2);

      var b = a.scale(6,6);
      ok(b.get(0,0),.25);
      ok(b.get(1,0),.25);
      ok(b.get(0,1),.25);
      ok(b.get(0,1),.25);
      ok(b.get(2,2),.25);
      ok(b.get(3,2),.25);
      ok(b.get(2,3),.25);
      ok(b.get(3,3),.25);
      ok(b.get(4,4),.25);
      ok(b.get(5,4),.25);
      ok(b.get(4,5),.25);
      ok(b.get(5,5),.25);

  })();

})();

(function () {

    console.log('test different dimensions');

    (function test_scale_down() {

        var a = Frame(3,3);
        a.inc(0,0);
        a.inc(1,1);
        a.inc(2,2);

        var b = a.scale(2,2);
        ok(b.get(0,0), 2);
        ok(b.get(1,1), 1);

    })();

    (function test_scale_up () {

        var a = Frame(2,2);
        a.inc(0,0);
        a.inc(1,1);

        var b = a.scale(3,3);
        ok(round(b.get(0,0),2), .44);
        ok(round(b.get(1,0),2), .44);
        ok(round(b.get(0,1),2), .44);
        ok(round(b.get(1,1),2), .89);
        ok(round(b.get(2,1),2), .44);
        ok(round(b.get(1,2),2), .44);
        ok(round(b.get(2,2),2), .44);

        function round (x, y) {
          var p = Math.pow(10, y);
          return Math.round(x * p) / p;
        }

    })();

})();
