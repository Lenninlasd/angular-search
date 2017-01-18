/*eslint angular/di: [2,"array"]*/
/*eslint angular/document-service: 2*/
/*eslint max-len: [2,100]*/
/**
 * Map service
 */
(function() {
    angular.module('SolrHeatmapApp')
    .factory('Map',
             ['$rootScope', '$filter', '$document', 'Normalize', '$controller',
             'queryService', 'HeightModule', '$window',
        function($rootScope, $filter, $document, Normalize, $controller,
            queryService, HeightModule, $window) {
            var NormalizeService = Normalize;
            var service = {};
            var map = {},
                defaults = {
                    renderer: 'canvas',
                    view: {
                        center: [0 ,0],
                        projection: 'EPSG:3857',
                        zoom: 2
                    }
                },
                rs = $rootScope;

            /**
             *
             */
            function buildMapLayers(layerConfig) {
                var layer,
                    layers = [];

                if (angular.isArray(layerConfig)) {

                    angular.forEach(layerConfig, function(conf) {
                        if (conf.type === 'googleLayer') {
                            service.googleLayer = new olgm.layer.Google({
                                backgroundLayer: conf.visible,
                                mapTypeId: google.maps.MapTypeId.TERRAIN
                            });
                            layer = service.googleLayer;
                        }
                        if (conf.type === 'OSM') {
                            service.osmLayer = new ol.layer.Tile({
                                source: new ol.source.OSM(),
                                backgroundLayer: conf.backgroundLayer,
                                visible: conf.visible
                            });
                            layer = service.osmLayer;
                        }
                        if (conf.type === 'TileWMS') {
                            layer = new ol.layer.Tile({
                                name: conf.name,
                                backgroundLayer: conf.backgroundLayer,
                                displayInLayerPanel: conf.displayInLayerPanel,
                                source: new ol.source.TileWMS({
                                    attributions: [new ol.Attribution({
                                        html: conf.attribution
                                    })],
                                    crossOrigin: conf.crossOrigin,
                                    logo: conf.logo,
                                    params: conf.params,
                                    ratio: conf.ratio,
                                    resolutions: conf.resoltions,
                                    url: conf.url
                                }),
                                opacity: conf.opacity,
                                visible: conf.visible
                            });
                        }
                        if (conf.type === 'ImageWMS') {
                            layer = new ol.layer.Image({
                                name: conf.name,
                                backgroundLayer: conf.backgroundLayer,
                                displayInLayerPanel: conf.displayInLayerPanel,
                                source: new ol.source.ImageWMS({
                                    attributions: [new ol.Attribution({
                                        html: conf.attribution
                                    })],
                                    crossOrigin: conf.crossOrigin,
                                    logo: conf.logo,
                                    params: conf.params,
                                    resolutions: conf.resoltions,
                                    url: conf.url
                                }),
                                opacity: conf.opacity,
                                visible: conf.visible
                            });
                        }
                        layers.push(layer);
                    });
                }
                return layers;
            }

            /**
            *
            */
            service.getMap = function() {
                return map;
            };

            service.getMapView = function() {
                return service.getMap().getView();
            };

            service.getMapZoom = function() {
                return service.getMapView().getZoom();
            };

            service.getMapSize = function() {
                return service.getMap().getSize();
            };

            service.getMapProjection = function() {
                return service.getMapView().getProjection().getCode();
            };

            service.getLayers = function() {
                return service.getMap().getLayers().getArray();
            };

            service.getInteractions = function () {
                return service.getMap().getInteractions().getArray();
            };

            service.getLayersBy = function(key, value) {
                var layers = service.getLayers();
                return layers.filter(function (layer) {
                    return layer.get(key) === value;
                });
            };

            /**
             *
             */
            service.getInteractionsByClass = function(value) {
                var interactions = service.getInteractions();
                return $filter('filter')(interactions, function(interaction) {
                    return interaction instanceof value;
                });
            };

            /**
             *
             */
            service.getInteractionsByType = function(interactions, type) {
                return $filter('filter')(interactions, function(interaction) {
                    return interaction.type_ === type;
                });
            };

            service.updateTransformationLayerFromQueryForMap = function(query) {
                var extent = queryService.
                    getExtentForProjectionFromQuery(query,
                                                    service.getMapProjection());
                setTransactionBBox(extent);
            };

            /**
            * Helper method to change active mode of masks for backgroundLayer and
            * heatmap layer
            */
            var _switchMasks = function(hmAvailable) {
                var heatMapLayer = service.getLayersBy('name', 'HeatMapLayer')[0];
                var heatMapMask = heatMapLayer.getFilters()[0];
                var backgroundLayer = service.getLayersBy('backgroundLayer', true)[0],
                    backgroundLayerMask = backgroundLayer.getFilters()[0];

                // disable mask of backgroundLayer if heatmap is available and vice versa
                backgroundLayerMask.setActive(!hmAvailable);
                // enable mask of heatMapLayer if heatmap is available and vice versa
                heatMapMask.setActive(hmAvailable);
            };

            function heatmapMinMax(heatmap, stepsLatitude, stepsLongitude){
                var max = -1;
                var min = Number.MAX_VALUE;
                for (var i = 0 ; i < stepsLatitude ; i++){
                    var currentRow = heatmap[i];
                    if (currentRow === null){
                        heatmap[i] = currentRow = [];
                    }
                    for (var j = 0 ; j < stepsLongitude ; j++){
                        if (currentRow[j] === null){
                            currentRow[j] = -1;
                        }

                        if (currentRow[j] > max){
                            max = currentRow[j];
                        }

                        if (currentRow[j] < min && currentRow[j] > -1){
                            min = currentRow[j];
                        }
                    }
                }
                return [min, max];
            }

            function rescaleHeatmapValue(value, minMaxValue){
                if (value === null){
                    return 0;
                }

                if (value === -1){
                    return -1;
                }

                if (value === 0){
                    return 0;
                }

                if ((minMaxValue[1] - minMaxValue[0]) === 0){
                    return 0;
                }

                var scaledValue = (value - minMaxValue[0]) / (minMaxValue[1] - minMaxValue[0]);

                // return scaledValue < 0.0001 ? 0 : (5 * scaledValue + 1)/6;
                return scaledValue;
            }

            function getClassifications(hmParams) {
                var flattenCount = [];
                hmParams.counts_ints2D.forEach(function(row) {
                    flattenCount.push.apply(flattenCount, row);
                });
                var series = new geostats(flattenCount);
                numberOfClassifications = hmParams.gradientArray.length;
                classifications = series.getClassJenks(numberOfClassifications);
                return classifications;
            }

            /*
             *
             */
            function createHeatMapSource(hmParams) {
                var counts_ints2D = hmParams.counts_ints2D,
                    gridLevel = hmParams.gridLevel,
                    gridColumns = hmParams.columns,
                    gridRows = hmParams.rows,
                    minX = hmParams.minX,
                    minY = hmParams.minY,
                    maxX = hmParams.maxX,
                    maxY = hmParams.maxY,
                    hmProjection = hmParams.projection,
                    dx = maxX - minX,
                    dy = maxY - minY,
                    sx = dx / gridColumns,
                    sy = dy / gridRows,
                    olFeatures = [],
                    minMaxValue,
                    sumOfAllVals = 0,
                    olVecSrc;

                if (!counts_ints2D) {
                    return null;
                }
                minMaxValue = heatmapMinMax(counts_ints2D, gridRows, gridColumns);
                var classifications = getClassifications(hmParams);
                console.log('classifications', classifications);

                for (var i = 0 ; i < gridRows ; i++){
                    for (var j = 0 ; j < gridColumns ; j++){
                        var hmVal = counts_ints2D[counts_ints2D.length-i-1][j],
                            lon,
                            lat,
                            feat,
                            coords;

                        if (hmVal && hmVal !== null){
                            lat = minY + i*sy + (0.5 * sy);
                            lon = minX + j*sx + (0.5 * sx);
                            coords = ol.proj.transform(
                              [lon, lat],
                              hmProjection,
                              map.getView().getProjection().getCode()
                            );

                            feat = new ol.Feature({
                                geometry: new ol.geom.Point(coords),
                                opacity: 1,
                                weight: 1
                            });

                            var scaledValue = rescaleHeatmapValue(hmVal,minMaxValue);
                            // var clasifyValue = getClassificationsValues()

                            feat.set('weight', scaledValue);
                            feat.set('origVal', hmVal);

                            olFeatures.push(feat);
                        }
                    }
                }

                olVecSrc = new ol.source.Vector({
                    features: olFeatures,
                    useSpatialIndex: true
                });
                return olVecSrc;
            }

            function createCircle_() {
                  var radius = this.getRadius();
                  var blur = this.getBlur();
                  var halfSize = radius + blur + 1;
                  var size = 2 * halfSize;
                  var context = ol.dom.createCanvasContext2D(size, size);
                  context.shadowOffsetX = context.shadowOffsetY = this.shadow_;
                  context.shadowBlur = blur;
                  context.shadowColor = '#000';
                  context.beginPath();
                  var center = halfSize - this.shadow_;
                  context.arc(center, center, radius, 0, Math.PI * 2, true);
                  context.fill();
                  return context.canvas.toDataURL();
            }

            service.createOrUpdateHeatMapLayer = function(hmData) {
                var existingHeatMapLayers, transformInteractionLayer, olVecSrc, newHeatMapLayer;

                hmData.heatmapRadius = 20;
                hmData.blur = 20;
                hmData.gradientArray = ['#000000', '#0000df', '#00effe', '#00ff42',
                '#feec30', '#ff5f00', '#ff0000'];
                console.log('hmData', hmData);

                existingHeatMapLayers = service.getLayersBy('name', 'HeatMapLayer');
                transformInteractionLayer = service.getLayersBy('name',
                                                                "TransformInteractionLayer")[0];
                olVecSrc = createHeatMapSource(hmData);

                if (existingHeatMapLayers && existingHeatMapLayers.length > 0){
                    var currHeatmapLayer = existingHeatMapLayers[0];
                    // Update layer source
                    var layerSrc = currHeatmapLayer.getSource();
                    if (layerSrc){
                        layerSrc.clear();
                    }
                    currHeatmapLayer.setSource(olVecSrc);
                    currHeatmapLayer.setRadius(hmData.heatmapRadius);
                } else {
                    newHeatMapLayer = new ol.layer.Heatmap({
                        name: 'HeatMapLayer',
                        source: olVecSrc,
                        radius: hmData.heatmapRadius,
                        blur: hmData.blur,
                        gradient: hmData.gradientArray
                    });

                    console.log('newHeatMapLayer', newHeatMapLayer);

                    // newHeatMapLayer.setStyle(function(feature, resolution) {
                    //     var weight = feature.get('weight');
                    //     style = [
                    //         new ol.style.Style({
                    //           image: new ol.style.Icon({
                    //             opacity: 1,
                    //                 src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAA+CAYAAABzwahEAAAE20lEQVRoQ+2aiY6jMBBEs/f5/1+6962SeKtSbbcxJBllw4xk2TBA/Lq628bmyemgf08Oyn16BD+a8o+KP4Dis0b+/QB9uVqMz0LOMl7cGJfsYPesvb9RwV7MAHs7hVLV/Xlu5poZyJlrZj3oLFcfAfI/v6Zrq7MOVbW7/+e9VwcfASW0H695mACBrOo1A10VvIJOOB1T1Jk87joIuEP7uc4om5VfUyA7mNAjYId9ujwojeEdTsC1Y+4dhUHrAVvA16AFBxjtrGfBfy0u39UZEpvhZ8E79+5gdT6LnsH1uH8qLlCH5dhr9wSuzeesxvpW8HRtVxTQZwbtbTdE/q5gKsify3nqNADgo9gvjTADXrm4q+fAAq2KrnEjjMAdVm2VH2YANwIGy6S4muy2gHuyAtyBBPZ8AfSadqrvSriSDitgwGlXXjDK/LsUr8Zk3BsQFBYg5YW1/bzDV+AOKVDKd2tXBkjleXY7xV1TvBquPFZROYFfnk4nwVMS3rM7aiW0YCnflrYbAwN0iW/o7lvB16ABVk0RvNrAozq/jVqAJ7CgKfzPDZCJr5r9/ePuM+A5ESGuURtVHfbVAkvN/4D3YQ1wYBz06wKtmrYbJt3es7wbYBN4NXR5BheEu7MgKa+j7errPp6jDuGqghAU4F8WWAF7W8cVfOXyrbuPFHfwTGge00AJWsBe3pgBUJ8s766OmwsadVV/XqAFTkH5jHuB4/ar7r4Gnm5OfLrarjLQbxcDCFxF52UgXQs483c6LMUTGvBPC7iO/RqP+Qq8dfdZ8ExqGdcAAypwCuAYSPdiQFxdSgkCKKkrSAFTdOwekAmP8X8qzjvwLr4ZswF3tQUoWNXvDBz1iXspn+DEN/EscIf+uBw7PEZCdQfvprJ/k9wWcJ+KMkQJQkCptMCBV+2qV+DqNPGN2sCqpo0xiHdX3ae2FwP3WRrxTcxK9VT6/QLuyhMOI8UBAvDDorRqh/dY9yRXuXuZ2WcUryYtUtyHL+IZUMBVZ6wznfXkhqtnbAOc4DJMJjkf030KexFwMnIOYRV4qs7QxiwuwXF1QUlRKVyB6zxJzoe2dPXqXX1TjLvihwX3aerdu7rywCGTG4sOhxzOcnnpbicwuQmwZcrKmJ7DGPP1m56yJri7u4wweknxFxNv59vZTb+kYIDDvZa68t0MLuOd93J/gfmvFiI6d7/7pSff5uk2EHJJeXaxUUOj//la+s0sNq5l+IT3dThfXiabC/qc5WUZhnl5t8KaW0qbFhtT8S7R3eWGQsJ3S83E/d1sITl45fK5h3atTUNyQLW8lGtsq9tHCVVuri0nqz20KuHlrmhuGfs9/ntr28S+gpp76KPvZlqmtZ0UbvTrqvX2zgi5J85EKH+Xzt/chwGdy+cEhxzgHwy4UTyb+4YCy0NuAF8+yk9CHuxTkE75XIb25JeJsAoXXw9b+9in2wPf/P3Llhj3WOncvprpVYYZ5ZL8sqEyRhprKpnlj87G+Oi+NESnrLt5Bz9KVLkdtEvpynVHSlT/S6ONPKHKEZnVK+WqGVh+5dB+9TAzTG2FHhluZJDuvqrzM4C7oPfGeGekLmz2htOMMfYKdtbXy9f0pHz2bmW3qrTbkoMbZ5W/OORMgroG8E0+c1aFm+z8OZ16BD/Hev/jvYdV/A8SDpNs6XcVeAAAAABJRU5ErkJggg=='
                    // //             // src: ol.layer.Heatmap.createCircle_()
                    //           })
                    //         })
                    //       ];
                    //     return style;
                    //   });
                    try {
                        service.getMap().addLayer(newHeatMapLayer);
                    } catch(err) {
                        void 0;
                    }

                }
            };

            /**
             * This method adds a transfrom interaction to the mapand a mask to background layer
             * The area outer the feature which can be modified by the transfrom interaction
             * will have a white shadow
             */
            function generateMaskAndAssociatedInteraction(bboxFeature, fromSrs) {
                var polygon = new ol.Feature(ol.geom.Polygon.fromExtent(bboxFeature)),
                    backGroundLayer = service.getLayersBy('backgroundLayer', true)[0];

                if (fromSrs !== service.getMapProjection()){
                    var polygonNew = ol.proj.transformExtent(bboxFeature, fromSrs,
                                                    service.getMapProjection());
                    polygon = new ol.Feature(ol.geom.Polygon.fromExtent(polygonNew));
                }

                // TransformInteractionLayer
                // holds the value of q.geo
                var vector = new ol.layer.Vector({
                    name: 'TransformInteractionLayer',
                    source: new ol.source.Vector(),
                    style: new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255,255,255,0]
                        }),
                        stroke: new ol.style.Stroke({
                            color: [0,0,0,0],
                            width: 0
                        })
                    })
                });
                service.getMap().addLayer(vector);
                vector.getSource().addFeature(polygon);
            }

            function setTransactionBBox(extent) {
                var transformationLayer = service.getLayersBy('name',
                                                              'TransformInteractionLayer')[0],
                    vectorSrc = transformationLayer.getSource(),
                    currentBbox = vectorSrc.getFeatures()[0],
                    polyNew;

                polyNew = ol.geom.Polygon.fromExtent(extent);
                currentBbox.setGeometry(polyNew);
            }

            service.calculateReducedBoundingBoxFromInFullScreen = function(extent) {
                var sideBarPercent = 1 - (HeightModule.sideBarWidth()/$window.innerWidth);
                var rightSideBarWidth = 1 - (HeightModule.rightSideBarWidth/$window.innerWidth);
                var bottomHeight = 1 - (HeightModule.bottomHeight/$window.innerWidth);
                var topBarPercent = 1 -
                    (HeightModule.topPanelHeight()/HeightModule.documentHeight());
                if(solrHeatmapApp.appConfig) {
                    var dx = extent.maxX - extent.minX,
                        dy = extent.maxY - extent.minY,
                        minX = extent.minX + (1 - sideBarPercent) * dx,
                        maxX = extent.minX + (rightSideBarWidth) * dx,
                        minY = extent.minY + (1 - bottomHeight) * dy,
                        maxY = extent.minY + (topBarPercent) * dy;
                    return {minX: minX, minY: minY, maxX: maxX, maxY: maxY};
                }
                return extent;
            };

            /*
             * For change:resolution event (zoom in map):
             * If bounding of transform interaction is grater than the map extent
             * the transform box will be resized to solrHeatmapApp.appConfig.ratioInnerBbox percent
             */
            service.checkBoxOfTransformInteraction = function() {
                var mapExtent = service.getMapView().calculateExtent(service.getMapSize());

                // calculate reduced bounding box
                var reducedBoundingBox = service.calculateReducedBoundingBoxFromInFullScreen({
                    minX: mapExtent[0], minY: mapExtent[1],
                    maxX: mapExtent[2], maxY: mapExtent[3]
                });

                setTransactionBBox([reducedBoundingBox.minX, reducedBoundingBox.minY,
                    reducedBoundingBox.maxX, reducedBoundingBox.maxY]);
            };

            /**
             * Helper method to reset the map
             */
            service.resetMap = function() {
                // Reset view
                var intitalCenter = solrHeatmapApp.initMapConf.view.center,
                    intitalZoom = solrHeatmapApp.initMapConf.view.zoom;
                if (intitalZoom && intitalCenter) {
                    var vw = service.getMapView();
                    vw.setCenter(intitalCenter);
                    vw.setZoom(intitalZoom);
                    service.checkBoxOfTransformInteraction();
                }
            };

            service.getReducedQueryFromExtent = function(extentQuery) {
                var extent = queryService.getExtentFromQuery(extentQuery);
                return queryService.
                    createQueryFromExtent(
                        service.calculateReducedBoundingBoxFromInFullScreen(extent));
            };

            service.getCurrentExtentQuery = function(){
                var currentExtent = service.getCurrentExtent();
                return {
                    geo: queryService.createQueryFromExtent(currentExtent.geo),
                    hm: queryService.createQueryFromExtent(currentExtent.hm)
                };
            };

            /**
             * Builds geospatial filter depending on the current map extent.
             * This filter will be used later for `q.geo` parameter of the API
             * search or export request.
             */
            service.getCurrentExtent = function(){
                var viewProj = service.getMapProjection(),
                    extent = service.getMapView().calculateExtent(service.getMapSize()),
                    extentWgs84 = ol.proj.transformExtent(extent, viewProj, 'EPSG:4326'),
                    transformInteractionLayer = service.
                                    getLayersBy('name', 'TransformInteractionLayer')[0],
                    currentBbox,
                    currentBboxExtentWgs84,
                    currentExtent = {},
                    currentExtentBox = {};

                if (!transformInteractionLayer) {
                    return null;
                }
                currentBbox = transformInteractionLayer.getSource().getFeatures()[0];
                currentBboxExtentWgs84 = ol.proj.transformExtent(
                                currentBbox.getGeometry().getExtent(), viewProj, 'EPSG:4326');

                // default: Zoom level <= 1 query whole world
                if (service.getMapZoom() <= 1) {
                    extentWgs84 = [-180, -90 ,180, 90];
                }

                if (extent && extentWgs84){
                    var normalizedExtentMap = NormalizeService.normalizeExtent(extentWgs84);
                    var normalizedExtentBox = NormalizeService
                            .normalizeExtent(currentBboxExtentWgs84);

                    currentExtent = createExtent(normalizedExtentMap);

                    currentExtentBox = createExtent(normalizedExtentBox);

                    var roundToFixed = function(value){
                        return parseFloat(Math.round(value* 100) / 100).toFixed(2);
                    };
                    // Reset the date fields
                    $rootScope.$broadcast('geoFilterUpdated', '[' +
                                            roundToFixed(currentExtentBox.minX) + ',' +
                                            roundToFixed(currentExtentBox.minY) + ' TO ' +
                                            roundToFixed(currentExtentBox.maxX) + ',' +
                                            roundToFixed(currentExtentBox.maxY) + ']');
                }

                function createExtent(normalizedExtent) {
                    return {
                        minX: normalizedExtent[1],
                        maxX: normalizedExtent[3],
                        minY: normalizedExtent[0],
                        maxY: normalizedExtent[2]
                    };
                }

                return {hm: currentExtent, geo: currentExtentBox};
            };

            service.removeAllfeatures = function() {
                if (angular.isObject(map)) {
                    var layersWithBbox = service.getLayersBy('isbbox', true);
                    layersWithBbox[0].getSource().clear();
                }
            };

            service.addCircle = function(point, style) {

                var geojsonObject = {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": ol.proj.fromLonLat(point)}
                };

                if (angular.isObject(map) && Object.keys(map).length !== 0) {
                    var layersWithBbox = service.getLayersBy('isbbox', true);
                    var features = (new ol.format.GeoJSON).readFeatures(geojsonObject);

                    if (layersWithBbox.length) {
                        layersWithBbox[0].getSource().addFeatures(features);
                    }else{
                        var vectorLayer = new ol.layer.Vector({
                            isbbox: true,
                            source: new ol.source.Vector({
                                features: features
                            })
                        });
                        vectorLayer.setStyle(style);
                        map.addLayer(vectorLayer);
                    }

                }
            };

            service.toggleBaseMaps = function() {
                service.googleLayer.setVisible(!service.googleLayer.getVisible());
                service.osmLayer.setVisible(!service.osmLayer.getVisible());
            };

            /**
             *
             */
            service.init = function(config) {
                var viewConfig = angular.extend(defaults.view,
                                                    config.mapConfig.view),
                    rendererConfig = config.mapConfig.renderer ?
                        config.mapConfig.renderer : defaults.renderer,
                    layerConfig = config.mapConfig.layers;

                map = new ol.Map({
                    // use OL3-Google-Maps recommended default interactions
                    interactions: olgm.interaction.defaults(),
                    controls: ol.control.defaults().extend([
                        new ol.control.ScaleLine(),
                        new ol.control.ZoomSlider()
                    ]),
                    layers: buildMapLayers(layerConfig),
                    renderer: angular.isString(rendererConfig) ?
                                            rendererConfig : undefined,
                    target: 'map',

                    view: new ol.View({
                        center: angular.isArray(viewConfig.center) ?
                                viewConfig.center : undefined,
                        maxZoom: angular.isNumber(viewConfig.maxZoom) ?
                                viewConfig.maxZoom : undefined,
                        minZoom: angular.isNumber(viewConfig.minZoom) ?
                                viewConfig.minZoom : undefined,
                        projection: angular.isString(viewConfig.projection) ?
                                viewConfig.projection : undefined,
                        resolution: angular.isString(viewConfig.resolution) ?
                                viewConfig.resolution : undefined,
                        resolutions: angular.isArray(viewConfig.resolutions) ?
                                viewConfig.resolutions : undefined,
                        rotation: angular.isNumber(viewConfig.rotation) ?
                                viewConfig.rotation : undefined,
                        zoom: angular.isNumber(viewConfig.zoom) ?
                                viewConfig.zoom : undefined,
                        zoomFactor: angular.isNumber(viewConfig.zoomFactor) ?
                                viewConfig.zoomFactor : undefined
                    })
                });

                var olGM = new olgm.OLGoogleMaps({map: map}); // map is the ol.Map instance
                olGM.activate();

                if (angular.isArray(viewConfig.extent)) {
                    var vw = map.getView();
                    vw.set('extent', viewConfig.extent);
                    generateMaskAndAssociatedInteraction(viewConfig.extent, viewConfig.projection);

                    if (viewConfig.initExtent) {
                        vw.fit(viewConfig.extent, service.getMapSize());
                    }
                }
            };
            return service;
        }]
);
})();
