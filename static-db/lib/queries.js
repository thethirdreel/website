'use strict'

const _ = require('lodash');

module.exports = function(db) {
  var module = {};

  module.get_by_id = function(language, id) {
    var localized_db = db.load(language);
    return localized_db.itemsById[id];
  }

  module.get_all = function(language, content_type) {
    var localized_db = db.load(language);
    var items = _.filter(localized_db.items, { contentType: content_type });
    return _.orderBy(items, ['slug'], ['asc']);
  }

  module.get_all_where = function(language, content_type, field, val) {
    var collection = module.get_all(language, content_type);
    return  _.filter(collection, function (entry) {
      if (entry[field] && entry[field].id === val) {
        return entry;
      }
    });
  }

  return module;
};
