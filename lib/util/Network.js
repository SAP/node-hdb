// Copyright 2026 SAP AG.
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

function _isHex(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||    // 0-9
    (code >= 65 && code <= 70) ||    // A-F
    (code >= 97 && code <= 102)      // a-f
  );
}
function _isAlphaNum(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||    // 0-9
    (code >= 65 && code <= 90) ||    // A-Z
    (code >= 97 && code <= 122)      // a-z
  );
}

/**
 * Loose check of whether or not the provided string of characters can be an IPv6, Mapped
 * IPv4, IPv4 or Hostname address.
 * Any enclosing brackets should have already been removed by the caller.
 * A value is a valid IPv6 address if:
 *  - address if it has more than one colon, and any other characters, Hex character or .,
 *  - if an Interface is specified (<address> %<interface>), everything after the start is alphanumeric
 *  - if a CIDR mask is specified (<address>/<CIDR Mask>), everything after the start is a digit
 *  - The host is assumed to have no port
 * A value is a valid IPv4/hostname address if
 *  - It contains alphanumeric characters, -, ., _
 *    (_ is not valid according to RFC but supported by some OS's and DNS)
 *  - if an Interface is specified (<address>%<interface>), everything after the start is alphanumeric
 *  - if a CIDR mask is specified (<address>/<CIDR Mask>), everything after the start is a digit
 *  - it optionally has exactly one colon (represented by inLastColon) followed by a port. Before
 *    the colon for the port there can optionally be exactly one run of whitespace characters
 *    (<address><space>:<port>)
 */
function _validateHostnameCharacters(addr, lastColonIdx) {
  let valid = true;
  let hasInvalidHostnameChars = false;
  let hasInvalidIPv6Chars = false;
  let isInterface = false;
  let isCIDR = false;
  let whitespaceCount = 0;
  let ipv6 = false;
  let colonCount = 0;
  let addressEnd = lastColonIdx >= 0 ? lastColonIdx : addr.length;

  for (let i = 0; i < addressEnd; i++) {
    const currentChar = addr[i];
    if (currentChar === ':') {
      colonCount++;
      if (!ipv6) {
        if (lastColonIdx >= 0 && i !== lastColonIdx) {
          ipv6 = true;
          addressEnd = addr.length;
        } else if (colonCount > 1) {
          ipv6 = true;
        }
      }
    } else if (/\s/.test(currentChar)) {
      hasInvalidIPv6Chars = true; // No space allowed within the IPv6 address
      whitespaceCount++;
      // skip run of whitespace
      while (i + 1 < addressEnd && /\s/.test(addr[i + 1])) {
        i++;
      }
    } else if (ipv6 && !isInterface && currentChar === '%') {
      isInterface = true;
      hasInvalidHostnameChars = true; // IPv4 doesn't have an interface specifier
    } else if (ipv6 && !isCIDR && currentChar === '/') {
      isCIDR = true;
    } else {
      const isHex = _isHex(currentChar);
      const isAlphaNum = _isAlphaNum(currentChar);
      if (isInterface || isCIDR) {
        hasInvalidIPv6Chars = hasInvalidIPv6Chars || !isAlphaNum;
        hasInvalidHostnameChars = hasInvalidHostnameChars || !isAlphaNum;
      } else {
        hasInvalidIPv6Chars = hasInvalidIPv6Chars || (!isHex && currentChar !== '.');
        hasInvalidHostnameChars =
          hasInvalidHostnameChars ||
          whitespaceCount > 0 ||
          (currentChar !== '-' && currentChar !== '.' && currentChar !== '_' && !isAlphaNum);
      }
    }
  }

  if (ipv6) {
    valid = !hasInvalidIPv6Chars;
  } else {
    valid = !hasInvalidHostnameChars;
  }
  if (addressEnd === 0) {
    valid = false;
  }
  return {valid, hostLen: addressEnd};
}

/**
 * Left and right trim whitespace and check for non-ascii character
 * @summary Helper for splitAddressStr
 * @param {string} addrStr address string
 * @returns {Object} {valid: boolean, addr: string, ascii: boolean}:
 *  - valid: false if addrStr is not a string or only whitespace
 *  - addr: trimmed addrStr
 *  - ascii: false if addrStr contains non-ascii characters
 */
