(function () {
    angular
    .module('search_config_component', [])
    .component('config', {
        templateUrl: 'components/config/config.tpl.html',
        controller: ['ConfigService', function(ConfigService) {
            var vm = this;
            vm.user = {name: 'world'};
            vm.dataverse = ConfigService.dataverse;
            vm.disabled = !vm.dataverse.AllowDataverseDeposit
            vm.link = ConfigService.prepareDataverseUrl;
            console.log(ConfigService.prepareDataverseUrl());
        }]
    })
    .component('configButton', {
        template: '<div><a href="#/config" target="_blank" class="btn btn-default btn-lg">' +
                    '<span class="glyphicon glyphicon-cog"></span>' +
                  '</a></div>',
        controller: ['ConfigService', function(ConfigService) {
            var vm = this;
            vm.url = ConfigService.prepareDataverseUrl();
        }]
    });
})();
