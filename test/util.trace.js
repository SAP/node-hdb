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

var packetTracer = require('../lib/util/trace/PacketTracer')

var data = require('./fixtures/packetTraceData');

describe('Util', function () {

  describe('#trace', function () {

    it('should trace an authenticate request', function (done) {
      var test = data.AUTHREQUEST;
      var traceStr = packetTracer.parseRequest(test.packet);
      var traceLines = traceStr.split('\n');
      // Remove trailing new lines
      while(traceLines.length > 0 && traceLines[traceLines.length - 1] === '') {
        traceLines.pop();
      }
      traceLines.length.should.eql(test.trace.length);
      // Check without timestamp next to <REQUEST>
      traceLines[0].should.startWith(test.trace[0]);
      for (var i = 1; i < test.trace.length; i++) {
        traceLines[i].should.eql(test.trace[i]);
      }
      done();
    });

    it('should trace a select reply', function (done) {
        var test = data.REPLY;
        var traceStr = packetTracer.parseReply(test.packet);
        var traceLines = traceStr.split('\n');
        // Remove trailing new lines
        while(traceLines.length > 0 && traceLines[traceLines.length - 1] === '') {
          traceLines.pop();
        }
        traceLines.length.should.eql(test.trace.length);
        // Check without timestamp next to <REPLY>
        traceLines[0].should.startWith(test.trace[0]);
        for (var i = 1; i < test.trace.length; i++) {
          traceLines[i].should.eql(test.trace[i]);
        }
        done();
      });

  });

});
