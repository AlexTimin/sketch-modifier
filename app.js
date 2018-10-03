let express = require('express');
let path = require('path');
let logger = require('morgan');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let generatePreview = require('./routes/generate-preview');
let addSketch = require('./routes/add-sketch');
let findTexts = require('./routes/find-texts');
let index = require('./routes/index');
let app = express();


if (Object.values === undefined) {
    Object.values = (obj) => {
        let values = [];
        for (let field in obj) {
            values.push(obj[field]);
        }
        return values;
    }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;//skip TLS cert verification

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/generate-preview', generatePreview);
app.use('/add-sketch', addSketch);
app.use('/find-texts', findTexts);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
