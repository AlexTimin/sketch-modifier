const
    router = require('express').Router(),
    PreviewGenerator = require('../src/preview-generator'),
    SketchStore = require('../src/sketch-store');

function generatePreview(req_params, res, next) {
    try {
        if (!req_params.screens) {
            throw 'Screens ids missed';
        }
        if (!req_params.text_replaces) {
            throw 'Text replaces missed';
        }
        req_params.screens = JSON.parse(req_params.screens);
        req_params.text_replaces = JSON.parse(req_params.text_replaces);
    } catch (err) {
        res.json({error: err});
        return;
    }

    let screens = req_params.screens,
        // {
        //      'f6ac42f8-ce63-4f06-8d2e-d3da941732c4' : [
        //          'C1C29749-B967-494D-8D7E-A484EAB37534',
        //          'BF38A95A-F0CD-452E-BE26-E346EBD349CE',
        //      ]
        // },
        text_replaces = req_params.text_replaces,
        // {
        //     'DADB2BDE-F509-45DB-9672-3FF16A588269': "БилИб-е-рда",
        //     'E31C5765-B8C7-4902-ADF8-B3DF6BAA6EE8': "Напиши чтоототвоатвоатоват-воат-ниб-нибудь",
        //     'E89B04C0-5F81-442F-BFB0-3B4129004672': "Напиши что-нибудь",
        // };
        screen_preview_urls = Object.create(null),
        preview_gen_promises = [],
        SketchWarehouse = new SketchStore();

    for (let sketch in screens) {
        if (!screens.hasOwnProperty(sketch)) continue;

        preview_gen_promises.push(
            SketchWarehouse
                .tempReplaceTextsInSketch(sketch, text_replaces, function (sketch_file_path) {
                    return new PreviewGenerator()
                        .generatePreview(sketch_file_path, screens[sketch])
                })
                .then(function (image_urls) {
                    Object.assign(screen_preview_urls, image_urls);
                })
        );
    }

    Promise.all(preview_gen_promises)
        .then(function () {
            res.json(screen_preview_urls);
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
