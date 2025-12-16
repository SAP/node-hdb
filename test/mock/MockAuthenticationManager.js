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

 module.exports = MockAuthenticationManager;

 function MockAuthenticationManager(options) {
   this.options = options;
 }

 MockAuthenticationManager.create = function createManager(options) {
   return new MockAuthenticationManager(options);
 };

 MockAuthenticationManager.prototype.initialData = function initialData() {
   if (this.options.initialDataError) {
     return this.options.initialDataError;
   }
   return 'INITIAL';
 };

 MockAuthenticationManager.prototype.initialize = function initialize(data, cb) {
   if (this.options.initializeError) {
     return cb(this.options.initializeError);
   }
   data.should.equal('INITIAL');
   cb();
 };

 MockAuthenticationManager.prototype.finalData = function initialData() {
   if (this.options.finalDataError) {
     return this.options.finalDataError;
   }
   return 'FINAL';
 };

 MockAuthenticationManager.prototype.finalize = function finalize(data) {
   if (this.options.finalizeError) {
     throw this.options.finalizeError;
   }
   data.should.equal('FINAL');
 };
