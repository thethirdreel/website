'use strict';

const path = require('path');
const fs = require('fs');
const del = require('del');
// gulp helpers
const gulp = require('gulp');
const gutil = require('gulp-util');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const nodemon = require('gulp-nodemon');
const browser = require('browser-sync').create();
const sequence = require('run-sequence');
// js
const jsminify = require('gulp-minify');
// css
const autoprefixer = require('gulp-autoprefixer');
const cssminify = require('gulp-clean-css');
// handlebars
const hb = require('gulp-hb');
const layouts = require('handlebars-layouts');
const helpers = require('handlebars-helpers');
// data
const argv = require('yargs').alias('l', 'language').alias('x', 'exclude').argv;
const _ = require('lodash');
const db = require('./static-db');

//
// set up & config
//

const language = 'en-US';
const env = process.env.NODE_ENV || 'development';
var database = {};

//
// data
//

// get most recent data
gulp.task('db:sync', function(cb) {
  // --exclude was passed
  if (argv['exclude']) {
    gutil.log(gutil.colors.magenta('excluding db sync'));
    return cb();
  }

  db.sync()
    .then(function() {
      return cb();
    })
    .catch(function(err)  {
      console.log(err);
      return cb();
    }
  );
});

// load and transform the data
gulp.task('db:load', function() {
  // queries
  database['podcast'] = db.get_all(language, 'podcast')[0];
  let volumes = db.get_all(language, 'volume');
  let episodes = db.get_all(language, 'episode');

  // sort - volumes
  volumes = _.orderBy(volumes, ['createdAt'], ['desc']);
  database['volumes'] = volumes;

  // sort - episodes
  episodes = _.orderBy(episodes, ['volume.createdAt', 'createdAt'], ['desc', 'desc']);
  database['episodes'] = episodes;

  // transform - podcast
  database['podcast']['pubDate'] = database['podcast'].createdAt.toUTCString();

  // transform - episodes
  _.each(database.episodes, (episode) => {
    episode['media'] = `https:${episode.asset.file.url}`;
    episode['pubDate'] = episode.createdAt.toUTCString();
  });
});

//
// js
//

gulp.task('clean:js', function() {
  return del([
    './public/js/**'
  ]);
});

gulp.task('build:js', ['clean:js'], function() {
  gulp.src('./src/js/*.min.js')
    .pipe(gulp.dest('./public/js/'))
    .pipe(browser.reload( { stream: true} ));
  gulp.src('./src/js/main.js')
    .pipe(jsminify({ ext: { src:'-debug.js', min:'.js' } } ))
    // .pipe(jsminify({ ext: { src:'-debug.js', min:'.js' }, ignoreFiles: ['*min.js'] } ))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('./public/js/'))
    .pipe(browser.reload( { stream: true} ));
});

//
// html & rss
//

gulp.task('clean:views', function() {
  return del([
    './public/**/*.rss',
    './public/**/index.html',
    './public/volumes/*',
    './public/episodes/*'
  ]);
});

gulp.task('build:views', ['clean:views'], function() {
  var data = {
    podcast: database.podcast,
    volumes: database.volumes,
    episodes: database.episodes,
  };

  // volume landing pages
  _.each(database.volumes, (volume) => {
    console.log(volume.number, volume.slug);

    let episodes =  _.filter(database.episodes, function (episode) {
      if (episode.volume.number === volume.number) {
        return episode;
      }
    });

    _.each(episodes, (episode) => {
      console.log('\t', episode.volume.number, episode.slug);
    });

    let data = {
      podcast: database.podcast,
      volume: volume,
      episodes: episodes
    }
    gulp
      .src('./src/templates/volume.hbs')
      .pipe(hb()
        .partials('./src/templates/layouts/main.hbs')
        .helpers(layouts)
        .data(data)
      )
      .pipe(rename(`${volume.slug}.html`))
      .pipe(gulp.dest('./public/volumes'))
      .pipe(browser.reload( { stream: true} ));
  });

  // episode landing pages
  _.each(database.episodes, (episode) => {
    console.log(episode.volume.number, episode.number, episode.slug);
  });

  // index
  gulp
    .src('./src/templates/index.hbs')
    .pipe(hb()
      .data(data)
    )
    .pipe(rename('index.html'))
    .pipe(gulp.dest('./public/'))
    .pipe(browser.reload( { stream: true} ));

  // rss feed
  gulp
    .src('./src/templates/feed.hbs')
    .pipe(hb()
      .data(data)
    )
    .pipe(rename('feed.rss'))
    .pipe(gulp.dest('./public/'))
    .pipe(browser.reload( { stream: true} ));
});

//
// css
//

gulp.task('clean:css', function() {
  return del([
    './public/css/**'
  ]);
});

gulp.task('build:css', ['clean:css'], function() {
  gulp.src('./src/css/*.min.css')
    .pipe(gulp.dest('./public/css/'))
    .pipe(browser.reload( { stream: true} ));
  return gulp.src('./src/css/main.css')
    .pipe(autoprefixer())
    .pipe(cssminify())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('./public/css/'))
    .pipe(browser.reload( { stream: true} ));
});

//
// generate the website
//

gulp.task('generate', function(cb) {
  sequence('db:sync', 'db:load', 'build:js', 'build:views', 'build:css', cb);
});

//
// dev build
//

gulp.task('reload', function() {
  browser.init({
    server: {
      baseDir: './public'
    },
  })
});

gulp.task('dev', ['reload', 'generate'], function(){
  gulp.watch('./src/js/*', ['build:js']);
  gulp.watch('./src/css/*', ['build:css']);
  gulp.watch('./src/templates/**/*', ['build:views']);
})

gulp.task('dev:build:views', ['db:load', 'build:views'], function() {
});

//
// production build
//

gulp.task('build', ['generate'], function() {
});
