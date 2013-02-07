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

var undo = {};
undo.Stack = function() {
  this.commands = [];
  this.stackPosition = -1;
  this.savePosition = -1;
};

extend(undo.Stack.prototype, {
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
	// do nothing, override
  }
});

undo.Command = function(name) {
  this.name = name;
};

var up = new Error("override me!");

extend(undo.Command.prototype, {
  execute: function() {
	throw up;
  },
  undo: function() {
	throw up;
  },
  redo: function() {
	this.execute();
  }
});

undo.Command.extend = function(protoProps) {
  var child = inherits(this, protoProps);
  child.extend = undo.Command.extend;
  return child;
};

var _ = require('lodash');
var Events = require('backbone').Events;

function interpreter() {
  if (!(this instanceof interpreter)) {
    return new interpreter();
  }
  _.extend(this, Events);
  
  this._stack = new undo.Stack();
  this._history = [];
  this._commands = {};
  this._globals = {};

  // create build-in commands:
  this.addCommand({
    name : 'undo',
    execute : function() {
      this._interp._undo();
    }
  });
  
  _.bindAll(this);
  return this;
}

// A getter and setter for commands:
interpreter.prototype.command = function(name, fun) {
  if (arguments.length === 2 && _.isString(name) && _.isFunction(fun)) {
    fun.name = name;
    return this._commands[name] = fun;
  } else if (arguments.length === 1 &&
             _.isObject(name) &&
             _.every(_.values(name), function(val) {
               return _.isFunction(val);
             })) {
    _(_.values(name), function(val, key) {
      val.name = key;
    });
    return _.extend(this._commands, name);
  } else if (arguments.length === 1 && _.isString(name)) {
    return this._commands[name];
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
  var Cmd = undo.Command.extend(obj);
  if (_.isString(obj.name)) {
    this.command(obj.name, Cmd);
  }
  return Cmd;
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
  this._stack = new undo.Stack();
  return this;
};


interpreter.prototype.undo = function() {
  if (this._stack.canUndo()) {
    var cmdName = this._stack.commands[this._stack.stackPosition].name;
    this._stack.undo();
    console.log('Undo ' + cmdName);
  } else {
    console.log('No further undo information');
  }
};

interpreter.prototype.redo = function() {
  if (this._stack.canRedo()) {
    this._stack.redo();
    var cmdName = this._stack.commands[this._stack.stackPosition].name;
    console.log('Redo ' + cmdName);
  } else {
    console.log('Can not redo anymore');
  }
};

interpreter.prototype.execute = function(arr) {
  if (arguments.length !== 1 || !_.isArray(arr) || arr.length < 1 || !_.isString(arr[0])) {
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

  var name = arr[0];
  if (name === 'undo'){
    return this.undo();
  } else if (name === 'redo'){
    return this.redo();
  } else {
    var Command = this.command(name);
    if (!_.isUndefined(Command) && _.isFunction(Command)) {
      var args = arr.slice(1);
      return this._stack.execute(new Command(args));
    } else {
      return false;
    }
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

module.exports = interpreter;
