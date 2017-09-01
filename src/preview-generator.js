const
    fs = require('fs'),
    uuid = require('uuid/v1'),
    child_process = require('child_process'),
    shellescape = require('shell-escape'),
    path = require('path'),
    fs_utils = require('../src/fs-utils');

function PreviewGenerator() {

    /**
     * @param {string[]} preview_files_paths
     * @return {Promise}
     */
    function mapPreviews(preview_files_paths) {
        return new Promise(function(resolve, reject) {
                let preview_images_urls = Object.create(null);

                for (let i = 0; i < preview_files_paths.length; i++) {
                    let screen_uuid = path.basename(preview_files_paths[i], `.${global.app_config.export_format}`),
                        bitmap = fs.readFileSync(preview_files_paths[i]);//TODO: пока вызов синхронный, не хочу портить код промисами еще больше. пока..

                    preview_images_urls[screen_uuid] =
                        `data:image/${global.app_config.export_format};base64,` + new Buffer(bitmap).toString('base64');
                }

                resolve(preview_images_urls);
            });
    }

    /**
     * @param {string} sketch_file_path
     * @param {string} output_dir_path
     * @param {string[]} screens
     * @return {Promise}
     */
    function exportScreens(sketch_file_path, output_dir_path, screens) {
        return new Promise(function (resolve, reject) {
            sketch_file_path = shellescape([sketch_file_path]);
            output_dir_path = shellescape([output_dir_path]);
            screens = shellescape([screens.join(',')]);

            const generate_preview_cmd = `cd ${output_dir_path} && sketchtool export artboards --items=${screens} --formats=${global.app_config.export_format} --save-for-web ${sketch_file_path}`;

            child_process.exec(generate_preview_cmd, function (error, stdout, stderr) {
                if (error) {
                    console.error('stderr:' + stderr);
                    console.log('stdout' + stdout);
                    reject(error);
                    return;
                }

                fs.readdir(output_dir_path, function(err, items) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(items.map(function(file_name){
                        return output_dir_path + file_name;
                    }));
                });
            });
        });
    }

    /**
     * @param {string} sketch_file_path
     * @param {string[]} screens
     * @return {Promise}
     */
    this.generatePreview = function(sketch_file_path, screens) {
        return new Promise(function(resolve, reject) {
            const
                output_dir = global.app_config.tmp_dir + uuid() + '/';

            fs_utils.createDirRecursive(output_dir)
                .then(function() {
                    return exportScreens(sketch_file_path, output_dir, screens);
                })
                .then(mapPreviews)
                .then(
                    function(image_urls) {
                        resolve(image_urls);
                        fs_utils.rmDirRecursiveASAP(output_dir)
                    },
                    function (err) {
                        reject(err);
                        fs_utils.rmDirRecursiveASAP(output_dir)
                    }
                );
        });
    }
}

module.exports = PreviewGenerator;