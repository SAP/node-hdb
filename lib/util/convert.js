'use strict';

var iconv = require('iconv-lite');

exports.encode = encode;
exports.decode = decode;
exports.lengthInCesu8 = lengthInCesu8;

function encode(text, useCesu8) {
  return (useCesu8) ?
    iconv.encode(text, 'cesu8') :
    new Buffer(text, 'utf-8');
}

function decode(buffer, useCesu8) {
  return (useCesu8) ?
    iconv.decode(buffer, 'cesu8') :
    buffer.toString('utf-8');
}

function lengthInCesu8(buffer, combineSurrogates = true) {
  var text = iconv.decode(buffer, 'cesu8');
  var len = 0;
  if (combineSurrogates) {
    // count surrogate pairs as a single char (String.length counts it as 2)
    var code = 0;
    for (var i = 0; i < text.length; i++) {
      code = text.charCodeAt(i);
      if (0xD800 <= code && code <= 0xDBFF) { i++; }
      len++;
    }
  } else {
    len = text.length;
  }
  return len;
}
