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
/* jshint expr: true */

var lib = require('../lib');
var TypeCode = lib.common.TypeCode;
var ResultSetAttributes = lib.common.ResultSetAttributes;
var LobSourceType = lib.common.LobSourceType;
var LobOptions = lib.common.LobOptions;
var ResultSet = lib.ResultSet;
var Lob = lib.Lob;

function writeInt(i) {
  var buffer = new Buffer(3);
  buffer[0] = 1;
  buffer.writeInt16LE(i, 1);
  return buffer;
}

function writeString(str) {
  var length = Buffer.byteLength(str);
  var buffer = new Buffer(length + 1);
  buffer[0] = length;
  buffer.write(str, 1);
  return buffer;
}

function writeLob(locatorId) {
  /* jshint bitwise:false */
  var buffer = new Buffer(32);
  buffer.fill(0);
  buffer[0] = LobSourceType.NCLOB;
  buffer[1] = LobOptions.DATA_INCLUDED | LobOptions.LAST_DATA;
  buffer.writeInt32LE(locatorId, 20);
  return buffer;
}

function LobStub(ld) {
  this.locatorId = ld.locatorId;
  this.error = undefined;
}

LobStub.prototype.read = function read(cb) {
  var self = this;
  setImmediate(function () {
    if (self.error) {
      return cb(self.error);
    }
    cb(null, self.locatorId);
  });
};

function ConnectionMock(id, chunks) {
  this.id = id;
  this.closed = false;
  this._chunks = chunks;
}

ConnectionMock.prototype.closeResultSet = function (options, cb) {
  this.id.should.equal(options.resultSetId);
  var self = this;
  setImmediate(function () {
    self.closed = true;
    cb(null);
  });
};

ConnectionMock.prototype.fetchNext = function fetchNext(options, cb) {
  this.id.should.equal(options.resultSetId);
  ResultSet.DEFAULT_FETCH_SIZE.should.equal(options.fetchSize);
  var self = this;
  setImmediate(function () {
    cb(null, {
      resultSets: [{
        data: self._chunks.shift()
      }]
    });
  });
};

function readSimpleStream(rs, stream, cb) {
  var chunks = [];
  stream.on('readable', function onreadable() {
    var chunk = stream.read();
    if (chunk !== null) {
      chunks.push(chunk);
    }
  });
  rs.once('error', function onerror(err) {
    cb(err);
  });
  rs.once('end', function onend() {
    cb(null, chunks);
  });
}

function createResultSet(rsd, chunks, options) {
  var connection = new ConnectionMock(rsd.id, chunks);
  var resultSet = ResultSet.create(connection, rsd, options);
  resultSet.createLob = function createLob(ld) {
    if (ld.locatorId[0] === 11) {
      return ld.locatorId;
    }
    var lob = new LobStub({
      locatorId: ld.locatorId
    });
    options = options || {};
    if (options.readError && options.readError.id === ld.locatorId[0]) {
      lob.error = options.readError;
    }
    return lob;
  };
  connection.should.equal(resultSet._connection);
  return resultSet;
}

