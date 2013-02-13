/** 
 * @author: Li Ge, lge@ucsd.edu
 * Module Name: interpreter.js
 * Description: A command pattern framework for Node.js
*/

/**
 * Undo class is based on http://jzaefferer.github.com/undo
 * Copyright (c) 2011 Jörn Zaefferer
 * MIT licensed.
 */

// based on Backbone.js' inherits

var ctor = function(){};
var inherits = function(parent, protoProps) {
  var child;

  if (protoProps && protoProps.hasOwnProperty('constructor')) {
	child = protoProps.constructor;
  } else {
	child = function(){ return parent.apply(this, arguments); };
  }

  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  
  if (protoProps) extend(child.prototype, protoProps);
  
  child.prototype.constructor = child;
  child.__super__ = parent.prototype;
  return child;
};

function extend(target, ref) {
  var name, value;
  for (name in ref) {
	value = ref[name];
	if (value !== undefined) {
	  target[name] = value;
	}
  }
  return target;
};

// Backbone events
var Events = {
  on: function(events, callback, context) {
    var ev;
    events = events.split(/\s+/);
    var calls = this._callbacks || (this._callbacks = {});
    while ((ev = events.shift())) {
      var list  = calls[ev] || (calls[ev] = {});
      var tail = list.tail || (list.tail = list.next = {});
      tail.callback = callback;
      tail.context = context;
      list.tail = tail.next = {};
    }
    return this;
  },
  off: function(events, callback, context) {
    var ev, calls, node;
    if (!events) {
      delete this._callbacks;
    } else if ((calls = this._callbacks)) {
      events = events.split(/\s+/);
      while ((ev = events.shift())) {
        node = calls[ev];
        delete calls[ev];
        if (!callback || !node) continue;
        // Create a new list, omitting the indicated event/context pairs.
        while ((node = node.next) && node.next) {
          if (node.callback === callback &&
              (!context || node.context === context)) continue;
          this.on(ev, node.callback, node.context);
        }
      }
    }
    return this;
  },
  trigger: function(events) {
    var event, node, calls, tail, args, all, rest;
    if (!(calls = this._callbacks)) return this;
    all = calls['all'];
    (events = events.split(/\s+/)).push(null);
    // Save references to the current heads & tails.
    while ((event = events.shift())) {
      if (all) events.push({next: all.next, tail: all.tail, event: event});
      if (!(node = calls[event])) continue;
      events.push({next: node.next, tail: node.tail});
    }
    // Traverse each list, stopping when the saved tail is reached.
    rest = Array.prototype.slice.call(arguments, 1);
    while ((node = events.pop())) {
      tail = node.tail;
      args = node.event ? [node.event].concat(rest) : rest;
      while ((node = node.next) !== tail) {
        node.callback.apply(node.context || this, args);
      }
    }
    return this;
  }
};

// var undo = {};
var Stack = function() {
  this.commands = [];
  this.stackPosition = -1;
  this.savePosition = -1;
};

extend(Stack.prototype, Events);

extend(Stack.prototype, {
  execute: function(command) {
	this._clearRedo();
	command.execute();
	this.commands.push(command);
	this.stackPosition++;
	this.changed();
    
  },
  undo: function() {
	this.commands[this.stackPosition].undo();
	this.stackPosition--;
	this.changed();
  },
  canUndo: function() {
	return this.stackPosition >= 0;
  },
  redo: function() {
	this.stackPosition++;
	this.commands[this.stackPosition].redo();
	this.changed();
  },
  canRedo: function() {
	return this.stackPosition < this.commands.length - 1;
  },
  save: function() {
	this.savePosition = this.stackPosition;
	this.changed();
  },
  dirty: function() {
	return this.stackPosition != this.savePosition;
  },
  _clearRedo: function() {
	// TODO there's probably a more efficient way for this
	this.commands = this.commands.slice(0, this.stackPosition + 1);
  },
  changed: function() {
    this.trigger('changed');
  }
});

