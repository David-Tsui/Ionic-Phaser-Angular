var GameCtrl = {
	game: ''
};

(function(){
'use strict';

GameCtrl.Boot = function () {
};

GameCtrl.Boot.prototype = {

	preload: function () {

		this.load.image('preloaderBackground', 'assets/progress_bar_background.png');
		this.load.image('preloaderBar', 'assets/progress_bar.png');
	},

	create: function () {
		/*
		TODO SOCKETS
		GameCtrl.socket = io.connect("http://192.168.0.201", {port: 8000, transports: ["websocket"]});
		var self=this;
		GameCtrl.socket.on("connect", function(){
		   self.game.state.start('Preloader'); 
		});
		*/
		this.game.state.start('Preloader'); 
	}
};

})();