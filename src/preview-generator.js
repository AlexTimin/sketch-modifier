const
    fs = require('fs'),
    uuid = require('uuid/v1'),
    childProcess = require('child_process'),
    shellEscape = require('shell-escape'),
    path = require('path'),
    fsUtils = require('../src/fs-utils');

class PreviewGenerator {
    /**
     * @private
     * @param {string[]} previewFilesPaths
     * @return {Promise}
     */
    _mapPreviews(previewFilesPaths)
    {
        return new Promise(function (resolve, reject) {
            let previewImagesUrls = Object.create(null);

            for (let i = 0; i < previewFilesPaths.length; i++) {
                let screenUuid = path.basename(previewFilesPaths[i], `.${global.appConfig.exportFormat}`),
                    bitmap = fs.readFileSync(previewFilesPaths[i]);//TODO: пока вызов синхронный, не хочу портить код промисами еще больше. пока..

                previewImagesUrls[screenUuid] =
                    `data:image/${global.appConfig.exportFormat};base64,` + new Buffer(bitmap).toString('base64');
            }

            resolve(previewImagesUrls);
        });
    }

    /**
     * @private
     * @param {string} sketchFilePath
     * @param {string} outputDirPath
     * @param {string[]} screens
     * @return {Promise}
     */
    _exportScreens(sketchFilePath, outputDirPath, screens)
    {
        return new Promise(function (resolve, reject) {
            sketchFilePath = shellEscape([sketchFilePath]);
            outputDirPath = shellEscape([outputDirPath]);
            screens = shellEscape([screens.join(',')]);

            const generatePreviewCmd = `cd ${outputDirPath} && /Applications/Sketch.app/Contents/Resources/sketchtool/bin/sketchtool export artboards --items=${screens} --formats=${global.appConfig.exportFormat} --save-for-web ${sketchFilePath}`;

            childProcess.exec(generatePreviewCmd, function (error, stdout, stderr) {
                if (error) {
                    console.error('stderr:' + stderr);
                    console.log('stdout' + stdout);
                    reject(error);
                    return;
                }

                fs.readdir(outputDirPath, function (err, items) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(items.map(function (fileName) {
                        return outputDirPath + fileName;
                    }));
                });
            });
        });
    }

    /**
     * @param {string} sketchFilePath
     * @param {string[]} screens
     * @return {Promise}
     */
    generatePreview(sketchFilePath, screens)
    {
        let _this = this;

        return new Promise(function (resolve, reject) {
            const
                outputDir = global.appConfig.tmpDir + uuid() + '/';

            fsUtils.createDirRecursive(outputDir)
                .then(function () {
                    return _this._exportScreens(sketchFilePath, outputDir, screens);
                })
                .then(_this._mapPreviews.bind(_this))
                .then(
                    function (imageUrls) {
                        resolve(imageUrls);
                        fsUtils.rmDirRecursiveASAP(outputDir)
                    },
                    function (err) {
                        reject(err);
                        fsUtils.rmDirRecursiveASAP(outputDir)
                    }
                );
        });
    }
}

module.exports = PreviewGenerator;