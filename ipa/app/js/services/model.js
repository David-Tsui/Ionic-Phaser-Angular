(function () {
	'use strict';

	angular
		.module('IPA')
		.factory('Model', Model);

	Model.$inject = ['Users'];
	function Model(Users) {

		return {
			Users: Users
		};
	}
})();