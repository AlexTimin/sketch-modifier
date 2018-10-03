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
            return SStore
                .tempReplaceTextsInSketch(fileName, replaces, function (sketchFilePath) {
                    return new PreviewGenerator()
                        .generatePreview(sketchFilePath, screens)
                })
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

        sketch_url = reqParams.sketch_url;
        screens = JSON.parse(reqParams.screens);
        if (!(screens instanceof Array)) {
            screens = Object.values(screens);
        }
        if (reqParams.textReplaces) {
            replaces = JSON.parse(reqParams.textReplaces);
        }
    } catch (err) {
        console.log(err);
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
