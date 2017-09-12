const
    fs = require('fs'),
    uuid = require('uuid'),
    childProcess = require('child_process'),
    xmlDom = require('xmldom'),
    shellescape = require('shell-escape'),
    fsUtils = require('../src/fs-utils');

class SketchTexts {
    constructor(sketchUuid) {
        this.sketchUuid = sketchUuid;
        this._Index = Object.create(null);
    }

    add(uuidBreadcrumbs, leaf) {
        let curIndexNode = this._Index;

        for (let i = 0; i < uuidBreadcrumbs.length - 1; i++) {
            if (!curIndexNode[uuidBreadcrumbs[i]]) {
                curIndexNode[uuidBreadcrumbs[i]] = Object.create(null);
            }

            curIndexNode = curIndexNode[uuidBreadcrumbs[i]];
        }
        curIndexNode[uuidBreadcrumbs[uuidBreadcrumbs.length - 1]] = leaf;
    };

    /**
     * @description This method is called by JSON.stringify
     * @return {Object}
     */
    toJSON() {
        let JSONable = {};
        JSONable[this.sketchUuid] = this._Index;
        return JSONable;
    };
}

class SketchStore {
    /**
     * @param {string} attributesArchive
     * @return {Promise}
     */
    _unarchiveAttributes(attributesArchive) {
        return new Promise(function (resolve, reject) {
            attributesArchive = shellescape([attributesArchive]);

            childProcess.exec(
                `echo ${attributesArchive} | base64 -D | plutil -convert xml1 -o - -`,
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
    _archiveAttributes(Attributes) {
        return new Promise(function (resolve, reject) {
            let attributes = shellescape([Attributes]);

            childProcess.exec(
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
     * @param {Object} obj
     * @param {function} mapCallback
     * @param {[]} [breadcrumbs] - We have only 3 crumbs for every text
     * @return {promiseReturnFunction[]}
     */
    _mapArchivedAttributes(obj, mapCallback, breadcrumbs) {
        if (obj._class === 'page') {
            breadcrumbs = [obj.do_objectID];
        }
        if (obj._class === 'artboard') {
            obj.name = obj.do_objectID;//TODO: we have to refactor this method to expose all of the mappings, not only of archived attributes
            breadcrumbs = [breadcrumbs[0]];// We go trough the tree. Imagine and understand!
            breadcrumbs.push(obj.do_objectID);
        }
        if (obj._class === 'text') {
            breadcrumbs = breadcrumbs.slice(0, 2);// We go trough the tree. Imagine and understand!
            breadcrumbs.push(obj.do_objectID);
        }

        let promisifiedCalls = [];

        if ('archivedAttributedString' in obj) {
            promisifiedCalls.push(function () {
                 return mapCallback(breadcrumbs, obj['archivedAttributedString']._archive)
                     .then(function (mappedValue) {
                         obj['archivedAttributedString']._archive = mappedValue;
                     });
             });

            return promisifiedCalls;
        }

        for (let propValue of obj) {
            if (propValue instanceof Object) {
                promisifiedCalls = promisifiedCalls.concat(this._mapArchivedAttributes(propValue, mapCallback, breadcrumbs));
            }
        }

        return promisifiedCalls;
    }

    /**
     * @callback sketchPageCallback
     * @param {Object} Page
     * @return {promiseReturnFunction[]}
     */

    /**
     * @param {string} sketchDir
     * @param {sketchPageCallback} mapCallback
     * @return {Promise}
     */
    _mapSketchPages(sketchDir, mapCallback) {
        return new Promise(function(resolve, reject) {
            const pagesDir = sketchDir + 'pages/';

            fs.readdir(pagesDir, function (err, pagesFileNames) {
                if (err) {
                    reject(err);
                    return;
                }

                let pages = Object.create(null),
                    promisifiedCalls = [];

                for (let i = 0; i < pagesFileNames.length; i++) {
                    let pageFilePath = pagesDir + pagesFileNames[i];

                    let Page = JSON.parse(fs.readFileSync(pageFilePath));//TODO: пока вызов синхронный, не хочу портить код промисами еще больше. пока..

                    pages[pageFilePath] = Page;

                    try {
                        promisifiedCalls = promisifiedCalls.concat(mapCallback(Page));
                    } catch (error) {
                        reject(error);
                    }
                }

                if (promisifiedCalls.length === 0) {
                    resolve();
                }

                function execMapping(fromI, toI) {
                    return Promise.all(
                        promisifiedCalls
                            .slice(fromI, toI)
                            .map(function(promisifiedCall) {return promisifiedCall();})
                    ).then(function() {
                        fromI += global.appConfig.maxParallelMappingThreads;
                        if (fromI < promisifiedCalls.length) {
                            toI += global.appConfig.maxParallelMappingThreads;
                            return execMapping(fromI, toI);
                        }
                    }, reject);
                }

                execMapping(0, global.appConfig.maxParallelMappingThreads)
                    .then(function () {
                        let promises = [];
                        for (let pageFilePath in pages) {
                            promises.push(fsUtils.writeFile(pageFilePath, JSON.stringify(pages[pageFilePath])));
                        }
                        return Promise.all(promises);
                    })
                    .then(resolve, reject);
            });
        });
    }

    /**
     * @param {string} sketchFilePath
     * @return {Promise}
     */
    addSketchFile(sketchFilePath) {
        let _this = this;

        return new Promise(function (resolve, reject) {
            const
                fileName = uuid(),
                unzippedProjectPath = global.appConfig.sketchProjectDir + fileName + '/',
                Texts = new SketchTexts(fileName);

            fsUtils.unzip(sketchFilePath, unzippedProjectPath)
                .then(function() {
                    return _this._mapSketchPages(unzippedProjectPath, function(Page) {
                        return _this._mapArchivedAttributes(
                            Page,
                            function(breadcrumbs, attributesArchive){
                                return _this._unarchiveAttributes(attributesArchive)
                                    .then(function (xmlAttributes) {
                                        let Attributes = new xmlDom.DOMParser().parseFromString(xmlAttributes, 'application/xml');

                                        Texts.add(breadcrumbs, Attributes.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.nodeValue);
                                        return xmlAttributes;
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
     * @param {string} sketchUuid
     * @param {Object} replaces - hash
     * @param {tmpSketchFileCallback} callback
     * @return {Promise}
     */
    tempReplaceTextsInSketch = function (sketchUuid, replaces, callback) {
        let _this = this;

        return new Promise(function(resolve, reject) {
            const
                srcSketchDir = global.appConfig.sketchProjectDir + sketchUuid + '/',
                translatedSketch = global.appConfig.tmpDir + uuid(),
                translatedSketchDir = translatedSketch + '/',
                translatedSketchFile = translatedSketch + '.sketch';

            fsUtils.copyDirRecursive(srcSketchDir, translatedSketchDir)
                .then(function () {
                    return _this._mapSketchPages(translatedSketchDir, function(Page) {
                        return _this._mapArchivedAttributes(
                            Page,
                            function(breadcrumbs, xmlAttributes) {
                                let textUuid = breadcrumbs[breadcrumbs.length - 1];

                                if (replaces[textUuid]) {
                                    let xmlDoc = (new xmlDom.DOMParser()).parseFromString(xmlAttributes);
                                    xmlDoc.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.data = replaces[textUuid];
                                    xmlAttributes = new xmlDom.XMLSerializer().serializeToString(xmlDoc);
                                }

                                return _this._archiveAttributes(xmlAttributes);
                            }
                        );
                    });
                })
                .then(function () {
                    return fsUtils.zip(translatedSketchDir, translatedSketchFile);
                })
                .then(function() {
                    return callback(translatedSketchFile);
                })
                .then(function() {
                    resolve.apply(this, arguments);

                    fs.unlink(translatedSketchFile, function (err) {
                        if (err) {
                            console.error(err);
                        }
                    });

                    fsUtils.rmDirRecursiveASAP(translatedSketchDir);
                }, reject);
        });
    };
}

module.exports = SketchStore;