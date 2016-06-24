(function () {
	'use strict';

	angular
		.module('IPA')
		.controller('PhaserController', PhaserController);

	PhaserController.$inject = ['$scope', '$stateParams', '$state'];
	function PhaserController($scope, $stateParams, $state) {
		// var console = {};
		// console.log = function(){};
		// console.warn = function(){};
		// window.console = console;
		console.log("$stateParams: ", $stateParams);
		$scope.name = $stateParams.name || '';
		$scope.movingSignal = function(flag, unit, anim, frame) {
			this.do = flag;
			this.unit = unit;
			this.anim = anim || '';
			this.frame = frame || '';
		};
		$scope.game = {
			new: function(width, height, name, canvas_selector) {
				this.phaser = new Phaser.Game(width, height, Phaser.CANVAS, canvas_selector, this);
				this.name = name;
				// this.phaser.state.add('Boot', GameCtrl.Boot);
				// this.phaser.state.add('Preloader', GameCtrl.Preloader);
			},
			preload: function() {
				//載入需要用到的資源
				var phaser = this.phaser;
				phaser.load.image('sky', 'assets/bg.png');
				phaser.load.image('star', 'assets/star.png');
				phaser.load.spritesheet('player', 'assets/Archer_shoot.png', 110, 160);
				phaser.load.spritesheet('monster', 'assets/monster.png', 195, 175);  
				phaser.load.spritesheet('mushroom', 'assets/mushroom.png', 65, 69);  
				phaser.load.spritesheet('thunder_ball', 'assets/thunder_ball.png', 180, 164);  
				// phaser.load.atlasJSONHash('monster', 'assets/monster.png', 'assets/monster.json');
				phaser.load.tilemap('map', 'tilemap/map_new.json', null, Phaser.Tilemap.TILED_JSON);
				phaser.load.image('spritesheet', 'tilemap/spritesheet.png');
				phaser.load.image('arrow', 'assets/arrow.png' , 70, 17);
				// phaser.load.image('btn_fire', 'assets/button_attack.png', 128, 128);
				phaser.load.spritesheet('btn_left', 'assets/button_left_spritesheet.png',120,120);
				phaser.load.spritesheet('btn_right', 'assets/button_right_spritesheet.png',120,120);
				phaser.load.spritesheet('btn_jump', 'assets/button_up_spritesheet.png' ,120, 120);
				phaser.load.spritesheet('btn_fire', 'assets/button_attack_spritesheet.png',128,128);
			},
			create: function() {
				//  啟用Arcade物理引擎
				var game = $scope.game;
				var phaser = game.phaser;
				var Y_ANCHOR_BUTTON = 220;
				game.physics.startSystem(Phaser.Physics.ARCADE);
				console.log("phaser: ", phaser);
				phaser.plugins.add(Phaser.Plugin.ArcadeSlopes);

				var bg = phaser.add.sprite(0, 0);
				bg.fixedToCamera = true;
				bg.scale.setTo(phaser.width, phaser.height);
				bg.inputEnabled = true;
				// bg.input.priorityID = 0; // lower priority
				bg.events.onInputDown.add(game.holdFire);
				bg.events.onInputUp.add(game.fire);

				//加入背景 並宣告背景物件
				var background = game.add.sprite(0, 0, 'sky');
				background.fixedToCamera = true; 

				// 加入地圖 宣告地圖物件
				var map = game.add.tilemap('map');
				map.addTilesetImage('spritesheet');  // spritesheet為地圖素材
				// console.log("map: ", map);

				var ground = map.createLayer('ground');
				ground.setScale(1.6, 1.6);
				ground.resizeWorld();

				ground = map.createLayer('collision');
				ground.setScale(1.6, 1.6);
				ground.resizeWorld();

				phaser.slopes.convertTilemapLayer(ground, {
			    2:  'FULL',
			    3:  'HALF_BOTTOM_LEFT',
			    4:  'HALF_BOTTOM_RIGHT',
			    6:  'HALF_TOP_LEFT',
			    5:  'HALF_TOP_RIGHT',
			    15: 'QUARTER_BOTTOM_LEFT_LOW',
			    16: 'QUARTER_BOTTOM_RIGHT_LOW',
			    17: 'QUARTER_TOP_RIGHT_LOW',
			    18: 'QUARTER_TOP_LEFT_LOW',
			    19: 'QUARTER_BOTTOM_LEFT_HIGH',
			    20: 'QUARTER_BOTTOM_RIGHT_HIGH',
			    21: 'QUARTER_TOP_RIGHT_HIGH',
			    22: 'QUARTER_TOP_LEFT_HIGH',
			    23: 'QUARTER_LEFT_BOTTOM_HIGH',
			    24: 'QUARTER_RIGHT_BOTTOM_HIGH',
			    25: 'QUARTER_RIGHT_TOP_LOW',
			    26: 'QUARTER_LEFT_TOP_LOW',
			    27: 'QUARTER_LEFT_BOTTOM_LOW',
			    28: 'QUARTER_RIGHT_BOTTOM_LOW',
			    29: 'QUARTER_RIGHT_TOP_HIGH',
			    30: 'QUARTER_LEFT_TOP_HIGH',
			    31: 'HALF_BOTTOM',
			    32: 'HALF_RIGHT',
			    33: 'HALF_TOP',
			    34: 'HALF_LEFT'
				});

				map.setCollisionBetween(2, 34, true, 'collision');
				
				var tiles = map.layers[0].data;

				// 設定背景和地圖同大小
				background.height = ground.height;
				background.width = ground.width;

				// 
				// 加入人物並宣告player物件
				var player = game.add.sprite(30, 150, 'player');
				player.scale.setTo(0.3,0.3);            //  將人物縮小
				game.physics.arcade.enable(player);  //  啟用人物的物理效果
				phaser.slopes.enable(player);
				
				player.body.gravity.y = 850;
				player.body.bounce.x = 0;
				player.body.bounce.y = 0.15;
				player.body.slopes.friction.x = 0;
				player.body.slopes.friction.y = 0.5;
				player.body.collideWorldBounds = true;
				
				// 向左向右 人物移動時的動畫效果
				player.animations.add('left', [2, 3, 4, 5], 8, true);
				player.animations.add('right', [7, 8, 9, 10], 8, true);
				player.animations.add('shoot_left', [0, 1], 5, true);
				player.animations.add('shoot_right', [12,11], 5, true);
				player.bringToTop();
				player.animations.play('right');
				game.camera.follow(player);
				// 設定地圖中方塊的碰撞面
				// player.body.checkCollision.up = false;
				// player.body.checkCollision.left = false;
				// player.body.checkCollision.right = false;
				// player.body.checkCollision.bottom = false;
				//讓自己擁有生命力
				player.health = 20;
				player.killMeCD = 150;
				
				//  加入group 宣告整個為stars物件
				var stars = game.add.group();
				stars.enableBody = true;  //  為group裡的每顆星星套上物理引擎
				game.world.bringToTop(stars);

				//  等距離橫向分布12顆星星
				for(var i = 0; i < 12; i++) {
					var star = stars.create(i * 70, 200, 'star');      //  加入星星並設定座標
					star.body.gravity.y = 500;                       //  為stars設定重力場
					star.body.bounce.y = 0.3 + Math.random() * 0.2;  //  利用Math.random()給予每顆星星不同的彈力
					phaser.slopes.enable(star);
				}
				
				// 宣告以下物件，因為他們還會被其他function使用到
				this.map = map;
				this.ground = ground;
				this.tiles = tiles;
				this.stars = stars;
				this.player = player;
				this.can_move = true;
				this.MOVING_SIGNAL = new $scope.movingSignal(false);

				// ===============  賦予怪物生命 & basics ===============
				//pay attention to the declaration form and order!!!
				//注意宣告方式以及順序
				this.monsterRunningCount = 45;
				this.monsterTotalHealth = 30;
				
				this.arrows = [];
				this.monsters = [];
				this.firetime = 0;

				this.btnLeftIsClick = false;
				this.btnRightIsClick = false;
				this.btnJumpIsClick = false;
				this.btnFireIsClick = false;
				this.btnFireIsClicked = false;

				for(var i = 0; i < 10; i++) {
					//加入怪物 宣告怪物物件
					var x = game.world.randomX;
					var y = game.world.randomY;
					if (x >= 1000) {
						x = 1000;
					} else if (x < 100) {
						x = 100;
					}
					var monster = game.add.sprite(x, 200, 'mushroom');
					// console.log("monster: ", monster);
					// monster.scale.setTo(.5,.5);
					game.physics.arcade.enable(monster);
					phaser.slopes.enable(monster);
					monster.body.bounce.y = 0.1;
					monster.body.gravity.y = 800;
					// monster.anchor.setTo(0, 0.5);
					monster.body.collideWorldBounds = true;

					// 怪物移動時的動畫效果及碰撞
					// monster.animations.add('left', [5, 6, 7, 8], 5, true); 
					// monster.animations.add('right', [13, 14, 15], 5, true);
					monster.animations.add('left', [5, 3, 1,0], 5, true);
					monster.animations.add('right', [14, 12, 10, 9], 5, true);
					monster.animations.add('hurt', [2, 4], 5, false);
					monster.animations.add('attack', [14, 12, 10, 9], 5, false);
					monster.body.checkCollision.up = false;
					monster.body.checkCollision.left = true;
					monster.body.checkCollision.right = true;
					monster.body.checkCollision.down = true;
					monster.bringToTop();

					//怪物出現時的移動方向
					if (x <= 325) {
						monster.body.velocity.x = 500;
						monster.animations.play('right');
					}
					if (x > 325) {
						monster.body.velocity.x = -500;
						monster.animations.play('left');
					}

					//將以上創造出來的怪物一個個推進沙坑（？
					this.monsters.push({
						monster : monster,
						health : 3,
						alive : true
					})
				}
				// =================  左上角加入一個記分板  ================
				var blood = game.add.text(16, 48, 'Health:', { fontSize: '16px' });
				blood.fixedToCamera = true;
				blood.font = 'Arial';
				blood.align = 'center';
				// blood.setShadow(2, 2, '#373331', 1);
				this.blood = blood;

				var avatar = game.add.text(16, 16, "Visitor: " + this.name, { fontSize: '20px' });
				avatar.fixedToCamera = true;
				avatar.font = 'Arial';
				avatar.align = 'center';
				// avatar.setShadow(0, 1, '#444', 1);
				this.avatar = avatar;

				var btnLeft = game.add.button(20, Y_ANCHOR_BUTTON, 'btn_left', null, this, 1, 0, 1, 0);
				btnLeft.inputEnabled = true;
				btnLeft.input.priorityID = 1;
		    btnLeft.fixedToCamera = true;
		    btnLeft.scale.setTo(.5,.5);

		    btnLeft.events.onInputDown.add(function() { //按下去
		    	this.btnLeftIsClick = true;
		    }.bind(this));
		    btnLeft.events.onInputUp.add(function() {   //彈起來
		    	this.btnLeftIsClick = false;
		    }.bind(this));

    		var btnRight = game.add.button(100, Y_ANCHOR_BUTTON, 'btn_right', null, this, 1, 0, 1, 0);
		    btnRight.fixedToCamera = true;
		    btnRight.inputEnabled = true;
				btnRight.input.priorityID = 1;
		    btnRight.scale.setTo(.5,.5);

		    btnRight.events.onInputDown.add(function(){
		    	this.btnRightIsClick = true;
		    }.bind(this));
		    btnRight.events.onInputUp.add(function(){
		    	this.btnRightIsClick = false;
		    }.bind(this));

		    var btnJump = game.add.button(500, Y_ANCHOR_BUTTON, 'btn_jump', null, this, 1, 0, 1, 0);
		    btnJump.fixedToCamera = true;
		    btnJump.inputEnabled = true;
				btnJump.input.priorityID = 1;
		    btnJump.scale.setTo(.5,.5);

		    btnJump.events.onInputDown.add(function(){
		    	this.btnJumpIsClick = true;
		    }.bind(this));
		    btnJump.events.onInputUp.add(function(){
		    	this.btnJumpIsClick = false;
		    }.bind(this));

		    var btnFire = game.add.button(580, Y_ANCHOR_BUTTON, 'btn_fire', null, this, 1, 0, 1, 0);
		    btnFire.fixedToCamera = true;
		    btnFire.inputEnabled = true;
				btnFire.input.priorityID = 1;
		    btnFire.scale.setTo(.48,.48);
	
		    btnFire.events.onInputDown.add(function(){ 
		    	this.btnFireIsClick = true;
		    	this.btnFireIsClicked = false;
		    }.bind(this));
		    btnFire.events.onInputUp.add(function(){ 
		    	this.btnFireIsClick = false;
		    	this.btnFireIsClicked = true;
		    }.bind(this));
			},
			update: function() {
				// update將會以每秒三十次之頻率更新畫面
				// 宣告之前使用過的物件
				var game = $scope.game;
				var phaser = game.phaser;
				var ground = game.ground;
				var collision = game.collision;
				var player = game.player;
				var can_move = game.can_move;
				var stars = game.stars;
				var monsters = game.monsters;
				var arrows = game.arrows;
				var firetime = game.firetime;
				var readyFire = game.readyFire;
				var MOVING_SIGNAL = game.MOVING_SIGNAL;
				var isMoving = game.isMoving;
				var getFirePoint = game.getFirePoint;
				var movePlayer = game.movePlayer;

				var btnLeftIsClick = game.btnLeftIsClick;
				var btnRightIsClick = game.btnRightIsClick;
				var btnJumpIsClick = game.btnJumpIsClick;
				var btnFireIsClick = game.btnFireIsClick;
				var btnFireIsClicked = game.btnFireIsClicked;

				//  人物與地圖物件之間的碰撞
				var isTouchGround = phaser.physics.arcade.collide(player, ground);

				// var touching = player.body.touching;
				phaser.physics.arcade.collide(stars, ground);
				phaser.physics.arcade.collide(arrows, ground, function(arrow, ground) {
					// 箭要消失喔
					// arrow.animations.play('disappear');
					arrow.destroy();
					this.arrows = arrows.filter(function(arrow) {
						return arrow.alive === true;
					});
				}.bind(this));
				//  偵測人物與星星，如果重疊將會call collectStar function來計算分數
				phaser.physics.arcade.overlap(player, stars, this.collectStar, null, this);
				//  人物的初速度
				player.body.velocity.x = 0;

				// ============================ 人物移動、動畫 =================================
				if (phaser.input.keyboard.isDown(Phaser.Keyboard.A) || btnLeftIsClick) { // 按A鍵 
					//  往左方移動
					// console.log("move left");
					player.body.velocity.x = -100;
					if (can_move) {
						movePlayer('left');
					}

					if (btnJumpIsClick && isTouchGround) {
						player.body.velocity.y = -340;
						this.btnJumpIsClick = false;
						this.jump = false;
					}
					// 若未觸地且人物也沒移動，
					if (!isTouchGround) {
						player.animations.stop();
						if (player.frame < 6) {
							player.frame = 2;   // 設定人物的面向
						}
					}
				} else if (phaser.input.keyboard.isDown(Phaser.Keyboard.D) || btnRightIsClick) { // 按D鍵
					// console.log("move right");
					player.body.velocity.x = 100;
					if (can_move) {
						movePlayer('right');
					}

					if (btnJumpIsClick && isTouchGround) {
						player.body.velocity.y = -340;
						this.btnJumpIsClick = false;
						this.jump = false;
					}

					if (!isTouchGround) {
						player.animations.stop();
						if (player.frame >= 6) {
							player.frame = 10;
						}
					}
				} else if (!readyFire && !btnJumpIsClick && !MOVING_SIGNAL.do) {
					//  若未按壓任何按鍵時
					player.animations.stop();
					this.btnLeftIsClick = false;
					this.btnRightIsClick = false;
					this.btnJumpIsClick = false;
					this.btnFireIsClick = false;
					if (player.frame < 6) {
						player.frame = 5;
					} else {
						player.frame = 7;
					}
				}
				// 觸地瞬間跳躍
				if ((phaser.input.keyboard.isDown(Phaser.Keyboard.W) || btnJumpIsClick) && isTouchGround) {
					player.body.velocity.y = -360;
				}			

				// if (MOVING_SIGNAL.do) {
				// 	console.log("A MOVE SIGNAL DETECTED!!!!");
				// 	console.log("MOVING_SIGNAL: ", MOVING_SIGNAL);
				// 	movePlayer(MOVING_SIGNAL.unit, MOVING_SIGNAL.anim, MOVING_SIGNAL.frame);
				// } 
				
				// ===============  發射動畫  ================
				// 延長射擊時間間距
				game.firetime -= 1;
				if (phaser.input.activePointer.isDown && btnFireIsClick && firetime <= 0) {
					console.log("拉弓");
					this.readyFire = true;
					if (player.frame < 6) {
						player.frame = 1;
					}	else {
						player.frame = 11;
					}
				} else if (phaser.input.activePointer.isUp && btnFireIsClicked && readyFire) {
					console.log("放弓");
					this.readyFire = false;

					var fire_point = getFirePoint();
					var rotation = 0;    // 設定發射點與滑鼠之間的角度
					if (player.frame < 6) {
						rotation += Math.PI;
					}	

					if (player.frame < 6) {
						player.frame = 0;
					} else if (player.frame >= 6) {
						player.frame = 12;
					}
				
					var arrow = game.add.sprite(fire_point.x, fire_point.y, 'arrow');
					// arrow.animations.add('blink', [0,1], 15, true);
					// arrow.animations.add('blink', [2,3,4], 5, true);
					// arrow.scale.setTo(.2,.2);
					arrow.scale.setTo(.5);
					arrow.rotation = rotation;
					arrow.currentSpeed = 300;
					arrow.anchor.setTo(0.5, 0);
					arrow.checkWorldBounds = true;
					arrow.outOfBoundsKill = true;
					// arrow.animations.play('blink');
					game.physics.arcade.enable(arrow);
					phaser.slopes.enable(arrow);
					// if (o == "o") {
					// 	arrow.scale.setTo(2, 2);
					// 	arrow.currentSpeed = 1200;
					// }
					game.physics.arcade.velocityFromRotation(arrow.rotation, arrow.currentSpeed, arrow.body.velocity);  
					// 用發射點與滑鼠之間的角度來產生速度
					game.arrows.push(arrow);
					game.firetime = 10;
				}	
				// ===============  發射動畫END  =============== 	
				// ================  人物控制結束   ================

				// ===================  怪物的AI  =====================
				this.monsterRunningCount --;  // 用來改變方向 
				this.player.killMeCD --;  // 怕你死太快 XD

				for(var i = 0; i < 10; i++) {
					if (monsters[i].alive) {
						// 設定怪物碰撞							
						game.physics.arcade.collide(monsters[i].monster, ground, function(monster, ground) {
							if (monster.monsterRunningCount < 0) {
								monster.monsterRunningCount = 20;
								monster.body.velocity.x = 200;
								monster.body.velocity.y = -300;
								monster.animations.play('right');
							} else {
								monster.monsterRunningCount = -20;
								monster.body.velocity.x = -200;
								monster.body.velocity.y = -300;
								monster.animations.play('left');
							}
						});

						// 如果受擊冷卻時間到，便受傷
						if (player.killMeCD <= 0) {
							game.physics.arcade.overlap(player, monsters[i].monster, function() {
								player.health -= 10;
								player.killMeCD = 60;
								// console.log("cd: " + this.player.killMeCD);
								// console.log("hp: " + this.player.health);
							}, null, this);
						}

						// 箭跟怪物的互動
						game.physics.arcade.overlap(arrows, monsters[i].monster, function(arrow, monster) {
							// 箭要消失喔
							arrow.destroy();
							console.log("monster: ", monster);
							monsters[i].monster.animations.play('hurt');
							monsters[i].health --;  // 心好痛
							game.monsterTotalHealth --; // 一步步走向滅絕
							// 沒血了 bye 囉
							if(monsters[i].health <= 0) {
								monsters[i].alive = false;
								monsters[i].monster.kill();
							}
						}, null, this);

						// 跑跑跑～～～向前跑 左右左右跑
						if (this.monsterRunningCount == 0) {
							monsters[i].monster.body.velocity.x *= -1;
							if(monsters[i].monster.body.velocity.x > 0)
								monsters[i].monster.animations.play('right');
							else
								monsters[i].monster.animations.play('left');
						}
					}
				}
				// ======================  left & right  =====================
				if (this.monsterRunningCount < 0) {
					this.monsterRunningCount = 90;
				}
				// =========================  AI 結束  ========================
				// =======================  show 出血量  ======================
				this.showHealth();

				// ============================================================
				// 隱藏版
				if (phaser.input.keyboard.isDown(Phaser.Keyboard.O) && player.health >= 0) {
					monsters.forEach(function (e, i) {monsters[i].monster.kill();});
					this.monsterTotalHealth = 0;
					this.player.health = "Ultra";
					this.fire(0, 460, 0, "o");
					this.firetime = 30;
					stars.visible = false;
				}

				if (phaser.input.currentPointers == 0 && !phaser.input.activePointer.isMouse){
					this.right = false; 
					this.left = false;
					this.jump = false;
					this.readyFire = false;
				}
			},
			render: function() {
				var game = $scope.game;
				var phaser = game.phaser;
				var player = game.player;
				var ground = game.ground;
				var collision = game.collision;
				var stars = game.stars;
				var monsters = game.monsters;
				var arrows = game.arrows;

				// phaser.debug.body(player);
				// monsters.forEach(function(monster) {phaser.debug.body(monster.monster);});
				//arrows.forEach(function(arrow) { phaser.debug.body(arrow); });
				// console.log('arrows: ', arrows);
			},
			collectStar: function (player, star){
				var game = $scope.game;
				var stars = game.stars;
				star.destroy();
				game.player.health += 5;
			},
			showHealth: function() {
				var game = $scope.game;
				var color;
				// ======================  變更血條顏色  ========================
				if (game.player.health < 40 || game.player.health == "Dead") {
					color = '#DA1212';
				} else if (game.player.health >= 40 && game.player.health < 80) {
					color = '#E4663A';
				} else if (game.player.health >= 80 && game.player.health <= 120) {
					color = '#17E7A4';
				} else if (game.player.health == "Ultra") {
					color = '#17E7A4';
				}
				// ========================  結果訊息  =======================
				if (game.monsterTotalHealth == 0) {
					game.createText("Mission Completed",'w');
				}
				if (game.player.health <= 0) {
					game.player.kill();
					game.player.health = "Dead";
					game.createText("Mission Failed",'l');
					// use createText function to create texts
				}
				game.blood.text = 'Health: ' + game.player.health;
				game.blood.fill = color;
			},
			createText: function (text, result) {
				var game = $scope.game;
				//  遊戲結果訊息
				var color;
				if(result == 'w') {      //贏了
					color = '#17EAD9';
				} else if(result == 'l') {
					color = '#EB2632';     //哭哭
				}
				var note = game.phaser.add.text(game.phaser.width / 2 - 105, game.phaser.height / 2 - 38 , text, { fontSize: '32px',	fill: color });
				note.fixedToCamera = true;
				note.font = 'Arial';
				note.align = 'center';
				note.setShadow(2, 2, '#3E3E3E', 1);
			},
			holdFire: function(bg, pointer) {
				var game = $scope.game;
				var phaser = game.phaser;
				var player = game.player;
				var left = game.left;
				var right = game.right;
				var jump = game.jump;
				var readyFire = game.readyFire;
				var isMoving = game.isMoving;
				var getFirePoint = game.getFirePoint;

				var rotation = game.physics.arcade.angleToPointer(getFirePoint());    // 設定發射點與滑鼠之間的角度
				// console.log("rotation: ", rotation);

				// 按著滑鼠左鍵時出現拉弓動作
				if (game.firetime <= 0) {
					console.log("拉弓");
					game.readyFire = true;
					console.log("rotation: ", rotation);
					if (!isMoving()) {
						console.log("我沒在動!");
						if (player.frame < 6 && Math.abs(rotation) > Math.PI / 2) {
							player.frame = 1;
							game.MOVING_SIGNAL = new $scope.movingSignal(true, player, '', 1);
							console.log("面左，射左");
						} else if (player.frame < 6 && Math.abs(rotation) < Math.PI / 2) {
							player.frame = 11;
							game.MOVING_SIGNAL = new $scope.movingSignal(true, player, '', 11);
							console.log("面左，射右");			
						} else if (player.frame >= 6 && Math.abs(rotation) < Math.PI / 2) {
							player.frame = 11;
							game.MOVING_SIGNAL = new $scope.movingSignal(true, player, '', 11);
							console.log("面右，射右");
						} else if (player.frame >= 6 && Math.abs(rotation) > Math.PI / 2) {
							player.frame = 1;
							game.MOVING_SIGNAL = new $scope.movingSignal(true, player, '', 1);
							console.log("面右，射左");
						}
					}
				} 
			},
			// fire:  function(x, y, rotation, o) {
			fire: function(bg, pointer) {
				// 放箭要做的事情	
				var game = $scope.game;
				var phaser = game.phaser;
				var player = game.player;
				var readyFire = game.readyFire;
				var left = game.left;
				var right = game.right;
				var getFirePoint = game.getFirePoint;

				if (!readyFire) return;
				else {
					console.log("放弓");
					game.readyFire = false;

					var fire_point = getFirePoint();
					var rotation = phaser.physics.arcade.angleToPointer(fire_point);    // 設定發射點與滑鼠之間的角度
					if (left) {
						rotation += Math.PI;
					} else if (right) {
						rotation = 0;
					}

					if (player.frame < 6) {
						player.frame = 0;
					} else if (player.frame >= 6) {
						player.frame = 12;
					}
					console.log("拉弓角度: ", rotation);
				
					var arrow = game.add.sprite(fire_point.x, fire_point.y, 'arrow');
					// arrow.animations.add('blink', [0,1], 10, true);
					// arrow.animations.add('disappear', [2,3,4], 3, true);
					arrow.scale.setTo(.5);
					arrow.rotation = rotation;
					arrow.currentSpeed = 300;
					arrow.anchor.setTo(0.5, 0);
					// arrow.anchor.setTo(0.5,0.5); // for thunder_ball
					arrow.checkWorldBounds = true;
					// arrow.animations.play('blink');
					arrow.outOfBoundsKill = true;
					game.physics.arcade.enable(arrow);
					phaser.slopes.enable(arrow);
					// if (o == "o") {
					// 	arrow.scale.setTo(2, 2);
					// 	arrow.currentSpeed = 1200;
					// }
					game.physics.arcade.velocityFromRotation(arrow.rotation, arrow.currentSpeed, arrow.body.velocity);  
					// 用發射點與滑鼠之間的角度來產生速度
					game.arrows.push(arrow);
					game.firetime = 10;
					game.MOVING_SIGNAL = new $scope.movingSignal(false);
				}
				// ===============  發射動畫END  =============== 	
			},
			getFirePoint: function() {
				var game = $scope.game;
				var player = game.player;
				var fire_point = {x: player.x + 30, y: player.y + 15};  
				if (player.frame < 6) {
					fire_point.x = player.x;
					fire_point.y = player.y + 18;
				}
				// var fire_point = {x: player.x + 30, y: player.y};  
				// if (player.frame < 6) {
				// 	fire_point.x = player.x;
				// 	fire_point.y = player.y + 15
				// }
				return fire_point;
			},
			isMoving: function() {
				var game = $scope.game;
				return game.left || game.right;
			},
			movePlayer: function(anim_name, frame) {
				// console.log("----------------\nLet's move!");
				var game = $scope.game;
				var player = game.player;
				if (anim_name != '') {
					player.animations.play(anim_name);
				} else {
					player.frame = frame;
				}
			}
		};

		$scope.game.new(650, 330, $scope.name, 'game-area');
	}
})();