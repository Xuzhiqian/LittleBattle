
(function () {
	var initializing = false,
		fnTest = /xyz/.test(function () {
			xyz;
		}) ? /\b_super\b/ : /.*/;
	// The base Class implementation (does nothing)
	this.Class = function () {
	};
	
	// Create a new Class that inherits from this class
	Class.extend = function (prop) {
		var _super = this.prototype;
		
		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		var prototype = new this();
		initializing = false;
		
		// Copy the properties over onto the new prototype
		for (var name in prop) {
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] == "function" &&
			typeof _super[name] == "function" &&
			fnTest.test(prop[name]) ?
				(function (name, fn) {
					return function () {
						var tmp = this._super;
						
						// Add a new ._super() method that is the same method
						// but on the super-class
						this._super = _super[name];
						
						// The method only need to be bound temporarily, so we
						// remove it when we're done executing
						var ret = fn.apply(this, arguments);
						this._super = tmp;
						
						return ret;
					};
				})(name, prop[name]) :
				prop[name];
		}
		
		// The dummy class constructor
		function Class() {
			// All construction is actually done in the init method
			if (!initializing && this.init)
				this.init.apply(this, arguments);
		}
		
		// Populate our constructed prototype object
		Class.prototype = prototype;
		
		// Enforce the constructor to be what we expect
		Class.prototype.constructor = Class;
		// And make this class extendable
		Class.extend = arguments.callee;
		
		return Class;
	};
})();


(function () {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
		window.cancelAnimationFrame =
			window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
	}
	
	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function (callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16.689 - (currTime - lastTime));
			var id = window.setTimeout(function () {
					callback(currTime + timeToCall);
				},
				timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	
	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function (id) {
			clearTimeout(id);
		};
}());

var Quisus = function () {
	var Q = {};
	
	Q._normalizeArg = function (arg) {
			arg = arg.replace(/\s+/g, '').split(",");
		return arg;
	};
	
	Q.gameLoop = function (callback) {
		Q.lastGameLoopFrame = new Date().getTime();

		Q.gameLoopCallbackWrapper = function (now) {
			Q.loop = requestAnimationFrame(Q.gameLoopCallbackWrapper);
			let dt = now - Q.lastGameLoopFrame;
			callback.apply(Q, [dt / 1000]);
			Q.lastGameLoopFrame = now;
		};
		requestAnimationFrame(Q.gameLoopCallbackWrapper);
	};
	
	Q.pauseGame = function () {
		if (Q.loop) {
			cancelAnimationFrame(Q.loop);
		}
		Q.loop = null;
	};
	
	Q.unpauseGame = function () {
		if (!Q.loop) {
			Q.lastGameLoopFrame = new Date().getTime();
			Q.loop = requestAnimationFrame(Q.gameLoopCallbackWrapper);
		}
	}
	
	Q.Evented = Class.extend({
		bind: function (event, target, callback) {
			// Handle the case where there is no target provided
			if (!callback) {
				callback = target;
				target = null;
			}
			// Handle case for callback that is a string
			if (typeof callback == 'string') {
				callback = target[callback];
			}
			
			this.listeners = this.listeners || {};
			this.listeners[event] = this.listeners[event] || [];
			this.listeners[event].push([target || this, callback]);
			if (target) {
				if (!target.binds) {
					target.binds = [];
				}
				target.binds.push([this, event, callback]);
			}
		},
		
		trigger: function (event, data) {
			if (this.listeners && this.listeners[event]) {
				for (var i = 0, len = this.listeners[event].length; i < len; i++) {
					var listener = this.listeners[event][i];
					listener[1].call(listener[0], data);
				}
			}
		},
		
		unbind: function (event, target, callback) {
			if (!target) {
				if (this.listeners[event]) {
					delete this.listeners[event];
				}
			} else {
				var l = this.listeners && this.listeners[event];
				if (l) {
					for (var i = l.length - 1; i >= 0; i--) {
						if (l[i][0] == target) {
							if (!callback || callback == l[i][1]) {
								this.listeners[event].splice(i, 1);
							}
						}
					}
				}
			}
		},
		
		debind: function () {
			if (this.binds) {
				for (var i = 0, len = this.binds.length; i < len; i++) {
					var boundEvent = this.binds[i],
						source = boundEvent[0],
						event = boundEvent[1];
					source.unbind(event, this);
				}
			}
		}
		
	});
	
	Q.components = {};
	
	Q.register = function (name, methods) {
		methods.name = name;
		Q.components[name] = Q.Component.extend(methods);
	};
	
	Q.Component = Q.Evented.extend({
		init: function (entity) {
			this.entity = entity;
			entity[this.name] = this;
			entity.activeComponents.push(this.name);
			if (this.added) this.added();
		},
		
		destroy: function () {
			delete this.entity[this.name];
			var idx = this.entity.activeComponents.indexOf(this.name);
			if (idx != -1) {
				this.entity.activeComponents.splice(idx, 1);
			}
			this.debind();
			if (this.destroyed) this.destroyed();
		}
	});
	
	Q.GameObject = Q.Evented.extend({
		has: function (component) {
			return this[component] ? true : false;
		},
		add: function (components) {
			components = Q._normalizeArg(components);
			if (!this.activeComponents) {
				this.activeComponents = [];
			}
			for (var i = 0, len = components.length; i < len; i++) {
				var name = components[i],
					comp = Q.components[name];
				if (!this.has(name) && comp) {
					var c = new comp(this);
					this.trigger('addComponent', c);
				}
			}
			return this;
		},
		del: function (components) {
			components = Q._normalizeArg(components);
			for (var i = 0, len = components.length; i < len; i++) {
				var name = components[i];
				if (name && this.has(name)) {
					this.trigger('delComponent', this[name]);
					this[name].destroy();
				}
			}
			return this;
		},
		
		destroy: function () {
			if (this.destroyed) {
				return;
			}
			this.debind();
			if (this.parent && this.parent.remove) {
				this.parent.remove(this);
			}
			this.trigger('removed');
			this.destroyed = true;
		}
	});
	
	
	return Q;
}
if ('undefined' != typeof global)
	module.exports = Quisus;
