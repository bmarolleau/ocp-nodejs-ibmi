//
// Usage: node index.js [port_secure port_insecure host_name]
//
console.log('hello');
var app = require('express')();
var https = require('https')
var http = require('http')
var io = require('socket.io')()
var os = require('os')
var fs = require('fs')
const { parseString } = require('xml2js');

const odbc = require('odbc');
const { Connection, CommandCall, ProgramCall } = require('itoolkit');

var conn;

var port_secure = process.argv[2] || 8443
var port_insecure = process.argv[3] || 8080
var host_name = process.argv[4] || os.hostname()

app.locals._ = require('underscore');
app.locals._.str = require('underscore.string');

app.set('views', __dirname + '/views')
app.set('view engine', 'pug')

app.get('/', function (req, res) {
  res.render('index', { title: 'Hey', message: 'Hello there!' })
})
app.get('/users', function (req, httpResponse) {
  var sql =
    "SELECT * FROM QSYS2.USER_STORAGE AS US" +
    " LEFT JOIN QSYS2.USER_INFO AS UI on UI.AUTHORIZATION_NAME=US.AUTHORIZATION_NAME"

  try {
    conn.query(sql, function (error, results) {
      if (error) {
        console.log(error);
        httpResponse.send(error);
      } else {
        httpResponse.render('users', { title: 'Users', results: results })
      }
    });
  }
  catch (err) {
    console.log(err);
    httpResponse.send(error);
  }
});
app.get('/user/:id', function (req, httpResponse) {

  var sql =
    "SELECT * FROM QSYS2.USER_STORAGE AS US" +
    " LEFT JOIN QSYS2.USER_INFO AS UI on UI.AUTHORIZATION_NAME=US.AUTHORIZATION_NAME" +
    " WHERE US.AUTHORIZATION_NAME='" + req.params.id + "'"
  try {
    conn.query(sql, function (error, results) {
      if (error) {
        console.log(error);
        httpResponse.send(error);
      } else {
        httpResponse.render('user', { result: results[0] })
      }
    });
  }
  catch (err) {
    console.log(err);
    httpResponse.send(error);
  }
})
app.get('/file_waste_schemas', function (req, res) {

  var sql =
    "select objname, objowner, objtext from table(QSYS2.object_statistics('QSYS      ', 'LIB       ')) libs order by  1"
  conn.query(sql, function (error, results) {
    res.render('file_waste_schemas', { title: 'File waste: Select schema', results: results })
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
  conn.query(sql, function (error, results) {
    res.render('file_waste', { title: 'File waste space information - library ' + req.params.id, results: results })

  })
})

app.get('/advised_index_schemas', function (req, res) {

  var sql =
    "select dbname, count(*) as nbradv" +
    "  from qsys2.sysixadv" +
    " group by dbname" +
    " order by nbradv desc" +
    " fetch first 100 rows only"
  conn.query(sql, function (error, results) {
    res.render('advised_index_schemas', { title: 'Advised Indexes: Select schema', results: results })

  })
})

app.get('/advised_indexes/:id', function (req, res) {

  var sql =
    "select dbname, tbname, index_type, nlssname, timesadv, lastadv, keysadv" +
    "  from qsys2.sysixadv" +
    " where dbname = '" + req.params.id + "'" +
    " order by tbname, timesadv desc"
  conn.query(sql, function (error, results) {
    res.render('advised_indexes', { title: 'Advised Indexes for ' + req.params.id, results: results })

  })
})

app.get('/wrkactjob', function (req, res) {
  res.render('wrkactjob', { title: 'WRKACTJOB' })
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
  if (req.params.splfname != '' && req.params.splfname != '*ALL') {
    title += " - " + req.params.splfname
    sql += "where SPOOLED_FILE_NAME = '" + req.params.splfname + "'"
  }
  sql +=
    " group by JOB_NAME " +
    " order by 5 desc " +
    " fetch first 100 rows only"
  conn.query(sql, function (error, results) {
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
  conn.query(sql, function (error, results) {
    res.render('splf_stg', { title: title, results: results })

  })
})

io.on('connection', function (socket) {
  console.log('WRKACTJOB client connected');
  var wrkactjob_itv = setInterval(function () {

    var sql = "SELECT JOB_NAME, AUTHORIZATION_NAME, ELAPSED_TOTAL_DISK_IO_COUNT, " +
      " ELAPSED_CPU_PERCENTAGE " +
      " FROM TABLE(QSYS2.ACTIVE_JOB_INFO('NO','','','')) X" +
      " ORDER BY ELAPSED_CPU_PERCENTAGE DESC" +
      " FETCH FIRST 20 ROWS ONLY"
    conn.query(sql, function (error, results) {
      socket.emit('wrkactjob_update', results);

    })
  }, 2000);
  socket.on('disconnect', function () {
    console.log('WRKACTJOB client disconnected');
    clearInterval(wrkactjob_itv);
  })
})


app.get('/ptf_group_info', function (req, res) {
  var title = "PTF Group info"

  var sql =
    "select PTF_GROUP_DESCRIPTION, PTF_GROUP_NAME, PTF_GROUP_LEVEL, PTF_GROUP_STATUS " +
    "  from QSYS2.GROUP_PTF_INFO " +
    " order by 2 desc "
  conn.query(sql, function (error, results) {
    res.render('ptf_group_info', { title: title, results: results })

  })
})


app.get('/ptf_group_status', function (req, res) {
  var title = "PTF Group status"

  var sql =
    "select PTF_GROUP_TITLE, PTF_GROUP_ID, PTF_GROUP_LEVEL_AVAILABLE, PTF_GROUP_LEVEL_INSTALLED, " +
    "   	date( PTF_GROUP_LAST_UPDATED_BY_IBM ) as PTF_GROUP_LAST_UPDATED_BY_IBM, " +
    "       case when PTF_GROUP_CURRENCY = 'UPDATE AVAILABLE' then 'UPDATE' else '' end as Warning" +
    "  from SYSTOOLS.GROUP_PTF_CURRENCY " +
    " order by 2 desc "
  conn.query(sql, function (error, results) {
    res.render('ptf_group_status', { title: title, results: results })

  })
})


app.get('/sysdiskstat', function (req, res) {
  try {
    console.log('using connection: ' + JSON.stringify(conn));
    conn.query("SELECT PERCENT_USED FROM QSYS2.SYSDISKSTAT", function (error, results) {
      console.log('got results: ' + JSON.stringify(results));
      res.render('sysdiskstat', { title: 'SYSDISKSTAT', diskResults: results });
      //console.log(results);

    });
  }
  catch (err) {
    console.log(err);
  }
});

app.get('/SYSTEM_STATUS_INFO', function (req, res) {
  var title = "SYSTEM_STATUS_INFO"

  var sql = "SELECT * FROM QSYS2.SYSTEM_STATUS_INFO"
  var url = "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.SYSTEM_STATUS_INFO"
  try {
    conn.query(sql, function (error, results) {
      res.render('table_view_single', { title: title, sql: sql, url: url, results: results });
      //console.log(results);

    });
  }
  catch (err) {
    console.log(err);
  }
});


app.get('/LICENSE_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "LICENSE_INFO",
    "SELECT * FROM QSYS2.LICENSE_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.LICENSE_INFO"
  );
});

app.get('/JOURNAL_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "JOURNAL_INFO",
    "SELECT * FROM QSYS2.JOURNAL_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.JOURNAL_INFO%20view"
  );
});

