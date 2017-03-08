
/*eslint angular/di: [2,"array"]*/
(function () {
    angular
    .module('SolrHeatmapApp')
    .factory('ConfigService', [function () {

        var dataverse = {
            AllowDataverseDeposit: true,
            dataverseDepositUrl: 'https://dataverse.harvard.edu/deposit-bop-subset',
            subsetRetrievalUrl: 'cb=https://bop.cga.edu/get_subset',
            parameters: {
                time: '{}',
                keywords: '{}',
                extent: '{}'
            }
        }

        function prepareDataverseUrl() {
            var dv = dataverse;
            if (dv.AllowDataverseDeposit) {
                var urlArray = [dv.dataverseDepositUrl, dv.subsetRetrievalUrl,
                    paramsToString(dv.parameters)];
                return urlArray.join('?');
            }
            return false;
        }

        function paramsToString(params) {
            return 'time=' + params.time + '&keywords=' + params.keywords +
            '&extent=' + params.extent;
        }

        return {
            dataverse: dataverse,
            prepareDataverseUrl: prepareDataverseUrl
        };


    }]);
})();
