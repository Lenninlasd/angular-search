/*eslint angular/controller-as: 0*/
/*eslint angular/di: [2,"array"]*/
/**
 * Geospatial filter Directive
 */
(function() {
    angular
    .module('search_geospatialFilter_component', [])
    .directive('geospatialFilter', ['InfoService', 'searchFilter', 'HeatMapSourceGenerator', 'Map',
        function(InfoService, searchFilter, HeatMapSourceGenerator, Map) {
            return {
                link: GeospatialFilterLink,
                restrict: 'EA',
                templateUrl: 'components/geospatialFilter/geospatialFilter.tpl.html',
                scope: {}
            };

            function GeospatialFilterLink(scope) {

                scope.filter = searchFilter;

                scope.showGeospatialInfo = function() {
                    InfoService.showInfoPopup('geospatialsearch');
                };

                scope.updateFilterString = function(str) {
                    scope.filter.geo = str;
                };

                scope.search = function() {
                    Map.updateTransformationLayerFromQueryForMap(this.filter.geo);
                    HeatMapSourceGenerator.search();
                };

            }
        }]);
})();
