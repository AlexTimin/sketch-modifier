let
    cwd = process.cwd(),
    config = {
        sketch_project_dir: cwd + '/sketch_projects/',
        tmp_dir: cwd + '/tmp/',
        max_sketch_size: 104857600, //100MB
        export_format: 'png',
        max_parallel_mapping_threads: 4,//  To prevent overload of main thread. Should be greater than 0.
    };

module.exports = config;