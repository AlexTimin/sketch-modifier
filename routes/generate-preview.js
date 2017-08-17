const
    express = require('express'),
    fs = require('fs'),
    router = express.Router(),
    child_process = require('child_process'),
    uuidv1 = require('uuid/v1'),
    tmp_dir = '',
    sketch_project_dir = '/Users/at/sketch-preview-generator/sketch_projects/',
    export_format = 'png';

// function replaceTextInProject(project_dir, search, replace) {
//     const pages_dir = project_dir + 'pages/';
//
//     fs.readdir(pages_dir, function(err, pages) {
//         if (err) {
//             throw err;
//         }
//
//         function findArchivedAttributes(Obj) {
//             if ('MSAttributedStringFontAttribute' in Obj) {
//                 return Obj.MSAttributedStringFontAttribute._archive;
//             }
//
//             for (let key in Obj) {
//                 if (Obj[key] instanceof Object) {
//                     return findArchivedAttributes(Obj[key]);
//                 }
//             }
//
//             return null;
//         }
//
//         let preview_images = [];
//
//         for (let i = 0; i < pages.length; i++) {
//             let page_file = pages_dir + pages[i],
//                 Page = JSON.parse(fs.readFileSync(page_file));
// //сделать поиск заархивированных аттрибутов здесь
//             preview_images.push({
//                 variant: pages[i],
//                 img: `data:image/${export_format};base64,` + new Buffer(bitmap).toString('base64'),
//             });
//
//             fs.unlinkSync(page_file);
//         }
//
//         resolve(preview_images);
//     });
// }

router.get('/', function(req, res, next) {
    const
        project_name ='11';
        request_dir = tmp_dir + uuidv1() + '/',
        output_dir =  request_dir + 'output/';

    child_process.exec(`mkdir -p ${output_dir}`, function (error, stdout, stderr) {
        if (error) {
            throw error;
        }

        const
            project_file = sketch_project_dir + + project_name + '.sketch',
            project_dir = sketch_project_dir + +project_name + '/';

        const generate_preview_cmd = `cd "${output_dir}" && sketchtool export artboards --formats=${export_format} --save-for-web "${project_file}"`;

        child_process.exec(generate_preview_cmd, function (error, stdout, stderr) {
            if (error || stderr) {
                console.error('exec error:' + (error || stderr));
                return;
            }

            let promise = new Promise(function(resolve, reject) {
                fs.readdir(output_dir, function(err, items) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let preview_images = [];

                    for (let i = 0; i < items.length; i++) {
                        let file_name = output_dir + items[i],
                            bitmap = fs.readFileSync(file_name);

                        preview_images.push({
                           variant: items[i],
                           img: `data:image/${export_format};base64,` + new Buffer(bitmap).toString('base64'),
                        });

                        fs.unlinkSync(file_name);
                    }

                    resolve(preview_images);
                });
            });

            let call_always = function () {
                child_process.exec(`rm -rf ${output_dir}`);
            };

            promise.then(
                function(preview_images) {
                    res.send(preview_images);
                    call_always();
                },
                function (err) {
                    console.error(err);
                    call_always();
                });
        });
    });
});

module.exports = router;
