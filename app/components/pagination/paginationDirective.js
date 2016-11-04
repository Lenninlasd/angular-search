/*eslint angular/di: [2,"array"]*/
(function() {
    angular
    .module('search_pagination_component', [])
    .directive('tweetPagination', ['searchFilter',
        function tweetCounter(searchFilter) {
            return {
                link: tweetPagination,
                restrict: 'EA',
                templateUrl: 'components/pagination/pagination.tpl.html',
                scope: {}
            };

            function tweetPagination(scope) {

                var vm = scope;

                vm.pagination = {
                    docsSoFar: 0,
                    showdocs: 0,
                    sizeDocuments: 0,
                    currentPage: 0,
                    pages: 0
                };

                vm.$on('setCounter', function(e, totalDocsCount){
                    if (totalDocsCount < 1 || !totalDocsCount) {
                        totalDocsCount = 'No results found';
                    }
                    vm.counter = totalDocsCount;

                    vm.pagination.sizeDocuments = totalDocsCount;
                    vm.pagination.showdocs = showedTweets(vm.pagination.sizeDocuments, searchFilter.numOfDocs);
                });


                function showedTweets(sizeDocuments, numOfDocs) {
                    if (sizeDocuments < numOfDocs) {
                        return sizeDocuments;
                    }else{
                        return numOfDocs;
                    }
                }



                // vm.$on('setCounter', function(event, totalDocsCount) {
                    // vm.pagination.sizeDocuments = totalDocsCount;


                    // vm.pagination.docsSoFar = goog.isDefAndNotNull(scope.filterOptions.from) ? scope.filterOptions.from + 10 : scope.filterOptions.size;
                    // vm.pagination.docsSoFar = scope.pagination.docsSoFar > totalDocsCount ? totalDocsCount : scope.pagination.docsSoFar;
                    // vm.pagination.currentPage = scope.filterOptions.docsPage;
                    // vm.pagination.pages = Math.ceil(scope.pagination.sizeDocuments / scope.filterOptions.size);
                // }
            }
        }]);

})();