function _checkAndTrimAddrStr(addrStr) {
  if (typeof addrStr !== 'string' || addrStr.length === 0) {
    return {valid: false, addr: '', ascii: true};
  }
  let ascii = true;
  for (let i = 0; i < addrStr.length; i++) {
    if (addrStr.charCodeAt(i) === 0 || addrStr.charCodeAt(i) >= 0x80) {
      ascii = false;
    }
  }
  addrStr = addrStr.trim();
  if (addrStr.length === 0) {
    return {valid: false, addr: '', len: 0, ascii};
  }
  return {valid: true, addr: addrStr, ascii};
}

/**
 * Parses string contains port information
 * @param {colonPortStr} string starting with colon and containing port number
 * @returns {Object} {valid: boolean, port: number}
 * TODO: Parsing invalid formats looks like unnecessary, perhaps could do all of
 * this method's checking with one match: /^:(\d+)$/ (valid with no leading or
 * trailing).
 */
function _parseColonPort(colonPortStr) {
  // colon port string should always start with ':'
  if (!colonPortStr.startsWith(':')) {
    return {valid: false, port: 0};
  }

  let portStr = colonPortStr.slice(1);
  let valid = true;
  if (portStr.length === 0 || /\s/.test(portStr[0])) {
    // Disallow whitespace after colon, but parse it anyway
    valid = false;
  }
  portStr = portStr.replace(/^\s+/, '');
  // Find the first run of digits
  const match = portStr.match(/^(\d+)/);
  if (!match) {
    return {valid: false, port: 0};
  }
  const port = parseInt(match[1], 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return {valid: false, port: 0};
  }
  // Check for invalid characters after the port digits
  // If any non-whitespace remains after the port digits, mark as invalid
  const afterPort = portStr.slice(match[1].length);
  valid = valid && !(afterPort.length > 0 && !/^\s*$/.test(afterPort));

  return {valid, port};
}

/**
 * Parses an IPv6 (or IPv4 or domain name) address string with an optional port.
 * @param {string} addrStr string containing address/hostname and optionally port
 * @returns {Object} {valid: boolean, parsedHost: string, parsedPort: number}:
 *  - valid: false if the input address string is invalid
 *  - parsedHost, parsedPort: the parsed host and port
 */
function splitAddressStr(addrStr) {
  const {valid: addrStrValid, addr: trimmedAddr, ascii} = _checkAndTrimAddrStr(addrStr);
  if (!addrStrValid) {
    return {valid: addrStrValid, parsedHost: '', parsedPort: 0};
  }

  // IPv6 in brackets
  if (trimmedAddr[0] === '[') {
    const endBracket = trimmedAddr.lastIndexOf(']');
    if (endBracket > 0) {
      // IPv6 format address in ^\[IPv6\](.?)* format
      const parsedHost = trimmedAddr.slice(1, endBracket);
      let hostValid = parsedHost.length !== 0 && !parsedHost.includes('[') && !parsedHost.includes(']');
      if (hostValid) {
        ({valid: hostValid} = _validateHostnameCharacters(parsedHost, -1));
      }

      // no port -> only validate parsed hostname
      const afterBracket = trimmedAddr.slice(endBracket + 1);
      const noPort = afterBracket.length === 0;
      if (noPort) {
        return {valid: hostValid && ascii, parsedHost, parsedPort: 0};
      }
      // port exists -> parse port
      const {valid: portValid, port: parsedPort} = _parseColonPort(afterBracket);

      return {valid: hostValid && portValid && ascii, parsedHost, parsedPort};
    } else {
      // [ with no matching ]
      return {valid: false, parsedHost: trimmedAddr, parsedPort: 0};
    }
  }

  const lastColonIdx = trimmedAddr.lastIndexOf(':');
  const {valid: hostValid, hostLen} = _validateHostnameCharacters(trimmedAddr, lastColonIdx);
  const noPort = hostLen === trimmedAddr.length;
  if (noPort) {
    return {valid: ascii && hostValid, parsedHost: trimmedAddr, parsedPort: 0};
  }
  const parsedHost = trimmedAddr.slice(0, hostLen);
  const colonPortStr = trimmedAddr.slice(hostLen);
  const {valid: portValid, port: parsedPort} = _parseColonPort(colonPortStr);
  return {valid: ascii && hostValid && portValid, parsedHost, parsedPort};
}

module.exports = {
  splitAddressStr,
};
