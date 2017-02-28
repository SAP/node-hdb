SAP HANA Database Client for Node
====================================

A JavaScript client for Node implementing the
[SAP HANA Database SQL Command Network Protocol](http://help.sap.com/hana/SAP_HANA_SQL_Command_Network_Protocol_Reference_en.pdf).

[![Version](https://img.shields.io/npm/v/hdb.svg?style=flat-square)](https://npmjs.org/package/hdb)
[![Build](https://img.shields.io/travis/SAP/node-hdb.svg?style=flat-square)](http://travis-ci.org/SAP/node-hdb)
[![Coverage](https://img.shields.io/coveralls/SAP/node-hdb/master.svg?style=flat-square)](https://coveralls.io/r/SAP/node-hdb?branch=master)
[![Dependencies](https://img.shields.io/david/SAP/node-hdb.svg?style=flat-square)](https://david-dm.org/SAP/node-hdb#info=dependencies&view=list)
[![DevDependencies](https://img.shields.io/david/dev/SAP/node-hdb.svg?style=flat-square)](https://david-dm.org/SAP/node-hdb?type=dev&view=list)
[![License](https://img.shields.io/npm/l/hdb.svg?style=flat-square)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![Downloads](https://img.shields.io/npm/dm/hdb.svg?style=flat-square)](http://npm-stat.com/charts.html?package=hdb)

Table of contents
-------------

* [Install](#install)
* [Getting started](#getting-started)
* [Establish a database connection](#establish-a-database-connection)
* [Direct Statement Execution](#direct-statement-execution)
* [Prepared Statement Execution](#prepared-statement-execution)
* [Bulk Insert](#bulk-insert)
* [Streaming results](#streaming-results)
* [Transaction handling](#transaction-handling)
* [Streaming Large Objects](#streaming-large-objects)
* [CESU-8 encoding support](#cesu-8-encoding-support)
* [Running tests](#running-tests)
* [Running examples](#running-examples)
* [Todo](#todo)

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

Getting started
------------

If you do not have access to a SAP HANA server, go to the [SAP HANA Developer Center](http://scn.sap.com/community/developer-center/hana) and choose one of the options to [get your own trial SAP HANA Server](http://scn.sap.com/docs/DOC-31722).

This is a very simple example how to use this module:

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

The first step to establish a database connection is to create a client object. It is recommended to pass all required `connect` options like `host`, `port`, `user` and `password` to the `createClient` function. They will be used as defaults for following connect calls on the created client instance. In case of network connection errors like a connection timeout or a database restart you should always register an error event handler in order to be able to handle this kind of problems.

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
console.log(client.readyState); // new
```

When a client instance is created it does not immediately open a network connection to the database host. Initially the client is in state `new`. When you call `connect` the first time two things are done internally.

1. A network connection is established and the communication is initialized (Protocol - and Product Version exchange). Now the connection is ready for exchanging messages but no user session is established. The client is in state `disconnected`. This step is skipped if the client is already in state `disconnected`.

2. The authentication process is initiated. After a successful user authentication a database session is established and the client is in state `connected`. If authentication fails the client remains in state `'disconnect'`.

```js
client.connect(function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log(client.readyState); // connected
});
```
If user and password are specified they will override the defaults of the client. It is possible to disconnect and reconnect with a different user on the same client instance and the same network connection.

The client also supports HANA systems installed in multiple-container (MDC) mode. In this case a single HANA system may contain several isolated tenant databases.
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

This is suitable for Multiple-host HANA systems which are distributed over several hosts. The client will establish a connection to the first available host from the list.

### Authentication mechanisms
Details about the different authentication method can be found in the [SAP HANA Security Guide](http://help.sap.com/hana/SAP_HANA_Security_Guide_en.pdf).

#### User / Password
Users authenticate themselves with their database `user` and `password`.

#### SAML assertion
SAML bearer assertions as well as unsolicited SAML responses that include an
unencrypted SAML assertion can be used to authenticate users. SAML assertions and responses must be signed using XML signatures. XML Digital signatures can be created with [xml-crypto](https://www.npmjs.org/package/xml-crypto) or [xml-dsig](https://www.npmjs.org/package/xml-dsig).

Instead of `user` and `password` you have to provide a SAML `assertion`.

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

After a successful SAML authentication the server returns the database `user` and a `SessionCookie` which can be used for reconnect.

#### Kerberos
A Kerberos authentication provider can be used to authenticate users.
> This mechanism is not implemented and I do not plan to implement a Kerberos authentication provider myself. Contributions via pull request are welcome.

### Encrypted network communication
To establish an encrypted database connection just pass whether `key`, `cert` and `ca` or a `pfx` to createClient.

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

**Note** for MDC use cases: The system database and the target tenant database may be configured to work with different certificates.
If so, make sure to include all the necessary TLS-related properties for both the databases in the client's options.

In case you need custom logic to validate the server's hostname against the certificate, you can assign a callback function to the `checkServerIdentity` property, alongside the other connection options. The callback is
supplied to the `tls.connect` funciton of the [TLS](https://nodejs.org/api/tls.html#connect) API and should conform to the signature described there.

Direct Statement Execution
--------------------------

Direct statement execution is the simplest way to execute SQL statements.
The only input parameter is the SQL command to be executed.
Generally we return the statement execution results using callbacks.
The type of returned result depends on the kind of statement.

### DDL Statement

In the case of a DDL Statement nothing is returned.

```js
client.exec('create table TEST.NUMBERS (a int, b varchar(16))', function (err) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Table TEST.NUMBERS has been created');
});
```

### DML Statement

In the case of a DML Statement the number of `affectedRows` is returned.

```js
client.exec('insert into TEST.NUMBERS values (1, \'one\')', function (err, affectedRows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Number of affected rows:', affectedRows);
});
```

### Query

The `exec` function is a convenient way to completely retrieve the result of a query. In this case all selected `rows` are fetched and returned in the callback. The `resultSet` is automatically closed and all `Lobs` are completely read and returned as Buffer objects. If streaming of the results is required you will have to use the `execute` function. This is described in section [Streaming results](#streaming-results).

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
The default representation of a single row is an Object where the property names are the columnDisplayNames of the resultSetMetadata.

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

If your SQL statement is a join with overlapping column names, you may want to get separate objects for each table per row. This is possible if you set option `nestTables` to true.

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

It is also possible to return all rows as an Array where the order of the column values is exactly the same as in the resultSetMetadata. In this case you have to set the option `rowsAsArray` to true.

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

The client returns a `statement` object which can be executed multiple times.

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

The execution of a prepared statement is similar to the direct statement execution on the client. The difference is that the first parameter of `exec` function is an array with positional `parameters`. In case of named parameters it can also be an `parameters` object.

```js
statement.exec(['X'], function (err, rows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Rows:', rows);
});
```

If you use the `execute` instead of `exec` function the `resultSet` is returned in the callback like in direct query execution above.

### Calling Stored Procedures

If you have for example the following stored procedure:

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
you can call it via a prepared statement.
The second argument is always an object with the scalar parameters.
If there are no scalar parameters, an empty object ``{}`` will be returned.
The following arguments are the `resultSets`.

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

### Drop Statement

To drop the statement simply call

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

If you want to use datetime types in a prepared statement,
be aware that strings like `'14.04.2016 12:41:11.215'` are not
processed by the SAP HANA Database but by the node-hdb module.
Therefore you must use the exact required format that would be returned
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
SQL statement to convert your string to a valid datetime type.

Bulk Insert
---------------

If you want to insert multiple rows with a single execute you just
have to provide the all parameters as array.

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
Take a look at the example [app9](https://github.com/SAP/node-hdb/blob/master/examples/app9.js) for further details.


Streaming results
---------------

If you use the `execute` function of client or statement instead of the `exec` function, a `resultSet` object is returned in the callback instead of an array of all rows. The `resultSet` object allows you to create an object based `row` stream or an array based stream of `rows` which can be piped to an writer object. Don't forget to close the `resultSet` if you use the `execute` function.

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
Take a look at the example [app4](https://github.com/SAP/node-hdb/blob/master/examples/app4.js) for further details.

Transaction handling
---------------

The default behavior is that each statement is automatically commited. If you want to manually control `commit ` and `rollback` of a transaction, you can do this by calling `setAutoCommit(false)` on the client object.

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

Take a look at the example [tx1](https://github.com/SAP/node-hdb/blob/master/examples/tx1.js) for further details.

Streaming Large Objects
-------------

### Read Streams

Reading large object as stream can be done if you use the `execute` method of client or statement. In this case for all LOB columns a [Lob](https://github.com/SAP/node-hdb/blob/master/lib/protocol/Lob.js) object is returned. You can call `createReadStream` or `read` in order create a readable stream or to read the LOB completely.

### Write Streams

Writing large objects is automatically done. You just have to pass instance of [`Readable`](http://nodejs.org/api/stream.html#stream_class_stream_readable_1) or a Buffer object as parameter.

Take a look at the example [app7](https://github.com/SAP/node-hdb/blob/master/examples/app7.js) for further details.

CESU-8 encoding support
-------------

SAP HANA server connectivity protocol uses [CESU-8](https://en.wikipedia.org/wiki/CESU-8) encoding. Node.js does not suport CESU-8 natively and the driver by default converts all text to CESU-8 format in the javascript layer including SQL statements.

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

For the acceptance tests a database connection has to be established. Therefore you need to copy the configuration template [config.tpl.json](https://github.com/SAP/node-hdb/blob/master/test/db/config.tpl.json) in the ```test/db``` folder to ```config.json``` and change the connection data to yours. If the ```config.json``` file does not exist a local mock server is started.


Running examples
----------------

Also, for the examples you need a valid a ```config.json``` in the ```test/db``` folder.


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

To run e.g. the first example:

```bash
node examples/app1
```

Todo
----
* Improve documentation of the client api
* Improve error handling
* ...