app.get('/USER_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "USER_INFO",
    "SELECT * FROM QSYS2.USER_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.USER_INFO%20catalog"
  );
});

app.get('/TCPIP_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "TCPIP_INFO",
    "SELECT * FROM QSYS2.TCPIP_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.TCPIP_INFO%20view"
  );
});

app.get('/NETSTAT_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "NETSTAT_INFO",
    "SELECT * FROM QSYS2.NETSTAT_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.NETSTAT_INFO"
  );
});

app.get('/USER_STORAGE', function (req, res) {
  doSimpleTableViewQuery(res,
    "USER_STORAGE",
    "SELECT * FROM QSYS2.USER_STORAGE",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.USER_STORAGE%20catalog"
  );
});

app.get('/OUTPUT_QUEUE_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "OUTPUT_QUEUE_INFO",
    "SELECT * FROM QSYS2.OUTPUT_QUEUE_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.OUTPUT_QUEUE_INFO%20-%20View"
  );
});

app.get('/SERVER_SBS_ROUTING', function (req, res) {
  doSimpleTableViewQuery(res,
    "SERVER_SBS_ROUTING",
    "SELECT * FROM QSYS2.SERVER_SBS_ROUTING",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.SERVER_SBS_ROUTING%20-%20view"
  );
});

app.get('/SYSTEM_VALUE_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "SYSTEM_VALUE_INFO",
    "SELECT * FROM QSYS2.SYSTEM_VALUE_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.SYSTEM_VALUE_INFO%20catalog"
  );
});

