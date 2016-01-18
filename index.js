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
	" where dbname = '" + req.params.id + "'" +
	" order by tbname, timesadv desc"
  db.exec(sql, function(results) {
    res.render('advised_indexes', { title: 'Advised Indexes for ' + req.params.id, results: results})
  })
})

app.get('/wrkactjob', function (req, res) {
  res.render('wrkactjob', { title: 'WRKACTJOB'})
})

app.get('/jobs_splf/:splfname', function (req, res) {
  var title = "Spoolfile storage by job"
  var sql = 
    "select substr( JOB_NAME, locate_in_string( JOB_NAME, '/', 1, 2 ) + 1 ) as JOBNAME, " +
	"       substr( JOB_NAME, locate_in_string( JOB_NAME, '/', 1, 1 ) + 1, locate_in_string( JOB_NAME, '/', 1, 2) - locate_in_string( JOB_NAME, '/', 1, 1) - 1 ) as JOBUSER, " +
	"       substr( JOB_NAME, 1, locate_in_string( JOB_NAME, '/', 1, 1) - 1 ) as JOBNBR, " +
	"       count(*) as SPLF_COUNT, " +
	"       sum(cast(SIZE as bigint)) * 1024 as SPLF_SIZE, " +
    "       char(date(max(CREATE_TIMESTAMP))) concat ' ' concat char(time(max(CREATE_TIMESTAMP))) as NEWEST_SPLF " +
    "  from table(QSYS2.OBJECT_STATISTICS('*ALL      ', '*LIB')) a, " +
    "       table(QSYS2.OBJECT_STATISTICS(a.OBJNAME, '*OUTQ')) b, " +
    "       table(QSYS2.OUTPUT_QUEUE_ENTRIES(a.OBJNAME, b.OBJNAME, '*NO')) c " 
  if ( req.params.splfname != '' && req.params.splfname != '*ALL' ){
      title += " - " + req.params.splfname
      sql += "where SPOOLED_FILE_NAME = '" + req.params.splfname + "'"
  }
  sql +=
    " group by JOB_NAME " +
    " order by 5 desc " +
    " fetch first 100 rows only"
  db.exec(sql, function(results) {
    res.render('jobs_splf', { title: title, results: results })
  })
})


app.get('/splf_stg', function (req, res) {
  var title = "Spoolfile storage"
  var sql = 
    "select SPOOLED_FILE_NAME, count(*) as SPLF_COUNT, sum(cast(SIZE as bigint)) * 1024 as SPLF_SIZE" +
    "  from table(QSYS2.OBJECT_STATISTICS('*ALL      ', '*LIB')) a, " +
    "       table(QSYS2.OBJECT_STATISTICS(a.OBJNAME, '*OUTQ')) b, " +
    "       table(QSYS2.OUTPUT_QUEUE_ENTRIES(a.OBJNAME, b.OBJNAME, '*NO')) c " +
    " group by SPOOLED_FILE_NAME " +
    " order by 3 desc "
  db.exec(sql, function(results) {
    res.render('splf_stg', { title: title, results: results })
   })
 })

io.on( 'connection', function( socket ) {
  console.log( 'WRKACTJOB client connected' );	
  var wrkactjob_itv = setInterval( function() {
    var sql = "SELECT JOB_NAME, AUTHORIZATION_NAME, ELAPSED_TOTAL_DISK_IO_COUNT, " +
			  " ELAPSED_CPU_PERCENTAGE " +
              " FROM TABLE(QSYS2.ACTIVE_JOB_INFO('NO','','','')) X" +
			  " ORDER BY ELAPSED_CPU_PERCENTAGE DESC" +
			  " FETCH FIRST 20 ROWS ONLY"
    db.exec(sql, function(results) {
      socket.emit('wrkactjob_update', results);
    })
  }, 2000);
  socket.on( 'disconnect', function() {
	  console.log( 'WRKACTJOB client disconnected' );	
	  clearInterval( wrkactjob_itv );
  })
})


app.get('/ptf_group_info', function (req, res) {
  var title = "PTF Group info"
  var sql = 
    "select PTF_GROUP_DESCRIPTION, PTF_GROUP_NAME, PTF_GROUP_LEVEL, PTF_GROUP_STATUS " +
    "  from QSYS2.GROUP_PTF_INFO " +
    " order by 2 desc "
  db.exec(sql, function(results) {
    res.render('ptf_group_info', { title: title, results: results })
   })
 })

 
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

