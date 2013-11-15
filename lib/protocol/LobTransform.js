// Copyright 2013 SAP AG.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http: //www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an 
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific 
// language governing permissions and limitations under the License.
'use strict';

var util = require('../util');
var Transform = util.stream.Transform;
var Lob = require('./Lob');

module.exports = LobTransform;

util.inherits(LobTransform, Transform);

function LobTransform(connection, names, options) {
  options = options || {};
  options.objectMode = true;
  Transform.call(this, options);
  // private
  this._connection = connection;
  this._names = names;
}

LobTransform.create = function createLobTransform(connection, names, options) {
  return new LobTransform(connection, names, options);
};

LobTransform.prototype._transform = function _transform(thing, encoding, done) {
  if (util.isArray(thing)) {
    transformRows.call(this, thing, done);
  } else {
    transformRow.call(this, thing, done);
  }
};

function transformRows(rows, done) {
  /* jshint validthis:true */
  var self = this;
  var i = 0;

  function handleRow(err) {
    if (err) {
      return done(err);
    }
    // next row
    i += 1;
    next();
  }

  function next() {
    if (i === rows.length) {
      return done(null, rows);
    }
    util.setImmediate(transformRow.bind(self, rows[i], handleRow));
  }
  next();
}

function transformRow(row, done) {
  /* jshint validthis:true */
  var self = this;
  var i = 0;

  function receiveLob(err, buffer) {
    if (err) {
      return done(err);
    }
    // update lob
    row[self._names[i]] = buffer;
    // next lob
    i += 1;
    next();
  }

  function next() {
    if (i === self._names.length) {
      return done(null, row);
    }
    var ld = row[self._names[i]];
    if (ld === null || Buffer.isBuffer(ld)) {
      return receiveLob(null, ld);
    }
    readLob.call(self, ld, receiveLob);
  }
  next();
}

function readLob(ld, cb) {
  /* jshint validthis:true */
  Lob.create(this._connection, ld).read(cb);
}