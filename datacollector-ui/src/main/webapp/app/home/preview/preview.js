/**
 * Controller for Preview Pane.
 */

angular
  .module('dataCollectorApp.home')

  .controller('PreviewController', function ($scope, $rootScope, $q, _, api, previewService, pipelineConstant) {
    var previewDataBackup;

    angular.extend($scope, {
      previewMultipleStages: false,
      listView: true,
      showLoading: false,
      previewSourceOffset: null,
      previewBatchSize: 10,
      previewData: {},
      stagePreviewData: {
        input: [],
        output: []
      },
      previewDataUpdated: false,
      stepExecuted: false,
      dirtyLanes: [],

      /**
       * Preview Data for previous stage instance.
       *
       * @param stageInstance
       */
      previousStagePreview: function(stageInstance) {
        $scope.changeStageSelection({
          selectedObject: stageInstance,
          type: pipelineConstant.STAGE_INSTANCE
        });
      },

      /**
       * Preview Data for next stage instance.
       * @param stageInstance
       * @param inputRecords
       */
      nextStagePreview: function(stageInstance, inputRecords) {
        $scope.changeStageSelection({
          selectedObject: stageInstance,
          type: pipelineConstant.STAGE_INSTANCE
        });
      },

      /**
       * Override to skip show configuration modal dialog
       */
      previewPipeline: function() {
        previewPipeline();
      },

      /**
       * Set dirty flag to true when record is updated in Preview Mode.
       *
       * @param recordUpdated
       * @param recordValue
       * @param stageInstance
       */
      recordValueUpdated: function(recordUpdated, recordValue, stageInstance) {
        $scope.previewDataUpdated = true;
        recordUpdated.dirty = true;
        recordValue.dirty = true;

        if(!_.contains($scope.dirtyLanes, recordUpdated.laneName)) {
          $scope.dirtyLanes.push(recordUpdated.laneName);
          $rootScope.$broadcast('updateDirtyLaneConnector', $scope.dirtyLanes);
        }
      },

      /**
       * Run Preview with user updated records.
       *
       * @param stageInstance
       */
      stepPreview: function(stageInstance) {
        var dirtyLanes = $scope.dirtyLanes,
          previewBatchOutput = $scope.previewData.batchesOutput[0],
          previewConfig = $scope.pipelineConfig.uiInfo.previewConfig,
          stageOutputs = [];

        angular.forEach(previewBatchOutput, function(stageOutput, index) {
          var lanesList = _.keys(stageOutput.output),
            intersection = _.intersection(dirtyLanes, lanesList);

          if((intersection && intersection.length) || index === 0) {
            //Always add Source preview data
            var stageOutputCopy = angular.copy(stageOutput);
            stageOutputs.push(stageOutputCopy);
          }
        });

        $scope.showLoading = true;

        api.pipelineAgent.previewPipeline($scope.activeConfigInfo.name, $scope.previewSourceOffset,
          previewConfig.batchSize, 0, !previewConfig.writeToDestinations, stageOutputs).
          success(function (previewData) {
            var updatedPreviewBatchOutput = previewData.batchesOutput[0];

            angular.forEach(updatedPreviewBatchOutput, function(stageOutput, index) {
              var lanesList = _.keys(stageOutput.output),
                intersection = _.intersection(dirtyLanes, lanesList),
                changedStageOutput = previewBatchOutput[index];

              if(intersection && intersection.length) {
                angular.forEach(intersection, function(laneName) {
                  stageOutput.output[laneName] = angular.copy(changedStageOutput.output[laneName]);
                });
              }
            });

            $scope.previewData = previewData;

            if(!$scope.previewMultipleStages) {
              $scope.changeStageSelection({
                selectedObject: stageInstance,
                type: pipelineConstant.STAGE_INSTANCE
              });
            }

            $scope.stepExecuted = true;
            $scope.showLoading = false;
            $rootScope.common.errors = [];
          }).
          error(function(data) {
            $rootScope.common.errors = [data];
            $scope.showLoading = false;
          });
      },

      /**
       * Revert changes done in Preview Data.
       *
       */
      revertChanges: function() {
        $scope.previewData = angular.copy(previewDataBackup);
        $scope.previewDataUpdated = false;
        $scope.stepExecuted = false;
        $scope.dirtyLanes = [];

        $rootScope.$broadcast('clearDirtyLaneConnector');

        if(!$scope.previewMultipleStages) {
          var firstStageInstance = $scope.pipelineConfig.stages[0];
          $scope.changeStageSelection({
            selectedObject: firstStageInstance,
            type: pipelineConstant.STAGE_INSTANCE
          });
        }

      },

      /**
       * Remove record from Source Output list.
       *
       * @param stageInstance
       * @param recordList
       * @param record
       * @param $index
       */
      removeRecord: function(stageInstance, recordList, record, $index) {
        var batchData = $scope.previewData.batchesOutput[0];
        recordList.splice($index, 1);
        $scope.previewDataUpdated = true;
        previewService.removeRecordFromSource(batchData, stageInstance, record);

        if(!_.contains($scope.dirtyLanes, record.laneName)) {
          $scope.dirtyLanes.push(record.laneName);
          $rootScope.$broadcast('updateDirtyLaneConnector', $scope.dirtyLanes);
        }
      }

    });

    /**
     * Update Stage Preview Data when stage selection changed.
     *
     * @param stageInstance
     */
    var updatePreviewDataForStage = function(stageInstance) {
      if(!$scope.previewData || !$scope.previewData.batchesOutput) {
        return;
      }

      var stageInstances = $scope.pipelineConfig.stages,
        batchData = $scope.previewData.batchesOutput[0];

      $scope.stagePreviewData = previewService.getPreviewDataForStage(batchData, stageInstance);

      if(stageInstance.inputLanes && stageInstance.inputLanes.length) {
        $scope.previousStageInstances = _.filter(stageInstances, function(instance) {
          return (_.intersection(instance.outputLanes, stageInstance.inputLanes)).length > 0;
        });
      } else {
        $scope.previousStageInstances = [];
      }

      if(stageInstance.outputLanes && stageInstance.outputLanes.length) {
        $scope.nextStageInstances = _.filter(stageInstances, function(instance) {
          return (_.intersection(instance.inputLanes, stageInstance.outputLanes)).length > 0;
        });
      } else {
        $scope.nextStageInstances = [];
      }
    };


    /**
     * Preview Pipeline.
     *
     */
    var previewPipeline = function() {
      var previewConfig = $scope.pipelineConfig.uiInfo.previewConfig,
        stageOutputs = [],
        deferList = [];

      $scope.stepExecuted = false;
      $scope.showLoading = true;

      switch(previewConfig.previewSource) {
        case pipelineConstant.CONFIGURED_SOURCE:
          break;
        case pipelineConstant.SNAPSHOT_SOURCE:
          var getSnapshotDefer = $q.defer();

          if(previewConfig.snapshotInfo) {
            api.pipelineAgent.getSnapshot(previewConfig.snapshotInfo.pipelineName,
              previewConfig.snapshotInfo.snapshotName).
              success(function(res) {
                if(res && res.snapshot && res.snapshot.length) {
                  var snapshotSourceOutputs = res.snapshot[0].output;

                  stageOutputs = [{
                    instanceName: $scope.pipelineConfig.stages[0].instanceName,
                    output: {}
                  }];


                  stageOutputs[0].output[$scope.pipelineConfig.stages[0].outputLanes[0]] =
                    snapshotSourceOutputs[Object.keys(snapshotSourceOutputs)[0]];

                  getSnapshotDefer.resolve();
                } else {
                  getSnapshotDefer.reject('No Snapshot data available');
                }

              }).
              error(function(data) {
                getSnapshotDefer.reject(data);

              });
          } else {
            getSnapshotDefer.reject('No Snapshot available');
          }

          deferList.push(getSnapshotDefer.promise);
          break;
        case pipelineConstant.USER_PROVIDED:
          //TODO
          break;
      }

      $q.all(deferList).then(function() {
        api.pipelineAgent.previewPipeline($scope.activeConfigInfo.name, $scope.previewSourceOffset,
          previewConfig.batchSize, 0, !previewConfig.writeToDestinations, stageOutputs).
          success(function (previewData) {
            var firstStageInstance;

            //Clear Previous errors
            $rootScope.common.errors = [];

            previewDataBackup = angular.copy(previewData);

            $scope.previewData = previewData;
            $scope.previewDataUpdated = false;
            $scope.dirtyLanes = [];

            if(!$scope.previewMultipleStages) {
              firstStageInstance = $scope.pipelineConfig.stages[0];
              $scope.changeStageSelection({
                selectedObject: firstStageInstance,
                type: pipelineConstant.STAGE_INSTANCE
              });
            }

            $rootScope.$broadcast('clearDirtyLaneConnector');
            $scope.showLoading = false;
          }).
          error(function(data) {
            $rootScope.common.errors = [data];
            $scope.closePreview();
            $scope.showLoading = false;
          });
      }, function(data) {
        $rootScope.common.errors = [data];
        $scope.closePreview();
        $scope.showLoading = false;
      });


    };

    if($scope.previewMode) {
      previewPipeline();
    }

    $scope.$on('previewPipeline', function(event) {
      previewPipeline();
    });

    $scope.$on('onSelectionChange', function(event, options) {
      if($scope.previewMode) {
        if (options.type === pipelineConstant.STAGE_INSTANCE) {
          updatePreviewDataForStage(options.selectedObject);
        } else {
          $scope.stagePreviewData = {
            input: {},
            output: {}
          };
        }
      }
    });

    $scope.$watch('previewMultipleStages', function(newValue) {
      if($scope.previewData.batchesOutput) {
        if(newValue === true) {
          $scope.moveGraphToCenter();
        } else {
          $scope.clearStartAndEndStageInstance();
          $scope.changeStageSelection({
            selectedObject: $scope.pipelineConfig.stages[0],
            type: pipelineConstant.STAGE_INSTANCE
          });
        }
      }
    });

    $scope.$on('recordUpdated', function(event, recordUpdated, recordValue) {
      $scope.recordValueUpdated(recordUpdated, recordValue);
    });

  });