var Command = function() {};

var up = function(){
  throw new Error("override me!");
};

extend(Command.prototype, {
  execute : up,
  undo : up,
  redo: function() {
	this.execute();
  }
});

Command.extend = function(protoProps) {
  var child = inherits(this, protoProps);
  child.extend = Command.extend;
  return child;
};

var _ = require('lodash');

function interpreter(context) {
  if (!(this instanceof interpreter)) {
    return new interpreter(context);
  }

  var _this = this;
  this._stack = new Stack();
  this._history = [];
  this._commands = {};
  this._ctx = context || {};

  // create build-in commands:
  this._addBuildInCommands();

  this._stack.on('changed', function() {
    _this.trigger('stackChanged');
  });
  _.bindAll(this);
  
  this.trigger('initialized');
  return this;
}

extend(interpreter.prototype, Events);

// A getter and setter for commands:
interpreter.prototype.command = function(arg) {
  if (arguments.length === 1 && _.isString(arg)) {
    return this._commands[arg];
  } else if (arguments.length === 1 && _.isObject(arg)) {
    return this.createCommand(arg);
  } else if (arguments.length === 1 && _.isString(arg)) {
    return this._commands[arg];
  } else {
    return false;
  }
};

interpreter.prototype.set = function(key, value) {
  this._ctx[key] = value;
};

interpreter.prototype.get = function(key) {
  return this._ctx[key];
};

interpreter.prototype.createCommand = function(obj) {
  if (_.isArray(obj)) {
    var _this = this;
    _.each(obj, function(o) {
      _this.createCommand(o);
    });
    return;
  }
  obj._interp = this;
  var Cmd = Command.extend(obj);
  if (_.isString(obj.name)) {
    this._commands[obj.name] = Cmd;
  }
};

interpreter.prototype.addCommand = interpreter.prototype.createCommand;

interpreter.prototype.removeCommand = function(name) {
  delete this._commands[name];
};

interpreter.prototype.reset = function() {
  while (this._stack.canUndo()) {
    this._stack.undo();
  }
  delete this._stack;
  this._stack = new Stack();
  return this;
};

interpreter.prototype._undo = function() {
  if (this._stack.canUndo()) {
    var cmdName = this._stack.commands[this._stack.stackPosition].name;
    this._stack.undo();
    console.log('Undo ' + cmdName);
  } else {
    console.log('No further undo information');
  }
};

interpreter.prototype._redo = function() {
  if (this._stack.canRedo()) {
    this._stack.redo();
    var cmdName = this._stack.commands[this._stack.stackPosition].name;
    console.log('Redo ' + cmdName);
  } else {
    console.log('Can not redo anymore');
  }
};

interpreter.prototype.getState = function() {
  return {
    stackSize : this._stack.commands.length,
    stackPosition : this._stack.stackPosition,
    savePosition : this._stack.savePosition,
    canUndo : this._stack.canUndo(),
    canRedo : this._stack.canRedo(),
    dirty : this._stack.dirty()
  };
};

var SUCCESS = 0;
var FAILED = 1;
interpreter.prototype.execute = function(arr, undoable) {
  if (!_.isArray(arr) || !_.isString(arr[0])) {
    console.error([
      'interpreter::execute only take one array as argument!',
      'If the cmd has only one argument, wrap it as [arg_0]'
    ].join('\n'));
    return false;
  }

  if (!_.isUndefined(undoable)) {
    undoable = !!undoable;
  } else {
    undoable = true;
  }
  
  try {
    var str = JSON.stringify(arr);    
  } catch(e) {
    console.error('The argument of interpreter::execute must be a serializable array');
    return false;
  }

  var name = arr[0], Command, cmd, ret, args;
  var _this = this;

  if (name === 'undo'){
    this.trigger('beforeUndo');
    ret = this._undo();   
    this.trigger('afterUndo');
  } else if (name === 'redo'){
    this.trigger('beforeRedo');
    ret = this._redo();
    this.trigger('afterRedo');
  } else {
    Command = this.command(name);
    if (!_.isUndefined(Command) && _.isFunction(Command)) {
      args = arr.slice(1);
      cmd = new Command(args);
      if (cmd.undo !== up && cmd.undo !== false && undoable === true) {
        ret = this._stack.execute(cmd);
      } else {
        ret = cmd.execute();
      }
    } else {
      console.error('interpreter::execute: command \'' + name + '\' does not exist.');
      ret = FAILED;
    }
  }
  
  this._lastCommandExitStatus = ret;
  this._history.push(arr);
  this.trigger('command', arr);

  return ret;
};
interpreter.prototype.exec = interpreter.prototype.execute;

