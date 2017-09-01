const
    fs = require('fs'),
    uuid = require('uuid'),
    child_process = require('child_process'),
    xmldom = require('xmldom'),
    shellescape = require('shell-escape'),
    fs_utils = require('../src/fs-utils');


function SketchTexts(sketch_uuid) {
    this.sketch_uuid = sketch_uuid;

    let Index = Object.create(null);

    this.add = function (uuid_breadcrumbs, leaf) {
        let cur_index_node = Index;

        for (let i = 0; i < uuid_breadcrumbs.length - 1; i++) {
            if (!cur_index_node[uuid_breadcrumbs[i]]) {
                cur_index_node[uuid_breadcrumbs[i]] = Object.create(null);
            }

            cur_index_node = cur_index_node[uuid_breadcrumbs[i]];
        }
        cur_index_node[uuid_breadcrumbs[uuid_breadcrumbs.length - 1]] = leaf;
    };

    /**
     * @description This method is called by JSON.stringify
     * @return {Object}
     */
    this.toJSON = function () {
        let JSONable = {};
        JSONable[this.sketch_uuid] = Index;
        return JSONable;
    };
}

function SketchStore() {
    /**
     * @param {string} attributes_archive
     * @return {Promise}
     */
    function unarchiveAttributes(attributes_archive) {
        return new Promise(function (resolve, reject) {
            attributes_archive = shellescape([attributes_archive]);

            child_process.exec(
                `echo ${attributes_archive} | base64 -D | plutil -convert xml1 -o - -`,
                function (error, stdout, stderr) {
                    if (error) {
                        console.error(stdout);
                        console.error(stderr);
                        reject(error);
                        return;
                    }

                    resolve(stdout.trim());
                }
            );
        });
    }

    /**
     * @param {Object} Attributes
     * @return {Promise}
     */
    function archiveAttributes(Attributes) {
        return new Promise(function (resolve, reject) {
            let attributes = shellescape([Attributes]);

            child_process.exec(
                `echo ${attributes} | plutil -convert binary1 -o - - | base64`,
                function (error, stdout, stderr) {
                    if (error) {
                        console.error('stdout: ' + stdout);
                        console.error('stderr: ' + stderr);
                        reject(error);
                        return;
                    }

                    resolve(stdout.trim());
                }
            );
        });
    }

    /**
     * @function promiseReturnFunction
     * @return {Promise}
     */

    /**
     * @param {Object} Obj
     * @param {function} map_callback
     * @param {[]} [breadcrumbs] - We have only 3 crumbs for every text
     * @return {promiseReturnFunction[]}
     */
    function mapArchivedAttributes(Obj, map_callback, breadcrumbs) {
        if (Obj._class === 'page') {
            breadcrumbs = [Obj.do_objectID];
        }
        if (Obj._class === 'artboard') {
            Obj.name = Obj.do_objectID;//TODO: we have to refactor this method to expose all of the mappings, not only of archived attributes
            breadcrumbs = [breadcrumbs[0]];// We go trough the tree. Imagine and understand!
            breadcrumbs.push(Obj.do_objectID);
        }
        if (Obj._class === 'text') {
            breadcrumbs = breadcrumbs.slice(0, 2);// We go trough the tree. Imagine and understand!
            breadcrumbs.push(Obj.do_objectID);
        }

        let promisified_calls = [];

        if ('archivedAttributedString' in Obj) {
            promisified_calls.push(function () {
                 return map_callback(breadcrumbs, Obj['archivedAttributedString']._archive)
                     .then(function (mapped_value) {
                         Obj['archivedAttributedString']._archive = mapped_value;
                     });
             });

            return promisified_calls;
        }

        for (let key in Obj) {
            if (Object.prototype.hasOwnProperty.call(Obj, key) && Obj[key] instanceof Object) {
                promisified_calls = promisified_calls.concat(mapArchivedAttributes(Obj[key], map_callback, breadcrumbs));
            }
        }

        return promisified_calls;
    }

    /**
     * @callback sketchPageCallback
     * @param {Object} Page
     * @return {promiseReturnFunction[]}
     */

    /**
     * @param {string} sketch_dir
     * @param {sketchPageCallback} map_callback
     * @return {Promise}
     */
    function mapSketchPages(sketch_dir, map_callback) {
        return new Promise(function(resolve, reject) {
            const pages_dir = sketch_dir + 'pages/';

            fs.readdir(pages_dir, function (err, pages_file_names) {
                if (err) {
                    reject(err);
                    return;
                }

                let pages = Object.create(null),
                    promisified_calls = [];

                for (let i = 0; i < pages_file_names.length; i++) {
                    let page_file_path = pages_dir + pages_file_names[i];

                    let Page = JSON.parse(fs.readFileSync(page_file_path));//TODO: пока вызов синхронный, не хочу портить код промисами еще больше. пока..

                    pages[page_file_path] = Page;

                    try {
                        promisified_calls = promisified_calls.concat(map_callback(Page));
                    } catch (error) {
                        reject(error);
                    }
                }

                if (promisified_calls.length === 0) {
                    resolve();
                }

                function execMapping(from_i, to_i) {
                    return Promise.all(
                        promisified_calls
                            .slice(from_i, to_i)
                            .map(function(promisified_call) {return promisified_call();})
                    ).then(function() {
                        from_i += global.app_config.max_parallel_mapping_threads;
                        if (from_i < promisified_calls.length) {
                            to_i += global.app_config.max_parallel_mapping_threads;
                            return execMapping(from_i, to_i);
                        }
                    }, reject);
                }

                execMapping(0, global.app_config.max_parallel_mapping_threads)
                    .then(function () {
                        let promises = [];
                        for (let page_file_path in pages) {
                            promises.push(fs_utils.writeFile(page_file_path, JSON.stringify(pages[page_file_path])));
                        }
                        return Promise.all(promises);
                    })
                    .then(resolve, reject);
            });
        });
    }

    /**
     * @param {string} sketch_file_path
     * @return {Promise}
     */
    this.addSketchFile = function (sketch_file_path) {
        return new Promise(function (resolve, reject) {
            const
                file_name = uuid(),
                unzipped_project_path = global.app_config.sketch_project_dir + file_name + '/',
                Texts = new SketchTexts(file_name);

            fs_utils.unzip(sketch_file_path, unzipped_project_path)
                .then(function() {
                    return mapSketchPages(unzipped_project_path, function(Page) {
                        return mapArchivedAttributes(
                            Page,
                            function(breadcrumbs, attributes_archive){
                                return unarchiveAttributes(attributes_archive)
                                    .then(function (xml_attributes) {
                                        let Attributes = new xmldom.DOMParser().parseFromString(xml_attributes);

                                        Texts.add(breadcrumbs, Attributes.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.nodeValue);
                                        return xml_attributes;
                                    });
                            }
                        );
                    });
                })
                .then(function() {
                    resolve(Texts);
                }, reject);
        });
    };

    /**
     * @callback tmpSketchFileCallback
     * @param {string} file_path
     * @return {Promise}
     */

    /**
     * @param {string} sketch_uuid
     * @param {Object} replaces - hash
     * @param {tmpSketchFileCallback} callback
     * @return {Promise}
     */
    this.tempReplaceTextsInSketch = function (sketch_uuid, replaces, callback) {
        return new Promise(function(resolve, reject) {
            const
                src_sketch_dir = global.app_config.sketch_project_dir + sketch_uuid + '/',
                translated_sketch = global.app_config.tmp_dir + uuid(),
                translated_sketch_dir = translated_sketch + '/',
                translated_sketch_file = translated_sketch + '.sketch';

            fs_utils.copyDirRecursive(src_sketch_dir, translated_sketch_dir)
                .then(function () {
                    return mapSketchPages(translated_sketch_dir, function(Page) {
                        return mapArchivedAttributes(
                            Page,
                            function(breadcrumbs, xml_attributes) {
                                let text_uuid = breadcrumbs[breadcrumbs.length - 1];

                                if (replaces[text_uuid]) {
                                    let xmldoc = (new xmldom.DOMParser()).parseFromString(xml_attributes);
                                    xmldoc.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.data = replaces[text_uuid];
                                    xml_attributes = new xmldom.XMLSerializer().serializeToString(xmldoc);
                                }

                                return archiveAttributes(xml_attributes);
                            }
                        );
                    });
                })
                .then(function () {
                    return fs_utils.zip(translated_sketch_dir, translated_sketch_file);
                })
                .then(function() {
                    return callback(translated_sketch_file);
                })
                .then(function() {
                    resolve.apply(this, arguments);

                    fs.unlink(translated_sketch_file, function (err) {
                        if (err) {
                            console.error(err);
                        }
                    });

                    fs_utils.rmDirRecursiveASAP(translated_sketch_dir);
                }, reject);
        });
    };
}

module.exports = SketchStore;