const
    router = require('express').Router(),
    SketchStore = require('../src/sketch-store'),
    multiparty = require('multiparty'),
    fs = require('fs'),
    path = require('path');

router.post('/', function(req, res, next) {
    let // создаем форму
        form = new multiparty.Form(),
        //здесь будет храниться путь с загружаемому файлу, его тип и размер
        uploadFile = {uploadPath: '', type: '', size: 0},
        //поддерживаемые типы(в данном случае это картинки формата jpeg,jpg и png)
        //supportMimeTypes = ['image/jpg', 'image/jpeg', 'image/png'];
        //массив с ошибками произошедшими в ходе загрузки файла
        errors = [];

    //если произошла ошибка
    form.on('error', function(err){
        if(fs.existsSync(uploadFile.path)) {
            //если загружаемый файл существует удаляем его
            fs.unlinkSync(uploadFile.path);
            console.log('error');
        }
    });

    form.on('close', function() {
        //если нет ошибок и все хорошо
        if (errors.length === 0) {
            //сообщаем что все хорошо

            // res.send({status: 'ok', text: 'Success'});
        } else {
            if(fs.existsSync(uploadFile.path)) {
                //если загружаемый файл существует удаляем его
                fs.unlinkSync(uploadFile.path);
            }
            //сообщаем что все плохо и какие произошли ошибки
            res.send({status: 'bad', errors: errors});
        }
    });

    // при поступление файла
    form.on('part', function(part) {
        //читаем его размер в байтах
        uploadFile.size = part.byteCount;
        //читаем его тип
        uploadFile.type = part.headers['content-type'];
        //путь для сохранения файла
        uploadFile.path = global.app_config.tmp_dir + part.filename;

        //проверяем размер файла, он не должен быть больше максимального размера
        if(uploadFile.size > global.app_config.max_sketch_size) {
            errors.push('File size is ' + uploadFile.size + '. Limit is' + (global.app_config.max_sketch_size / 1024 / 1024) + 'MB.');
        }

        //проверяем является ли тип поддерживаемым
        // if(supportMimeTypes.indexOf(uploadFile.type) === -1) {
        //     errors.push('Unsupported mimetype ' + uploadFile.type);
        // }

        //если нет ошибок то создаем поток для записи файла
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
                                    //если загружаемый файл существует удаляем его
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
            //пропускаем
            req.abort();
            // part.resume();
        }
    });

    // парсим форму
    form.parse(req);
});

module.exports = router;