interpreter.prototype.listCommands = function() {
  return _.keys(this._commands);
};

interpreter.prototype.lastCommand = function() {
  return this._history[this._history.length - 1];
};

interpreter.prototype.result = function(value) {  
  if (_.isUndefined(value)) {
    return this._lastCommandResult;
  } else {
    this._lastCommandResult = value;
    return value;
  }
};

interpreter.prototype.stdout = function(str) {
  if (_.isString(str) && str.length > 0) {
    this.trigger('stdout', str);
  }
};

interpreter.prototype.error = function(str) {
  if (_.isString(str) && str.length > 0) {
    this.trigger('error', new Error(str));
  }
};

interpreter.prototype.parse = function(str) {
  if (!_.isString(str)) {
    console.error('interpreter::parse only take string as argument!');
    return false;
  }
  
  try {
    var arr = JSON.parse(str);
    this.execute(arr);
  } catch(e) {
    console.error('The argument of interpreter::execute must be a serializable array');
    return false;
  }
  return true;
};

interpreter.prototype.validateCommand = function(arr) {
  if (!_.isArray(arr) || !_.isString(arr[0])) {
    console.error([
      'interpreter::execute only take one array as argument!',
      'If the cmd has only one argument, wrap it as [arg_0]'
    ].join('\n'));
    return false;
  }
  
  try {
    var str = JSON.stringify(arr);    
  } catch(e) {
    console.error('The argument of interpreter::execute must be a serializable array');
    return false;
  }

  if (arr[0] === 'undo' || arr[0] === 'redo') {
    return true;
  }
  
  var Command = this.command(arr[0]);
  if ( _.isUndefined(Command) || (!_.isFunction(Command)) ) {
    return false;
  }
  
  return true;
};

interpreter.prototype._addBuildInCommands = function() {
  var _this = this;
  this.addCommand([
    // Equivalent to call
    // interp.execute(args[0]); interp.execute(args[1]); interp.execute(args[2]) ...
    {
      name : 'proc',
      constructor : function(args) {
        this.args = args;
      },
      execute : function() {
        var _this = this;
        _.each(this.args, function(cmd) {
          _this._interp.execute(cmd);
        });
      }
    },

    // Group multiple undoable commands into one.
    {
      name : 'group',
      constructor : function(args) {
        this.stack = [];
        // Make sure every element in args is a valid command array
        // Each of them exists in interp and is undoable (undo function is overrided)
        // If any element is not valid, leave the stack empty and exist;
        if ( !(_.every(args, function(arg) {
          var isValid = _this.validateCommand(arg);
          var Command = _this.command(arg[0]);
          return isValid && (Command.undo !== up);
        })) ) {
          return;
        }
        
        // Build command stack:
        var i = -1, len = args.length;
        var name, Cmd;
        while (++i < len) {
          name = args[i].shift();
          Cmd = _this.command(name);
          this.stack.push(new Cmd(args[i]));
        }
      },
      execute : function() {
        var i = -1, len = this.stack.length;
        while (++i < len) {
          this.stack[i].execute();
        }
      },
      undo : function() {
        var i = this.stack.length;
        while (--i > -1) {
          this.stack[i].undo();
        }
      }
    }
    
  ]);
};

module.exports = interpreter;
