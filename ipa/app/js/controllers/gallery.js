(function() {
'use strict';

    angular
        .module('IPA')
        .controller('GalleryController', GalleryController);

    GalleryController.$inject = ['$scope', '$state'];
    function GalleryController($scope, $state) {
        
        $scope.openItem = function(item){
            $state.go('app.item', { title: item.title, icon: item.icon, color: item.color });
        };
    }
})();