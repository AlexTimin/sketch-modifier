const
    router = require('express').Router(),
    PreviewGenerator = require('../src/preview-generator'),
    SketchStore = require('../src/sketch-store').SketchStore;

function generatePreview(sketch_url, screens, replaces) {
    let SStore = new SketchStore();
        // sketch_url = reqParams.sketch_url,
        // screens =
        // [
        //     'C1C29749-B967-494D-8D7E-A484EAB37534',
        //     'BF38A95A-F0CD-452E-BE26-E346EBD349CE',
        // ]
        // textReplaces =
        // {
        //     'DADB2BDE-F509-45DB-9672-3FF16A588269': "БилИб-е-рда",
        //     'E31C5765-B8C7-4902-ADF8-B3DF6BAA6EE8': "Напиши чтоототвоатвоатоват-воат-ниб-нибудь",
        //     'E89B04C0-5F81-442F-BFB0-3B4129004672': "Напиши что-нибудь",
        // }

    return SStore.load(sketch_url)
        .then(fileName => {
            let screenPreviewUrls = Object.create(null);

            let previewGenPromises = screens.map(screen_uuid => {
                return SStore
                    .tempReplaceTextsInSketch(fileName, replaces, function (sketchFilePath) {
                        return new PreviewGenerator()
                            .generatePreview(sketchFilePath, screen_uuid)
                    })
                    .then(function (imageUrls) {
                        Object.assign(screenPreviewUrls, imageUrls);
                    });
            });

            return Promise.all(previewGenPromises)
                .then(() => Promise.resolve(screenPreviewUrls));
        });
}

function controller(reqParams, res)
{
    let screens,
        replaces,
        sketch_url;

    try {
        if (!reqParams.sketch_url) {
            throw 'Sketch url missed';
        }
        if (!reqParams.screens) {
            throw 'Screens ids missed';
        }
        if (!reqParams.textReplaces) {
            throw 'Text replaces missed';
        }
        sketch_url = reqParams.sketch_url;
        screens = JSON.parse(reqParams.screens);
        replaces = JSON.parse(reqParams.textReplaces);
    } catch (err) {
        res.json({error: err});
        return;
    }

    generatePreview(sketch_url, screens, replaces)
        .then(function (screenPreviewUrls) {
            res.json(screenPreviewUrls);
        })
        .catch(function (err) {
            console.error(err);
            res.json({error: 'Error'});
        });
}

router.get('/', function (req, res, next) {
    controller(req.query, res);
});
router.post('/', function (req, res, next) {
    controller(req.body, res);
});

module.exports = router;