app.get('/ACTIVE_JOB_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "ACTIVE_JOB_INFO",
    "SELECT * FROM TABLE(QSYS2.ACTIVE_JOB_INFO()) AS X",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.ACTIVE_JOB_INFO()%20-%20UDTF"
  );
});
function doSimpleTableViewQuery(httpResponse, title, sql, url) {
  try {
    conn.query(sql, function (error, results) {
      if (error) {
        console.log(error);
        httpResponse.send(error);
      } else {
        httpResponse.render('table_view', { title: title, sql: sql, url: url, results: results });
      }

    });
  }
  catch (err) {
    console.log(err);
    httpResponse.send(error);
  }
}
app.get('/GROUP_PROFILE_ENTRIES', function (req, res) {
  doSimpleTableViewQuery(res,
    "GROUP_PROFILE_ENTRIES",
    "SELECT * FROM QSYS2.GROUP_PROFILE_ENTRIES",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.GROUP_PROFILE_ENTRIES%20%E2%80%93%20new%20security%20view"
  );
});

app.get('/DRDA_AUTHENTICATION_ENTRY_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "DRDA_AUTHENTICATION_ENTRY_INFO",
    "SELECT * FROM QSYS2.DRDA_AUTHENTICATION_ENTRY_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.DRDA_AUTHENTICATION_ENTRY_INFO"
  );
});

app.get('/ENVIRONMENT_VARIABLE_INFO', function (req, res) {
  doSimpleTableViewQuery(res,
    "ENVIRONMENT_VARIABLE_INFO",
    "SELECT * FROM QSYS2.ENVIRONMENT_VARIABLE_INFO",
    "https://www.ibm.com/developerworks/community/wikis/home?lang=en#!/wiki/IBM%20i%20Technology%20Updates/page/QSYS2.ENVIRONMENT_VARIABLE_INFO%20-%20view"
  );
});

