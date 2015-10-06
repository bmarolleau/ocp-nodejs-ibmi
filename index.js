var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var db = require('/QOpenSys/QIBM/ProdData/Node/os400/db2i/lib/db2')

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
    "SELECT SYSTEM_SCHEMA_NAME, SCHEMA_OWNER, SCHEMA_TEXT FROM QSYS2.SYSSCHEMAS ORDER BY 1" 
  db.exec(sql, function(results) {
    res.render('file_waste_schemas', { title: 'File waste: Select schema', results: results})
  })
})
app.get('/file_waste/:id', function (req, res) {
  var sql = 
    "select a.system_table_name, b.system_table_member, " +
	"       number_rows, number_deleted_rows, " +
	"       bigint( 100 * number_deleted_rows / max( number_rows+number_deleted_rows, 1 ) ) as Percent_Deleted, " +
	"       data_size, " +
	"       bigint( data_size * float( number_deleted_rows ) / max( number_rows+number_deleted_rows, 1 ) ) as Deleted_Space " +
	"  from qsys2.systables a join qsys2.syspartitionstat b on (a.system_table_name, a.system_table_schema) = (b.system_table_name, b.system_table_schema) " +
	" where a.table_schema = '" + req.params.id + "' " +
	"       and table_type in ('T', 'P')and table_type in ('T', 'P') and file_type = 'D' and number_deleted_rows > 0 " +
	" order by 7 desc" +
	" fetch first 100 rows only"
  db.exec(sql, function(results) {
    res.render('file_waste', { title: 'File waste space information - library ' + req.params.id, results: results})
  })
})

app.get('/wrkactjob', function (req, res) {
  res.render('wrkactjob', { title: 'WRKACTJOB'})
})

setInterval( function() {
  var sql = "SELECT JOB_NAME, AUTHORIZATION_NAME, ELAPSED_TOTAL_DISK_IO_COUNT, " +
          " ELAPSED_CPU_PERCENTAGE " +
          " FROM TABLE(QSYS2.ACTIVE_JOB_INFO()) X" +
          " ORDER BY ELAPSED_CPU_PERCENTAGE DESC" +
          " FETCH FIRST 20 ROWS ONLY"
  db.exec(sql, function(results) {
    io.emit('wrkactjob_update', results);
  })
}, 2000);


var port = 8000
server.listen(port, function(){ 
  console.log('listening on *:%s', port)
})
