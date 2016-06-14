/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * Arcade Slopes provides sloped tile functionality for tilemaps that use
 * Phaser's Arcade physics engine.
 * 
 * TODO: Extract all the handy methods to the Facade class, and a new
 *       CollisionResolver/CollisionHandler class that stores all the solvers
 *       and a default solver type?
 * 
 * @class Phaser.Plugin.ArcadeSlopes
 * @constructor
 * @extends Phaser.Plugin
 * @param {Phaser.Game} game          - A reference to the game using this plugin.
 * @param {any}         parent        - The object that owns this plugin, usually a Phaser.PluginManager.
 * @param {integer}     defaultSolver - The default collision solver type to use for sloped tiles.
 */
Phaser.Plugin.ArcadeSlopes = function (game, parent, defaultSolver) {
	Phaser.Plugin.call(this, game, parent);
	
	/**
	 * The default collision solver type to use for sloped tiles.
	 * 
	 * @property {string} defaultSolver
	 * @default
	 */
	this.defaultSolver = defaultSolver || Phaser.Plugin.ArcadeSlopes.SAT;
	
	/**
	 * A tile slope factory.
	 * 
	 * @property {Phaser.Plugin.ArcadeSlopes.TileSlopeFactory} factory
	 */
	this.factory = new Phaser.Plugin.ArcadeSlopes.TileSlopeFactory();
	
	/**
	 * The collision solvers provided by the plugin.
	 * 
	 * Maps solver constants to their respective instances.
	 * 
	 * @property {object} solvers
	 */
	this.solvers = {};
	
	this.solvers[Phaser.Plugin.ArcadeSlopes.SAT] = new Phaser.Plugin.ArcadeSlopes.SatSolver();
};

Phaser.Plugin.ArcadeSlopes.prototype = Object.create(Phaser.Plugin.prototype);
Phaser.Plugin.ArcadeSlopes.prototype.constructor = Phaser.Plugin.ArcadeSlopes;

/**
 * The Arcade Slopes plugin version number.
 * 
 * @constant
 * @type {string}
 */
Phaser.Plugin.ArcadeSlopes.VERSION = '0.1.0-beta';

/**
 * The Separating Axis Theorem collision solver type.
 * 
 * Uses the excellent SAT.js library.
 * 
 * @constant
 * @type {string}
 */
Phaser.Plugin.ArcadeSlopes.SAT = 'sat';

/**
 * The Metroid collision solver type.
 * 
 * Inspired by and adapted from the source of a Metroid clone by Jan Geselle.
 * 
 * @constant
 * @type {string}
 */
Phaser.Plugin.ArcadeSlopes.METROID = 'metroid';

/**
 * Initializes the plugin.
 * 
 * @method Phaser.Plugin.ArcadeSlopes#init
 */
Phaser.Plugin.ArcadeSlopes.prototype.init = function () {
	// Give the game an Arcade Slopes facade
	this.game.slopes = this.game.slopes || this;
	
	// Keep a reference to the original collideSpriteVsTilemapLayer method
	this.originalCollideSpriteVsTilemapLayer = Phaser.Physics.Arcade.prototype.collideSpriteVsTilemapLayer;
	
	// Replace the original method with the Arcade Slopes override, along with
	// some extra methods that break down the functionality a little more
	Phaser.Physics.Arcade.prototype.collideSpriteVsTile = Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTile;
	Phaser.Physics.Arcade.prototype.collideSpriteVsTiles = Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTiles;
	Phaser.Physics.Arcade.prototype.collideSpriteVsTilemapLayer = Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTilemapLayer;
	
	// Add some extra neighbour methods to the Tilemap class
	Phaser.Tilemap.prototype.getTileTopLeft = Phaser.Plugin.ArcadeSlopes.Overrides.getTileTopLeft;
	Phaser.Tilemap.prototype.getTileTopRight = Phaser.Plugin.ArcadeSlopes.Overrides.getTileTopRight;
	Phaser.Tilemap.prototype.getTileBottomLeft = Phaser.Plugin.ArcadeSlopes.Overrides.getTileBottomLeft;
	Phaser.Tilemap.prototype.getTileBottomRight = Phaser.Plugin.ArcadeSlopes.Overrides.getTileBottomRight;
};

/**
 * Destroys the plugin and nulls its references. Restores any overriden methods.
 * 
 * @method Phaser.Plugin.ArcadeSlopes#destroy
 */
Phaser.Plugin.ArcadeSlopes.prototype.destroy = function () {
	// Null the game's reference to the facade.
	this.game.slopes = null;
	
	// Restore the original collideSpriteVsTilemapLayer method and null the rest
	Phaser.Physics.Arcade.prototype.collideSpriteVsTile = null;
	Phaser.Physics.Arcade.prototype.collideSpriteVsTiles = null;
	Phaser.Physics.Arcade.prototype.collideSpriteVsTilemapLayer = this.originalCollideSpriteVsTilemapLayer;
	
	// Remove the extra neighbour methods from the Tilemap class
	Phaser.Tilemap.prototype.getTileTopLeft = null;
	Phaser.Tilemap.prototype.getTileTopRight = null;
	Phaser.Tilemap.prototype.getTileBottomLeft = null;
	Phaser.Tilemap.prototype.getTileBottomRight = null;
	
	// Call the parent destroy method
	Phaser.Plugin.prototype.destroy.call(this);
};

/**
 * Enable the physics body of the given object for sloped tile interaction.
 *
 * @method Phaser.Plugin.ArcadeSlopes#enable
 * @param {Phaser.Sprite|Phaser.Group} object - The object to enable sloped tile physics for.
 */
Phaser.Plugin.ArcadeSlopes.prototype.enable = function (object) {
	if (Array.isArray(object)) {
		for (var i = 0; i < object.length; i++) {
			this.enable(object[i]);
		}
	} else {
		if (object instanceof Phaser.Group) {
			this.enable(object.children);
		} else {
			if (object.hasOwnProperty('body')) {
				this.enableBody(object.body);
			}
			
			if (object.hasOwnProperty('children') && object.children.length > 0) {
				this.enable(object.children);
			}
		}
	}
};

/**
 * Enable the given physics body for sloped tile interaction.
 * 
 * TODO: Circle body support, when it's released.
 *
 * @method Phaser.Plugin.ArcadeSlopes#enableBody
 * @param {Phaser.Physics.Arcade.Body} body - The physics body to enable.
 */
Phaser.Plugin.ArcadeSlopes.prototype.enableBody = function (body) {
	// Create an SAT polygon from the body's bounding box
	body.polygon = new SAT.Box(
		new SAT.Vector(body.x, body.y),
		body.width,
		body.height
	).toPolygon();
	
	// Attach a new set of properties that configure the body's interaction
	// with sloped tiles (TODO: Formalize as a class?)
	body.slopes = {
		friction: new Phaser.Point(),
		preferY: false,
		pullUp: 0,
		pullDown: 0,
		pullLeft: 0,
		pullRight: 0,
		sat: {
			response: null,
		},
		skipFriction: false,
		snapUp: 0,
		snapDown: 0,
		snapLeft: 0,
		snapRight: 0,
		velocity: new SAT.Vector()
	};
};

/**
 * Converts a layer of the given tilemap.
 * 
 * Attaches Phaser.Plugin.ArcadeSlopes.TileSlope objects that are used to define
 * how the tile should collide with a physics body.
 *
 * @method Phaser.Plugin.ArcadeSlopes#convertTilemap
 * @param  {Phaser.Tilemap}                    map      - The map containing the layer to convert.
 * @param  {number|string|Phaser.TileMapLayer} layer    - The layer of the map to convert.
 * @param  {object}                            slopeMap - A map of tilemap indexes to ArcadeSlope.TileSlope constants.
 * @return {Phaser.Tilemap}                             - The converted tilemap.
 */
Phaser.Plugin.ArcadeSlopes.prototype.convertTilemap = function (map, layer, slopeMap) {
	return this.factory.convertTilemap(map, layer, slopeMap);
};

/**
 * Converts a tilemap layer.
 *
 * @method Phaser.Plugin.ArcadeSlopes#convertTilemapLayer
 * @param  {Phaser.TilemapLayer}  layer    - The tilemap layer to convert.
 * @param  {object}               slopeMap - A map of tilemap indexes to ArcadeSlope.TileSlope constants.
 * @return {Phaser.TilemapLayer}           - The converted tilemap layer.
 */
Phaser.Plugin.ArcadeSlopes.prototype.convertTilemapLayer = function (layer, slopeMap) {
	return this.factory.convertTilemapLayer(layer, slopeMap);
};

/**
 * Collides a physics body against a tile.
 *
 * @method Phaser.Plugin.ArcadeSlopes#collide
 * @param  {integer}                    i           - The tile index.
 * @param  {Phaser.Physics.Arcade.Body} body        - The physics body.
 * @param  {Phaser.Tile}                tile        - The tile.
 * @param  {boolean}                    overlapOnly - Whether to only check for an overlap.
 * @return {boolean}                                - Whether the body was separated.
 */
Phaser.Plugin.ArcadeSlopes.prototype.collide = function (i, body, tile, overlapOnly) {
	if (tile.slope.solver && this.solvers.hasOwnProperty(tile.slope.solver)) {
		return this.solvers[tile.slope.solver].collide(i, body, tile, overlapOnly);
	}
	
	return this.solvers[this.defaultSolver].collide(i, body, tile, overlapOnly);
};

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * A facade class to attach to a Phaser game.
 *
 * Not yet in use, but will be when the plugin methods are moved here.
 * 
 * @class Phaser.Plugin.ArcadeSlopes.Facade
 * @constructor
 * @param {Phaser.Plugin.ArcadeSlopes.TileSlopeFactory} factory - A tile slope factory.
 */
Phaser.Plugin.ArcadeSlopes.Facade = function (factory) {
	/**
	 * A tile slope factory.
	 * 
	 * @property {Phaser.Plugin.ArcadeSlopes.TileSlopeFactory} factory
	 */
	this.factory = factory;
};

// TODO: Tile conversion methods, collision methods, body enable etc.

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * A static class with override methods for Phaser's tilemap collisions and tile
 * neighbour checks.
 * 
 * @static
 * @class Phaser.Plugin.ArcadeSlopes.Override
 */
Phaser.Plugin.ArcadeSlopes.Overrides = {};

/**
 * Collide a sprite against a single tile.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#collideSpriteVsTile
 * @param  {integer}             i                - The tile index.
 * @param  {Phaser.Sprite}       sprite           - The sprite to check.
 * @param  {Phaser.Tile}         tile             - The tile to check.
 * @param  {function}            collideCallback  - An optional collision callback.
 * @param  {function}            processCallback  - An optional overlap processing callback.
 * @param  {object}              callbackContext  - The context in which to run the callbacks.
 * @param  {boolean}             overlapOnly      - Whether to only check for an overlap.
 * @return {boolean}                              - Whether a collision occurred.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTile = function (i, sprite, tile, collideCallback, processCallback, callbackContext, overlapOnly) {
	if (!sprite.body) {
		return false;
	}
	
	if (tile.hasOwnProperty('slope')) {
		if (this.game.slopes.collide(i, sprite.body, tile, overlapOnly)) {
			this._total++;
			
			if (collideCallback) {
				collideCallback.call(callbackContext, sprite, tile);
			}
			
			return true;
		}
	} else if (this.separateTile(i, sprite.body, tile, overlapOnly)) {
		this._total++;
		
		if (collideCallback) {
			collideCallback.call(callbackContext, sprite, tile);
		}
		
		return true;
	}
	
	return false;
};

/**
 * Collide a sprite against a set of tiles.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#collideSpriteVsTiles
 * @param  {Phaser.Sprite}       sprite           - The sprite to check.
 * @param  {Phaser.Tile[]}       tiles            - The tiles to check.
 * @param  {function}            collideCallback  - An optional collision callback.
 * @param  {function}            processCallback  - An optional overlap processing callback.
 * @param  {object}              callbackContext  - The context in which to run the callbacks.
 * @param  {boolean}             overlapOnly      - Whether to only check for an overlap.
 * @return {boolean}                              - Whether a collision occurred.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTiles = function (sprite, tiles, collideCallback, processCallback, callbackContext, overlapOnly) {
	var collided = false;
	
	if (!sprite.body) {
		return collided;
	}
	
	for (var i = 0; i < tiles.length; i++) {
		if (processCallback) {
			if (processCallback.call(callbackContext, sprite, tiles[i])) {
				collided = this.collideSpriteVsTile(i, sprite, tiles[i], collideCallback, processCallback, callbackContext, overlapOnly) || collided;
			}
		} else {
			collided = this.collideSpriteVsTile(i, sprite, tiles[i], collideCallback, processCallback, callbackContext, overlapOnly) || collided;
		}
	}
	
	return collided;
};

/**
 * Collide a sprite against a tile map layer.
 * 
 * This is used to override Phaser.Physics.Arcade.collideSpriteVsTilemapLayer().
 * 
 * @override Phaser.Physics.Arcade#collideSpriteVsTilemapLayer
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#collideSpriteVsTilemapLayer
 * @param  {Phaser.Sprite}       sprite           - The sprite to check.
 * @param  {Phaser.TilemapLayer} tilemapLayer     - The tilemap layer to check.
 * @param  {function}            collideCallback  - An optional collision callback.
 * @param  {function}            processCallback  - An optional overlap processing callback.
 * @param  {object}              callbackContext  - The context in which to run the callbacks.
 * @param  {boolean}             overlapOnly      - Whether to only check for an overlap.
 * @return {boolean}                              - Whether a collision occurred.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.collideSpriteVsTilemapLayer = function (sprite, tilemapLayer, collideCallback, processCallback, callbackContext, overlapOnly) {
	if (!sprite.body) {
		return false;
	}
	
	var tiles = tilemapLayer.getTiles(
		sprite.body.position.x - sprite.body.tilePadding.x,
		sprite.body.position.y - sprite.body.tilePadding.y,
		sprite.body.width      + sprite.body.tilePadding.x,
		sprite.body.height     + sprite.body.tilePadding.y,
		false,
		false
	);
	
	if (tiles.length === 0) {
		return false;
	}
	
	var collided = this.collideSpriteVsTiles(sprite, tiles, collideCallback, processCallback, callbackContext, overlapOnly);
	
	if (!collided && !overlapOnly) {
		// TODO: This call is too hacky and solver-specific
		this.game.slopes.solvers.sat.snap(sprite.body, tiles);
	}
	
	return collided;
};

/**
 * Gets the tile to the top left of the coordinates given.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#getTileTopLeft
 * @param  {integer} layer - The index of the layer to read the tile from.
 * @param  {integer} x     - The X coordinate, in tiles, to get the tile from.
 * @param  {integer} y     - The Y coordinate, in tiles, to get the tile from.
 * @return {Phaser.Tile}   - The tile found.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.getTileTopLeft = function(layer, x, y) {
	if (x > 0 && y > 0) {
		return this.layers[layer].data[y - 1][x - 1];
	}
	
	return null;
};

/**
 * Gets the tile to the top right of the coordinates given.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#getTileTopRight
 * @param  {integer} layer - The index of the layer to read the tile from.
 * @param  {integer} x     - The X coordinate, in tiles, to get the tile from.
 * @param  {integer} y     - The Y coordinate, in tiles, to get the tile from.
 * @return {Phaser.Tile}   - The tile found.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.getTileTopRight = function(layer, x, y) {
	if (x < this.layers[layer].width - 1 && y > 0) {
		return this.layers[layer].data[y - 1][x + 1];
	}
	
	return null;
};

/**
 * Gets the tile to the bottom left of the coordinates given.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#getTileBottomLeft
 * @param  {integer} layer - The index of the layer to read the tile from.
 * @param  {integer} x     - The X coordinate, in tiles, to get the tile from.
 * @param  {integer} y     - The Y coordinate, in tiles, to get the tile from.
 * @return {Phaser.Tile}   - The tile found.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.getTileBottomLeft = function(layer, x, y) {
	if (x > 0 && y < this.layers[layer].height - 1) {
		return this.layers[layer].data[y + 1][x - 1];
	}
	
	return null;
};

/**
 * Gets the tile to the bottom right of the coordinates given.
 *
 * @method Phaser.Plugin.ArcadeSlopes.Overrides#getTileBottomRight
 * @param  {integer} layer - The index of the layer to read the tile from.
 * @param  {integer} x     - The X coordinate, in tiles, to get the tile from.
 * @param  {integer} y     - The Y coordinate, in tiles, to get the tile from.
 * @return {Phaser.Tile}   - The tile found.
 */
