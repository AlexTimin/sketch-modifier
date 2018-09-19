const
    router = require('express').Router(),
    PreviewGenerator = require('../src/preview-generator'),
    SketchStore = require('../src/sketch-store').SketchStore;

function generatePreview(reqParams, res, next) {
    try {
        if (!reqParams.screens) {
            throw 'Screens ids missed';
        }
        if (!reqParams.textReplaces) {
            throw 'Text replaces missed';
        }
        reqParams.screens = JSON.parse(reqParams.screens);
        reqParams.textReplaces = JSON.parse(reqParams.textReplaces);
    } catch (err) {
        res.json({error: err});
        return;
    }

    let screens = reqParams.screens,
        // {
        //      'f6ac42f8-ce63-4f06-8d2e-d3da941732c4' : [
        //          'C1C29749-B967-494D-8D7E-A484EAB37534',
        //          'BF38A95A-F0CD-452E-BE26-E346EBD349CE',
        //      ]
        // },
        textReplaces = reqParams.textReplaces,
        // {
        //     'DADB2BDE-F509-45DB-9672-3FF16A588269': "БилИб-е-рда",
        //     'E31C5765-B8C7-4902-ADF8-B3DF6BAA6EE8': "Напиши чтоототвоатвоатоват-воат-ниб-нибудь",
        //     'E89B04C0-5F81-442F-BFB0-3B4129004672': "Напиши что-нибудь",
        // };
        screenPreviewUrls = Object.create(null),
        previewGenPromises = [],
        SketchWarehouse = new SketchStore();

    for (let sketch in screens) {
        if (!screens.hasOwnProperty(sketch)) continue;

        previewGenPromises.push(
            SketchWarehouse
                .tempReplaceTextsInSketch(sketch, textReplaces, function (sketchFilePath) {
                    return new PreviewGenerator()
                        .generatePreview(sketchFilePath, screens[sketch])
                })
                .then(function (imageUrls) {
                    Object.assign(screenPreviewUrls, imageUrls);
                })
        );
    }

    Promise.all(previewGenPromises)
        .then(function () {
            res.json(screenPreviewUrls);
        })
        .catch(function (err) {
            console.error(err);
            res.json({error: 'Error'});
        })
}

router.get('/', function (req, res, next) {
    generatePreview(req.query, res, next);
});
router.post('/', function (req, res, next) {
    generatePreview(req.body, res, next);
});

module.exports = router;
