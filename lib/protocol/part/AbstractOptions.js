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

var util = require('../../util');

module.exports = AbstractOptions;

function AbstractOptions() {}

AbstractOptions.prototype.getOptions = function getOptions() {
  var self = this;

  function getOption(name) {
    var propertyName = util._2cc(self.PROPERTY_NAMES[name]);
    var value = self[propertyName];
    var type = self.TYPES[name];
    return {
      name: name,
      value: value,
      type: type
    };
  }
  return this.KEYS.map(getOption).filter(function(option) {
    return (typeof option.value !== 'undefined');
  });
};

AbstractOptions.prototype.setOptions = function setOptions(options) {
  var self = this;

  if (!Array.isArray(options)) {
    return;
  }

  function hasProperty(option) {
    return Object.prototype.hasOwnProperty.call(self.PROPERTY_NAMES, option.name);
  }

  function setOption(option) {
    self[util._2cc(self.PROPERTY_NAMES[option.name])] = option.value;
  }
  options.filter(hasProperty).forEach(setOption);
};
