(function () {
	'use strict';

	angular
		.module('IPA')
		.controller('HomeController', HomeController);

	HomeController.$inject = ['$scope', '$ionicPopup', 'Modals', 'Model'];
	function HomeController($scope, $ionicPopup, Modals, Model) {

		$scope.users = [];

		$scope.hello = function () {
			$ionicPopup.alert({
				title: 'IPA',
				template: 'IPA means \'Ionic-Phaser-Android\'',
     		cssClass: 'animated bounceInDown'
			});
		};
		
		// $scope.showUsers = function () {
		// 	Model.Users.getAll().then(function (users) {
		// 		$scope.users = angular.copy(users);
		// 	});
		// 	Modals.openModal($scope, 'templates/modals/users.html', 'animated rotateInDownLeft');
		// };
		
		// $scope.closeModal = function () {
		// 	Modals.closeModal();
		// 	$scope.users = [];
		// };
		
		//Center content
		//1. http://codepen.io/mhartington/pen/gcHeL
		//2. http://codepen.io/anon/pen/meQJvp
	}
})();