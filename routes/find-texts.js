const
    router = require('express').Router(),
    SketchStore = require('../src/sketch-store').SketchStore,
    SketchTexts = require('../src/sketch-store').SketchTexts;

/**
 * @param {string} sketch_url
 * @return {Promise<SketchTexts>}
 */
function findTexts (sketch_url) {
    let SStore = new SketchStore;

    return SStore.load(sketch_url)
        .then(fileName => {
            let Texts = new SketchTexts(fileName);

            return SStore.mapSketchPages(SStore.getPath(fileName), Page => {
                SStore.mapTexts(
                    Page,
                    function (breadcrumbs, text) {
                        Texts.add(breadcrumbs, text);
                        return text;
                    }
                );
                return [];
            })
                .then(() => Promise.resolve(Texts));
        });
}

router.get('/', function(req, res, next) {
    findTexts(req.query.sketch_url)
        .then(Texts => {
            res.json(Texts);
        })
        .catch(function (err) {
            console.error(err);
            res.json({error: 'Error'});
        });
});

router.post('/', function(req, res, next) {
    findTexts(req.body.sketch_url)
        .then(Texts => {
            res.json(Texts);
        })
        .catch(function (err) {
            console.error(err);
            res.json({error: 'Error'});
        });
});

module.exports = router;