// IBM i program/service call
app.get('/IBMi_program_call', function (req, res) {
  var title = "IBM i program/service call"
  var cmd = "QTOCNETSTS"
  var sysVal = "QCCSID";
  var errno = [
    { value: 0, type: "10i0" },
    { value: 0, type: "10i0", setlen: "rec2" },
    { value: "", type: "7A" },
    { value: "", type: "1A" }
  ];
  var outBuf = [
    { value: 0, type: "10i0" },     // [0] Bytes returned
    { value: 0, type: "10i0" },     // [1] Bytes available
    { value: 0, type: "10i0" },     // [2] TCP/IPv4 stack status
    { value: 0, type: "10i0" },     // [3] How long active
    { value: "", type: "8A" },     // [4] When last started - date
    { value: "", type: "6A" },     // [5] When last started - time
    { value: "", type: "8A" },     // [6] When last ended - date
    { value: "", type: "6A" },     // [7] When last ended - time
    { value: "", type: "10A" },    // [8] Who last started - job name
    { value: "", type: "10A" },    // [9] Who last started - job user name
    { value: "", type: "6A" },     // [10] Who last started - job number
    { value: "", type: "16h" },    // [11] Who last started - internal job identifier
    { value: "", type: "10A" },    // [12] Who last ended - job name
    { value: "", type: "10A" },    // [13] Who last ended - job user name
    { value: "", type: "6A" },     // [14] Who last ended - job number
    { value: "", type: "16h" },    // [15] Who last ended - internal job identifier
    { value: 0, type: "10i0" },     // [16] Offset to additional information
    { value: 0, type: "10i0" },     // [17] Length of additional information
    { value: 0, type: "10i0" },     // [18] Limited mode
    { value: 0, type: "10i0" },     // {value: 19] Offset to list of Internet addresses
    { value: 0, type: "10i0" },     // [20] Number of Internet addresses
    { value: 0, type: "10i0" },     // [21] Entry length for list of Internet addresses
    { value: 0, type: "10i0" },     // [22] DNS protocol
    { value: 0, type: "10i0" },     // [23] Retries
    { value: 0, type: "10i0" },     // [24] Time interval
    { value: 0, type: "10i0" },     // [25] Search order
    { value: 0, type: "10i0" },     // [26] Initial domain name server
    { value: 0, type: "10i0" },     // [27] DNS listening port
    { value: "", type: "64A" },    // [28] Host name
    { value: "", type: "255A" },  // [29] Domain name
    { value: "", type: "1A" },     // [30] Reserved
    { value: "", type: "256A" },  // [31] Domain search list
  ];
  let xt = new Connection({
    transport: 'odbc',
    transportOptions: { dsn: 'ibmidemo' }
  });
  let pgm = new ProgramCall("QTOCNETSTS", { "lib": "QSYS", "func": "QtocRtvTCPA" });
  pgm.addParam({ io: "out", len: "rec1", type: "ds", fields: outBuf });
  pgm.addParam({ value: 0, type: "10i0", setlen: "rec1" });
  pgm.addParam({ value: "TCPA0300", type: "8A" });
  pgm.addParam({ fields: errno, io: "both", "len": "rec2", type: "ds" });
  xt.add(pgm);
  xt.run(function (error, results) {
    if (error) {
      console.log('uh oh: ' + error); res.send(error); return;
    }
    parseString(results, { trim: true }, function (err, jsResult) {
      if (err) {
        console.log('uh oh');
        res.send(err);
        return;
      }
      let pram1 = "Domain: " + jsResult.myscript.pgm[0].parm[0].ds[0].data[29]._;
      let pram2 = "Host: " + jsResult.myscript.pgm[0].parm[0].ds[0].data[28]._;
      res.render('node_toolkit', { title: title, cmd: cmd, pram1: pram1, pram2: pram2 })
    });
  });
});

// CL Command
app.get('/IBMi_cl_command', function (req, httpResponse) {
  var title = "IBM i CL Command"
  var cmd = "RTVJOBA USRLIBL(?) SYSLIBL(?)"
  try {
    let conn = new Connection({
      transport: 'odbc',
      transportOptions: { dsn: 'ibmidemo' }
    });
    conn.add(new CommandCall({ type: 'cl', command: 'RTVJOBA USRLIBL(?) SYSLIBL(?)' }));
    conn.run(function (error, results) {
      if (error) {
        res.send(error);
        return;
      }
      parseString(results, { trim: true }, function (err, jsResult) {
        if (err) {
          res.send(err);
          return;
        }
        var pram1 = "USRLIBL: " + jsResult.myscript.cmd[0].row[0].data[0]._;
        var pram2 = "SYSLIBL: " + jsResult.myscript.cmd[0].row[1].data[0]._;
        httpResponse.render('node_toolkit', { title: title, cmd: cmd, pram1: pram1, pram2: pram2 })
      });
    });

  }
  catch (err) {
    console.log(err);
    httpResponse.send(error);
  }
});

odbc.connect('DSN=ibmidemo', (error, connection) => {
  if (error) { 
    console.log(error);
  } else {
    conn = connection;
    console.log('got connection: ' + JSON.stringify(conn));

    try {
      var options = {
        key: fs.readFileSync('./ibmidash-key.pem'),
        cert: fs.readFileSync('./ibmidash-cert.pem')
      }
      http.createServer(function (req, res) {
        var new_loc = 'https://' + host_name + ':' + port_secure
        console.log('new_loc:%s', new_loc)
        res.writeHead(301,
          { Location: new_loc }
        );
        res.end();
      }).listen(port_insecure);
      var httpsServer = https.createServer(options, app).listen(port_secure);
      console.log("listening on port " + port_insecure);
      io.attach(httpsServer);
    } catch (err) {
      console.log(err);
      console.log("falling back to http");
      var httpServer = http.createServer(app).listen(port_insecure);
      console.log("listening on port " + port_insecure);
      io.attach(httpServer);
    }
  }
});
