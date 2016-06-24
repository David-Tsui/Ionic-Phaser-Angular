(function () {
	'use strict';

	angular
		.module('IPA')
		.controller('AppController', AppController);

	AppController.$inject = ['$scope',
		'$state',
		'$ionicPopover'
	];

	function AppController($scope, $state, $ionicPopover) {
		$scope.user = {
			name: '',
			email: ''
		};

		$scope.mySubmit = function() {
			var name = $scope.user.name;
			if (name) {
				$state.go("phaser", {name: name});
			}
		};
	}
})();