Phaser.Plugin.ArcadeSlopes.Overrides.getTileBottomRight = function(layer, x, y) {
	if (x < this.layers[layer].width - 1 && y < this.layers[layer].height - 1) {
		return this.layers[layer].data[y + 1][x + 1];
	}
	
	return null;
};

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * Restrains SAT tile collision handling based on their neighbouring tiles.
 *
 * Can separate on a tile's preferred axis if it has one.
 *
 * This is what keeps the sloped tiles fairly smooth for AABBs.
 * 
 * Think of it as the equivalent of the Arcade Physics tile face checks for all
 * of the sloped tiles and their possible neighbour combinations.
 *
 * Thanks to some painstaking heuristics, it allows a set of touching tiles to
 * behave more like a single shape.
 * 
 * TODO: Change all of these rules to work with the built in edge restraints.
 *       Will require checking all of these rules during tilemap convert.
 *       TileSlope specific edge flags would need to be set for this.
 *       See SatSolver.shouldSeparate(). That should deal with it.
 *       This would work because we're only trying to prevent
 *       axis-aligned overlap vectors, not anything else.
 *
 * TODO: Move away from these heuristics and start flagging edge visibility
 *       automatically, if that could at all work out as well as this has.
 *       Imagine using the normals of each face to prevent separation on
 *       that axis, and instead using the next shortest axis to collide.
 *       TL;DR: Disable separation on the normals of internal faces
 *       by flagging them and further customising SAT.js.
 * 
 * @class Phaser.Plugin.ArcadeSlopes.SatRestrainer
 * @constructor
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer = function () {
	/**
	 * Restraint definitions for SAT collision handling.
	 *
	 * Each restraint is an array of rules, keyed by a corresponding tile type.
	 *
	 * Each rule defines a neighbour to check, overlap ranges to match and
	 * optionally neighbouring tile slope types to match (the same type is used
	 * otherwise). The separate property determines whether to attempt to
	 * collide on the tile's preferred axis, if there is one.
	 * 
	 * Schema:
	 *   [
	 *     {
	 *       neighbour: 'above'|'below'|'left'|'right'|'topLeft'|'topRight'|'bottomLeft'|'bottomRight'
	 *       overlapX:  {integer}|[{integer}, {integer}]
	 *       overlapY:  {integer}|[{integer}, {integer}]
	 *       types:     {array of neighbour TileSlope type constants}
	 *       separate:  {boolean|function(body, tile, response)}
	 *    },
	 *    {
	 *      ...
	 *    }
	 *  ]
	 *
	 * Shorthand schema:
	 *   [
	 *     {
	 *       neighbour: 'above'|'below'|'left'|'right'|'topLeft'|'topRight'|'bottomLeft'|'bottomRight'
	 *       direction: 'up'|'down'|'left'|'right'
	 *       types:     {array of neighbour TileSlope type constants}
	 *       separate:  {boolean=true|function(body, tile, response)}
	 *     },
	 *     {
	 *       ...
	 *     }
	 *   ]
	 *
	 * @property {object} restraints
	 */
	this.restraints = {};
	
	// Define all of the default restraints
	this.setDefaultRestraints();
};

