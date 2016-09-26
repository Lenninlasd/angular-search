/*eslint angular/di: [2,"array"]*/
/*eslint angular/document-service: 2*/
/*eslint max-len: [2,150]*/
/**
 * HeatMapSourceGenerator Service
 */
(function() {
    angular
    .module('SolrHeatmapApp')
    .factory('HeatMapSourceGenerator', ['Map', '$rootScope', '$controller', '$filter', '$window', '$document', '$http', '$state',
        function(Map, $rootScope, $controller, $filter, $window, $document , $http, $state) {
            var MapService= Map;

            var methods = {
                search: search,
                searchUser: searchUser,
                performSearch: performSearch,
                startCsvExport: startCsvExport,
                getFormattedDateString: getFormattedDateString,
                filterObj: filterMethods(),
                setFilter: setFilter
            };
            /**
             *
             */
            function getTweetsSearchQueryParameters (bounds) {

                var reqParamsUi = methods.filterObj.getSearchObj();

                /*
                // calculate reduced bounding box
'[' + bounds.minX + ',' + bounds.minY + ' TO ' + bounds.maxX + ',' + bounds.maxY + ']',
                */
                var params = {
                    'q.text': reqParamsUi.searchText,
                    'q.user': reqParamsUi.user,
                    'q.time': timeTextFormat(reqParamsUi.textDate, reqParamsUi.minDate, reqParamsUi.maxDate),
                    'q.geo': reqParamsUi.geo,
                    'a.hm.filter': reqParamsUi.hm,
                    'a.time.limit': '1',
                    'a.time.gap': 'PT1H',
                    'd.docs.limit': '10'
                };
                $state.go('search', {text: params['q.text'], user: params['q.user'], time: params['q.time'], geo: params['q.geo']}, {notify: false, location: "replace"});

                return params;
            }
            var createParamsForGeospatialSearch = function() {
                //var spatialFilters = MapService.getCurrentExtent(), params;
                params = getTweetsSearchQueryParameters();
                return params;
            };

            return methods;

            function setFilter(filter) {
                if(filter.time) {
                    this.filterObj.setTextDate(filter.time);
                }
                if(filter.user) {
                    this.filterObj.setUser(filter.user);
                }
                if(filter.text) {
                    this.filterObj.setSearchText(filter.text);
                }
                if(filter.geo) {
                    this.filterObj.setSearchBounds(filter.geo);
                    $rootScope.$broadcast('geoFilterUpdated', filter.geo);
                }
            }

            function searchUser(username) {
                this.filterObj.setUser(username);
                this.performSearch();
            }

            function search(input) {
                this.filterObj.setSearchText(input);
                this.performSearch();
            }

            function filterMethods() {
                var searchObj = {
                    minDate: new Date('2013-03-10'),
                    maxDate: new Date('2013-03-21'),
                    textDate: null,
                    searchText : null,
                    user: null,
                    geo: '[1,1 TO 1,1]',
                    hm: '[-1,1 TO 2,4]',
                    histogramCount: []
                };
                /**
                 * Set keyword text
                 */
                function setSearchText(val) {
                    searchObj.searchText = val.length === 0 ? null : val;
                }

                function setUser(val) {
                    searchObj.user = val.length === 0 ? null : val;
                }

                function setTextDate(val) {
                    searchObj.textDate = val.length === 0 ? null : val;
                }

                function setSearchBounds(val) {
                    if(val.length !== 0) {
                        searchObj.geo = val;
                        searchObj.hm = MapService.getReducedQueryFromExtent(val);
                    } else {
                        searchObj.geo = null;
                        searchObj.hm = null;
                    }
                }

                /**
                * Returns the complete search object
                */
                function getSearchObj(){
                    return searchObj;
                }

                function setHistogramCount(val) {
                    searchObj.histogramCount = angular.isArray(val) && val.length !== 0 ? val : [];
                }
                return {
                    getSearchObj: getSearchObj,
                    setSearchText: setSearchText,
                    setUser: setUser,
                    setTextDate: setTextDate,
                    setHistogramCount: setHistogramCount,
                    setSearchBounds: setSearchBounds
                };
            }

            /**
             * Performs search with the given full configuration / search object.
             */
            function performSearch(){
                var config,
                    params = createParamsForGeospatialSearch();
                if (params) {
                    params['a.hm.limit'] = solrHeatmapApp.bopwsConfig.heatmapFacetLimit;

                    config = {
                        url: solrHeatmapApp.appConfig.tweetsSearchBaseUrl,
                        method: 'GET',
                        params: params
                    };
                    //load the data
                    $http(config)
                    .then(function successCallback(response) {
                        // check if we have a heatmap facet and update the map with it
                        var data = response.data;
                        if (data && data['a.hm']) {
                            MapService.createOrUpdateHeatMapLayer(data['a.hm']);
                            // get the count of matches
                            $rootScope.$broadcast('setCounter', data['a.matchDocs']);

                            $rootScope.$broadcast('setHistogram', data['a.time']);

                            $rootScope.$broadcast('setTweetList', data['d.docs']);

                            methods.filterObj.setHistogramCount(data['a.time'].counts);
                        }
                    }, function errorCallback(response) {
                        $window.alert('An error occured while reading heatmap data');
                    })
                    .catch(function() {
                        $window.alert('An error occured while reading heatmap data');
                    });
                } else {
                    $window.alert('Spatial filter could not be computed.');
                }
            }


            /**
             * Help method to build the whole params object, that will be used in
             * the API requests.
             */
            function startCsvExport(numberOfDocuments){
                var config,
                    params = createParamsForGeospatialSearch();
                if (params) {
                    params['d.docs.limit'] = angular.isNumber(numberOfDocuments) ?
                            numberOfDocuments : solrHeatmapApp.bopwsConfig.csvDocsLimit;
                    config = {
                        url: solrHeatmapApp.appConfig.tweetsExportBaseUrl,
                        method: 'GET',
                        params: params
                    };

                    //start the export
                    $http(config)
                    .then(function successCallback(response) {
                        var anchor = angular.element('<a/>');
                        anchor.css({display: 'none'}); // Make sure it's not visible
                        angular.element($document.body).append(anchor); // Attach to document
                        anchor.attr({
                            href: 'data:attachment/csv;charset=utf-8,' + encodeURI(response.data),
                            target: '_blank',
                            download: 'bop_export.csv'
                        })[0].click();
                        anchor.remove(); // Clean it up afterwards
                    }, function errorCallback(response) {
                        $window.alert('An error occured while exporting csv data');
                    })
                    .catch(function() {
                        $window.alert('An error occured while exporting csv data');
                    });
                } else {
                    $window.alert('Spatial filter could not be computed.');
                }
            }

            /**
             * Returns the formatted date object that can be parsed by API.
             * @param {minDate} date full date object
                            (e.g. 'Sat Jan 01 2000 01:00:00 GMT+0100 (CET))
             * @return {String} formatted date as string (e.g. [2013-03-10T00:00:00 TO 2013-03-21T00:00:00])
             */
            function getFormattedDateString(minDate, maxDate){
                return '[' + minDate.toISOString().replace('.000Z','') + ' TO ' +
                  maxDate.toISOString().replace('.000Z','') + ']';
            }
            function timeTextFormat(textDate, minDate, maxDate) {
                return textDate === null ? getFormattedDateString(minDate, maxDate) : textDate;
            }


        }]
);
})();
