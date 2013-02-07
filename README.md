# interpreter.js #
An command pattern framework for node.

## Usage ##

    var interp = require('interpreter.js');
    var my_interp = interp();
    
    my_interp.addCommand({
      name : 'init-domain',
      execute : function() {
        this.global('my_domain', {});
        return 
      }
    })

## Build-in commands ##