/**
 * Restrain the given SAT body-tile collision context based on the set rules.
 * 
 * @method Phaser.Plugin.ArcadeSlopes.SatRestrainer#restrain
 * @param  {Phaser.Plugin.ArcadeSlopes.SatSolver} solver   - The SAT solver.
 * @param  {Phaser.Physics.Arcade.Body}           body     - The physics body.
 * @param  {Phaser.Tile}                          tile     - The tile.
 * @param  {SAT.Response}                         response - The initial collision response.
 * @return {boolean}                                       - Whether to continue collision handling.
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.prototype.restrain = function (solver, body, tile, response) {
	// Bail out if there's no overlap, no neighbours, or no tile type restraint
	if (!response.overlap || !tile.neighbours || !this.restraints.hasOwnProperty(tile.slope.type)) {
		return true;
	}

	for (var r in this.restraints[tile.slope.type]) {
		var rule = this.restraints[tile.slope.type][r];
		
		var neighbour = tile.neighbours[rule.neighbour];
		
		if (!(neighbour && neighbour.slope)) {
			continue;
		}
		
		// Restrain based on the same tile type by default
		var condition = false;
		
		if (rule.types) {
			condition = rule.types.indexOf(neighbour.slope.type) > -1;
		} else {
			condition = neighbour.slope.type === tile.slope.type;
		}
		
		// Restrain based on the overlapN.x value
		if (rule.hasOwnProperty('overlapX')) {
			if (typeof rule.overlapX === 'number') {
				condition = condition && response.overlapN.x === rule.overlapX;
			} else {
				condition = condition && response.overlapN.x >= rule.overlapX[0] && response.overlapN.x <= rule.overlapX[1];
			}
		}
		
		// Restrain based on the overlapN.y value
		if (rule.hasOwnProperty('overlapY')) {
			if (typeof rule.overlapY === 'number') {
				condition = condition && response.overlapN.y === rule.overlapY;
			} else {
				condition = condition && response.overlapN.y >= rule.overlapY[0] && response.overlapN.y <= rule.overlapY[1];
			}
		}
		
		// Return false if the restraint condition has been matched
		if (condition) {
			var separate = rule.separate;
			
			// Resolve the restraint separation decision if it's a function
			if (typeof separate === 'function') {
				separate = separate.call(this, body, tile, response);
			}
			
			// Collide on the tile's preferred axis if desired and available
			if (separate && tile.slope.axis) {
				solver.collideOnAxis(body, tile, tile.slope.axis);
			}
			
			return false;
		}
	}
	
	return true;
};

/**
 * Resolve overlapX and overlapY restraints from the given direction string.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatRestrainer#resolveOverlaps
 * @param  {string} direction
 * @return {object}
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.resolveOverlaps = function (direction) {
	switch (direction) {
		case 'up':
			return {
				overlapX: 0,
				overlapY: [-1, 0]
			};
		case 'down':
			return {
				overlapX: 0,
				overlapY: [0, 1]
			};
		case 'left':
			return {
				overlapX: [-1, 0],
				overlapY: 0
			};
		case 'right':
			return {
				overlapX: [0, 1],
				overlapY: 0
			};
	}
	
	console.warn('Unknown overlap direction \'' + direction + '\'');
	
	return {};
};

/**
 * Formalizes the given informally defined restraints.
 *
 * Converts direction properties into overlapX and overlapY properties and
 * tile type strings into tile type constants.
 *
 * This simply allows for more convenient constraint definitions.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatRestrainer#createRestraints
 * @param  {object}        restraints - The restraints to prepare.
 * @return {object}                   - The prepared restraints.
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.prepareRestraints = function(restraints) {
	var prepared = {};
	
	for (var type in restraints) {
		var restraint = restraints[type];
		
		// Resolve each rule in the restraint
		for (var r in restraint) {
			var rule = restraint[r];
			
			// Resolve overlapX and overlapY restraints from a direction
			if (rule.direction) {
				var resolved = Phaser.Plugin.ArcadeSlopes.SatRestrainer.resolveOverlaps(rule.direction);
				
				rule.overlapX = resolved.overlapX;
				rule.overlapY = resolved.overlapY;
			}
			
			// Resolve neighbour types from their string representations
			for (var nt in rule.types) {
				rule.types[nt] = Phaser.Plugin.ArcadeSlopes.TileSlope.resolveType(rule.types[nt]);
			}
			
			// Conveniently set separate to true unless it's already false
			if (rule.separate !== false && typeof rule.separate !== 'function') {
				rule.separate = true;
			}
		}
		
		var restraintType = Phaser.Plugin.ArcadeSlopes.TileSlope.resolveType(type);
		
		prepared[restraintType] = restraint;
	}
	
	return prepared;
};

/**
 * Set all of the default SAT collision handling restraints.
 *
 * These are the informally defined hueristics that get refined and utilised
 * above.
 *
 * They were cumbersome to write but they definitely pay off.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatRestrainer#setDefaultRestraints
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.prototype.setDefaultRestraints = function () {
	var restraints = {};
	
	restraints.HALF_TOP = [
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('topRight', 'right'),
			separate: false
		},
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('topLeft', 'left'),
			separate: false
		}
	];

	restraints.HALF_BOTTOM = [
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('right', 'bottomRight'),
			separate: false
		},
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('left', 'bottomLeft'),
			separate: false
		}
	];

	restraints.HALF_LEFT = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('bottomLeft', 'bottom'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('topLeft', 'top'),
			separate: false
		}
	];

	restraints.HALF_RIGHT = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('bottom', 'bottomRight'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('top', 'topRight'),
			separate: false
		}
	];

	restraints.HALF_BOTTOM_LEFT = [
		{
			direction: 'right',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		},
		{
			direction: 'up',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		}
	];

	restraints.HALF_BOTTOM_RIGHT = [
		{
			direction: 'left',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight'),
		},
		{
			direction: 'up',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		}
	];

	restraints.HALF_TOP_LEFT = [
		{
			direction: 'right',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		},
		{
			direction: 'down',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight')
		}
	];

	restraints.HALF_TOP_RIGHT = [
		{
			direction: 'left',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		},
		{
			direction: 'down',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		}
	];

	restraints.QUARTER_BOTTOM_LEFT_LOW = [
		{
			direction: 'right',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		},
		{
			direction: 'up',
			neighbour: 'left',
			types: this.resolve('topLeft', 'right', 'bottomRight')
		},
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('right', 'bottomRight'),
			separate: false
		}
	];

	restraints.QUARTER_BOTTOM_LEFT_HIGH = [
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('left', 'bottomLeft'),
			separate: function (body, tile) {
				return body.bottom < tile.bottom;
			}
		},
		{
			direction: 'up',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		}
	];

	restraints.QUARTER_BOTTOM_RIGHT_LOW = [
		{
			direction: 'left',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight')
		},
		{
			direction: 'up',
			neighbour: 'right',
			types: this.resolve('topRight', 'left', 'bottomLeft')
		},
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('left', 'bottomLeft'),
			separate: false
		}
	];

	restraints.QUARTER_BOTTOM_RIGHT_HIGH = [
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('right', 'bottomRight'),
			separate: function (body, tile) {
				return body.bottom < tile.bottom;
			}
		},
		{
			direction: 'up',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		}
	];
	
	restraints.QUARTER_LEFT_BOTTOM_LOW = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('topLeft', 'left'),
			separate: function (body, tile) {
				return body.left > tile.left;
			}
		},
		{
			direction: 'right',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		}
	];
	
	restraints.QUARTER_LEFT_BOTTOM_HIGH = [
		{
			direction: 'up',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('topLeft', 'top'),
			separate: false
		},
		{
			direction: 'right',
			neighbour: 'below',
			types: this.resolve('topLeft', 'top', 'bottomRight')
		}
	];
	
	restraints.QUARTER_RIGHT_BOTTOM_LOW = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('bottom', 'bottomRight'),
			separate: function (body, tile) {
				return body.right < tile.right;
			}
		},
		{
			direction: 'left',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight')
		}
	];
	
	restraints.QUARTER_RIGHT_BOTTOM_HIGH = [
		{
			direction: 'up',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('top', 'topRight'),
			separate: false
		},
		{
			direction: 'left',
			neighbour: 'below',
			types: this.resolve('top', 'topRight', 'bottomLeft')
		}
	];
	
	restraints.QUARTER_LEFT_TOP_LOW = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('bottomLeft', 'bottom')
		},
		{
			direction: 'right',
			neighbour: 'above',
			types: this.resolve('bottomLeft', 'bottom'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight')
		}
	];
	
	restraints.QUARTER_LEFT_TOP_HIGH = [
		{
			direction: 'right',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('topLeft', 'top'),
			separate: function (body, tile) {
				return body.left > tile.left;
			}
		}
	];
	
	restraints.QUARTER_RIGHT_TOP_LOW = [
		{
			direction: 'up',
			neighbour: 'above',
			types: this.resolve('bottom', 'bottomRight')
		},
		{
			direction: 'left',
			neighbour: 'above',
			types: this.resolve('bottom', 'bottomRight'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		}
	];
	
	restraints.QUARTER_RIGHT_TOP_HIGH = [
		{
			direction: 'left',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		},
		{
			direction: 'down',
			neighbour: 'below',
			types: this.resolve('top', 'topRight'),
			separate: function (body, tile) {
				return body.right < tile.right;
			}
		}
	];
	
	restraints.QUARTER_TOP_LEFT_LOW = [
		{
			direction: 'right',
			neighbour: 'topRight',
			types: this.resolve('bottomLeft')
		},
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('topRight', 'right'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'left',
			types: this.resolve('bottomLeft', 'topRight', 'right')
		}
	];
	
	restraints.QUARTER_TOP_LEFT_HIGH = [
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('topLeft', 'left'),
			separate: function (body, tile) {
				return body.top > tile.top;
			}
		},
		{
			direction: 'down',
			neighbour: 'bottomLeft',
			types: this.resolve('topRight')
		}
	];
	
	restraints.QUARTER_TOP_RIGHT_LOW = [
		{
			direction: 'left',
			neighbour: 'topLeft',
			types: this.resolve('bottomRight')
		},
		{
			direction: 'right',
			neighbour: 'right',
			types: this.resolve('topLeft', 'left'),
			separate: false
		},
		{
			direction: 'down',
			neighbour: 'right',
			types: this.resolve('bottomRight', 'topLeft', 'left')
		}
	];
	
	restraints.QUARTER_TOP_RIGHT_HIGH = [
		{
			direction: 'left',
			neighbour: 'left',
			types: this.resolve('topRight', 'right'),
			separate: function (body, tile) {
				return body.top > tile.top;
			}
		},
		{
			direction: 'down',
			neighbour: 'bottomRight',
			types: this.resolve('topLeft')
		}
	];
	
	// Keep a copy of the informal restraints for inspection
	this.informalRestraints = JSON.parse(JSON.stringify(restraints));
	
	this.restraints = Phaser.Plugin.ArcadeSlopes.SatRestrainer.prepareRestraints(restraints);
};

/**
 * Compute the intersection of two arrays.
 * 
 * Returns a unique set of values that exist in both arrays.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatRestrainer#intersectArrays
 * @param  {array} a - The first array.
 * @param  {array} b - The second array.
 * @return {array}   - The unique set of values shared by both arrays.
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.intersectArrays = function (a, b) {
	return a.filter(function (value) {
		return b.indexOf(value) !== -1;
	}).filter(function (value, index, array) {
		return array.indexOf(value) === index;
	});
};

/**
 * Resolve the types of all tiles with vertices in all of the given locations.
 *
 * Locations can be:
 *   'topLeft',    'top',       'topRight',
 *   'left',                       'right',
 *   'bottomLeft', 'bottom', 'bottomRight'
 * 
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#resolve
 * @param  {...string} locations - A set of AABB vertex locations as strings.
 * @return {array}               - The tile slope types with matching vertices.
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.prototype.resolve = function () {
	var types = [];
	
	if (!arguments.length) {
		return types;
	}
	
	// Check the vertex maps of the given locations
	for (var l in arguments) {
		var location = arguments[l];
		
		if (!Phaser.Plugin.ArcadeSlopes.SatRestrainer.hasOwnProperty(location + 'Vertices')) {
			console.warn('Tried to resolve types from undefined vertex map location \'' + location + '\'');
			continue;
		}
		
		var vertexMap = Array.prototype.slice.call(Phaser.Plugin.ArcadeSlopes.SatRestrainer[location + 'Vertices']);
		
		// If we only have one location to match, we can return its vertex map
		if (arguments.length === 1) {
			return vertexMap;
		}
		
		// If we don't have any types yet, use this vertex map to start with,
		// otherwise intersect this vertex map with the current types
		if (!types.length) {
			types = vertexMap;
		} else {
			types = Phaser.Plugin.ArcadeSlopes.SatRestrainer.intersectArrays(types, vertexMap);
		}
	}
	
	return types;
};

// TODO: Automate these definitions instead of relying on tedious heuristics.
//       Store them in a single vertexMaps property object, too.

/**
 * The set of tile slope types with a top center vertex.
 *
 * @static
 * @property {array} topVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.topVertices = [
	'HALF_LEFT',
	'HALF_RIGHT',
	'QUARTER_LEFT_TOP_LOW',
	'QUARTER_RIGHT_TOP_LOW',
	'QUARTER_LEFT_BOTTOM_LOW',
	'QUARTER_RIGHT_BOTTOM_LOW'
];

/**
 * The set of tile slope types with a bottom center vertex.
 *
 * @static
 * @property {array} bottomVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.bottomVertices = [
	'HALF_LEFT',
	'HALF_RIGHT',
	'QUARTER_LEFT_TOP_HIGH',
	'QUARTER_LEFT_BOTTOM_HIGH',
	'QUARTER_RIGHT_TOP_HIGH',
	'QUARTER_RIGHT_BOTTOM_HIGH'
];

/**
 * The set of tile slope types with a left center vertex.
 *
 * @static
 * @property {array} leftVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.leftVertices = [
	'HALF_TOP',
	'HALF_BOTTOM',
	'QUARTER_TOP_LEFT_LOW',
	'QUARTER_TOP_RIGHT_HIGH',
	'QUARTER_BOTTOM_LEFT_LOW',
	'QUARTER_BOTTOM_RIGHT_HIGH'
];

/**
 * The set of tile slope types with a right center vertex.
 *
 * @static
 * @property {array} rightVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.rightVertices = [
	'HALF_TOP',
	'HALF_BOTTOM',
	'QUARTER_TOP_LEFT_HIGH',
	'QUARTER_TOP_RIGHT_LOW',
	'QUARTER_BOTTOM_LEFT_HIGH',
	'QUARTER_BOTTOM_RIGHT_LOW',
];

/**
 * The set of tile slope types with a top left vertex.
 *
 * @static
 * @property {array} topLeftVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.topLeftVertices = [
	'FULL',
	'HALF_TOP',
	'HALF_LEFT',
	'HALF_TOP_LEFT',
	'HALF_TOP_RIGHT',
	'HALF_BOTTOM_LEFT',
	'QUARTER_TOP_LEFT_LOW',
	'QUARTER_TOP_LEFT_HIGH',
	'QUARTER_TOP_RIGHT_HIGH',
	'QUARTER_BOTTOM_LEFT_HIGH',
	'QUARTER_LEFT_TOP_LOW',
	'QUARTER_LEFT_TOP_HIGH',
	'QUARTER_LEFT_BOTTOM_LOW',
	'QUARTER_LEFT_BOTTOM_HIGH',
	'QUARTER_RIGHT_TOP_HIGH'
];

/**
 * The set of tile slope types with a top right vertex.
 *
 * @static
 * @property {array} topRightVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.topRightVertices = [
	'FULL',
	'HALF_TOP',
	'HALF_RIGHT',
	'HALF_TOP_LEFT',
	'HALF_TOP_RIGHT',
	'HALF_BOTTOM_RIGHT',
	'QUARTER_TOP_LEFT_LOW',
	'QUARTER_TOP_LEFT_HIGH',
	'QUARTER_TOP_RIGHT_LOW',
	'QUARTER_TOP_RIGHT_HIGH',
	'QUARTER_BOTTOM_RIGHT_HIGH',
	'QUARTER_LEFT_TOP_HIGH',
	'QUARTER_RIGHT_TOP_LOW',
	'QUARTER_RIGHT_TOP_HIGH',
	'QUARTER_RIGHT_BOTTOM_LOW',
	'QUARTER_RIGHT_BOTTOM_HIGH'
];

/**
 * The set of tile slope types with a bottom left vertex.
 *
 * @static
 * @property {array} bottomLeftVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.bottomLeftVertices = [
	'FULL',
	'HALF_LEFT',
	'HALF_BOTTOM',
	'HALF_TOP_LEFT',
	'HALF_BOTTOM_LEFT',
	'HALF_BOTTOM_RIGHT',
	'QUARTER_TOP_LEFT_HIGH',
	'QUARTER_BOTTOM_LEFT_LOW',
	'QUARTER_BOTTOM_LEFT_HIGH',
	'QUARTER_BOTTOM_RIGHT_LOW',
	'QUARTER_BOTTOM_RIGHT_HIGH',
	'QUARTER_LEFT_TOP_HIGH',
	'QUARTER_LEFT_BOTTOM_LOW',
	'QUARTER_LEFT_BOTTOM_HIGH',
	'QUARTER_RIGHT_BOTTOM_LOW'
];

/**
 * The set of tile slope types with a bottom right vertex.
 *
 * @static
 * @property {array} bottomRightVertices
 */
Phaser.Plugin.ArcadeSlopes.SatRestrainer.bottomRightVertices = [
	'FULL',
	'HALF_RIGHT',
	'HALF_BOTTOM',
	'HALF_TOP_RIGHT',
	'HALF_BOTTOM_LEFT',
	'HALF_BOTTOM_RIGHT',
	'QUARTER_TOP_RIGHT_HIGH',
	'QUARTER_BOTTOM_LEFT_LOW',
	'QUARTER_BOTTOM_LEFT_HIGH',
	'QUARTER_BOTTOM_RIGHT_LOW',
	'QUARTER_BOTTOM_RIGHT_HIGH',
	'QUARTER_LEFT_BOTTOM_LOW',
	'QUARTER_RIGHT_TOP_HIGH',
	'QUARTER_RIGHT_BOTTOM_LOW',
	'QUARTER_RIGHT_BOTTOM_HIGH'
];

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * Solves tile collisions using the Separating Axis Theorem.
 * 
 * @class Phaser.Plugin.ArcadeSlopes.SatSolver
 * @constructor
 * @param {object} options - Options for the SAT solver.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver = function (options) {
	/**
	 * Options for the SAT solver.
	 * 
	 * @property {object} options
	 */
	this.options = Phaser.Utils.mixin(options || {}, {
		// Whether to prefer the minimum Y offset over the smallest separation
		preferY: false,
		// Velocity that has to be overcome on each axis to leave the slope, maybe? (stickiness)
		stick: new Phaser.Point(0, 0),
		// Whether to restrain SAT collisions
		restrain: true
	});
	
	/**
	 * Objects that have the chance to process collisions themselves.
	 *
	 * They should expose a restrain() function.
	 *
	 * @property {object[]} restrainters
	 */
	this.restrainers = [
		new Phaser.Plugin.ArcadeSlopes.SatRestrainer()
	];
};

