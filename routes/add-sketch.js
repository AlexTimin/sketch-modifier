const
    router = require('express').Router(),
    SketchStore = require('../src/sketch-store'),
    multiparty = require('multiparty'),
    fs = require('fs');

router.post('/', function(req, res, next) {
    let
        form = new multiparty.Form(),
        uploadFile = {uploadPath: '', type: '', size: 0},
        errors = [];

    form.on('error', function(err){
        if(fs.existsSync(uploadFile.path)) {
            fs.unlinkSync(uploadFile.path);
            console.log('error');
        }
    });

    form.on('close', function() {
        if (errors.length !== 0) {
            if(fs.existsSync(uploadFile.path)) {
                fs.unlinkSync(uploadFile.path);
            }
            res.send({status: 'bad', errors: errors});
        }
    });

    form.on('part', function(part) {
        uploadFile.size = part.byteCount;
        uploadFile.type = part.headers['content-type'];
        uploadFile.path = global.appConfig.tmpDir + part.filename;

        if(uploadFile.size > global.appConfig.maxSketchSize) {
            errors.push('File size is ' + uploadFile.size + '. Limit is' + (global.appConfig.maxSketchSize / 1024 / 1024) + 'MB.');
        }

        if(errors.length === 0) {
            let out = fs.createWriteStream(uploadFile.path);
            part.pipe(out)
                .on('finish', function () {
                    new SketchStore()
                        .addSketchFile(uploadFile.path)
                        .then(
                            /** @param {SketchTexts} Texts */
                            function(Texts) {
                                if(fs.existsSync(uploadFile.path)) {
                                    fs.unlinkSync(uploadFile.path);
                                }
                                res.json(Texts);
                            }
                        )
                        .catch(function(err) {
                            console.error(err);
                            res.json({error: 'Error'});
                        });
                });
        } else {
            req.abort();
        }
    });

    form.parse(req);
});

module.exports = router;
