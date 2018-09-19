const
    router = require('express').Router(),
    SketchStore = require('../src/sketch-store').SketchStore,
    SketchTexts = require('../src/sketch-store').SketchTexts,
    fs = require('fs'),
    url = require('url');

router.post('/', function(req, res, next) {
    let sketch_url = req.body.sketch_url;


    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;//skip TLS cert verification

    let fileName = sketch_url.replace(/\//g, '_');
    let SStore = new SketchStore;

    SStore.has(fileName)
        .then(
            () => {
                let Texts = new SketchTexts(fileName);

                SStore.mapSketchPages(SStore.getPath(fileName), Page => {
                    SStore.mapTexts(
                        Page,
                        function (breadcrumbs, text) {
                            Texts.add(breadcrumbs, text);
                            return text;
                        }
                    );
                    return [];
                })
                    .then(() => {
                        res.json(Texts);
                    });
            },
            () => {
                let adapters = {
                    'http:' : require('http'),
                    'https:': require('https'),
                };

                adapters[url.parse(sketch_url).protocol].get(sketch_url, function (response) {
                    let uploadPath = global.appConfig.tmpDir + fileName;
                    let file = fs.createWriteStream(uploadPath);

                    response.pipe(file)
                        .on('finish', function () {
                            SStore
                                .addSketchFile(uploadPath, fileName)
                                .then(
                                    /** @param {SketchTexts} Texts */
                                    function(Texts) {
                                        if(fs.existsSync(uploadPath)) {
                                            fs.unlinkSync(uploadPath);
                                        }
                                        res.json(Texts);
                                    }
                                )
                                .catch(function(err) {
                                    console.error(err);
                                    res.json({error: 'Error'});
                                });
                        })
                        .on('error', function(e) {
                            res.status(500);
                        });
            }
        );
    });
});

module.exports = router;
