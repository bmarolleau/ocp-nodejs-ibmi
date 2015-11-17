//
// Usage: node index.js [port_secure port_insecure host_name]
//
var app = require('express')();
var https = require('https')
var http = require('http')
var io = require('socket.io')()
var os = require('os')
var fs = require('fs')
var db = require('/QOpenSys/QIBM/ProdData/Node/os400/db2i/lib/db2')

var options = {
  key: fs.readFileSync('./ibmidash-key.pem'),
  cert: fs.readFileSync('./ibmidash-cert.pem')
}

var port_secure = process.argv[2] || 8443
var port_insecure = process.argv[3] || 8080
var host_name = process.argv[4] || os.hostname()

app.locals._      = require('underscore');
app.locals._.str  = require('underscore.string');

db.debug(true)
db.init()
db.conn("*LOCAL")

app.set('views', __dirname + '/views')
app.set('view engine', 'jade')

app.get('/', function (req, res) {
  res.render('index', { title: 'Hey', message: 'Hello there!'})
})
app.get('/users', function (req, res) {
  var sql = 
    "SELECT * FROM QSYS2.USER_STORAGE AS US" +
    " LEFT JOIN QSYS2.USER_INFO AS UI on UI.AUTHORIZATION_NAME=US.AUTHORIZATION_NAME" 
  db.exec(sql, function(results) {
    res.render('users', { title: 'Users', results: results})
  })
})
app.get('/user/:id', function (req, res) {
  var sql = 
    "SELECT * FROM QSYS2.USER_STORAGE AS US" +
    " LEFT JOIN QSYS2.USER_INFO AS UI on UI.AUTHORIZATION_NAME=US.AUTHORIZATION_NAME" +
    " WHERE US.AUTHORIZATION_NAME='" + req.params.id + "'"
  db.exec(sql, function(result) {
    res.render('user', { result: result[0]})
  })
})
app.get('/file_waste_schemas', function (req, res) {
  var sql = 
    "select objname, objowner, objtext from table(QSYS2.object_statistics('QSYS      ', 'LIB       ')) libs order by  1" 
  db.exec(sql, function(results) {
    res.render('file_waste_schemas', { title: 'File waste: Select schema', results: results})
  })
})
app.get('/file_waste/:id', function (req, res) {
  var sql = 
    "select a.system_table_name, a.table_text, b.system_table_member, " +
	"       date(b.last_change_timestamp) as last_changed_date, date(b.last_used_timestamp) as last_used_date, " +
	"       number_rows, number_deleted_rows, " +
	"       bigint( 100 * number_deleted_rows / max( number_rows+number_deleted_rows, 1 ) ) as Percent_Deleted, " +
	"       data_size, " +
	"       bigint( data_size * float( number_deleted_rows ) / max( number_rows+number_deleted_rows, 1 ) ) as Deleted_Space " +
	"  from qsys2.systables a join qsys2.syspartitionstat b on (a.system_table_name, a.system_table_schema) = (b.system_table_name, b.system_table_schema) " +
	" where a.table_schema = '" + req.params.id + "' " +
	"       and table_type in ('T', 'P') and table_type in ('T', 'P') and file_type = 'D' and number_deleted_rows > 0 " +
	" order by Deleted_Space desc" +
	" fetch first 100 rows only"
  db.exec(sql, function(results) {
    res.render('file_waste', { title: 'File waste space information - library ' + req.params.id, results: results})
  })
})

app.get('/advised_index_schemas', function (req, res) {
  var sql = 
    "select dbname, count(*) as nbradv" +
	"  from qsys2.sysixadv" +
	" group by dbname" +
	" order by nbradv desc" +
	" fetch first 100 rows only"
  db.exec(sql, function(results) {
    res.render('advised_index_schemas', { title: 'Advised Indexes: Select Schema ' + req.params.id, results: results})
  })
})

app.get('/advised_indexes/:id', function (req, res) {
  var sql = 
    "select dbname, tbname, index_type, nlssname, timesadv, lastadv, keysadv" +
	"  from qsys2.sysixadv" +
	" where dbname = '" + req.params.id + "'"
	" order by tbname" +
	" fetch first 100 rows only"
  db.exec(sql, function(results) {
    res.render('advised_indexes', { title: 'Advised Indexes ' + req.params.id, results: results})
  })
})

app.get('/wrkactjob', function (req, res) {
  res.render('wrkactjob', { title: 'WRKACTJOB'})
})

setInterval( function() {
  var sql = "SELECT JOB_NAME, AUTHORIZATION_NAME, ELAPSED_TOTAL_DISK_IO_COUNT, " +
          " ELAPSED_CPU_PERCENTAGE " +
          " FROM TABLE(QSYS2.ACTIVE_JOB_INFO('NO','','','')) X" +
          " ORDER BY ELAPSED_CPU_PERCENTAGE DESC" +
          " FETCH FIRST 20 ROWS ONLY"
  db.exec(sql, function(results) {
    io.emit('wrkactjob_update', results);
  })
}, 2000);


http.createServer(function(req, res) {
  var new_loc = 'https://' + host_name + ':' + port_secure
  console.log('new_loc:%s', new_loc)
  res.writeHead(301,
    {Location: new_loc}
  );
  res.end();
}).listen(port_insecure);

var httpsServer = https.createServer(options, app).listen(port_secure);

io.attach(httpsServer)

