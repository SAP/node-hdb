SAP HANA Database Client for Node
====================================

A JavaScript client for Node implementing the 
[SAP HANA Database SQL Command Network Protocol](http://help.sap.com/hana/SAP_HANA_Database_SQL_command_network_protocol_en.pdf).


Install
-------

Install from [npm](https://npmjs.org/):

```
$ npm install hdb
```

or clone from the [GitHub repository](https://github.com/SAP/node-hdb) to run tests and examples locally:

```
$ git clone https://github.com/SAP/node-hdb.git
$ cd node-hdb
$ npm install
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
}).connect();

client.exec('select * from DUMMY', function(err, rows) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Results:', rows);  
  }  
  client.end();
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
  port     : 30015
});

client.connect({
  user     : 'user',
  password : 'secret'
}, function(err) {
  if (err) {
    console.error('Client connection error:', err);
  } else {
    console.log('Client connected!');  
  }
});
```
 
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
client.exec('create table TEST.NUMBERS (a int, b varchar(16))', function(err) {
  if (err) {
    return console.error('Error:', err);
  } 
  console.log('Table TEST.NUMBERS has been created');  
});
```

### DML Statement

In the case of a DML Statement the number of `affectedRows` is returned.

```js
client.exec('insert into TEST.NUMBERS values (1, \'one\')', function(err, affectedRows) {
  if (err) {
    return console.error('Error:', err);
  } 
  console.log('Number of affected rows:', affectedRows);  
});
```

### Query

In the case of a Query all selected `rows` are fetched and returned in the callback.

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

```js
statement.exec([1], function (err, rows) {
  if (err) {
    return console.error('Error:', err);
  }
  console.log('Rows:', rows);  
});
```

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
  console.lob('Statement droped');
});
```

Running tests
-------------

To run the unit tests for _hdb_ simply run:

```bash
$ make test-unit
```

To run the unit tests as well as acceptance tests for _hdb_ you have to run:

```bash
$ make test
```

For the acceptance tests a database connection has to be established. Therefore you 
need to copy the configuration template [config.tpl.json](./test/lib/config.tpl.json) 
in the ```test/lib``` folder to ```config.json``` and change the connection data to yours.


Running examples
----------------

Also, for the [examples](./examples) you need a valid a ```config.json``` in the ```test/lib``` folder. 

The example for call procedure:

```bash
$ node examples/call1
```

Todo
----
* Finish support for Lob data types 
    * Support for read Lob in development
    * Support for write Lob not yet started
* Improve documentation of the client api    
* Improve error handling
* SAML Authentication support
* Transaction handling
* Enhance tests
* ...
