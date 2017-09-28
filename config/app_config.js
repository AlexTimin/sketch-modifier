let
    cwd = process.cwd(),
    config = {
        sketchProjectDir: cwd + '/sketch_projects/',
        tmpDir: cwd + '/tmp/',
        maxSketchSize: 104857600, //100MB
        exportFormat: 'png',
        maxParallelMappingThreads: 4,//  Should be greater than 0
    };

module.exports = config;