/**
 * Prepare the given SAT response by inverting the overlap vectors.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#prepareResponse
 * @param  {SAT.Response}
 * @return {SAT.Response}
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prepareResponse = function(response) {
	// Invert our overlap vectors so that we have them facing outwards
	response.overlapV.scale(-1);
	response.overlapN.scale(-1);
	
	return response;
};

/**
 * Position a body on the slope of a tile using the X axis.
 *
 * TODO: Remove.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#putOnSlopeX
 * @param {Phaser.Physics.Arcade.Body} body - The body to reposition.
 * @param {Phaser.Tile}                tile - The tile to put the body on.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.putOnSlopeX = function(body, tile) {
	// Calculate a slope definition
	var slope = Phaser.Point.subtract(tile.slope.line.end, tile.slope.line.start);
	
	// Calculate how far into the slope the body is
	//var lerpX = (body.x - tile.slope.line.start.x) / slope.x;
	var lerpY = (body.y - tile.slope.line.start.y) / slope.y;
	
	// Place the body on the slope
	body.position.x = tile.slope.line.start.x + lerpY * slope.y;
	//body.position.y = tile.slope.line.start.y + lerpX * slope.y;
};

/**
 * Position a body on the slope of a tile using the Y axis.
 *
 * TODO: Remove.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#putOnSlopeY
 * @param {Phaser.Physics.Arcade.Body} body - The body to reposition.
 * @param {Phaser.Tile}                tile - The tile to put the body on.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.putOnSlopeY = function(body, tile) {
	// Calculate a slope definition
	var slope = Phaser.Point.subtract(tile.slope.line.end, tile.slope.line.start);
	
	// Calculate how far into the slope the body is
	var lerpX = (body.x - tile.slope.line.start.x) / slope.x;
	//var lerpY = (body.y - tile.slope.line.start.y) / slope.y;
	
	// Place the body on the slope
	//body.position.x = tile.slope.line.start.x + lerpY * slope.y;
	body.position.y = tile.slope.line.start.y + lerpX * slope.y;
};

/**
 * Calculate the minimum X offset given an overlap vector.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#minimumOffsetX
 * @param  {SAT.Vector} vector - The overlap vector.
 * @return {integer}
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.minimumOffsetX = function (vector) {
	return ((vector.y * vector.y) / vector.x) + vector.x;
};

/**
 * Calculate the minimum Y offset given an overlap vector.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#minimumOffsetY
 * @param  {SAT.Vector} vector - The overlap vector.
 * @return {integer}
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.minimumOffsetY = function (vector) {
	return ((vector.x * vector.x) / vector.y) + vector.y;
};

/**
 * Determine whether the given body is moving against the overlap vector of the
 * given response on the Y axis.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#movingAgainstY
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {SAT.Response}               response - The SAT response.
 * @return {boolean}                             - Whether the body is moving against the overlap vector.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.movingAgainstY = function (body, response) {
	return (response.overlapV.y < 0 && body.velocity.y > 0) || (response.overlapV.y > 0 && body.velocity.y < 0);
};

// TODO: shouldPreferX()

/**
 * Determine whether a body should be separated on the Y axis only, given an SAT
 * response.
 *
 * Returns true if options.preferY is true, the overlap vector is non-zero
 * for each axis and the body is moving against the overlap vector.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#shouldPreferY
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {SAT.Response}               response - The SAT response.
 * @return {boolean}                             - Whether to separate on the Y axis only.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.shouldPreferY = function (body, response) {
	return (this.options.preferY || body.slopes.preferY) &&                  // Enabled globally or on the body
		response.overlapV.y !== 0 && response.overlapV.x !== 0 &&            // There's an overlap on both axes
		Phaser.Plugin.ArcadeSlopes.SatSolver.movingAgainstY(body, response); // And we're moving into the shape
};

/**
 * Determine whether two polygons intersect on a given axis.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#isSeparatingAxis
 * @param  {SAT.Polygon}  a        - The first polygon.
 * @param  {SAT.Polygon}  b        - The second polygon.
 * @param  {SAT.Vector}   axis     - The axis to test.
 * @param  {SAT.Response} response - The response to populate.
 * @return {boolean}               - Whether a separating axis was found.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.isSeparatingAxis = function (a, b, axis, response) {
	var result = SAT.isSeparatingAxis(a.pos, b.pos, a.points, b.points, axis, response || null);
	
	if (response) {
		response.a = a;
		response.b = b;
		response.overlapV = response.overlapN.clone().scale(response.overlap);
	}
	
	return result;
};

/**
 * Separate a body from a tile using the given SAT response.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#separate
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {Phaser.Tile}                tile     - The tile.
 * @param  {SAT.Response}               response - The SAT response.
 * @param  {boolean}                    force    - Whether to force separation.
 * @return {boolean}                             - Whether the body was separated.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.separate = function (body, tile, response, force) {
	// Test whether we need to separate from the tile by checking its edge
	// properties and any separation constraints
	if (!force && !this.shouldSeparate(tile.index, body, tile, response)) {
		return false;
	}
	
	// Run any custom tile callbacks, with local callbacks taking priority over
	// layer level callbacks
	if (tile.collisionCallback && !tile.collisionCallback.call(tile.collisionCallbackContext, body.sprite, tile)) {
		return false;
	} else if (tile.layer.callbacks[tile.index] && !tile.layer.callbacks[tile.index].callback.call(tile.layer.callbacks[tile.index].callbackContext, body.sprite, tile)) {
		return false;
	}
	
	// Separate the body from the tile
	if (this.shouldPreferY(body, response)) {
		body.position.y += Phaser.Plugin.ArcadeSlopes.SatSolver.minimumOffsetY(response.overlapV);
	} else {
		body.position.x += response.overlapV.x;
		body.position.y += response.overlapV.y;
	}
	
	return true;
};

/**
 * Apply velocity changes (friction and bounce) to a body given a tile and
 * SAT collision response.
 * 
 * TODO: Optimize by pooling bounce and friction vectors.
 * 
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#applyVelocity
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {Phaser.Tile}                tile     - The tile.
 * @param  {SAT.Response}               response - The SAT response.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.applyVelocity = function (body, tile, response) {
	// Update the body's velocity vector
	body.slopes.velocity.x = body.velocity.x;
	body.slopes.velocity.y = body.velocity.y;
	
	// Project our velocity onto the overlap normal for the bounce vector (Vn)
	var bounce = body.slopes.velocity.clone().projectN(response.overlapN);
	
	// Then work out the surface vector (Vt)
	var friction = body.slopes.velocity.clone().sub(bounce);
	
	// Apply bounce coefficients
	bounce.x = bounce.x * (-body.bounce.x);
	bounce.y = bounce.y * (-body.bounce.y);
	
	// Apply friction coefficients
	friction.x = friction.x * (1 - body.slopes.friction.x - tile.slope.friction.x);
	friction.y = friction.y * (1 - body.slopes.friction.y - tile.slope.friction.y);
	
	// Now we can get our new velocity by adding the bounce and friction vectors
	body.velocity.x = bounce.x + friction.x;
	body.velocity.y = bounce.y + friction.y;
	
	// Process collision pulling
	this.pull(body, response);
};

/**
 * Update the flags of a physics body using a given SAT response.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#updateFlags
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {SAT.Response}               response - The SAT response.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.updateFlags = function (body, response) {
	// Set the touching values
	body.touching.up    = body.touching.up || response.overlapV.y > 0;
	body.touching.down  = body.touching.down || response.overlapV.y < 0;
	body.touching.left  = body.touching.left || response.overlapV.x > 0;
	body.touching.right = body.touching.right || response.overlapV.x < 0;
	
	// Set the blocked values
	body.blocked.up    = body.blocked.up || response.overlapV.x === 0 && response.overlapV.y > 0;
	body.blocked.down  = body.blocked.down || response.overlapV.x === 0 && response.overlapV.y < 0;
	body.blocked.left  = body.blocked.left || response.overlapV.y === 0 && response.overlapV.x > 0;
	body.blocked.right = body.blocked.right || response.overlapV.y === 0 && response.overlapV.x < 0;
};

/**
 * Attempt to snap the body to a given set of tiles based on its slopes options.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#snap
 * @param  {Phaser.Physics.Arcade.Body} body  - The physics body.
 * @param  {Phaser.Tile[]}              tiles - The tiles.
 * @return {boolean}                          - Whether the body was snapped to any tiles.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.snap = function (body, tiles) {
	/*
	if (!body.slopes.snapUp && !body.slopes.snapDown && !body.slopes.snapLeft && !body.slopes.snapRight) {
		return false;
	}
	
	// Keep the current body position to snap from
	var current = new Phaser.Point(body.position.x, body.position.y);
	
	// Keep track of whether the body has snapped to a tile
	var snapped = false;
	
	// For each tile, move the body in each direction by the configured amount,
	// and try to collide, returning the body to its original position if no
	// collision occurs
	for (var t in tiles) {
		var tile = tiles[t];
		
		if (!tile.slope) {
			continue;
		}
		
		if (body.slopes.snapUp) {
			body.position.x = current.x;
			body.position.y = current.y - body.slopes.snapUp;
			
			if (this.snapCollide(body, tile, current)) {
				return true;
			}
		}
		
		if (body.slopes.snapDown) {
			body.position.x = current.x;
			body.position.y = current.y + body.slopes.snapDown;
			
			if (this.snapCollide(body, tile, current)) {
				return true;
			}
		}
		
		if (body.slopes.snapLeft) {
			body.position.x = current.x - body.slopes.snapLeft;
			body.position.y = current.y;
			
			if (this.snapCollide(body, tile, current)) {
				return true;
			}
		}
		
		if (body.slopes.snapRight) {
			body.position.x = current.x + body.slopes.snapRight;
			body.position.y = current.y;
			
			if (this.snapCollide(body, tile, current)) {
				return true;
			}
		}
	}
	
	return false;*/
};

/**
 * Pull the body into a collision response based on its slopes options.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#pull
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {SAT.Response}               response - The SAT response.
 * @return {boolean}                             - Whether the body was pulled.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.pull = function (body, response) {
	if (!body.slopes.pullUp && !body.slopes.pullDown && !body.slopes.pullLeft && !body.slopes.pullRight) {
		return false;
	}
	
	// Clone and flip the overlap normal so that it faces into the collision
	var overlapN = response.overlapN.clone().scale(-1);
	
	if (body.slopes.pullUp && overlapN.y < 0) {
		// Scale it by the configured amount
		pullUp = overlapN.clone().scale(body.slopes.pullUp);
		
		// Apply it to the body velocity
		body.velocity.x += pullUp.x;
		body.velocity.y += pullUp.y;
		
		return true;
	}
	
	if (body.slopes.pullDown && overlapN.y > 0) {
		// Scale it by the configured amount
		pullDown = overlapN.clone().scale(body.slopes.pullDown);
		
		// Apply it to the body velocity
		body.velocity.x += pullDown.x;
		body.velocity.y += pullDown.y;
		
		return true;
	}
	
	if (body.slopes.pullLeft && overlapN.x < 0) {
		// Scale it by the configured amount
		pullLeft = overlapN.clone().scale(body.slopes.pullLeft);
		
		// Apply it to the body velocity
		body.velocity.x += pullLeft.x;
		body.velocity.y += pullLeft.y;
		
		return true;
	}
	
	if (body.slopes.pullRight && overlapN.x > 0) {
		// Scale it by the configured amount
		pullRight = overlapN.clone().scale(body.slopes.pullRight);
		
		// Apply it to the body velocity
		body.velocity.x += pullRight.x;
		body.velocity.y += pullRight.y;
		
		return true;
	}
	
	return false;
};

/**
 * Perform a snap collision between the given body and tile, setting the body
 * back to the given current position if it fails.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#snapCollide
 * @param  {Phaser.Physics.Arcade.Body} body    - The translated physics body.
 * @param  {Phaser.Tile}                tile    - The tile.
 * @param  {Phaser.Point}               current - The original position of the body.
 * @return {boolean}                            - Whether the body snapped to the tile.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.snapCollide = function (body, tile, current) {
	if (this.collide(0, body, tile)) {
		return true;
	}
	
	// There was no collision, so reset the body position
	body.position.x = current.x;
	body.position.y = current.y;
	
	return false;
};

/**
 * Separate the given body and tile from each other and apply any relevant
 * changes to the body's velocity.
 *
 * TODO: Maybe the dot product test for moving into the collision is a good idea
 * TODO: Accept a process callback into this method
 * 
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#collide
 * @param  {integer}                    i           - The tile index.
 * @param  {Phaser.Physics.Arcade.Body} body        - The physics body.
 * @param  {Phaser.Tile}                tile        - The tile.
 * @param  {boolean}                    overlapOnly - Whether to only check for an overlap.
 * @return {boolean}                                - Whether the body was separated.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.collide = function (i, body, tile, overlapOnly) {
	// Bail out if we don't have everything we need
	if (!(body.enable && body.polygon && body.slopes && tile.slope && tile.slope.polygon)) {
		return false;
	}
	
	// Update the body polygon position
	body.polygon.pos.x = body.x;
	body.polygon.pos.y = body.y;
	
	// Update the tile polygon position
	tile.slope.polygon.pos.x = tile.worldX;
	tile.slope.polygon.pos.y = tile.worldY;
	
	var response = new SAT.Response();
	
	// Nothing more to do here if there isn't an overlap
	if (!SAT.testPolygonPolygon(body.polygon, tile.slope.polygon, response)) {
		return false;
	}
	
	// If we're only testing for the overlap, we can bail here
	if (overlapOnly) {
		return true;
	}
	
	// Update the overlap properties of the body
	body.overlapX = response.overlapV.x;
	body.overlapY = response.overlapV.y;
	body.slopes.sat.response = response;
	
	// TODO: Invoke a process callback here
	
	// Invert our overlap vectors so that we have them facing outwards
	Phaser.Plugin.ArcadeSlopes.SatSolver.prepareResponse(response);
	
	// Bail out if no separation occurred
	if (!this.separate(body, tile, response)) {
		return false;
	}
	
	// Apply any velocity changes as a result of the collision
	this.applyVelocity(body, tile, response);
	
	// Update the touching and blocked flags of the physics body
	this.updateFlags(body, response);
	
	return true;
};

/**
 * Collide a body with a tile on a specific axis.
 *
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#collideOnAxis
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {Phaser.Tile}                tile     - The tile.
 * @param  {SAT.Vector}                 axis     - The axis unit vector.
 * @param  {SAT.Response}               response - The SAT response to use.
 * @return {boolean}                             - Whether the body was separated.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.collideOnAxis = function (body, tile, axis, response) {
	// Bail out if we don't have everything we need
	if (!(body.enable && body.polygon && body.slopes && tile.slope && tile.slope.polygon)) {
		return false;
	}
	
	response = response || new SAT.Response();
	
	var separatingAxis = Phaser.Plugin.ArcadeSlopes.SatSolver.isSeparatingAxis(body.polygon, tile.slope.polygon, axis, response);
	
	if (separatingAxis) {
		return false;
	}
	
	Phaser.Plugin.ArcadeSlopes.SatSolver.prepareResponse(response);
	
	if (!this.separate(body, tile, response, true)) {
		return false;
	}
	
	this.applyVelocity(body, tile, response);
	this.updateFlags(body, response);
	
	return true;
};

/**
 * Determine whether to separate a body from a tile, given an SAT response.
 *
 * Checks against the tile slope's edge flags.
 *
 * TODO: Support regular tile face flags?
 * 
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#shouldSeparate
 * @param  {integer}                    i        - The tile index.
 * @param  {Phaser.Physics.Arcade.Body} body     - The physics body.
 * @param  {Phaser.Tile}                tile     - The tile.
 * @param  {SAT.Response}               response - The initial collision response.
 * @return {boolean}                             - Whether to pursue the narrow phase.
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.shouldSeparate = function (i, body, tile, response) {
	if (!(body.enable && response.overlap)) {
		return false;
	}
	
	if (tile.slope.edges.top === Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY && response.overlapN.y < 0 && response.overlapN.x === 0) {
		return false;
	}
	
	if (tile.slope.edges.bottom === Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY && response.overlapN.y > 0 && response.overlapN.x === 0) {
		return false;
	}
	
	if (tile.slope.edges.left === Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY && response.overlapN.x < 0 && response.overlapN.y === 0) {
		return false;
	}
	
	if (tile.slope.edges.right === Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY && response.overlapN.x > 0 && response.overlapN.y === 0) {
		return false;
	}
	
	if  (!this.options.restrain) {
		return true;
	}
	
	for (var r in this.restrainers) {
		var restrainer = this.restrainers[r];
		
		// Skip anything without a restrain function
		if (typeof restrainer.restrain !== 'function') {
			continue;
		}
		
		// Bail if the restrainer dealt with the collision by itself
		if (!restrainer.restrain(this, body, tile, response)) {
			return false;
		}
	}
	
	return true;
};

/**
 * Render the given SAT response as a set of lines from the given position.
 * 
 * TODO: Actually maybe just collect the lines here for drawing later?
 *       Or, make this static and just something you can call in the
 *       context of a game, or game state.
 * 
 * @method Phaser.Plugin.ArcadeSlopes.SatSolver#debug
 * @param {Phaser.Point} position
 * @param {SAT.Response} response
 */
