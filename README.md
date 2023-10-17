hdb - Pure JavaScript SAP HANA Database Client
==============================================

[![Version](https://img.shields.io/npm/v/hdb.svg?style=flat-square)](https://npmjs.org/package/hdb)
[![Build](https://img.shields.io/travis/SAP/node-hdb.svg?style=flat-square)](http://travis-ci.org/SAP/node-hdb)
[![Coverage](https://img.shields.io/coveralls/SAP/node-hdb/master.svg?style=flat-square)](https://coveralls.io/r/SAP/node-hdb?branch=master)
[![License](https://img.shields.io/npm/l/hdb.svg?style=flat-square)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![Downloads](https://img.shields.io/npm/dm/hdb.svg?style=flat-square)](http://npm-stat.com/charts.html?package=hdb)
[![REUSE status](https://api.reuse.software/badge/github.com/SAP/node-hdb)](https://api.reuse.software/info/github.com/SAP/node-hdb)

Table of contents
-------------

* [Install](#install)
* [SAP Support for hdb and @sap/hana-client](#sap-support-for-hdb-and-saphana-client)
* [Getting started](#getting-started)
* [Establish a database connection](#establish-a-database-connection)
* [Direct Statement Execution](#direct-statement-execution)
* [Prepared Statement Execution](#prepared-statement-execution)
* [Bulk Insert](#bulk-insert)
* [Streaming results](#streaming-results)
* [Transaction handling](#transaction-handling)
* [Streaming Large Objects](#streaming-large-objects)
* [CESU-8 encoding support](#cesu-8-encoding-support)
* [TCP Keepalive](#tcp-keepalive)
* [Setting Session-Specific Client Information](#setting-session-specific-client-information)
* [Running tests](#running-tests)
* [Running examples](#running-examples)

Install
-------

Install from npm:

```bash
npm install hdb
```

or clone from the [GitHub repository](https://github.com/SAP/node-hdb) to run tests and examples locally:

```bash
git clone https://github.com/SAP/node-hdb.git
cd node-hdb
npm install
```
SAP Support for hdb and @sap/hana-client
------------

__The hdb and [@sap/hana-client](https://www.npmjs.com/package/@sap/hana-client) Node.js SAP HANA client drivers are supported by SAP for connecting to [SAP HANA Cloud](https://www.sap.com/products/hana/cloud.html) and [SAP HANA Platform](https://www.sap.com/products/hana.html) servers. When starting a new project, it is encouraged to use the fully featured @sap/hana-client driver ([documentation](https://help.sap.com/viewer/f1b440ded6144a54ada97ff95dac7adf/latest/en-US/a5c332936d9f47d8b820a4ecc427352c.html)).__

```shell
npm install @sap/hana-client
```

Below is a major feature comparison chart between the two drivers:

| Feature	                                        | @sap/hana-client |hdb|
|-------------------------------------------------------|:----------------:|:----------------:|
| Connectivity to SAP HANA Cloud	                |:heavy_check_mark:|:heavy_check_mark:|
| Connectivity to SAP HANA as a Service	                |:heavy_check_mark:|:heavy_check_mark:|
| Connectivity to SAP HANA Platform	                |:heavy_check_mark:|:heavy_check_mark:|
| Transport Layer Security (TLS)	                |:heavy_check_mark:|:heavy_check_mark:|
| Automatic Reconnect (Transparent Session Recovery)    |:heavy_check_mark:|:x:|
| Active-Active Read Enabled	                        |:heavy_check_mark:|:x:|
| Connection Pooling (Implicit and Explicit)            |:heavy_check_mark:|:x:|
| Client-Side Data Encryption	                        |:heavy_check_mark:|:x:|
| Database Redirection                              |:heavy_check_mark:|:x:|
| Statement Distribution	                        |:heavy_check_mark:|:x:|
| Password/PBKDF2 Authentication	                |:heavy_check_mark:|:heavy_check_mark:|
| SAML Authentication	                            |:heavy_check_mark:|:heavy_check_mark:|
| JWT Authentication	                            |:heavy_check_mark:|:heavy_check_mark:|
| LDAP Authentication	                            |:heavy_check_mark:|:heavy_check_mark:|
| Kerberos Authentication	                        |:heavy_check_mark:|:x:|
| X.509 Authentication	                          |:heavy_check_mark:|:x:|
| Secure User Store Integration (hdbuserstore)	        |:heavy_check_mark:|:x:|
| Connections through HTTP proxy	                |:heavy_check_mark:|:x:|
| Connections through SOCKS proxy (SAP Cloud Connector)	|:heavy_check_mark:|:x:|
| Network Compression                                   |:heavy_check_mark:|:x:|
| Network Packet Size                                   |:heavy_check_mark:|:x:|
| Network Poll before Send                              |:heavy_check_mark:|:x:|
| Advanced Tracing via external utility or environment variables |:heavy_check_mark:|:x:|
| Tracing via environment variable to a file	        |:heavy_check_mark:|:heavy_check_mark:|
| Promise support                                   |:heavy_check_mark:|:x:|
| TypeScript support                                |:heavy_check_mark:|:x:|
| Pure JavaScript package	                        |:x:               |:heavy_check_mark:|
| Security Provider Support                         |SAP CommonCryptoLib, OpenSSL, MSCrypto|OpenSSL|
| Node.js major version support                         |See [SAP Note 3165810](https://launchpad.support.sap.com/#/notes/3165810)|All Supported Versions|
| License (without alternate SAP license agreement)     |[SAP Developer Agreement](https://tools.hana.ondemand.com/developer-license.txt)|[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html)|
| SAP Support (with SAP Support agreement)              |Component [HAN-DB-CLI](https://launchpad.support.sap.com/#incident/create)|Component [HAN-DB-CLI](https://launchpad.support.sap.com/#incident/create)|
| Community Support                                     |[answers.sap.com](https://answers.sap.com/tags/73554900100700000996) HANA tag|[node-hdb/issues](https://github.com/SAP/node-hdb/issues)

The hdb driver may also have different APIs or lack support for SAP HANA server features where the @sap/hana-client is fully supported. APIs that are the same in both drivers may have different behaviour.

Getting started
------------

If you do not have access to an SAP HANA server, go to the [SAP HANA Developer Center](https://developers.sap.com/topics/hana.html) and choose one of the options to use SAP HANA Express or deploy a new SAP HANA Cloud server.

This is a very simple example showing how to use this module:

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host     : 'hostname',
  port     : 30015,
  user     : 'user',
  password : 'secret'
});
client.on('error', function (err) {
  console.error('Network connection error', err);
});
client.connect(function (err) {
  if (err) {
  	return console.error('Connect error', err);
  }
  client.exec('select * from DUMMY', function (err, rows) {
	client.end();
    if (err) {
      return console.error('Execute error:', err);
    }
    console.log('Results:', rows);
  });
});
```

Establish a database connection
-------------------------------

The first step to establish a database connection is to create a client object. It is recommended to pass all required `connect` options like `host`, `port`, `user` and `password` to the `createClient` function. They will be used as defaults for any following connect calls on the created client instance. Options beginning with the prefix "SESSIONVARIABLE:" are used to set session-specific client information at connect time (see example of setting EXAMPLEKEY=EXAMPLEVALUE below). In case of network connection errors like a connection timeout or a database restart, you should register an error event handler in order to be able to handle these kinds of problems. If there are no error event handlers, errors will not be emitted.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host     : 'hostname',
  port     : 30015,
  user     : 'user',
  password : 'secret',
  'SESSIONVARIABLE:EXAMPLEKEY' : 'EXAMPLEVALUE'
});
client.on('error', function (err) {
  console.error('Network connection error', err);
});
console.log(client.readyState); // new
```

When a client instance is created it does not immediately open a network connection to the database host. Initially, the client is in a 'new' state. When you call `connect` for the first time, two things are done internally:

1. A network connection is established and the communication is initialized (Protocol - and Product Version exchange). Now the connection is ready for exchanging messages but no user session is established as the client is in a `disconnected` state. This step is skipped if the client is already in a `disconnected` state.

2. The authentication process is initiated. After a successful user authentication a database session is established and the client is in a `connected` state. If authentication fails the client remains in a `'disconnect'` state.

```js
client.connect(function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log(client.readyState); // connected
});
```
If user and password are specified they will override the defaults of the client. It is possible to disconnect and reconnect with a different user on the same client instance and the same network connection.

The client also supports SAP HANA systems installed in multiple-container (MDC) mode. In this case a single SAP HANA system may contain several isolated tenant databases.
A database is identified by its name. One of the databases in an MDC setup is the system database which is used for central system administration.
One can connect to a specific tenant database directly via its host and SQL port (as shown in the example above) or via the system database which may lookup the exact host and port of a particular database by a given name.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host         : 'hostname', // system database host
  port         : 30013,      // system database port
  databaseName : 'DB1',      // name of a particular tenant database
  user         : 'user',     // user for the tenant database
  password     : 'secret'    // password for the user specified
});
```

The client also accepts an instance number instead of the port of the system database:

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host           : 'hostname', // system database host
  instanceNumber : '00',       // instance number of the HANA system
  databaseName   : 'DB1',      // name of a particular tenant database
  user           : 'user',     // user for the tenant database
  password       : 'secret'    // password for the user specified
});
```

Multiple hosts can be provided to the client as well:

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  hosts : [ { host: 'host1', port: 30015 }, { host: 'host2', port: 30015 } ],
  user     : 'user',
  password : 'secret'
});
```

This is suitable for multiple-host SAP HANA systems which are distributed over several hosts. The client establishes a connection to the first available host from the list.

### Authentication mechanisms
Details about the different authentication methods can be found in the [SAP HANA Security Guide](https://help.sap.com/viewer/6b94445c94ae495c83a19646e7c3fd56/latest/en-US/440f6efe693d4b82ade2d8b182eb1efb.html).

#### User / Password
Users authenticate themselves with their database `user` and `password`. 

#### SAML assertion
SAML bearer assertions as well as unsolicited SAML responses that include an
unencrypted SAML assertion can be used to authenticate users. SAML assertions and responses must be signed using XML signatures. XML Digital signatures can be created with [xml-crypto](https://www.npmjs.org/package/xml-crypto) or [xml-dsig](https://www.npmjs.org/package/xml-dsig).

Instead of `user` and `password` you have to provide a SAML `assertion`:

```js
client.connect({
  assertion: '<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ...>...</Assertion>'
},function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('User:', client.get('user'));
  console.log('SessionCookie:', client.get('SessionCookie'));
});
```

After a successful SAML authentication, the server returns the database `user` and a `SessionCookie` which can be used for reconnecting.

#### JWT token
JWT tokens can also be used to authenticate users.

Instead of `user` and `password` you have to provide a JWT `token`:

```js
client.connect({
  token: 'eyJhbGciOiJSUzI1NiJ9....'
},function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('User:', client.get('user'));
  console.log('SessionCookie:', client.get('SessionCookie'));
});
```

After a successful JWT authentication, the server returns the database `user` and a `SessionCookie` which can be used for reconnecting.

### Encrypted network communication
To establish an encrypted database connection just pass either `key`, `cert` and `ca` or a `pfx` to createClient.

```js
var client = hdb.createClient({
  host : 'hostname',
  port : 30015,
  key  : fs.readFileSync('client-key.pem'),
  cert : fs.readFileSync('client-cert.pem'),
  ca   : [fs.readFileSync('trusted-cert.pem')],
  ...
});
```

Use the `useTLS` option if you would like to connect to SAP HANA using Node.js's trusted certificates.

```js
var client = hdb.createClient({
  host : 'hostname',
  port : 30015,
  useTLS: true,
  ...
});
```

**Note** for MDC use cases: The system database and the target tenant database may be configured to work with different certificates.
If so, make sure to include all the necessary TLS-related properties for both the databases in the client's options.

In case you need custom logic to validate the server's hostname against the certificate, you can assign a callback function to the `checkServerIdentity` property, alongside the other connection options. The callback is
supplied to the `tls.connect` funciton of the [TLS](https://nodejs.org/api/tls.html#connect) API and should conform to the signature described there.

Direct Statement Execution
--------------------------

Direct statement execution is the simplest way to execute SQL statements.
The only input parameter is the SQL command to be executed.
Generally, statement execution results are returned using callbacks.
The type of returned result depends on the kind of statement.

### DDL Statement

In the case of a DDL statement nothing is returned:

```js
client.exec('create table TEST.NUMBERS (a int, b varchar(16))', function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Table TEST.NUMBERS has been created');
});
```

### DML Statement

In the case of a DML Statement the number of `affectedRows` is returned:

```js
client.exec('insert into TEST.NUMBERS values (1, \'one\')', function (err, affectedRows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Number of affected rows:', affectedRows);
});
```

### Query

The `exec` function is a convenient way to completely retrieve the result of a query. In this case all selected `rows` are fetched and returned in the callback. The `resultSet` is automatically closed and all `Lobs` are completely read and returned as buffer objects. If streaming of the results is required you will have to use the `execute` function. This is described in section [Streaming results](#streaming-results):

```js
client.exec('select A, B from TEST.NUMBERS order by A', function(err, rows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Rows:', rows);
});
```

Different Representations of Query Results
-----------------------------------
The default representation of a single row is an object where the property names are the columnDisplayNames of the resultSetMetadata:

```js
var command = 'select top 1 * from t1';
client.exec(command, function(err, rows) {
  /* rows will be an array like this:
  [{
    ID: 1,
    A: 't1.1.a',
    B: 't1.1.b'
  }]
  */
});
```

If your SQL statement is a join with overlapping column names, you may want to get separate objects for each table per row. This is possible if you set option `nestTables` to TRUE:

```js
var command = 'select top 1 * from t1 join t2 on t1.id = t2.id';
var options = {
  nestTables: true
};
client.exec(command, options, function(err, rows) {
  /* rows will be an array like this now:
  [{
    T1: {
      ID: 1,
      A: 't1.1.a',
      B: 't1.1.b',
    },
    T2: {
      ID: 1
      A: 't2.1.a',
      B: 't2.1.b',
    },
  }]
  */
});
```

It is also possible to return all rows as an array where the order of the column values is exactly the same as in the resultSetMetadata. In this case you have to set the option `rowsAsArray` to TRUE:

```js
var command = 'select top 1 * from t1 join t2 on t1.id = t2.id';
var options = {
  rowsAsArray: true
};
client.exec(command, options, function(err, rows) {
  /* rows will be an array like this now:
  [[
    1,
    't1.1.a',
    't1.1.b',
    1
    't2.1.a',
    't2.1.b'
  ]]
  */
});
```

Prepared Statement Execution
----------------------------

###  Prepare a Statement

The client returns a `statement` object which can be executed multiple times:

```js
client.prepare('select * from DUMMY where DUMMY = ?', function (err, statement){
  if (err) {
    return console.error('Error:', err);
  }
  // do something with the statement
  console.log('StatementId', statement.id);
});
```

### Execute a Statement

The execution of a prepared statement is similar to the direct statement execution on the client. The difference is that the first parameter of the `exec` function is an array with positional `parameters`. In case of named parameters it can also be an `parameters` object:

```js
statement.exec(['X'], function (err, rows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Rows:', rows);
});
```

If you use the `execute` function instead of the `exec` function the `resultSet` is returned in the callback like in the direct query execution above.

### Calling Stored Procedures

If you have a stored procedure similar to the following example:

```sql
create procedure PROC_DUMMY (in a int, in b int, out c int, out d DUMMY, out e TABLES)
  language sqlscript
  reads sql data as
  begin
    c := :a + :b;
    d = select * from DUMMY;
    e = select * from TABLES;
  end
```
You can call it via a prepared statement.
The second argument is always an object with the scalar parameters.
If there are no scalar parameters, an empty object ``{}`` is returned.
The following arguments are the `resultSets`:

```js
client.prepare('call PROC_DUMMY (?, ?, ?, ?, ?)', function(err, statement){
  if (err) {
    return console.error('Prepare error:', err);
  }
  statement.exec({
    A: 3,
    B: 4
  }, function(err, parameters, dummyRows, tableRows) {
    if (err) {
      return console.error('Exec error:', err);
    }
    console.log('Parameters:', parameters);
    console.log('Dummies:', dummyRows);
    console.log('Tables:', tableRows);
  });
});
```
**Note:** Default values for stored procedures are not supported.

### Drop Statement

To drop the statement simply call:

```js
statement.drop(function(err){
  if (err) {
    return console.error('Drop error:', err);
  }
  console.log('Statement dropped');
});
```
The callback is optional in this case.

### Using Datetime types

If you want to use DATETIME types in a prepared statement,
be aware that strings like `'14.04.2016 12:41:11.215'` are not
processed by the SAP HANA Database but by the node-hdb module.
Therefore, you must use the exact required format that would be returned
by a selection made with this module.
The formats are:
```js
TIME: '13:32:20'
DATE: '2016-04-14'
TIMESTAMP: '2016-04-14T13:32:20.737'
SECONDDATE: '2016-04-14T13:32:20'
```

Another possibility is to use the functions
`TO_DATE`, `TO_DATS`, `TO_TIME` and `TO_TIMESTAMP` in your
SQL statement to convert your string to a valid DATETIME type.

Bulk Insert
---------------

If you want to insert multiple rows with a single execution you just
have to provide the all parameters as array, for example:

```js
client.prepare('insert into TEST.NUMBERS values (?, ?)', function(err, statement){
  if (err) {
    return console.error('Prepare error:', err);
  }
  statement.exec([[1, 'one'], ['2', 'two'], [3, 'three']], function(err, affectedRows) {
    if (err) {
      return console.error('Exec error:', err);
    }
    console.log('Array of affected rows:', affectedRows);
  });
});
```
For further details, see: [app9](https://github.com/SAP/node-hdb/blob/master/examples/app9.js).


Streaming results
---------------

If you use the `execute` function of the client or statement instead of the `exec` function, a `resultSet` object is returned in the callback instead of an array of all rows. The `resultSet` object allows you to create an object based `row` stream or an array based stream of `rows` which can be piped to an writer object. Don't forget to close the `resultSet` if you use the `execute` function:

```js
client.execute('select A, B from TEST.NUMBERS order by A', function(err, rs) {
  if (err) {
    return console.error('Error:', err);
  }
  rs.setFetchSize(2048);
  rs.createObjectStream()
    .pipe(new MyWriteStream())
    .on('finish', function (){
      if (!rs.closed) {
       rs.close();
      }
    });
});
```
For further details, see [app4](https://github.com/SAP/node-hdb/blob/master/examples/app4.js).

Transaction handling
---------------

The default behavior is that each statement is automatically committed. If you want to manually control `commit ` and `rollback` of a transaction, you can do this by calling `setAutoCommit(false)` on the client object:

```js
function execTransaction(cb) {
  client.setAutoCommit(false);
  async.series([
    client.exec.bind(client, "insert into NUMBERS values (1, 'one')"),
    client.exec.bind(client, "insert into NUMBERS values (2, 'two')")
  ], function (err) {
    if (err) {
      client.rollback(function(err){
        if (err) {
          err.code = 'EROLLBACK';
          return cb(err);
        }
        cb(null, false);
      });
    } else {
      client.commit(function(commitError){
        if (err) {
          err.code = 'ECOMMIT';
          return cb(err);
        }
        cb(null, true);
      });
    }
    client.setAutoCommit(true);
  });
}

execTransaction(function(err, ok){
  if (err) {
    return console.error('Commit or Rollback error', err);
  }
  if (ok) {
    console.log('Commited');
  } else {
    console.log('Rolled back');
  }
})

```

For further details, see: [tx1](https://github.com/SAP/node-hdb/blob/master/examples/tx1.js).

Streaming Large Objects
-------------

### Read Streams

Reading large object as stream can be done if you use the `execute` method of client or statement. In this case for all LOB columns a [Lob](https://github.com/SAP/node-hdb/blob/master/lib/protocol/Lob.js) object is returned. You can call `createReadStream` or `read` in order create a readable stream or to read the LOB completely.

### Write Streams

Writing large objects is automatically done. You just have to pass a [`Readable`](http://nodejs.org/api/stream.html#stream_class_stream_readable_1) instance or a buffer object as parameter.

For further details, see: [app7](https://github.com/SAP/node-hdb/blob/master/examples/app7.js).

CESU-8 encoding support
-------------

The SAP HANA server connectivity protocol uses [CESU-8](https://en.wikipedia.org/wiki/CESU-8) encoding. Node.js does not suport CESU-8 natively and the driver by default converts all text to CESU-8 format in the javascript layer including SQL statements.

Due to the fact that Node.js has built-in support for UTF-8, using UTF-8 in the HDB drivers can lead to performance gains especially for large text data.
If you are sure that your data contains only [BMP](https://en.wikipedia.org/wiki/Plane_(Unicode)#Basic_Multilingual_Plane) characters, you can disable CESU-8 conversion by setting a flag in the client configuration.

`createClient` accepts the parameter `useCesu8` to disable CESU-8 support. Here is how to provide the configuration:

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host     : 'hostname',
  port     : 30015,
  user     : 'user',
  password : 'secret',
  useCesu8 : false
});

```

This setting is per client and cannot be changed later.

__Note:__ Using CESU-8 brings performance penalties proportionate to the text size that has to be converted.

TCP Keepalive
-------------

To configure TCP keepalive behaviour, include the tcpKeepAliveIdle connect option. The value provided for this option is the number of seconds before an idle connection will begin sending keepalive packets. By default, TCP keepalive will be turned on with a value of 200 seconds. If a value of 0 is specified, keepalive behaviour is determined by the operating system.
The following example creates a client whose connections will begin sending keepalive packets after 300 seconds.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host             : 'hostname',
  port             : 30015,
  user             : 'user',
  password         : 'secret',
  tcpKeepAliveIdle : 300
});

```

TCP keepalive can be explicity disabled by specifying tcpKeepAliveIdle=false as in the example below.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host             : 'hostname',
  port             : 30015,
  user             : 'user',
  password         : 'secret',
  tcpKeepAliveIdle : false
});

```
Setting Session-Specific Client Information
-------------

The client information is a list of session variables (defined in property-value pairs that are case sensitive) that an application can set on a client object. These variables can be set at connection time via "SESSIONVARIABLE:" prefixed options, or by using the setClientInfo method to specify a single property-value pair.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host             : 'hostname',
  port             : 30015,
  user             : 'user',
  password         : 'secret',
  "SESSIONVARIABLE:EXAMPLEKEY1" : "EXAMPLEVALUE1"
});
client.setClientInfo("EXAMPLEKEY2", "EXAMPLEVALUE2");

```
Session variables set via the setClientInfo method will be sent to the server during the next execute, prepare, or fetch operation.


Running tests
-------------

To run the unit tests for _hdb_ simply run:

```bash
make test-unit
```

To run the unit tests as well as acceptance tests for _hdb_ you have to run:

```bash
make test
```

For the acceptance tests a database connection has to be established. Therefore, you need to copy the configuration template [config.tpl.json](https://github.com/SAP/node-hdb/blob/master/test/db/config.tpl.json) in the ```test/db``` folder to ```config.json``` and change the connection data to yours. If the ```config.json``` file does not exist a local mock server is started.





Running examples
----------------

For any examples you need a valid ```config.json``` in the ```test/db``` folder.


- [app1](https://github.com/SAP/node-hdb/blob/master/examples/app1.js): Simple query.
- [app2](https://github.com/SAP/node-hdb/blob/master/examples/app2.js): Fetch rows from `ResultSet`.
- [app3](https://github.com/SAP/node-hdb/blob/master/examples/app3.js): Streaming rows `createObjectStream()`.
- [app4](https://github.com/SAP/node-hdb/blob/master/examples/app4.js): Pipe row into JSON-Transform and to `stdout`.
- [app5](https://github.com/SAP/node-hdb/blob/master/examples/app6.js): Stream from the filesystem into a db table.
- [app6](https://github.com/SAP/node-hdb/blob/master/examples/app5.js): Stream from a db table into the filesystem.
- [app7](https://github.com/SAP/node-hdb/blob/master/examples/app7.js): Insert a row with a large image into a db table (uses WriteLobRequest and Transaction internally).
- [app8](https://github.com/SAP/node-hdb/blob/master/examples/app8.js): Automatic reconnect when network connection is lost.
- [app9](https://github.com/SAP/node-hdb/blob/master/examples/app9.js): Insert multiple rows with large images into a db table as one batch.
- [app10](https://github.com/SAP/node-hdb/blob/master/examples/app10.js): Usage example of query option `nestTables`.
- [call1](https://github.com/SAP/node-hdb/blob/master/examples/call1.js): Call stored procedure.
- [call2](https://github.com/SAP/node-hdb/blob/master/examples/call2.js): Call stored procedure with lob input and output parameter.
- [call3](https://github.com/SAP/node-hdb/blob/master/examples/call3.js): Call stored procedure with table as input parameter.
- [tx1](https://github.com/SAP/node-hdb/blob/master/examples/tx1.js): Transaction handling (shows how to use commit and rollback).
- [csv](https://github.com/SAP/node-hdb/blob/master/examples/csv.js): Stream a db table into csv file.
- [server](https://github.com/SAP/node-hdb/blob/master/examples/server.js): Stream rows into http response `http://localhost:1337/{schema}/{tablename}?top={top}`

To run the first example:

```bash
node examples/app1
```

## Licensing

Copyright 2013-2021 SAP SE or an SAP affiliate company and node-hdb contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/node-hdb).