function createSimpleResultSet(options) {
  /* jshint bitwise:false */
  var rsd = {
    id: new Buffer([1, 0, 0, 0, 0, 0, 0, 0]),
    metadata: [{
      dataType: TypeCode.SMALLINT,
      columnDisplayName: 'SMALLINT'
    }],
    data: null
  };
  var chunks = [{
    argumentCount: 1,
    attributes: ResultSetAttributes.FIRST,
    buffer: Buffer.concat([
      writeInt(1),
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.NEXT,
    buffer: Buffer.concat([
      writeInt(2),
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.NEXT,
    buffer: Buffer.concat([
      writeInt(3),
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.NEXT,
    buffer: Buffer.concat([
      writeInt(4),
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.LAST |
      ResultSetAttributes.CLOSED,
    buffer: Buffer.concat([
      writeInt(5),
    ])
  }];
  return createResultSet(rsd, chunks, options);
}

function createResultSetWithLob(options) {
  var rsd = {
    id: new Buffer([1, 0, 0, 0, 0, 0, 0, 0]),
    metadata: [{
      dataType: TypeCode.SMALLINT,
      columnDisplayName: 'SMALLINT'
    }, {
      dataType: TypeCode.NVARCHAR,
      columnDisplayName: 'NVARCHAR'
    }, {
      dataType: TypeCode.NCLOB,
      columnDisplayName: 'NCLOB'
    }],
    data: {
      argumentCount: 1,
      attributes: ResultSetAttributes.FIRST,
      buffer: Buffer.concat([
        writeInt(1),
        writeString('foo'),
        writeLob(47)
      ])
    }
  };
  var chunks = [{
    argumentCount: 1,
    attributes: ResultSetAttributes.NEXT,
    buffer: Buffer.concat([
      writeInt(2),
      writeString('bar'),
      writeLob(11)
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.LAST,
    buffer: Buffer.concat([
      writeInt(3),
      writeString('abc'),
      writeLob(123)
    ])
  }];

  return createResultSet(rsd, chunks, options);
}

function createResultSetWithoutLob(options) {
  /* jshint bitwise:false */
  var rsd = {
    id: new Buffer([1, 0, 0, 0, 0, 0, 0, 0]),
    metadata: [{
      dataType: TypeCode.SMALLINT,
      columnDisplayName: 'SMALLINT'
    }, {
      dataType: TypeCode.NVARCHAR,
      columnDisplayName: 'NVARCHAR'
    }],
    data: {
      argumentCount: 1,
      attributes: ResultSetAttributes.FIRST,
      buffer: Buffer.concat([
        writeInt(1),
        writeString('foo')
      ])
    }
  };
  var chunks = [{
    argumentCount: 1,
    attributes: ResultSetAttributes.NEXT,
    buffer: Buffer.concat([
      writeInt(2),
      writeString('bar')
    ])
  }, {
    argumentCount: 1,
    attributes: ResultSetAttributes.LAST |
      ResultSetAttributes.CLOSED,
    buffer: Buffer.concat([
      writeInt(3),
      writeString('abc')
    ])
  }];
  return createResultSet(rsd, chunks, options);
}

describe('Lib', function () {

  describe('#ResultSet', function () {

    it('should create a simple resultSet', function () {
      var rs = createSimpleResultSet({
        rowsAsArray: true
      });
      // columnNameProperty
      rs.columnNameProperty.should.be.false;
      // fetchSize
      rs.setFetchSize(128);
      rs.fetchSize.should.equal(128);
      rs.setFetchSize(ResultSet.MAX_FETCH_SIZE + 1);
      rs.fetchSize.should.equal(ResultSet.MAX_FETCH_SIZE);
      // averageRowLength
      rs.setAverageRowLength(256);
      rs.averageRowLength.should.equal(256);
      // readSize
      rs.setReadSize(1024);
      rs.readSize.should.equal(1024);
      rs.setReadSize(Lob.MAX_READ_SIZE + 1);
      rs.readSize.should.equal(Lob.MAX_READ_SIZE);
      // createLob
      var lob = ResultSet.prototype.createLob.call({}, {
        locatorId: new Buffer([1, 0, 0, 0, 0, 0, 0, 0])
      });
      lob.should.be.instanceof(Lob);
    });

    it('should fetch all rows of a simple resultSet with metadata', function () {
      var rs = createSimpleResultSet({
        rowsWithMetadata: true
      });
      // columnNameProperty
      rs._settings.rowsWithMetadata.should.be.true;
      rs.fetch(function (err, rows) {
        rows.should.eql([{
          SMALLINT: 1,
        }, {
          SMALLINT: 2,
        }, {
          SMALLINT: 3,
        }, {
          SMALLINT: 4,
        }, {
          SMALLINT: 5,
        }]);
        rows.metadata.should.eql([{
          dataType: 2,
          columnDisplayName: 'SMALLINT'
        }]);
      });
    });

    it(
      'should fetch all rows with a LOB and resultSet already closed',
      function (
        done) {
        var rs = createResultSetWithLob();
        rs.fetch(function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should.eql([{
            SMALLINT: 1,
            NVARCHAR: 'foo',
            NCLOB: new Buffer([47, 0, 0, 0, 0, 0, 0, 0])
          }, {
            SMALLINT: 2,
            NVARCHAR: 'bar',
            NCLOB: new Buffer([11, 0, 0, 0, 0, 0, 0, 0])
          }, {
            SMALLINT: 3,
            NVARCHAR: 'abc',
            NCLOB: new Buffer([123, 0, 0, 0, 0, 0, 0, 0])
          }]);
          rs.finished.should.be.true;
          rs.closed.should.be.true;
          done();
        });
      });

    it(
      'should fetch all rows with a LOB and rowsAsArray set',
      function (
        done) {
        var rs = createResultSetWithLob();
        rs._settings.rowsAsArray = true;
        rs.fetch(function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should.eql([[
            1,
            'foo',
            new Buffer([47, 0, 0, 0, 0, 0, 0, 0])
          ], [
            2,
            'bar',
            new Buffer([11, 0, 0, 0, 0, 0, 0, 0])
          ], [
            3,
            'abc',
            new Buffer([123, 0, 0, 0, 0, 0, 0, 0])
          ]]);
          rs.finished.should.be.true;
          rs.closed.should.be.true;
          done();
        });
      });

    it(
      'should fetch all rows without a LOB and resultSet already closed',
      function (done) {
        var rs = createResultSetWithoutLob();
        rs.fetch(function (err, rows) {
          if (err) {
            return done(err);
          }
          rows.should.eql([{
            SMALLINT: 1,
            NVARCHAR: 'foo'
          }, {
            SMALLINT: 2,
            NVARCHAR: 'bar'
          }, {
            SMALLINT: 3,
            NVARCHAR: 'abc'
          }]);
          rs.finished.should.be.true;
          rs.closed.should.be.true;
          done();
        });
      });

    it('should close the resultSet before all rows are fetched',
      function (done) {
        var rs = createSimpleResultSet();
        var stream = rs.createReadStream();
        stream._readableState.objectMode.should.be.true;
        var rows = [];
        stream.on('readable', function onreadable() {
          var row = stream.read();
          if (row) {
            rows.push(row);
            if (row.SMALLINT === 2) {
              rs.pause();
              setTimeout(function () {
                rs.resume();
              }, 1);
            }
            if (row.SMALLINT === 3) {
              rs.close();
            }
          }
        });
        rs.once('end', function onend() {
          rows.should.eql([{
            SMALLINT: 1,
          }, {
            SMALLINT: 2,
          }, {
            SMALLINT: 3,
          }]);
          rs.finished.should.be.true;
          rs.closed.should.be.false;
        });
        rs.once('close', function onend() {
          rs.closed.should.be.true;
          done();
        });
      });

    it('should create an array stream and close the resultSet ' +
      'at the first readable event',
      function (done) {
        var rs = createSimpleResultSet();
        var stream = rs.createReadStream({
          arrayMode: true
        });
        stream._readableState.objectMode.should.be.true;
        var rows = [];
        stream.once('readable', function onreadable() {
          rows = rows.concat(stream.read());
          rs.close();
        });
        rs.once('end', function onend() {
          rows.should.eql([{
            SMALLINT: 1,
          }]);
          rs.finished.should.be.true;
          rs.closed.should.be.false;
        });
        rs.once('close', function onend() {
          rs.closed.should.be.true;
          done();
        });
      });

    it('should create a binary stream and read all data', function (
      done) {
      var rs = createSimpleResultSet();
      var stream = rs.createReadStream({
        objectMode: false
      });
      stream._readableState.objectMode.should.be.false;
      readSimpleStream(rs, stream, function (err, chunks) {
        (!err).should.be.ok;
        Buffer.concat(chunks).should.eql(new Buffer(
          [1, 1, 0, 1, 2, 0, 1, 3, 0, 1, 4, 0, 1, 5, 0]
        ));
        rs.finished.should.be.true;
        rs.closed.should.be.true;
        done();
      });
    });

    it('should try to create a binary stream in running mode', function () {
      var rs = createSimpleResultSet();
      rs._running = true;
      var stream = rs.createBinaryStream();
      (stream === null).should.be.ok;
    });

    it('should create an array stream', function (done) {
      var rs = createSimpleResultSet();
      var stream = rs.createArrayStream(2);
      readSimpleStream(rs, stream, function (err, chunks) {
        (!err).should.be.ok;
        chunks.should.eql([
          [{
            SMALLINT: 1
          }, {
            SMALLINT: 2
          }],
          [{
            SMALLINT: 3
          }, {
            SMALLINT: 4
          }]
        ]);
        rs.finished.should.be.true;
        rs.closed.should.be.true;
        done();
      });
    });

    it('should fail closing the resultSet', function (done) {
      var closeError = new Error('CLOSE_ERROR');
      var rs = createSimpleResultSet();
      var connection = rs._connection;
      connection.closeResultSet = function closeResultSet(options, cb) {
        ConnectionMock.prototype.closeResultSet.call(connection, options, function (err) {
          cb(err || closeError);
        });
      };
      rs.close(function (err) {
        err.should.equal(closeError);
        done();
      });
    });

    it('should fail fetching data', function (done) {
      var fetchError = new Error('FETCH_ERROR');
      var rs = createSimpleResultSet();
      var connection = rs._connection;
      var count = 0;
      connection.fetchNext = function fetchNext(options, cb) {
        ConnectionMock.prototype.fetchNext.call(connection, options, function (err, reply) {
          if (++count > 2) {
            return cb(fetchError);
          }
          cb(err, reply);
        });
      };
      rs.fetch(function (err) {
        err.should.equal(fetchError);
        done();
      });
    });

    it('should fail reading lobs', function (done) {
      var readError = {};
      // readError = new Error('READ_ERROR');
      readError.id = 123;
      var rs = createResultSetWithLob({
        readError: readError
      });
      rs.fetch(function (err) {
        err.should.equal(readError);
        done();
      });
    });

  });
});
