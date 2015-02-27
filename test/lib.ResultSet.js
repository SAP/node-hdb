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

var lib = require('./hdb').lib;
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
}

LobStub.prototype.read = function read(cb) {
  var self = this;
  setImmediate(function () {
    cb(null, self.locatorId);
  });
};

function ConnectionMock(options) {
  this.id = options.id;
  this.closed = false;
  this._chunks = options.chunks;
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

function createResultSet(options) {
  options.data = options.data || options.chunks.shift();
  var connection = new ConnectionMock(options);
  var resultSet = ResultSet.create(connection, options);
  resultSet.createLob = function createLob(ld) {
    return new LobStub({
      locatorId: ld.locatorId
    });
  };
  connection.should.equal(resultSet._connection);
  return resultSet;
}

function createSimpleResultSet() {
  /* jshint bitwise:false */
  var options = {
    id: new Buffer([1, 0, 0, 0, 0, 0, 0, 0]),
    metadata: [{
      dataType: TypeCode.SMALLINT,
      columnDisplayName: 'SMALLINT'
    }],
    data: {
      argumentCount: 1,
      attributes: ResultSetAttributes.FIRST,
      buffer: Buffer.concat([
        writeInt(1),
      ])
    },
    chunks: [{
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
    }]
  };
  return createResultSet(options);
}

function createResultSetWithLob() {
  var options = {
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
    },
    chunks: [{
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
    }]
  };
  return createResultSet(options);
}

function createResultSetWithoutLob() {
  /* jshint bitwise:false */
  var options = {
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
    },
    chunks: [{
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
    }]
  };
  return createResultSet(options);
}

describe('Lib', function () {

  describe('#ResultSet', function () {

    it('should create a simple resultSet', function () {
      var rs = createSimpleResultSet();
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
      var lob = ResultSet.prototype.createLob({
        locatorId: new Buffer([1, 0, 0, 0, 0, 0, 0, 0])
      });
      lob.should.be.instanceof(Lob);
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
      var chunks = [];
      stream.on('readable', function onreadable() {
        var chunk = stream.read();
        if (chunk !== null) {
          chunks.push(chunk);
        }
      });
      rs.once('end', function onend() {
        Buffer.concat(chunks).should.eql(new Buffer(
          [1, 1, 0, 1, 2, 0, 1, 3, 0, 1, 4, 0, 1, 5, 0]
        ));
        rs.finished.should.be.true;
        rs.closed.should.be.true;
      });
      rs.once('close', function onend() {
        done();
      });
    });

  });
});