Phaser.Plugin.ArcadeSlopes.SatSolver.prototype.debug = function (position, response) {
	// TODO: Implement.
};

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * Defines the slope of a tile.
 * 
 * @class Phaser.Plugin.ArcadeSlopes.TileSlope
 * @constructor
 * @param {integer}     type    - The type of the tile slope.
 * @param {Phaser.Tile} tile    - The tile this slope definition belongs to.
 * @param {SAT.Polygon} polygon - The polygon representing the shape of the tile.
 * @param {Phaser.Line} line    - The line representing the slope of the tile.
 * @param {object}      edges   - The flags for each edge of the tile.
 * @param {SAT.Vector}  axis    - The preferred axis for separating physics bodies.
 */
Phaser.Plugin.ArcadeSlopes.TileSlope = function (type, tile, polygon, line, edges, axis) {
	/**
	 * The type of the tile slope.
	 * 
	 * @property {integer} type
	 */
	this.type = type;
	
	/**
	 * The tile this slope definition is for.
	 * 
	 * @property {Phaser.Tile} tile
	 */
	this.tile = tile;
	
	/**
	 * The polygon representing the shape of the tile.
	 *
	 * @property {SAT.Polygon} polygon
	 */
	this.polygon = polygon;
	
	/**
	 * The line representing the slope of the tile.
	 *
	 * @property {Phaser.Tile} line
	 */
	this.line = line;
	
	/**
	 * The flags for each edge of the tile; empty, solid or interesting?
	 *
	 * @property {object} edges
	 */
	this.edges = Phaser.Utils.mixin(edges || {}, {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID
	});
	
	/**
	 * The preferred axis for separating physics bodies.
	 *
	 * @property {SAT.Vector} axis
	 */
	this.axis = axis || null;
	
	/**
	 * The preferred solver to use for this slope.
	 * 
	 * @property {string} solver
	 */
	this.solver = null;
	
	/**
	 * The friction of this slope.
	 *
	 * @property {Phaser.Point} friction
	 */
	this.friction = new Phaser.Point();
};

/**
 * Resolve a tile slope type constant from the given value.
 *
 * Returns any successfully parsed non-zero integers regardless of whether they
 * are valid slope tile types. This method is really for strings.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlope#resolveType
 * @param  {string|integer} type - The value to resolve.
 * @return {integer}             - The resolved tile slope type constant.
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.resolveType = function (type) {
	if (parseInt(type) > -1) {
		return type;
	}
	
	if (Phaser.Plugin.ArcadeSlopes.TileSlope.hasOwnProperty(type)) {
		return Phaser.Plugin.ArcadeSlopes.TileSlope[type];
	}
	
	console.warn('Unresolved slope type \'' + type + '\'');
	
	return -1;
};

/**
 * The slope of the tile.
 *
 * @name Phaser.Plugin.ArcadeSlopes.TileSlope#slope
 * @property {number} slope
 */
Object.defineProperty(Phaser.Plugin.ArcadeSlopes.TileSlope.prototype, 'slope', {
	get: function () {
		if (!this.line) {
			return 0;
		}
		
		return (this.line.start.y - this.line.end.y) / (this.line.start.x - this.line.end.x);
	}
});

/**
 * The name of the tile slope type.
 *
 * @name Phaser.Plugin.ArcadeSlopes.TileSlope#typeName
 * @property {string} typeName
 */
Object.defineProperty(Phaser.Plugin.ArcadeSlopes.TileSlope.prototype, 'typeName', {
	get: function () {
		return Phaser.Plugin.ArcadeSlopes.TileSlope.resolveTypeName(this.type);
	},
	set: function (type) {
		this.type = Phaser.Plugin.ArcadeSlopes.TileSlope.resolveType(type);
	}
});

/**
 * Resolve a tile slope type name from the given type constant.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlope#resolveTypeName
 * @param  {integer} type - The type constant.
 * @return {integer}      - The type name.
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.resolveTypeName = function (type) {
	if (Phaser.Plugin.ArcadeSlopes.TileSlope.typeNames.hasOwnProperty(type)) {
		return Phaser.Plugin.ArcadeSlopes.TileSlope.typeNames[type];
	}
	
	return Phaser.Plugin.ArcadeSlopes.TileSlope.typeNames[-1];
};

/**
 * The map of tile slope types to their corresponding type names.
 *
 * @static
 * @property {object} typeNames
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.typeNames = {
	'-1': 'UNKNOWN',
	0:  'FULL',
	21: 'HALF_BOTTOM',
	22: 'HALF_TOP',
	23: 'HALF_LEFT',
	24: 'HALF_RIGHT',
	1:  'HALF_BOTTOM_LEFT',
	2:  'HALF_BOTTOM_RIGHT',
	3:  'HALF_TOP_LEFT',
	4:  'HALF_TOP_RIGHT',
	5:  'QUARTER_BOTTOM_LEFT_LOW',
	6:  'QUARTER_BOTTOM_LEFT_HIGH',
	7:  'QUARTER_BOTTOM_RIGHT_LOW',
	8:  'QUARTER_BOTTOM_RIGHT_HIGH',
	9:  'QUARTER_LEFT_BOTTOM_LOW',
	10: 'QUARTER_LEFT_BOTTOM_HIGH',
	11: 'QUARTER_RIGHT_BOTTOM_LOW',
	12: 'QUARTER_RIGHT_BOTTOM_HIGH',
	13: 'QUARTER_LEFT_TOP_LOW',
	14: 'QUARTER_LEFT_TOP_HIGH',
	15: 'QUARTER_RIGHT_TOP_LOW',
	16: 'QUARTER_RIGHT_TOP_HIGH',
	17: 'QUARTER_TOP_LEFT_LOW',
	18: 'QUARTER_TOP_LEFT_HIGH',
	19: 'QUARTER_TOP_RIGHT_LOW',
	20: 'QUARTER_TOP_RIGHT_HIGH',
};

// TODO: Misleading constants here - they aren't tile slope types, they're edges

/**
 * An empty tile edge.
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY = 0;

/**
 * A solid tile edge.
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID = 1;

/**
 * An interesting tile edge.
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING = 2;

/**
 * An undefined tile slope type.
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.UNKNOWN = -1;

/**
 * A full square tile.
 * .___
 * |   |
 * |___|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.FULL = 0;

/**
 * A half bottom tile.
 * .
 *  ___
 * |___|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM = 21;

/**
 * A half top tile.
 * .___
 * |___|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP = 22;

/**
 * A half left tile.
 * ._
 * | |
 * |_|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_LEFT = 23;

/**
 * A half right tile.
 * .  _
 *   | |
 *   |_|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_RIGHT = 24;

/**
 * A 45 degree bottom left slope.
 *
 * |\
 * | \
 * |__\
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM_LEFT = 1;

/**
 * A 45 degree bottom right slope.
 *
 *   /|
 *  / |
 * /__|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM_RIGHT = 2;

/**
 * A 45 degree top left slope.
 *  __
 * |  /
 * | /
 * |/
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP_LEFT = 3;

/**
 * A 45 degree top right slope.
 *  __
 * \  |
 *  \ |
 *   \|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP_RIGHT = 4;

/**
 * |\
 * | | |\
 * |_| |_\ <--
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_LEFT_LOW = 5;

/**
 *    |\
 *    | | |\
 * -->|_| |_\
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_LEFT_HIGH = 6;

/**
 *         /|
 *     /| | |
 * -->/_| |_|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_RIGHT_LOW = 7;

/**
 *      /|
 *  /| | |
 * /_| |_|<--
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_RIGHT_HIGH = 8;

/**
 * |\
 * |_\
 *  __
 * |  \ <--
 * |___\
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_BOTTOM_LOW = 9;

/**
 * |\
 * |_\ <--
 *  __
 * |  \
 * |___\
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_BOTTOM_HIGH = 10;

/**
 *    /|
 *   /_|
 *   __
 *  /  | <--
 * /___|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_BOTTOM_LOW = 11;

/**
 *    /|
 *   /_| <--
 *   __
 *  /  |
 * /___|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_BOTTOM_HIGH = 12;

/**
 *  ____
 * |    /
 * |___/
 *  __
 * | /  <--
 * |/
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_TOP_LOW = 13;

/**
 *  ____
 * |    / <--
 * |___/
 *  __
 * | /
 * |/
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_TOP_HIGH = 14;

/**
 *  ____
 * \    |
 *  \___|
 *    __
 *    \ | <--
 *     \|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_TOP_LOW = 15;

/**
 *  ____
 * \    | <--
 *  \___|
 *    __
 *    \ |
 *     \|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_TOP_HIGH = 16;

/**
 *  __    __
 * |  |  | / <--
 * |  |  |/
 * | /
 * |/
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_LEFT_LOW = 17;

/**
 *      __    __
 *     |  |  | /
 * --> |  |  |/
 *     | /
 *     |/
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_LEFT_HIGH = 18;

/**
 *    __   __
 *    \ | |  |
 * --> \| |  |
 *         \ |
 *          \|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_RIGHT_LOW = 19;

/**
 * __   __
 * \ | |  |
 *  \| |  | <--
 *      \ |
 *       \|
 *
 * @constant
 * @type {integer}
 */
Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_RIGHT_HIGH = 20;

/**
 * @author Chris Andrew <chris@hexus.io>
 * @copyright 2016 Chris Andrew
 * @license MIT
 */

/**
 * Builds TileSlope objects from a set of definition functions.
 * 
 * @class Phaser.Plugin.ArcadeSlopes.TileSlopeFactory
 * @constructor
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory = function () {
	/**
	 * A set of definition functions for the factory to use to build tile slopes
	 * of a given type.
	 * 
	 * Maps slope type constants to definition functions.
	 * 
	 * @property {object} definitions
	 */
	this.definitions = {};
	
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.FULL]                      = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createFull;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM]               = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottom;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP]                  = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTop;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_LEFT]                 = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfLeft;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_RIGHT]                = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfRight;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM_LEFT]          = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottomLeft;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_BOTTOM_RIGHT]         = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottomRight;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP_LEFT]             = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTopLeft;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.HALF_TOP_RIGHT]            = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTopRight;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_LEFT_LOW]   = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomLeftLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_LEFT_HIGH]  = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomLeftHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_RIGHT_LOW]  = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomRightLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_BOTTOM_RIGHT_HIGH] = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomRightHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_BOTTOM_LOW]   = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftBottomLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_BOTTOM_HIGH]  = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftBottomHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_BOTTOM_LOW]  = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightBottomLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_BOTTOM_HIGH] = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightBottomHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_TOP_LOW]      = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftTopLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_LEFT_TOP_HIGH]     = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftTopHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_TOP_LOW]     = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightTopLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_RIGHT_TOP_HIGH]    = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightTopHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_LEFT_LOW]      = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopLeftLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_LEFT_HIGH]     = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopLeftHigh;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_RIGHT_LOW]     = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopRightLow;
	this.definitions[Phaser.Plugin.ArcadeSlopes.TileSlope.QUARTER_TOP_RIGHT_HIGH]    = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopRightHigh;
};

Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.constructor = Phaser.Plugin.ArcadeSlopes.TileSlopeFactory;

