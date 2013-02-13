var interp = require('./interpreter.js')({
  x : 1,
  y : "strings",
  z : [23, 4, 5, 34],
  a : {
    'key1' : 'value1',
    'key2' : 2323455
  }
});

console.log('Original context:' , interp._ctx);
console.log('\n');

interp.on('command', function() {
  console.log('command: ' + interp.lastCommand());
  var obj = interp.getState();
  console.log([
    'Stack changed. Position ',
    obj.stackPosition,
    '/', obj.stackSize - 1,
    '. Save position ',
    obj.savePosition,
    '. canUndo:' , obj.canUndo,
    '. canRedo:' , obj.canRedo,
    '. dirty:' , obj.dirty
  ].join(''));
  console.log('context:', interp._ctx);
  console.log('\n');
});

interp.on('stdout', function(str) {
  console.log('stdout: ' + str);
});

interp.addCommand([
  {
    name : 'add_to_x',
    constructor : function(arg) {
      this.originalX = this._interp.get('x');
      this.arg = arg;
    },
    execute : function() {
      this._interp.set('x', this.originalX + this.arg[0]);
    },
    undo : function() {
      this._interp.set('x', this.originalX);
    }
  },{
    name : 'scale_z',
    constructor : function(arg) {
      this._z = this._interp.get('z');
      this.scale = arg[0];
    },
    execute : function() {
      var _this = this;
      this._interp.set('z', this._z.map(function(val) {
        return val * _this.scale;
      }));
    },
    undo : function() {
      this._interp.set('z', this._z);
    }
  },{
    name : 'upper_case_y',
    constructor : function() {
      this.originalY = this._interp.get('y');
    },
    execute : function() {
      this._interp.set('y', this.originalY.toUpperCase());
    },
    undo : function() {
      this._interp.set('y', this.originalY);
    }
  }
]);

interp.exec(
  ['proc',
   ['add_to_x', 3],
   ['add_to_x', 4],
   ['add_to_x', 5],
   ['undo'],
   ['undo'],
   ['redo'],
   ['scale_z', 2],
   ['scale_z', 4],
   ['redo'],
   ['undo'],
   ['undo'],
   ['upper_case_y'],
   ['undo']
  ]
);
