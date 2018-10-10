const
    fs = require('fs'),
    uuid = require('uuid'),
    childProcess = require('child_process'),
    xmlDom = require('xmldom'),
    shellEscape = require('shell-escape'),
    fsUtils = require('../src/fs-utils'),
    request = require('request');

class SketchTexts {
    constructor() {
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
        return this._Index;
    };
}

class SketchStore {
    /**
     * @param {string} url
     * @return {string}
     */
    url2fileName(url) {
        return url.replace(/\//g, '_');
    }

    /**
     * @private
     * @param {string} attributesArchive
     * @return {Promise}
     */
    _unArchiveAttributes(attributesArchive) {
        return new Promise(function (resolve, reject) {
            attributesArchive = shellEscape([attributesArchive]);

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
     * @private
     * @param {Object} Attributes
     * @return {Promise}
     */
    _archiveAttributes(Attributes) {
        return new Promise(function (resolve, reject) {
            let attributes = shellEscape([Attributes]);

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
     * @private
     * @param {Object} obj
     * @return {archivedAttributedString[]}
     */
    _findArchivedAttributes(obj) {
        let archives = [];

        if (obj.archivedAttributedString) {
            archives.push(obj.archivedAttributedString);
        } else {
            for (let field in obj) {
                if (obj[field] instanceof Object) {
                    archives = archives.concat(this._findArchivedAttributes(obj[field]));
                }
            }
        }

        return archives;
    }

    /**
     * @param {Object} obj
     * @param {function} callback
     * @param {[]} [breadcrumbs] - We have only 3 crumbs for every text
     */
    mapTexts (obj, callback, breadcrumbs) {
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

        if (breadcrumbs.length >= 3 && obj.attributedString) { //length must be greater or equal to 3, bcoz 1-page, 2-artboard, 3-text
            if (obj.attributedString.archivedAttributedString) {
                let Attributes = new xmlDom.DOMParser().parseFromString(
                    obj.attributedString.archivedAttributedString._archive,
                    'application/xml'
                );
                Attributes.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.data = callback(
                    breadcrumbs,
                    Attributes.childNodes[4].childNodes[1].childNodes[7].childNodes[5].firstChild.nodeValue
                );
                obj.attributedString.archivedAttributedString._archive = new xmlDom.XMLSerializer().serializeToString(Attributes);
            } else {
                obj.attributedString.string = callback(breadcrumbs, obj.attributedString.string);
            }
            return;
        }

        for (let field in obj) {
            if (obj[field] instanceof Object) {
                this.mapTexts(obj[field], callback, breadcrumbs);
            }
        }
    }

    /**
     * @callback sketchPageCallback
     * @param {Object} Page
     * @return {promiseReturnFunction[]}
     */

    /**
     * @param {string} sketchDir
     * @param {function(*=): Array} mapCallback
     * @return {Promise}
     */
    mapSketchPages(sketchDir, mapCallback) {
        return new Promise(function(resolve, reject) {
            const pagesDir = sketchDir + 'pages/';

            fs.readdir(pagesDir, function (err, pagesFileNames) {
                if (err) {
                    reject(err);
                    return;
                }

                let pages = Object.create(null),
                    promisifiedCalls = [];

                pagesFileNames.forEach(function (pagesFileName) {
                    let pageFilePath = pagesDir + pagesFileName;

                    let Page = JSON.parse(fs.readFileSync(pageFilePath));//TODO: пока вызов синхронный, не хочу портить код промисами еще больше. пока..

                    pages[pageFilePath] = Page;

                    promisifiedCalls = promisifiedCalls.concat(mapCallback(Page));
                });

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
                        for (let pageFilePath in pages) {
                            fs.writeFileSync(pageFilePath, JSON.stringify(pages[pageFilePath]));
                        }
                        resolve();
                    });
            });
        });
    }

    /**
     * @param {string} fileName
     * @return {string}
     */
    getPath (fileName) {
        return global.appConfig.sketchProjectDir + fileName + '/';
    }

    /**
     * @param {string} fileName
     * @return {Promise}
     */
    has(fileName) {
        return new Promise((resolve, reject) => {
            fs.stat(this.getPath(fileName), (err, stat) => {
                if (err == null) {
                    resolve();
                } else {
                    reject();
                }
            });
        });
    }

    async load(sketch_url)
    {
        return new Promise((resolve, reject) => {
            let fileName = this.url2fileName(sketch_url);

            this.has(fileName)
                .then(
                    () => {
                        resolve(fileName);
                    },
                    () => {
                        console.log('loading ' + sketch_url);
                        request(sketch_url)
                            .on('response', response => {
                                let uploadPath = global.appConfig.tmpDir + fileName;
                                let file = fs.createWriteStream(uploadPath);
                                response.pipe(file)
                                    .on('close', () => {
                                        this.addSketchFile(uploadPath, fileName)
                                            .then(
                                                function () {
                                                    if (fs.existsSync(uploadPath)) {
                                                        fs.unlinkSync(uploadPath);
                                                    }
                                                    resolve(fileName);
                                                }
                                            );
                                    })
                                    .on('error', function (e) {
                                        console.log(JSON.stringify());
                                        reject(e);
                                    });
                            })
                            .on('error', function (e) {
                                console.log(JSON.stringify());
                                reject(e);
                            });
                    }
                )
        });
    }

    /**
     * @param {string} sketchFilePath
     * @param {string} fileName
     * @return {Promise}
     */
    addSketchFile(sketchFilePath, fileName) {
        let _this = this;

        return new Promise(function (resolve, reject) {
            const
                unzippedProjectPath = _this.getPath(fileName),
                Texts = new SketchTexts(fileName);

            fsUtils.unzip(sketchFilePath, unzippedProjectPath)
                .then(function() {
                    let pages = [];

                    return _this.mapSketchPages(unzippedProjectPath, function(Page) {
                        pages.push(Page);

                        let promisifiedCalls = [];

                        let archives = _this._findArchivedAttributes(Page);
                        if (archives.length) {
                            archives.forEach(archivedAttributedString => {
                                promisifiedCalls.push(
                                    function() {
                                        return _this._unArchiveAttributes(archivedAttributedString._archive)
                                            .then(function (xmlAttributes) {
                                                archivedAttributedString._archive = xmlAttributes;
                                            })
                                    }
                                );
                            });
                        }

                        return promisifiedCalls;
                    })
                        .then(function () {
                            //TODO::не используется, удалить, проверить
                            pages.forEach(function (Page) {
                                _this.mapTexts(
                                    Page,
                                    function (breadcrumbs, text) {
                                        Texts.add(breadcrumbs, text);
                                        return text;
                                    }
                                );
                            });
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
    tempReplaceTextsInSketch(sketchUuid, replaces, callback) {
        let _this = this;

        return new Promise(function(resolve, reject) {
            const
                srcSketchDir = global.appConfig.sketchProjectDir + sketchUuid + '/',
                translatedSketch = global.appConfig.tmpDir + uuid(),
                translatedSketchDir = translatedSketch + '/',
                translatedSketchFile = translatedSketch + '.sketch';

            fsUtils.copyDirRecursive(srcSketchDir, translatedSketchDir)
                .then(function () {
                    return _this.mapSketchPages(translatedSketchDir, function(Page) {
                        if (replaces) {
                            _this.mapTexts(
                                Page,
                                function (breadcrumbs, text) {
                                    let textUuid = breadcrumbs[breadcrumbs.length - 1];

                                    if (replaces[textUuid]) {
                                        return replaces[textUuid];
                                    }

                                    return text;
                                }
                            );
                        }
                        let promisifiedCalls = [];
                        let archives = _this._findArchivedAttributes(Page);
                        if (archives.length) {
                            archives.forEach(archivedAttributedString => {
                                promisifiedCalls.push(
                                    function() {
                                        return _this._archiveAttributes(archivedAttributedString._archive)
                                            .then(function (xmlAttributes) {
                                                archivedAttributedString._archive = xmlAttributes;
                                            })
                                    }
                                );
                            });
                        }

                        return promisifiedCalls;
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

module.exports.SketchStore = SketchStore;
module.exports.SketchTexts = SketchTexts;