/**
 * Define a new tile slope type.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#define
 * @param  {integer}  type       - The slope type key.
 * @param  {function} definition - The slope type definition function.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.define = function (type, definition) {
	if (typeof definition !== 'function') {
		return;
	}
	
	this.definitions[type] = definition;
};

/**
 * Create a TileSlope of the given type for the given tile.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#create
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.create = function (type, tile) {
	var original = type;
	
	type = Phaser.Plugin.ArcadeSlopes.TileSlope.resolveType(original);
	
	if (!this.definitions.hasOwnProperty(type)) {
		console.warn('Slope type ' + original + ' not defined');
		
		return null;
	}
	
	if (typeof this.definitions[type] !== 'function') {
		console.warn('Slope type definition for type ' + original + ' is not a function');
		
		return null;
	}
	
	return this.definitions[type].call(this, type, tile);
};

/**
 * Convert a layer of the given tilemap.
 * 
 * Attaches Phaser.Plugin.ArcadeSlopes.TileSlope objects that are used to define
 * how the tile should collide with a physics body.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#convertTilemap
 * @param  {Phaser.Tilemap}                    map      - The map containing the layer to convert.
 * @param  {number|string|Phaser.TileMapLayer} layer    - The layer of the map to convert.
 * @param  {object}                            slopeMap - A map of tilemap indexes to ArcadeSlope.TileSlope constants.
 * @return {Phaser.Tilemap}                             - The converted tilemap.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.convertTilemap = function (map, layer, slopeMap) {
	layer = map.getLayer(layer);
	
	this.convertTilemapLayer(layer, slopeMap);
	
	return map;
};

/**
 * Convert a tilemap layer.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#convertTilemapLayer
 * @param  {Phaser.TilemapLayer} layer    - The tilemap layer to convert.
 * @param  {object}              slopeMap - A map of tilemap indexes to ArcadeSlope.TileSlope constants.
 * @return {Phaser.TilemapLayer}          - The converted tilemap layer.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.convertTilemapLayer = function (layer, slopeMap) {
	var that = this;
	
	// Create the TileSlope objects for each relevant tile in the layer
	layer.layer.data.forEach(function (row) {
		row.forEach(function (tile) {
			if (slopeMap.hasOwnProperty(tile.index)) {
				var slope = that.create(slopeMap[tile.index], tile);
				
				if (slope) {
					tile.slope = slope;
				}
			}
			
			var x = tile.x;
			var y = tile.y;
			
			tile.neighbours = tile.neighbours || {};
			
			// Give each tile references to their eight neighbours
			tile.neighbours.above = layer.map.getTileAbove(layer.index, x, y);
			tile.neighbours.below = layer.map.getTileBelow(layer.index, x, y);
			tile.neighbours.left = layer.map.getTileLeft(layer.index, x, y);
			tile.neighbours.right = layer.map.getTileRight(layer.index, x, y);
			tile.neighbours.topLeft = layer.map.getTileTopLeft(layer.index, x, y);
			tile.neighbours.topRight = layer.map.getTileTopRight(layer.index, x, y);
			tile.neighbours.bottomLeft = layer.map.getTileBottomLeft(layer.index, x, y);
			tile.neighbours.bottomRight = layer.map.getTileBottomRight(layer.index, x, y);
		});
	});
	
	// Calculate the edge flags for each tile in the layer
	this.calculateEdges(layer);
	
	return layer;
};

/**
 * Calculate the edge flags for each tile in the given tilemap layer.
 *
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#calculateEdges
 * @param {Phaser.TilemapLayer} layer - The tilemap layer to calculate edge flags for.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.calculateEdges = function (layer) {
	var above = null;
	var below = null;
	var left  = null;
	var right = null;
	
	for (var y = 0, h = layer.layer.height; y < h; y++) {
		for (var x = 0, w = layer.layer.width; x < w; x++) {
			var tile = layer.layer.data[y][x];
			
			if (tile && tile.hasOwnProperty('slope')) {
				above = layer.map.getTileAbove(layer.index, x, y);
				below = layer.map.getTileBelow(layer.index, x, y);
				left  = layer.map.getTileLeft(layer.index, x, y);
				right = layer.map.getTileRight(layer.index, x, y);
				
				if (above && above.hasOwnProperty('slope')) {
					tile.slope.edges.top = this.compareEdges(tile.slope.edges.top, above.slope.edges.bottom);
				}
				
				if (below && below.hasOwnProperty('slope')) {
					tile.slope.edges.bottom = this.compareEdges(tile.slope.edges.bottom, below.slope.edges.top);
				}
				
				if (left && left.hasOwnProperty('slope')) {
					tile.slope.edges.left = this.compareEdges(tile.slope.edges.left, left.slope.edges.right);
				}
				
				if (right && right.hasOwnProperty('slope')) {
					tile.slope.edges.right = this.compareEdges(tile.slope.edges.right, right.slope.edges.left);
				}
			}
		}
	}
};

/**
 * Resolve the given flags of two shared edges.
 *
 * Returns the new flag to use for the first edge after comparing it with the
 * second edge.
 * 
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#compareEdges
 * @param  {integer} firstEdge  - The edge to resolve.
 * @param  {integer} secondEdge - The edge to compare against.
 * @return {integer}            - The resolved edge.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.prototype.compareEdges = function (firstEdge, secondEdge) {
	if (firstEdge === Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID && secondEdge === Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID) {
		return Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY;
	}
	
	if (firstEdge === Phaser.Plugin.ArcadeSlopes.TileSlope.SOLID && secondEdge === Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY) {
		return Phaser.Plugin.ArcadeSlopes.TileSlope.EMPTY;
	}
	
	return firstEdge;
};

/**
 * Define a full square tile.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createFull
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createFull = function (type, tile) {
	var polygon = new SAT.Box(
		new SAT.Vector(tile.worldX, tile.worldY),
		tile.width,
		tile.height
	).toPolygon();
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon);
};

/**
 * Define a bottom half tile.
 * 
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfBottom
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottom = function (type, tile) {
	var halfHeight = tile.height / 2;
	
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, halfHeight),
		new SAT.Vector(tile.width, halfHeight),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top + tile.height / 2, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges);
};

/**
 * Define a top half tile.
 * 
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfTop
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTop = function (type, tile) {
	var halfHeight = tile.height / 2;
	
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, halfHeight),
		new SAT.Vector(0, halfHeight)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.right, tile.top);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges);
};

/**
 * Define a left half tile.
 * 
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfLeft
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfLeft = function (type, tile) {
	var halfWidth = tile.width / 2;
	
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(halfWidth, 0),
		new SAT.Vector(halfWidth, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + halfWidth, tile.top, tile.left + halfWidth, tile.bottom);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges);
};

/**
 * Define a right half tile.
 * 
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfRight
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfRight = function (type, tile) {
	var halfWidth = tile.width / 2;
	
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(halfWidth, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(halfWidth, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + halfWidth, tile.top, tile.left + halfWidth, tile.bottom);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges);
};

/**
 * Define a 45 degree bottom left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfBottomLeft
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottomLeft = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),                    // Top left
		new SAT.Vector(tile.width, tile.height), // Bottom right
		new SAT.Vector(0, tile.height)           // Bottom left
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.right, tile.bottom);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.7071067811865475, -0.7071067811865475);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a 45 degree bottom right slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfBottomRight
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfBottomRight = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width, 0),           // Top right
		new SAT.Vector(tile.width, tile.height), // Bottom right
		new SAT.Vector(0, tile.height)           // Bottom left
	]);
	
	var line = new Phaser.Line(tile.left, tile.bottom, tile.right, tile.top);
	
	var edges = {
		top:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.707106781186548, -0.707106781186548);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a 45 degree top left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfTopLeft
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTopLeft = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),          // Top left
		new SAT.Vector(tile.width, 0), // Top right
		new SAT.Vector(0, tile.height) // Bottom right
	]);
	
	var line = new Phaser.Line(tile.right, tile.top, tile.left, tile.bottom);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.7071067811865475, 0.7071067811865475);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a 45 degree top left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createHalfTopRight
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createHalfTopRight = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),                   // Top left
		new SAT.Vector(tile.width, 0),          // Top right
		new SAT.Vector(tile.width, tile.height) // Bottom right
	]);
	
	var line = new Phaser.Line(tile.right, tile.bottom, tile.left, tile.top);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.7071067811865475, 0.7071067811865475);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree bottom left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterBottomLeftLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomLeftLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, tile.height / 2),      // Center left
		new SAT.Vector(tile.width, tile.height), // Bottom right
		new SAT.Vector(0, tile.height)           // Bottom left
	]);
	
	var line = new Phaser.Line(tile.left, tile.top + tile.height / 2, tile.right, tile.bottom);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.4472135954999579, -0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree bottom left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterBottomLeftHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomLeftHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),                        // Top left
		new SAT.Vector(tile.width, tile.height / 2), // Center right
		new SAT.Vector(tile.width, tile.height),     // Bottom right
		new SAT.Vector(0, tile.height)               // Bottom left
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.4472135954999579, -0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree bottom right slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterBottomRightLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomRightLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width, tile.height / 2), // Center right
		new SAT.Vector(tile.width, tile.height),     // Bottom right
		new SAT.Vector(0, tile.height)               // Bottom left
	]);
	
	var line = new Phaser.Line(tile.left, tile.bottom, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.4472135954999579, -0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree bottom right slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterBottomRightHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterBottomRightHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width, 0),          // Top right
		new SAT.Vector(0, tile.height / 2),     // Center left
		new SAT.Vector(0, tile.height),         // Bottom left
		new SAT.Vector(tile.width, tile.height) // Bottom right
	]);
	
	var line = new Phaser.Line(tile.left, tile.bottom, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		top:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.4472135954999579, -0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};


/**
 * Define a lower 22.5 degree left bottom slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterLeftBottomLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftBottomLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width / 2, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + tile.width / 2, tile.top, tile.right, tile.bottom);
	
	var edges = {
		top:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.8944271909999159, -0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree left bottom slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterLeftBottomHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftBottomHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width / 2, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.left + tile.width / 2, tile.bottom);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.8944271909999159, -0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};


/**
 * Define a lower 22.5 degree right bottom slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterRightBottomLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightBottomLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width / 2, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left, tile.bottom, tile.left + tile.width / 2, tile.top);
	
	var edges = {
		top:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.8944271909999159, -0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};


/**
 * Define an upper 22.5 degree right bottom slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterRightBottomHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightBottomHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(tile.width / 2, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + tile.width / 2, tile.bottom, tile.right, tile.top);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.8944271909999159, -0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree left top slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterLeftTopLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftTopLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width / 2, 0),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(0, tile.height, tile.width / 2, 0);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.8944271909999159, 0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree left top slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterLeftTopHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterLeftTopHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width / 2, tile.height),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + tile.width / 2, tile.bottom, tile.right, tile.bottom);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.8944271909999159, 0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree right top slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterRightTopLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightTopLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(tile.width / 2, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left + tile.width / 2, tile.top, tile.right, tile.bottom);
	
	var edges = {
		top:    Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.8944271909999159, 0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree right top slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterRightTopHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterRightTopHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(tile.width / 2, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.left + tile.width / 2, tile.bottom);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.8944271909999159, 0.4472135954999579);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree top left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterTopLeftLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopLeftLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(0, tile.height / 2)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top + tile.height / 2, tile.right, tile.top);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.4472135954999579, 0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree top left slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterTopLeftHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopLeftHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height / 2),
		new SAT.Vector(0, tile.height)
	]);
	
	var line = new Phaser.Line(tile.left, tile.bottom, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(0.4472135954999579, 0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define a lower 22.5 degree top right slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterTopRightLow
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopRightLow = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height / 2)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top, tile.right, tile.top + tile.height / 2);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		right:  Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.4472135954999579, 0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

/**
 * Define an upper 22.5 degree top right slope.
 *
 * @static
 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#createQuarterTopRightHigh
 * @param  {integer}     type                     - The slope type.
 * @param  {Phaser.Tile} tile                     - The tile object.
 * @return {Phaser.Plugin.ArcadeSlopes.TileSlope} - The defined tile slope.
 */
Phaser.Plugin.ArcadeSlopes.TileSlopeFactory.createQuarterTopRightHigh = function (type, tile) {
	var polygon = new SAT.Polygon(new SAT.Vector(tile.worldX, tile.worldY), [
		new SAT.Vector(0, 0),
		new SAT.Vector(tile.width, 0),
		new SAT.Vector(tile.width, tile.height),
		new SAT.Vector(0, tile.height / 2)
	]);
	
	var line = new Phaser.Line(tile.left, tile.top + tile.height / 2, tile.right, tile.top + tile.height);
	
	var edges = {
		bottom: Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING,
		left:   Phaser.Plugin.ArcadeSlopes.TileSlope.INTERESTING
	};
	
	var axis = new SAT.Vector(-0.4472135954999579, 0.8944271909999159);
	
	return new Phaser.Plugin.ArcadeSlopes.TileSlope(type, tile, polygon, line, edges, axis);
};

// Version 0.5.0 - Copyright 2012 - 2015 -  Jim Riecken <jimr@jimr.ca>
//
// Released under the MIT License - https://github.com/jriecken/sat-js
//
// A simple library for determining intersections of circles and
// polygons using the Separating Axis Theorem.
/** @preserve SAT.js - Version 0.5.0 - Copyright 2012 - 2015 - Jim Riecken <jimr@jimr.ca> - released under the MIT License. https://github.com/jriecken/sat-js */

/*global define: false, module: false*/
/*jshint shadow:true, sub:true, forin:true, noarg:true, noempty:true, 
  eqeqeq:true, bitwise:true, strict:true, undef:true, 
  curly:true, browser:true */

// Create a UMD wrapper for SAT. Works in:
//
//  - Plain browser via global SAT variable
//  - AMD loader (like require.js)
//  - Node.js
//
// The quoted properties all over the place are used so that the Closure Compiler
// does not mangle the exposed API in advanced mode.
/**
 * @param {*} root - The global scope
 * @param {Function} factory - Factory that creates SAT module
 */
