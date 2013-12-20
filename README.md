SAP HANA Database Client for Node
====================================

A JavaScript client for Node implementing the 
[SAP HANA Database SQL Command Network Protocol](http://help.sap.com/hana/SAP_HANA_Database_SQL_command_network_protocol_en.pdf).

[![Build Status](https://secure.travis-ci.org/SAP/node-hdb.png)](http://travis-ci.org/SAP/node-hdb)

Install
-------

Install from npm:

[![NPM](https://nodei.co/npm/hdb.png?compact=true)](https://npmjs.org/package/hdb)

or clone from the [GitHub repository](https://github.com/SAP/node-hdb) to run tests and examples locally:

```bash
git clone https://github.com/SAP/node-hdb.git
cd node-hdb
npm install
```

Introduction
------------

A very simple example how to use this module:

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host     : 'hostname',
  port     : 30015,
  user     : 'user',
  password : 'secret'
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

Authentication methods
----------------------

The SAP HANA Database supports the following authentication methods:

- **SCRAMSHA256** user/password based authentication method
- _GSS_
- _SAML_

Currently only the SCRAMSHA256 authentication method is supported.


Establishing a connection to the database
-----------------------------------------

In order to be able to handle connection errors it is recommended to explicitly
establish a connection  using the `connect` method of the client object.

```js
var hdb    = require('hdb');
var client = hdb.createClient({
  host     : 'hostname',
  port     : 30015,
  user     : 'user',
  password : 'secret'
	
});

client.connect({
  user     : 'somebody',
  password : 'abc123'
}, function (err) {
  if (err) {
    return console.error('Client connection error:', err);
  } 
  console.log('Client connected!');  
});
```
If user and password are specified it will override the defaults of the client. It is possible to disconnect and reconnect with a different user on the same client instance and the same network connection.    
 
Direct Statement Execution 
--------------------------

Direct statement execution is the simplest way to execute SQL statements.
The only input parameter is the SQL command to be executed.
Generally we return the statement execution results using callbacks.
For callbacks we follow the convention described in the
[Node.js Style Guide](http://nodeguide.com/style.html#callbacks) 
to reserve the first parameter of any callback for an optional error object.
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

The `exec` function is a convinient way to completely retrieve the result of a query. In this case all selected `rows` are fetched and returned in the callback. The `resultSet` is automatically closed and all `Lobs` are completely read and returned as Buffer objects. If streaming of the results is required you will have to use the `execute` function. This is described in section [Streaming results](#streaming-results).

```js
client.exec('select A, B from TEST.NUMBERS oder by A', function(err, rows) {
  if (err) {
    return console.error('Error:', err);
  } 
  console.log('Rows:', rows);  
});
```

Prepared Statement Execution
----------------------------

###  Prepare a Statement 

The client returns a `statement` object which can be executed multiple times.

```js
client.prepare('call * from DUMMY where X = ?', function (err, statement){
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
statement.exec([1], function (err, rows) {
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

Streaming results
---------------

If you use the `execute` function of client or statement instead of the `exec` function, a `resultSet` object is returned in the callback instead of an array of all rows. The `resultSet` object allows you to create an object based `row` stream or an array based stream of `rows` which can be piped to an writer object. Don't forget to close the `resultSet` if you use the `execute` function. 
 
```js
client.execute('select A, B from TEST.NUMBERS oder by A', function(err, rs) {
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

Streaming Large Objects (LOBs)
-------------

### Read Streams

Reading large object as stream can be done if you use the `execute` method of client or statement. In this case for all LOB columns a [Lob](https://github.wdf.sap.corp/d021332/node-hdb/blob/master/lib/protocol/Lob.js#L74-L89) object is returned. You can call `createReadStream` or `read` in order create a readable stream or to read the LOB completely. 

### Write Streams

Writing large objects is automatically done. You just have to pass instance of [`Readable`](http://nodejs.org/api/stream.html#stream_class_stream_readable_1) or a Buffer oobject as parameter.

Take a look at the example [app7](https://github.com/SAP/node-hdb/blob/master/examples/app7.js) for further details. 

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

For the acceptance tests a database connection has to be established. Therefore you need to copy the configuration template [config.tpl.json](https://github.com/SAP/node-hdb/blob/master/test/lib/config.tpl.json) in the ```test/lib``` folder to ```config.json``` and change the connection data to yours. If the ```config.json``` file does not exist a local mock server is started.


Running examples
----------------

Also, for the examples you need a valid a ```config.json``` in the ```test/lib``` folder. 


- [app1](https://github.com/SAP/node-hdb/blob/master/examples/app1.js): Simple query. 
- [app2](https://github.com/SAP/node-hdb/blob/master/examples/app2.js): Fetch rows from `ResultSet`.
- [app3](https://github.com/SAP/node-hdb/blob/master/examples/app3.js): Streaming rows `createObjectStream()`.
- [app4](https://github.com/SAP/node-hdb/blob/master/examples/app4.js): Pipe row into JSON-Transform and to `stdout`.
- [app5](https://github.com/SAP/node-hdb/blob/master/examples/app5.js): Stream XS repository into the filesystem.
- [app6](https://github.com/SAP/node-hdb/blob/master/examples/app6.js): Stream from the filesystem into a db table.
- [app7](https://github.com/SAP/node-hdb/blob/master/examples/app7.js): Insert a row with a large image into a db table (uses WriteLobRequest and Transaction internally).
- [call1](https://github.com/SAP/node-hdb/blob/master/examples/call1.js): Call stored procedure. 
- [call2](https://github.com/SAP/node-hdb/blob/master/examples/call2.js): Call stored procedure with lob input and output parameter.
- [tx1](https://github.com/SAP/node-hdb/blob/master/examples/tx1.js): Transaction handling (shows how to use commit and rollback).  
- [csv](https://github.com/SAP/node-hdb/blob/master/examples/csv.js): Stream a db table into csv file.
- [server](https://github.com/SAP/node-hdb/blob/master/examples/server.js): Stream rows into http response `http://localhost:1337/{schema}/{tablename}?top={top}`

To call e.g. the first example:

```bash
node examples/app1
```

Todo
----
* Improve documentation of the client api    
* Improve error handling
* SAML Authentication support
* Enhance tests
* ...
