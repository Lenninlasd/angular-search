/**
 * The main solrHeatmapApp module
 */
(function() {
    angular.module('SolrHeatmapApp', [
        'templates-components',
        'ui.bootstrap',
        'rzModule',
        'search_components',
        'ui.router'
    ]);
    angular.module('SolrHeatmapApp')
    .config(function($locationProvider, $stateProvider, $urlRouterProvider) {
        $locationProvider.html5Mode({
            enabled: false,
            requireBase: false
        });
        $urlRouterProvider.otherwise('/search');
        $stateProvider
            .state({
                name: 'search',
                url: '/search?time&geo&text&user',
                templateUrl: 'view/search.tpl.html',
                controller: 'MainController',
                resolve: {
                    search: function($stateParams,HeatMapSourceGenerator,searchFilter) {
                        searchFilter.setFilter($stateParams);
                    }
                }
            })
            .state({
                name: 'config',
                url: '/config',
                template: '<h1>My Config</h1>'
            });
    });
})();
