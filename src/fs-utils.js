const
    child_process = require('child_process'),
    fs = require('fs'),
    shellescape = require('shell-escape');

module.exports = {
    /**
     * @param {string} dir_path
     */
    rmDirRecursiveASAP: function (dir_path) {
        if (dir_path === '/') {
            throw new Error('Hey man, did you really hope to remove / ?');
        }

        child_process.exec(`rm -rf ${dir_path}`, function (error, stdout, stderr) {
            if (error) {
                console.error('Can\'t rm dir ' + dir_path);
                console.error(error);
                console.error('stderr:' + stderr);
                console.log('stdout' + stdout);
            }
        });
    },

    /**
     * @param {string} dir_path
     * @return {Promise}
     */
    createDirRecursive: function (dir_path) {
        return new Promise(function (resolve, reject) {
            child_process.exec(`mkdir -p ${dir_path}`, function (error, stdout, stderr) {
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
            src = shellescape([src]);
            dst = shellescape([dst]);

            child_process.exec(`cp -r ${src} ${dst}`, function (error, stdout, stderr) {
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
     * @param {string} file_path
     * @param {string} data
     * @return {Promise}
     */
    writeFile: function (file_path, data) {
        return new Promise(function (resolve, reject) {
            fs.writeFile(file_path, data, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });})
    },

    /**
     * @param {string} project_file_path
     * @param {string} unzipped_project_path
     * @return {Promise}
     */
    unzip: function  (project_file_path, unzipped_project_path) {
        return new Promise(function (resolve, reject) {
            project_file_path = shellescape([project_file_path]);
            unzipped_project_path = shellescape([unzipped_project_path]);

            child_process.exec(
                `unzip -oq ${project_file_path} -d ${unzipped_project_path}`,
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
     * @param {string} unzipped_dir
     * @param {string} archive_path
     * @return {Promise}
     */
    zip: function (unzipped_dir, archive_path) {
        return new Promise(function (resolve, reject) {
            unzipped_dir = shellescape([unzipped_dir]);
            archive_path = shellescape([archive_path]);

            child_process.exec(
                `cd ${unzipped_dir} && zip -Xrq ${archive_path} .`,
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