(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define['amd']) {
    define(factory);
  } else if (typeof exports === 'object') {
    module['exports'] = factory();
  } else {
    root['SAT'] = factory();
  }
}(this, function () {
  "use strict";

  var SAT = {};

  //
  // ## Vector
  //
  // Represents a vector in two dimensions with `x` and `y` properties.


  // Create a new Vector, optionally passing in the `x` and `y` coordinates. If
  // a coordinate is not specified, it will be set to `0`
  /** 
   * @param {?number=} x The x position.
   * @param {?number=} y The y position.
   * @constructor
   */
  function Vector(x, y) {
    this['x'] = x || 0;
    this['y'] = y || 0;
  }
  SAT['Vector'] = Vector;
  // Alias `Vector` as `V`
  SAT['V'] = Vector;


  // Copy the values of another Vector into this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['copy'] = Vector.prototype.copy = function(other) {
    this['x'] = other['x'];
    this['y'] = other['y'];
    return this;
  };

  // Create a new vector with the same coordinates as this on.
  /**
   * @return {Vector} The new cloned vector
   */
  Vector.prototype['clone'] = Vector.prototype.clone = function() {
    return new Vector(this['x'], this['y']);
  };

  // Change this vector to be perpendicular to what it was before. (Effectively
  // roatates it 90 degrees in a clockwise direction)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['perp'] = Vector.prototype.perp = function() {
    var x = this['x'];
    this['x'] = this['y'];
    this['y'] = -x;
    return this;
  };

  // Rotate this vector (counter-clockwise) by the specified angle (in radians).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Vector} This for chaining.
   */
  Vector.prototype['rotate'] = Vector.prototype.rotate = function (angle) {
    var x = this['x'];
    var y = this['y'];
    this['x'] = x * Math.cos(angle) - y * Math.sin(angle);
    this['y'] = x * Math.sin(angle) + y * Math.cos(angle);
    return this;
  };

  // Reverse this vector.
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reverse'] = Vector.prototype.reverse = function() {
    this['x'] = -this['x'];
    this['y'] = -this['y'];
    return this;
  };
  

  // Normalize this vector.  (make it have length of `1`)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['normalize'] = Vector.prototype.normalize = function() {
    var d = this.len();
    if(d > 0) {
      this['x'] = this['x'] / d;
      this['y'] = this['y'] / d;
    }
    return this;
  };
  
  // Add another vector to this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['add'] = Vector.prototype.add = function(other) {
    this['x'] += other['x'];
    this['y'] += other['y'];
    return this;
  };
  
  // Subtract another vector from this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaiing.
   */
  Vector.prototype['sub'] = Vector.prototype.sub = function(other) {
    this['x'] -= other['x'];
    this['y'] -= other['y'];
    return this;
  };
  
  // Scale this vector. An independant scaling factor can be provided
  // for each axis, or a single scaling factor that will scale both `x` and `y`.
  /**
   * @param {number} x The scaling factor in the x direction.
   * @param {?number=} y The scaling factor in the y direction.  If this
   *   is not specified, the x scaling factor will be used.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['scale'] = Vector.prototype.scale = function(x,y) {
    this['x'] *= x;
    this['y'] *= y || x;
    return this; 
  };
  
  // Project this vector on to another vector.
  /**
   * @param {Vector} other The vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['project'] = Vector.prototype.project = function(other) {
    var amt = this.dot(other) / other.len2();
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Project this vector onto a vector of unit length. This is slightly more efficient
  // than `project` when dealing with unit vectors.
  /**
   * @param {Vector} other The unit vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['projectN'] = Vector.prototype.projectN = function(other) {
    var amt = this.dot(other);
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Reflect this vector on an arbitrary axis.
  /**
   * @param {Vector} axis The vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflect'] = Vector.prototype.reflect = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.project(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Reflect this vector on an arbitrary axis (represented by a unit vector). This is
  // slightly more efficient than `reflect` when dealing with an axis that is a unit vector.
  /**
   * @param {Vector} axis The unit vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflectN'] = Vector.prototype.reflectN = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.projectN(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Get the dot product of this vector and another.
  /**
   * @param {Vector}  other The vector to dot this one against.
   * @return {number} The dot product.
   */
  Vector.prototype['dot'] = Vector.prototype.dot = function(other) {
    return this['x'] * other['x'] + this['y'] * other['y'];
  };
  
  // Get the squared length of this vector.
  /**
   * @return {number} The length^2 of this vector.
   */
  Vector.prototype['len2'] = Vector.prototype.len2 = function() {
    return this.dot(this);
  };
  
  // Get the length of this vector.
  /**
   * @return {number} The length of this vector.
   */
  Vector.prototype['len'] = Vector.prototype.len = function() {
    return Math.sqrt(this.len2());
  };
  
  // ## Circle
  //
  // Represents a circle with a position and a radius.

  // Create a new circle, optionally passing in a position and/or radius. If no position
  // is given, the circle will be at `(0,0)`. If no radius is provided, the circle will
  // have a radius of `0`.
  /**
   * @param {Vector=} pos A vector representing the position of the center of the circle
   * @param {?number=} r The radius of the circle
   * @constructor
   */
  function Circle(pos, r) {
    this['pos'] = pos || new Vector();
    this['r'] = r || 0;
  }
  SAT['Circle'] = Circle;
  
  // Compute the axis-aligned bounding box (AABB) of this Circle.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Circle.prototype['getAABB'] = Circle.prototype.getAABB = function() {
    var r = this['r'];
    var corner = this["pos"].clone().sub(new Vector(r, r));
    return new Box(corner, r*2, r*2).toPolygon();
  };

  // ## Polygon
  //
  // Represents a *convex* polygon with any number of points (specified in counter-clockwise order)
  //
  // Note: Do _not_ manually change the `points`, `angle`, or `offset` properties. Use the
  // provided setters. Otherwise the calculated properties will not be updated correctly.
  //
  // `pos` can be changed directly.

  // Create a new polygon, passing in a position vector, and an array of points (represented
  // by vectors relative to the position vector). If no position is passed in, the position
  // of the polygon will be `(0,0)`.
  /**
   * @param {Vector=} pos A vector representing the origin of the polygon. (all other
   *   points are relative to this one)
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @constructor
   */
  function Polygon(pos, points) {
    this['pos'] = pos || new Vector();
    this['angle'] = 0;
    this['offset'] = new Vector();
    this.setPoints(points || []);
  }
  SAT['Polygon'] = Polygon;
  
  // Set the points of the polygon.
  //
  // Note: The points are counter-clockwise *with respect to the coordinate system*.
  // If you directly draw the points on a screen that has the origin at the top-left corner
  // it will _appear_ visually that the points are being specified clockwise. This is just
  // because of the inversion of the Y-axis when being displayed.
  /**
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setPoints'] = Polygon.prototype.setPoints = function(points) {
    // Only re-allocate if this is a new polygon or the number of points has changed.
    var lengthChanged = !this['points'] || this['points'].length !== points.length;
    if (lengthChanged) {
      var i;
      var calcPoints = this['calcPoints'] = [];
      var edges = this['edges'] = [];
      var normals = this['normals'] = [];
      // Allocate the vector arrays for the calculated properties
      for (i = 0; i < points.length; i++) {
        calcPoints.push(new Vector());
        edges.push(new Vector());
        normals.push(new Vector());
      }
    }
    this['points'] = points;
    this._recalc();
    return this;
  };

  // Set the current rotation angle of the polygon.
  /**
   * @param {number} angle The current rotation angle (in radians).
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setAngle'] = Polygon.prototype.setAngle = function(angle) {
    this['angle'] = angle;
    this._recalc();
    return this;
  };

  // Set the current offset to apply to the `points` before applying the `angle` rotation.
  /**
   * @param {Vector} offset The new offset vector.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setOffset'] = Polygon.prototype.setOffset = function(offset) {
    this['offset'] = offset;
    this._recalc();
    return this;
  };

  // Rotates this polygon counter-clockwise around the origin of *its local coordinate system* (i.e. `pos`).
  //
  // Note: This changes the **original** points (so any `angle` will be applied on top of this rotation).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['rotate'] = Polygon.prototype.rotate = function(angle) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].rotate(angle);
    }
    this._recalc();
    return this;
  };

  // Translates the points of this polygon by a specified amount relative to the origin of *its own coordinate
  // system* (i.e. `pos`).
  //
  // This is most useful to change the "center point" of a polygon. If you just want to move the whole polygon, change
  // the coordinates of `pos`.
  //
  // Note: This changes the **original** points (so any `offset` will be applied on top of this translation)
  /**
   * @param {number} x The horizontal amount to translate.
   * @param {number} y The vertical amount to translate.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['translate'] = Polygon.prototype.translate = function (x, y) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].x += x;
      points[i].y += y;
    }
    this._recalc();
    return this;
  };


  // Computes the calculated collision polygon. Applies the `angle` and `offset` to the original points then recalculates the
  // edges and normals of the collision polygon.
  /**
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype._recalc = function() {
    // Calculated points - this is what is used for underlying collisions and takes into account
    // the angle/offset set on the polygon.
    var calcPoints = this['calcPoints'];
    // The edges here are the direction of the `n`th edge of the polygon, relative to
    // the `n`th point. If you want to draw a given edge from the edge value, you must
    // first translate to the position of the starting point.
    var edges = this['edges'];
    // The normals here are the direction of the normal for the `n`th edge of the polygon, relative
    // to the position of the `n`th point. If you want to draw an edge normal, you must first
    // translate to the position of the starting point.
    var normals = this['normals'];
    // Copy the original points array and apply the offset/angle
    var points = this['points'];
    var offset = this['offset'];
    var angle = this['angle'];
    var len = points.length;
    var i;
    for (i = 0; i < len; i++) {
      var calcPoint = calcPoints[i].copy(points[i]);
      calcPoint.x += offset.x;
      calcPoint.y += offset.y;
      if (angle !== 0) {
        calcPoint.rotate(angle);
      }
    }
    // Calculate the edges/normals
    for (i = 0; i < len; i++) {
      var p1 = calcPoints[i];
      var p2 = i < len - 1 ? calcPoints[i + 1] : calcPoints[0];
      var e = edges[i].copy(p2).sub(p1);
      normals[i].copy(e).perp().normalize();
    }
    return this;
  };
  
  
  // Compute the axis-aligned bounding box. Any current state
  // (translations/rotations) will be applied before constructing the AABB.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Polygon.prototype["getAABB"] = Polygon.prototype.getAABB = function() {
    var points = this["calcPoints"];
    var len = points.length;
    var xMin = points[0]["x"];
    var yMin = points[0]["y"];
    var xMax = points[0]["x"];
    var yMax = points[0]["y"];
    for (var i = 1; i < len; i++) {
      var point = points[i];
      if (point["x"] < xMin) {
        xMin = point["x"];
      }
      else if (point["x"] > xMax) {
        xMax = point["x"];
      }
      if (point["y"] < yMin) {
        yMin = point["y"];
      }
      else if (point["y"] > yMax) {
        yMax = point["y"];
      }
    }
    return new Box(this["pos"].clone().add(new Vector(xMin, yMin)), xMax - xMin, yMax - yMin).toPolygon();
  };
  

  // ## Box
  //
  // Represents an axis-aligned box, with a width and height.


  // Create a new box, with the specified position, width, and height. If no position
  // is given, the position will be `(0,0)`. If no width or height are given, they will
  // be set to `0`.
  /**
   * @param {Vector=} pos A vector representing the bottom-left of the box (i.e. the smallest x and smallest y value).
   * @param {?number=} w The width of the box.
   * @param {?number=} h The height of the box.
   * @constructor
   */
  function Box(pos, w, h) {
    this['pos'] = pos || new Vector();
    this['w'] = w || 0;
    this['h'] = h || 0;
  }
  SAT['Box'] = Box;

  // Returns a polygon whose edges are the same as this box.
  /**
   * @return {Polygon} A new Polygon that represents this box.
   */
  Box.prototype['toPolygon'] = Box.prototype.toPolygon = function() {
    var pos = this['pos'];
    var w = this['w'];
    var h = this['h'];
    return new Polygon(new Vector(pos['x'], pos['y']), [
     new Vector(), new Vector(w, 0), 
     new Vector(w,h), new Vector(0,h)
    ]);
  };
  
  // ## Response
  //
  // An object representing the result of an intersection. Contains:
  //  - The two objects participating in the intersection
  //  - The vector representing the minimum change necessary to extract the first object
  //    from the second one (as well as a unit vector in that direction and the magnitude
  //    of the overlap)
  //  - Whether the first object is entirely inside the second, and vice versa.
  /**
   * @constructor
   */  
  function Response() {
    this['a'] = null;
    this['b'] = null;
    this['overlapN'] = new Vector();
    this['overlapV'] = new Vector();
    this.clear();
  }
  SAT['Response'] = Response;

  // Set some values of the response back to their defaults.  Call this between tests if
  // you are going to reuse a single Response object for multiple intersection tests (recommented
  // as it will avoid allcating extra memory)
  /**
   * @return {Response} This for chaining
   */
  Response.prototype['clear'] = Response.prototype.clear = function() {
    this['aInB'] = true;
    this['bInA'] = true;
    this['overlap'] = Number.MAX_VALUE;
    return this;
  };

  // ## Object Pools

  // A pool of `Vector` objects that are used in calculations to avoid
  // allocating memory.
  /**
   * @type {Array.<Vector>}
   */
  var T_VECTORS = [];
  for (var i = 0; i < 10; i++) { T_VECTORS.push(new Vector()); }
  
  // A pool of arrays of numbers used in calculations to avoid allocating
  // memory.
  /**
   * @type {Array.<Array.<number>>}
   */
  var T_ARRAYS = [];
  for (var i = 0; i < 5; i++) { T_ARRAYS.push([]); }

  // Temporary response used for polygon hit detection.
  /**
   * @type {Response}
   */
  var T_RESPONSE = new Response();

  // Unit square polygon used for polygon hit detection.
  /**
   * @type {Polygon}
   */
  var UNIT_SQUARE = new Box(new Vector(), 1, 1).toPolygon();

  // ## Helper Functions

  // Flattens the specified array of points onto a unit vector axis,
  // resulting in a one dimensional range of the minimum and
  // maximum value on that axis.
  /**
   * @param {Array.<Vector>} points The points to flatten.
   * @param {Vector} normal The unit vector axis to flatten on.
   * @param {Array.<number>} result An array.  After calling this function,
   *   result[0] will be the minimum value,
   *   result[1] will be the maximum value.
   */
  function flattenPointsOn(points, normal, result) {
    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    var len = points.length;
    for (var i = 0; i < len; i++ ) {
      // The magnitude of the projection of the point onto the normal
      var dot = points[i].dot(normal);
      if (dot < min) { min = dot; }
      if (dot > max) { max = dot; }
    }
    result[0] = min; result[1] = max;
  }
  
  // Check whether two convex polygons are separated by the specified
  // axis (must be a unit vector).
  /**
   * @param {Vector} aPos The position of the first polygon.
   * @param {Vector} bPos The position of the second polygon.
   * @param {Array.<Vector>} aPoints The points in the first polygon.
   * @param {Array.<Vector>} bPoints The points in the second polygon.
   * @param {Vector} axis The axis (unit sized) to test against.  The points of both polygons
   *   will be projected onto this axis.
   * @param {Response=} response A Response object (optional) which will be populated
   *   if the axis is not a separating axis.
   * @return {boolean} true if it is a separating axis, false otherwise.  If false,
   *   and a response is passed in, information about how much overlap and
   *   the direction of the overlap will be populated.
   */
  function isSeparatingAxis(aPos, bPos, aPoints, bPoints, axis, response) {
    var rangeA = T_ARRAYS.pop();
    var rangeB = T_ARRAYS.pop();
    // The magnitude of the offset between the two polygons
    var offsetV = T_VECTORS.pop().copy(bPos).sub(aPos);
    var projectedOffset = offsetV.dot(axis);
    // Project the polygons onto the axis.
    flattenPointsOn(aPoints, axis, rangeA);
    flattenPointsOn(bPoints, axis, rangeB);
    // Move B's range to its position relative to A.
    rangeB[0] += projectedOffset;
    rangeB[1] += projectedOffset;
    // Check if there is a gap. If there is, this is a separating axis and we can stop
    if (rangeA[0] > rangeB[1] || rangeB[0] > rangeA[1]) {
      T_VECTORS.push(offsetV); 
      T_ARRAYS.push(rangeA); 
      T_ARRAYS.push(rangeB);
      return true;
    }
    // This is not a separating axis. If we're calculating a response, calculate the overlap.
    if (response) {
      var overlap = 0;
      // A starts further left than B
      if (rangeA[0] < rangeB[0]) {
        response['aInB'] = false;
        // A ends before B does. We have to pull A out of B
        if (rangeA[1] < rangeB[1]) { 
          overlap = rangeA[1] - rangeB[0];
          response['bInA'] = false;
        // B is fully inside A.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      // B starts further left than A
      } else {
        response['bInA'] = false;
        // B ends before A ends. We have to push A out of B
        if (rangeA[1] > rangeB[1]) { 
          overlap = rangeA[0] - rangeB[1];
          response['aInB'] = false;
        // A is fully inside B.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      }
      // If this is the smallest amount of overlap we've seen so far, set it as the minimum overlap.
      var absOverlap = Math.abs(overlap);
      if (absOverlap < response['overlap']) {
        response['overlap'] = absOverlap;
        response['overlapN'].copy(axis);
        if (overlap < 0) {
          response['overlapN'].reverse();
        }
      }      
    }
    T_VECTORS.push(offsetV); 
    T_ARRAYS.push(rangeA); 
    T_ARRAYS.push(rangeB);
    return false;
  }
  SAT['isSeparatingAxis'] = isSeparatingAxis;
  
  // Calculates which Voronoi region a point is on a line segment.
  // It is assumed that both the line and the point are relative to `(0,0)`
  //
  //            |       (0)      |
  //     (-1)  [S]--------------[E]  (1)
  //            |       (0)      |
  /**
   * @param {Vector} line The line segment.
   * @param {Vector} point The point.
   * @return  {number} LEFT_VORONOI_REGION (-1) if it is the left region,
   *          MIDDLE_VORONOI_REGION (0) if it is the middle region,
   *          RIGHT_VORONOI_REGION (1) if it is the right region.
   */
  function voronoiRegion(line, point) {
    var len2 = line.len2();
    var dp = point.dot(line);
    // If the point is beyond the start of the line, it is in the
    // left voronoi region.
    if (dp < 0) { return LEFT_VORONOI_REGION; }
    // If the point is beyond the end of the line, it is in the
    // right voronoi region.
    else if (dp > len2) { return RIGHT_VORONOI_REGION; }
    // Otherwise, it's in the middle one.
    else { return MIDDLE_VORONOI_REGION; }
  }
  // Constants for Voronoi regions
  /**
   * @const
   */
  var LEFT_VORONOI_REGION = -1;
  /**
   * @const
   */
  var MIDDLE_VORONOI_REGION = 0;
  /**
   * @const
   */
  var RIGHT_VORONOI_REGION = 1;
  
  // ## Collision Tests

  // Check if a point is inside a circle.
  /**
   * @param {Vector} p The point to test.
   * @param {Circle} c The circle to test.
   * @return {boolean} true if the point is inside the circle, false if it is not.
   */
  function pointInCircle(p, c) {
    var differenceV = T_VECTORS.pop().copy(p).sub(c['pos']);
    var radiusSq = c['r'] * c['r'];
    var distanceSq = differenceV.len2();
    T_VECTORS.push(differenceV);
    // If the distance between is smaller than the radius then the point is inside the circle.
    return distanceSq <= radiusSq;
  }
  SAT['pointInCircle'] = pointInCircle;

  // Check if a point is inside a convex polygon.
  /**
   * @param {Vector} p The point to test.
   * @param {Polygon} poly The polygon to test.
   * @return {boolean} true if the point is inside the polygon, false if it is not.
   */
  function pointInPolygon(p, poly) {
    UNIT_SQUARE['pos'].copy(p);
    T_RESPONSE.clear();
    var result = testPolygonPolygon(UNIT_SQUARE, poly, T_RESPONSE);
    if (result) {
      result = T_RESPONSE['aInB'];
    }
    return result;
  }
  SAT['pointInPolygon'] = pointInPolygon;

  // Check if two circles collide.
  /**
   * @param {Circle} a The first circle.
   * @param {Circle} b The second circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   the circles intersect.
   * @return {boolean} true if the circles intersect, false if they don't. 
   */
  function testCircleCircle(a, b, response) {
    // Check if the distance between the centers of the two
    // circles is greater than their combined radius.
    var differenceV = T_VECTORS.pop().copy(b['pos']).sub(a['pos']);
    var totalRadius = a['r'] + b['r'];
    var totalRadiusSq = totalRadius * totalRadius;
    var distanceSq = differenceV.len2();
    // If the distance is bigger than the combined radius, they don't intersect.
    if (distanceSq > totalRadiusSq) {
      T_VECTORS.push(differenceV);
      return false;
    }
    // They intersect.  If we're calculating a response, calculate the overlap.
    if (response) { 
      var dist = Math.sqrt(distanceSq);
      response['a'] = a;
      response['b'] = b;
      response['overlap'] = totalRadius - dist;
      response['overlapN'].copy(differenceV.normalize());
      response['overlapV'].copy(differenceV).scale(response['overlap']);
      response['aInB']= a['r'] <= b['r'] && dist <= b['r'] - a['r'];
      response['bInA'] = b['r'] <= a['r'] && dist <= a['r'] - b['r'];
    }
    T_VECTORS.push(differenceV);
    return true;
  }
  SAT['testCircleCircle'] = testCircleCircle;
  
  // Check if a polygon and a circle collide.
  /**
   * @param {Polygon} polygon The polygon.
   * @param {Circle} circle The circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonCircle(polygon, circle, response) {
    // Get the position of the circle relative to the polygon.
    var circlePos = T_VECTORS.pop().copy(circle['pos']).sub(polygon['pos']);
    var radius = circle['r'];
    var radius2 = radius * radius;
    var points = polygon['calcPoints'];
    var len = points.length;
    var edge = T_VECTORS.pop();
    var point = T_VECTORS.pop();
    
    // For each edge in the polygon:
    for (var i = 0; i < len; i++) {
      var next = i === len - 1 ? 0 : i + 1;
      var prev = i === 0 ? len - 1 : i - 1;
      var overlap = 0;
      var overlapN = null;
      
      // Get the edge.
      edge.copy(polygon['edges'][i]);
      // Calculate the center of the circle relative to the starting point of the edge.
      point.copy(circlePos).sub(points[i]);
      
      // If the distance between the center of the circle and the point
      // is bigger than the radius, the polygon is definitely not fully in
      // the circle.
      if (response && point.len2() > radius2) {
        response['aInB'] = false;
      }
      
      // Calculate which Voronoi region the center of the circle is in.
      var region = voronoiRegion(edge, point);
      // If it's the left region:
      if (region === LEFT_VORONOI_REGION) {
        // We need to make sure we're in the RIGHT_VORONOI_REGION of the previous edge.
        edge.copy(polygon['edges'][prev]);
        // Calculate the center of the circle relative the starting point of the previous edge
        var point2 = T_VECTORS.pop().copy(circlePos).sub(points[prev]);
        region = voronoiRegion(edge, point2);
        if (region === RIGHT_VORONOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge);
            T_VECTORS.push(point); 
            T_VECTORS.push(point2);
            return false;
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
        T_VECTORS.push(point2);
      // If it's the right region:
      } else if (region === RIGHT_VORONOI_REGION) {
        // We need to make sure we're in the left region on the next edge
        edge.copy(polygon['edges'][next]);
        // Calculate the center of the circle relative to the starting point of the next edge.
        point.copy(circlePos).sub(points[next]);
        region = voronoiRegion(edge, point);
        if (region === LEFT_VORONOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge); 
            T_VECTORS.push(point);
            return false;              
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
      // Otherwise, it's the middle region:
      } else {
        // Need to check if the circle is intersecting the edge,
        // Change the edge into its "edge normal".
        var normal = edge.perp().normalize();
        // Find the perpendicular distance between the center of the 
        // circle and the edge.
        var dist = point.dot(normal);
        var distAbs = Math.abs(dist);
        // If the circle is on the outside of the edge, there is no intersection.
        if (dist > 0 && distAbs > radius) {
          // No intersection
          T_VECTORS.push(circlePos); 
          T_VECTORS.push(normal); 
          T_VECTORS.push(point);
          return false;
        } else if (response) {
          // It intersects, calculate the overlap.
          overlapN = normal;
          overlap = radius - dist;
          // If the center of the circle is on the outside of the edge, or part of the
          // circle is on the outside, the circle is not fully inside the polygon.
          if (dist >= 0 || overlap < 2 * radius) {
            response['bInA'] = false;
          }
        }
      }
      
      // If this is the smallest overlap we've seen, keep it. 
      // (overlapN may be null if the circle was in the wrong Voronoi region).
      if (overlapN && response && Math.abs(overlap) < Math.abs(response['overlap'])) {
        response['overlap'] = overlap;
        response['overlapN'].copy(overlapN);
      }
    }
    
    // Calculate the final overlap vector - based on the smallest overlap.
    if (response) {
      response['a'] = polygon;
      response['b'] = circle;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    T_VECTORS.push(circlePos); 
    T_VECTORS.push(edge); 
    T_VECTORS.push(point);
    return true;
  }
  SAT['testPolygonCircle'] = testPolygonCircle;
  
  // Check if a circle and a polygon collide.
  //
  // **NOTE:** This is slightly less efficient than polygonCircle as it just
  // runs polygonCircle and reverses everything at the end.
  /**
   * @param {Circle} circle The circle.
   * @param {Polygon} polygon The polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testCirclePolygon(circle, polygon, response) {
    // Test the polygon against the circle.
    var result = testPolygonCircle(polygon, circle, response);
    if (result && response) {
      // Swap A and B in the response.
      var a = response['a'];
      var aInB = response['aInB'];
      response['overlapN'].reverse();
      response['overlapV'].reverse();
      response['a'] = response['b'];
      response['b'] = a;
      response['aInB'] = response['bInA'];
      response['bInA'] = aInB;
    }
    return result;
  }
  SAT['testCirclePolygon'] = testCirclePolygon;
  
  // Checks whether polygons collide.
  /**
   * @param {Polygon} a The first polygon.
   * @param {Polygon} b The second polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonPolygon(a, b, response) {
    var aPoints = a['calcPoints'];
    var aLen = aPoints.length;
    var bPoints = b['calcPoints'];
    var bLen = bPoints.length;
    // If any of the edge normals of A is a separating axis, no intersection.
    for (var i = 0; i < aLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, a['normals'][i], response)) {
        return false;
      }
    }
    // If any of the edge normals of B is a separating axis, no intersection.
    for (var i = 0;i < bLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, b['normals'][i], response)) {
        return false;
      }
    }
    // Since none of the edge normals of A or B are a separating axis, there is an intersection
    // and we've already calculated the smallest overlap (in isSeparatingAxis).  Calculate the
    // final overlap vector.
    if (response) {
      response['a'] = a;
      response['b'] = b;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    return true;
  }
  SAT['testPolygonPolygon'] = testPolygonPolygon;

  return SAT;
}));