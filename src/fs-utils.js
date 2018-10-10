const
    childProcess = require('child_process'),
    fs = require('fs'),
    shellEscape = require('shell-escape');

module.exports = {
    /**
     * @param {string} dirPath
     */
    rmDirRecursiveASAP: function (dirPath) {
        if (dirPath === '/') {
            throw new Error('Hey man, did you really hope to remove / ?');
        }

        childProcess.exec(`rm -rf ${dirPath}`, function (error, stdout, stderr) {
            if (error) {
                console.error('Can\'t rm dir ' + dirPath);
                console.error(error);
                console.error('stderr:' + stderr);
                console.log('stdout' + stdout);
            }
        });
    },

    /**
     * @param {string} dirPath
     * @return {Promise}
     */
    createDirRecursive: function (dirPath) {
        return new Promise(function (resolve, reject) {
            childProcess.exec(`mkdir -p ${dirPath}`, function (error, stdout, stderr) {
                if (error) {
                    console.error('stderr:' + stderr);
                    console.log('stdout' + stdout);
                    reject(error);
                }

                resolve();
            });
        });
    },

    /**
     * @param {string} src
     * @param {string} dst
     * @return {Promise}
     */
    copyDirRecursive: function (src, dst) {
        return new Promise(function(resolve, reject){
            src = shellEscape([src]);
            dst = shellEscape([dst]);

            childProcess.exec(`cp -r ${src} ${dst}`, function (error, stdout, stderr) {
                if (error) {
                    console.error(stdout);
                    reject(error);
                    return;
                }

                resolve();
            })
        });
    },

    /**
     * @param {string} projectFilePath
     * @param {string} unzippedProjectPath
     * @return {Promise}
     */
    unzip: function  (projectFilePath, unzippedProjectPath) {
        return new Promise(function (resolve, reject) {
            projectFilePath = shellEscape([projectFilePath]);
            unzippedProjectPath = shellEscape([unzippedProjectPath]);

            childProcess.exec(
                `unzip -oq ${projectFilePath} -d ${unzippedProjectPath}`,
                function (error, stdout, stderr) {
                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }

                    resolve();
                }
            );
        });
    },

    /**
     * @param {string} unzippedDir
     * @param {string} archivePath
     * @return {Promise}
     */
    zip: function (unzippedDir, archivePath) {
        return new Promise(function (resolve, reject) {
            unzippedDir = shellEscape([unzippedDir]);
            archivePath = shellEscape([archivePath]);

            childProcess.exec(
                `cd ${unzippedDir} && zip -Xrq ${archivePath} .`,
                function (error, stdout, stderr) {
                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }

                    resolve();
                }
            );
        });
    }
};