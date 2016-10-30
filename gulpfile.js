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
  database['episodes'] = db.get_all(language, 'episode');

  // transform - podcast
  let podcast_publish_date = database['podcast'].publishDate;
  let podcast_pub_date = new Date(podcast_publish_date).toUTCString();
  database['podcast']['pubDate'] = podcast_pub_date;

  // transform - episodes
  _.each(database.episodes, (episode) => {
    episode['media'] = `https:${episode.asset.file.url}`;
    let episode_publish_date = episode.publishDate;
    let episode_pub_date = new Date(episode_publish_date).toUTCString();
    episode['pubDate'] = episode_pub_date;
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
  return gulp.src('./src/js/*')
    .pipe(jsminify({ ext: { src:'-debug.js', min:'.js' }, ignoreFiles: ['*min.js'] } ))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('./public/js/'))
    .pipe(browser.reload( { stream: true} ));
});

//
// html & rss
//

gulp.task('clean:views', function() {
  return del([
    './public/**/index.html',
    './public/**/*.rss'
  ]);
});

gulp.task('build:views', ['clean:views'], function() {
  var data = {
    podcast: database.podcast,
    episodes: database.episodes
  };
  // landing page
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

gulp.task('generate', ['build:js', 'build:views', 'build:css', 'db:sync', 'db:load'], function() {
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
})

gulp.task('dev', ['reload', 'generate'], function(){
  gulp.watch('./src/js/*', ['build:js']);
  gulp.watch('./src/css/*', ['build:css']);
  gulp.watch('./src/templates/**/*', ['build:views']);
})

//
// production build
//

gulp.task('build', ['generate'], function() {
});
