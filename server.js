#!/usr/bin/node
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql');
const mysqlSession = require('express-mysql-session')(session);
const passport = require('passport');
const saml_strategy = require('passport-saml').Strategy;
const fs = require('fs');
const cheerio = require('cheerio');
const emailjs = require('emailjs');

var config_env = process.env.CONFIG_ENV || 'production';
const config = require('./config/general')[config_env];

console.log('Using configuration', config);

if (config.app.timezone) {
  process.env['TZ'] = config.app.timezone;
}

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

var sstrat = new saml_strategy(
  {
    protocol: config.passport.saml.protocol,
    path: config.passport.saml.path,
    entryPoint: config.passport.saml.entryPoint,
    logoutUrl: config.passport.saml.logoutUrl,
    issuer: config.passport.saml.issuer,
    cert: config.passport.saml.cert,
    host: config.passport.saml.host,
    identifierFormat: config.passport.saml.identifierFormat
  },
  function (profile, done) {
    var cookieok = false;
    var ret = {
      nameID: profile.nameID,
      nameIDFormat: profile.nameIDFormat,
      cookieok: false,
      profile: profile
    };
    connection.query("SELECT cookieok FROM users WHERE uuid='"+
                       profile.infnUUID+"'",function(err,rows){
      if (rows.length <= 0) {
        var user = {
          uuid: profile.infnUUID,
          surname: profile["urn:oid:2.5.4.4"],
          givennames: profile["urn:oid:2.5.4.42"],
          email: profile.mail,
        };
        connection.query("INSERT INTO users SET ?",user); // Ship & pray.
      } else {
        if (rows[0].cookieok) ret.cookieok = true;
      }
      return done(null, ret);
    });
  });

passport.use(sstrat);

var sp_metadata = sstrat.generateServiceProviderMetadata();
console.log("Service Provider Metadata:" + sp_metadata);

var app = express();
app.set('port', config.app.port);
app.set('sslPort', config.app.sslPort);

const db_config = require('./config/database')[config_env];

var connection;
handleDisconnect();
var sessionStore = new mysqlSession({}, connection);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(session(
 {
   resave: true,
   saveUninitialized: true,
   secret: 'Evviva Gli Orsi',
   store: sessionStore
 }));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', express.static(__dirname + '/public'));

var authtree;
fs.stat(config.app.authtree, function (err, stat) {
  if (err) throw err;
  config.app.authtree_mtime = stat.mtime;
});
fs.readFile(config.app.authtree, 'utf8', function (err, data) {
  if (err) throw err;
  authtree = JSON.parse(data);
  // console.log('DEBUG: Herr Direktor ist: ' + authtree.dir.name + ' (email: ' + authtree.dir.email + ')\n');
});

var server = require('http').Server(app);
server.listen(app.get('port'), function(){
 console.log('listening on *.', app.get('port'));
});

var ssl_creds = {
  key:  fs.readFileSync(config.app.privateKey),
  cert: fs.readFileSync(config.app.certificate),
  ca:   fs.readFileSync(config.app.caCert),
  ciphers: [
    "ECDHE-RSA-AES128-SHA256",
    "DHE-RSA-AES128-SHA256",
    "AES128-GCM-SHA256",
    "!RC4", // RC4 be gone
    "HIGH",
    "!MD5",
    "!aNULL",
    "-EDH-RSA-DES-CBC3-SHA",
    "-DES-CBC3-SHA"
  ].join(':'),
  honorCipherOrder: true
};

var server = require('https').Server(ssl_creds, app);
server.listen(app.get('sslPort'), function(){
 console.log('listening on *.', app.get('sslPort'));
});

app.get('/', function (req, res) {
  if (req.isAuthenticated()) {
    fs.stat(config.app.authtree, function (err, stat) {
      if (err) throw err;
      if (config.app.authtree_mtime < stat.mtime) {
        var data = fs.readFileSync(config.app.authtree, 'utf8');
        authtree = JSON.parse(data);
        console.log('Reloaded auth tree ' + config.app.authtree + 
                    '(' + config.app.authtree_mtime + '->' +
                    stat.mtime + ').\n');
        config.app.authtree_mtime = stat.mtime;
        authnames = undefined;
      }
      connection.query("SELECT determine.* from approvals,determine WHERE " +
                       "approvals.apprid='" +
                       req.user.profile.infnUUID + "' AND " +
                       "determine.detnum=approvals.detnum AND " +
                       "approvals.status='pending'",function(err,urows){
        if (err) {
          req.session.alertMessage = "Database error: " + err.code;
          res.redirect('/');
          return;
        }

        var rquery = "SELECT * from determine WHERE " +
                     "rupid='" + req.user.profile.infnUUID + "' AND " +
                     "rup_pending=TRUE";

        if (isAdmin(req.user.profile.infnUUID)) {
          var aquery = "SELECT * from determine WHERE adm_pending=TRUE";
          connection.query(aquery, function(err,arows){
            if (err) {
              req.session.alertMessage = "Database error: " + err.code;
              res.redirect('/');
              return;
            }
            connection.query(rquery, function(err,rrows){
              if (err) {
                req.session.alertMessage = "Database error: " + err.code;
                res.redirect('/');
                return;
              }
    
              var alert_message = req.session.alertMessage;
              var success_message = req.session.successMessage;
              req.session.alertMessage = undefined;
              req.session.successMessage = undefined;

              sendHtmlWithContext(res, '/mainpage.html', authtree,
                               { user_profile: req.user.profile,
                                 user_cookieok: req.user.cookieok,
                                 user_approvals: urows,
                                 adm_approvals: arows,
                                 rup_approvals: rrows,
                                 alert_message: alert_message,
                                 success_message: success_message });
            });
          });
        } else {
          connection.query(rquery, function(err,rrows){
            if (err) {
              req.session.alertMessage = "Database error: " + err.code;
              res.redirect('/');
              return;
            }
  
            var alert_message = req.session.alertMessage;
            var success_message = req.session.successMessage;
            req.session.alertMessage = undefined;
            req.session.successMessage = undefined;

            sendHtmlWithContext(res, '/mainpage.html', authtree,
                             { user_profile: req.user.profile,
                               user_cookieok: req.user.cookieok,
                               user_approvals: urows,
                               adm_approvals: [],
                               rup_approvals: rrows,
                               alert_message: alert_message,
                               success_message: success_message });
          });
        }
      });
    });
  } else {
    req.session.alertMessage = undefined;
    req.session.successMessage = undefined;
    res.redirect('/login');
  }
});

app.get('/login',
  passport.authenticate(config.passport.strategy,
    {
      successRedirect: '/',
      failureRedirect: '/login'
    })
);

app.post(config.passport.saml.path,
  passport.authenticate(config.passport.strategy,
    {
      failureRedirect: '/',
      failureFlash: true
    }),
  function (req, res) {
    req.session.alertMessage = undefined;
    req.session.successMessage = undefined;
    res.redirect('/');
  }
);

app.get('/logout', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  sstrat.logout(req, function(err, request){
    if(!err){
        //redirect to the IdP Logout URL
        req.logout();
        req.session.destroy();
        res.redirect('/successlogout.html');
    }
  });
});

app.get('/cookieok', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    connection.query("UPDATE users SET cookieok=TRUE WHERE uuid='"+
                      req.user.profile.infnUUID+"'",function(err,rows){
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }
      req.user.cookieok = true;
      res.redirect('/successcookie.html');
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/modify', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    if (!isAdmin(req.user.profile.infnUUID)) {
      req.session.alertMessage = "Azione riservata agli amministratori.";
      res.redirect('/');
      return; 
    }
    if (!(req.query.detnum)) {
      req.session.alertMessage = "Numero determina (detnum) mancante.";
      res.redirect('/');
      return; 
    }
    connection.query("SELECT * from determine WHERE detnum='"+
                      req.query.detnum+"'",function(err,rows){
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }

      sendHtmlWithContext(res, '/modify.html', authtree,
                           { modorder: rows[0] });
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/print', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    if ((!req.query.detnum) && (!req.query.defnum)) {
      req.session.alertMessage = "Numero determina (detnum/defnum) mancante.";
      res.redirect('/');
      return; 
    }
    var num_clause = '';
    var printreq = '???';
    if (req.query.defnum) {
      num_clause = "AND determine.defnum='" + req.query.defnum + "'";
      printreq = req.query.defnum;
    } else {
      num_clause = "AND determine.detnum='" + req.query.detnum + "'";
      printreq = req.query.detnum;
    }
    connection.query("SELECT * from determine,approvals WHERE " +
                     "determine.detnum=approvals.detnum "+
                     num_clause, function(err,rows){
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }

      if (rows.length <= 0) {
        req.session.alertMessage = "Richiesta " + printreq + 
                                   " non trovata.";
        res.redirect('/');
        return; 
      }
      // Requester, RUP and admins can print order.
      if ((rows[0].rupid != req.user.profile.infnUUID) &&
          (rows[0].reqid != req.user.profile.infnUUID) &&
          (!isAdmin(req.user.profile.infnUUID))) {
        req.session.alertMessage = "Stampa non autorizzata (permessa solo a " +
                                   "richiedente, RUP e Amministratori).";
        res.redirect('/');
      } else {
        if (((req.query.mint) && (req.query.mint.length > 0)) &&
            ((rows[0].cig) && (rows[0].cig.length > 0))) {
          sendHtmlWithContext(res, '/printmdi.html', authtree,
                             { printorder: rows });
        } else {
          sendHtmlWithContext(res, '/print.html', authtree,
                             { printorder: rows });
        }
      }
    });
  } else {
    res.redirect('/login');
  }
});

app.post('/comemail', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    if (!config.app.smtpServer) {
      req.session.alertMessage = "Funzione non configurata.";
      res.redirect('/');
      return; 
    }
    if (!req.body.detnum) {
      req.session.alertMessage = "Numero richiesta (detnum) mancante.";
      res.redirect('/');
      return; 
    }
    if ((!req.body.emailtxt) || (req.body.emailtxt.length <= 0)) {
      req.session.alertMessage = "testo (emailtxt) mancante.";
      res.redirect('/');
      return; 
    }

    connection.query("SELECT * from determine WHERE " +
                     "detnum="+req.body.detnum, function(err,rows) {
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }
      if (rows.length <= 0) {
        req.session.alertMessage = "Richiesta #" + req.body.detnum +
                                   " non trovata.";
        res.redirect('/');
        return;
      }
      var csexp = rows[0].exp.split(':');
      var appremails = [ req.user.profile.mail, getRupEmail(rows[0].rupid) ];
      for (var i in authtree.exps[csexp[0]][csexp[1]]) {
        var apprid = authtree.exps[csexp[0]][csexp[1]][i].infnUUID;
        if ((apprid == req.user.profile.infnUUID) ||
            (apprid == rows[0].rupid)) {
          continue;
        }
        appremails.push(authtree.exps[csexp[0]][csexp[1]][i].email); 
      }

      if (req.body.emailcc) {
        var ccs = req.body.emailcc.split(',');
        for (var i in ccs) {
          appremails.push(ccs[i]);
        }
      }

      var mcli  = emailjs.server.connect({
         host: config.app.smtpServer, 
         ssl: false
      });
  
      mcli.send({
        text:  req.body.emailtxt + "\r\n---------\r\n" +
               "Inviato dalla piattaforma " + config.app.host + "\r\n" +
               "per conto di " + req.user.profile["urn:oid:2.5.4.42"] + " " +
               req.user.profile["urn:oid:2.5.4.4"].toUpperCase() + ".\r\n", 
        from:  req.user.profile.mail, 
        to:    rows[0].reqemail,
        cc:    appremails,
        subject: req.body.emailsubj
      }, function(err, message) { 
        if (err) {
          req.session.alertMessage = err.smtp;
          console.log(err);
        } else req.session.successMessage = "E-mail inviata.";
        res.redirect('/');
      });
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/list', function (req, res) {
  req.session.successMessage = undefined;
  req.session.alertMessage = undefined;
  if (req.isAuthenticated()) {
    
    var query = "SELECT * from determine ";
    var need_where = true;

    if (!(req.query.all)) {
      query += "WHERE rup_finished=false ";
      need_where = false;
    }

    if (!isAdmin(req.user.profile.infnUUID)) {
      if (need_where) {
        query += "WHERE ";
        need_where = false;
      } else {
        query += "AND ";
      }
      query += "( reqid='" + req.user.profile.infnUUID +
               "' OR rupid='"+
               req.user.profile.infnUUID + "') ";
    }

    query += "ORDER BY detnum";

    connection.query(query, function(err,rows){
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }

      var aquery = "SELECT * from approvals,determine " + 
                   "WHERE determine.detnum=approvals.detnum ";

      if (!(req.query.all)) {
        aquery += "AND ( determine.rup_finished=false " +
                  "OR approvals.status='pending' ) ";
      }

      if (!isAdmin(req.user.profile.infnUUID)) {
        aquery += "AND ( determine.reqid='" + req.user.profile.infnUUID +
                 "' OR determine.rupid ='"+
                 req.user.profile.infnUUID + "' OR " +
                 "approvals.apprid ='"+ req.user.profile.infnUUID + "') ";
      }

      aquery += "ORDER BY determine.detnum";

      connection.query(aquery, function(err,arows){
        if (err) {
          req.session.alertMessage = "Database error: " + err.code;
          res.redirect('/');
          return;
        }
        var j = 0;
        var maxj = arows.length;


        // Merge the rows with no approvals with the approval/determine join set.
        for (var i = 0; i < rows.length; i++) {
          if ((j >= maxj) || (rows[i].detnum < arows[j].detnum)) {
            arows.push(rows[i]);
            continue;
          }
          while (arows[j].detnum <= rows[i].detnum) {
            j++;
            if (j >= maxj) break;
          }
        }

        // If we arent' admins we need to look up *all* approvals for the
        // orders approved by the requestor.
        var dquery = "SELECT * from approvals,determine " + 
                     "WHERE determine.detnum=approvals.detnum AND " +
                     "approvals.apprid<>'" + req.user.profile.infnUUID + "' AND (";
        var need_dquery = false;

        for (var i in arows) {
          if (arows[i].apprid) {
            arows[i].apprname = authName(arows[i].apprid);
          }
          if (arows[i].apprid == req.user.profile.infnUUID) {
            if (need_dquery) {
              dquery += " OR ";
            } else {
              need_dquery = true;
            }
            dquery += "determine.detnum=" + arows[i].detnum;
          }
        }
        dquery += ")";

        if (need_dquery && (!isAdmin(req.user.profile.infnUUID))) {
          connection.query(dquery, function(err,drows){
            if (err) {
              req.session.alertMessage = "Database error: " + err.code;
              res.redirect('/');
              return;
            }
            for (var i in drows) {
              if (drows[i].apprid) {
                drows[i].apprname = authName(drows[i].apprid);
              }
              arows.push(drows[i]);
            }
            arows.sort(function(r1, r2) {
              if (r1.detnum > r2.detnum) return -1;
              return 1;
            });
            res.json(arows);
          });
        } else {
          arows.sort(function(r1, r2) {
            if (r1.detnum > r2.detnum) return -1;
            return 1;
          });
          res.json(arows);
        }
      });
    });
  } else {
    res.redirect('/login');
  }
});

app.post('/add_request', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    var today_date = new Date();

    var datefields = req.body['orddate'].split(/[^0-9]+/);
    var ord_date = new Date(datefields[2], datefields[1]-1, datefields[0]);
    var deter ={
      reqname: req.body['reqname'],
      reqid:   req.user.profile.infnUUID,
      rupid:   req.body['rupid'],
      descobj: req.body['descobj'],
      reqamount:req.body['reqamount'],
      exp:     req.body['expid'],
      capid:   req.body['capid'],
      critid:  req.body['critid'],
      reqemail:req.body['reqemail'],
      modop:   req.body['modop'],
      docurl:  req.body['docurl'],
      orddate: dateToDb(ord_date),
      created: dateTimeToDb(today_date),
      rup_pending: true
    }
    if (!(deter.exp)) {
      req.session.alertMessage = "Sigla esperimento non specificata.";
      res.redirect('/');
      return; 
    }

    // If the requestor is the RUP, assume he/she approves...
    if (req.user.profile.infnUUID == req.body['rupid']) {
      deter.rup_pending = false;
      deter.rup_approved = true;
    }

    connection.query("INSERT INTO determine SET ?",deter,function(err,dbres) {
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }

      var csexp = deter.exp.split(':');
      var apprids = [];
      var appremails = [];
      req.session.successMessage = 'Inserita Richiesta Ordine n. ' +
                                   dbres.insertId + '.';
                                 
      for (var i in authtree.exps[csexp[0]][csexp[1]]) {
        var appp = authtree.exps[csexp[0]][csexp[1]][i];
        var apprv = {
          detnum: dbres.insertId,
          apprid: appp.infnUUID,
          appremail: appp.email,
          isdir: (appp.infnUUID == authtree.dir.infnUUID),
          status: 'pending',
          apcreated: dateTimeToDb(today_date)
        }
        if ((apprv.apprid == req.user.profile.infnUUID) ||
            (apprv.apprid == authtree.dir.infnUUID)) {
          // Requestor can approve. Bump to RUP if needed, then director.
          continue;
        }
        apprids.push(apprv); 
        appremails.push(appp.email); 
      }
      if ((apprids.length == 0) &&
          (req.user.profile.infnUUID == req.body['rupid'])) {
        // Requestor is the RUP and no other needs to approve.
        // Bump to director.
        var dirappr = {
          detnum: dbres.insertId,
          apprid: authtree.dir.infnUUID,
          appremail: authtree.dir.email,
          isdir: true,
          status: 'pending',
          apcreated: dateTimeToDb(today_date)
        }
        apprids.push(dirappr); 
        appremails.push(authtree.dir.email); 
      }
      // At least the RUP will have to approve.
      if (deter.rup_pending) {
        var rup_email = getRupEmail(deter.rupid);
        if (rup_email.length > 0) {
          approvalEmail(dbres.insertId, [ rup_email ], deter,
                        'accettazione', 'RUP');
        }
      }
      if (apprids.length > 0) {
        var query = "INSERT INTO approvals (";
        var first = true;
        var keys = [];
        for (key in apprids[0]) {
          if (!first) query += ',';
          else first = false; 
          query += key;
          keys.push(key);
        }
        query += ") VALUES (";
        for (var i in apprids) {
         if (i>0) query += ",(";
          for (var j in keys) {
            if (j>0) query += ',';
            var val = apprids[i][keys[j]];
            if ((typeof val) == 'string') {
              query += "'" + val + "'";
            } else {
              query += val;
            }
          }
         query += ")";
        }
        
        if (appremails.length > 0) {
          approvalEmail(dbres.insertId, appremails, deter);
        }


        connection.query(query, function(err,dbres) {
          if (err) {
            req.session.alertMessage = "Database error: " + err.code;
            res.redirect('/');
          } 
          res.redirect('/');
        });
      } else {
        res.redirect('/');
      }
    });
  } else {
    res.redirect('/login');
  }
});

app.post('/change_request', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    if (!isAdmin(req.user.profile.infnUUID)) {
      req.session.alertMessage = "Solo gli amministratori possono modificare le determine.";
      res.redirect('/');
      return; 
    }
    var today_date = new Date();
    var datefields = req.body['orddate'].split(/[^0-9]+/);
    var ord_date = new Date(datefields[2], datefields[1]-1, datefields[0]);
    var deter ={
      reqname: req.body['reqname'],
      rupid:   req.body['rupid'],
      cig:     req.body['cig'],
      descobj: req.body['descobj'],
      reqamount:req.body['reqamount'],
      exp:     req.body['expid'],
      capid:   req.body['capid'],
      critid:  req.body['critid'],
      reqemail:req.body['reqemail'],
      modop:   req.body['modop'],
      docurl:  req.body['docurl'],
      rup_approved:req.body['rup_approved'],
      orddate: dateToDb(ord_date)
    }

    if (!(deter.exp)) {
      req.session.alertMessage = "Sigla esperimento non specificata.";
      res.redirect('/');
      return; 
    }

    if (!deter.rup_approved) {
      deter.rup_pending = true;
      var rup_email = getRupEmail(deter.rupid);
      if (rup_email.length > 0) {
        approvalEmail(req.body['detnum'], [ rup_email ], deter,
                      'accettazione (richiesta modificata)', 'RUP');
      }
    }
    
    connection.query("UPDATE determine SET ? WHERE detnum="+req.body['detnum'],
                     deter,function(err,dbres) {
      if (err) {
        req.session.alertMessage = "Database error: " + err.code;
        res.redirect('/');
        return;
      }

      // Record admin change in the DB.
      connection.query("INSERT INTO admmod (detnum, admid) VALUES (" +
                       req.body['detnum'] + ",'" + req.user.profile.infnUUID + "')");

      req.session.successMessage = 'Modificata Richiesta Ordine n. ' +
                                   req.body['detnum'] + '.';
      // If we don't want to ask for a new approval we are done. 
      if (!config.app.authorizeOnChanges) {
        res.redirect('/');
        return;
      }

      // Make all approvals pending again.
      var pquery="UPDATE approvals SET status='pending' WHERE" +
                      " detnum=" + req.body['detnum'] + " AND" +
                      " apprid<>'" + req.user.profile.infnUUID + "'";
      connection.query(pquery, function(err,dbres) {
        if (err) {
          req.session.successMessage = undefined;
          req.session.alertMessage = "Database error: " + err.code;
          res.redirect('/');
          return;
        }
        connection.query("SELECT appremail from approvals WHERE status='pending'" +
                      " AND detnum=" + req.body['detnum'], function(err,erows) {
          var appremails = [];
          for (var i in erows) {
            appremails.push(erows[i].appremail);
          }
          if (appremails.length > 0) {
            approvalEmail(req.body['detnum'], appremails, deter,
                          'ri-approvazione (richiesta modificata)');
          }
        });
        res.redirect('/');
      });
    });
  } else {
    res.redirect('/login');
  }
});

app.post('/approval', function (req, res) {
  req.session.alertMessage = undefined;
  req.session.successMessage = undefined;
  if (req.isAuthenticated()) {
    var apprid = req.body.rupid;
    var isrup = true;
    var isadmin = false;
    var apprstate = 'denied';
    var approved = false;
    if (!apprid) {
      isrup = false;
      apprid = req.body.admid;
      if (apprid) {
        isadmin = true;
      } else {
        apprid = req.body.userid;
      }
    }
    if ((req.body.action.indexOf('pprov') > 0)||
        (req.body.action.indexOf('onf') > 0)) {
      apprstate = 'approved';
      approved = true;
    }
    if (apprid != req.user.profile.infnUUID) {
      // Approval is not coming from the user that has to approve. Reject it.
      req.session.alertMessage = 'Approvazione non autorizzata.';
      res.redirect('/');
    } else {
      if (req.body.cig) {
        connection.query("UPDATE determine SET cig='" + req.body.cig +
                         "', rup_pending=FALSE, rup_finished=TRUE " +
                         " WHERE detnum="+ req.body.detnum,
                         function(err,dbres) {
           if (err) {
            req.session.alertMessage = "Database error: " + err.code;
          }
          res.redirect('/');
        });
        return;
      } else if (isadmin) {
        if (approved) {
          var today_date = new Date();
          connection.query("SELECT MAX(defnum) AS defnum from determine;",
                         function(err,drow) {
            if (err) {
              req.session.alertMessage = "Database error: " + err.code;
            }
            var nextnum = drow[0].defnum; 
            if (!nextnum) {
              nextnum = 1;
            } else nextnum++;

            connection.query("UPDATE determine SET defnum=" + nextnum + "," +
                         " admid='" + apprid + "', adm_pending=FALSE," +
                         " orddate='" + dateToDb(today_date) + "'," +
                         " rup_pending=TRUE, rup_finished=FALSE" +
                         " WHERE detnum="+ req.body.detnum,
                         function(err,dbres) {
              if (err) {
                req.session.alertMessage = "Database error: " + err.code;
              }
              // Send e-mail to the RUP
              connection.query("SELECT * from determine where detnum=" +
                               req.body.detnum, function(err,rows) {
                if (!err) {
                  var rup_email = getRupEmail(rows[0].rupid);
                  if (rup_email.length > 0) {
                    approvalEmail(rows[0].detnum, [ rup_email ], rows[0],
                                'inserzione del CIG', 'RUP');
                  }
                }
              });
              res.redirect('/');
            });
          });
        } else {
          res.redirect('/');
        }
        return;
      }

      var query;
      if (isrup) {
        query = "UPDATE determine SET rup_pending=FALSE, rup_approved=" +
                approved + ", rup_finished=" + (!approved) + " " +
                "WHERE rup_pending=TRUE AND " +
                "rupid='" + apprid + "'";
      } else {
        query = "UPDATE approvals SET status='" + apprstate + "' WHERE " +
                "status='pending' AND apprid='" +
                 apprid + "'";
      }
      var dnums = req.body.detnum.split(',');
      var dnum_query = '';
      for (var i=0; i<dnums.length; i++) {
        if (i > 0) {
          dnum_query += " OR ";
        }
        dnum_query += "detnum=" + dnums[i];
      }
      connection.query(query + " AND " + dnum_query, function(err,dbres) {
        if (err) {
          req.session.alertMessage = "Database error: " + err.code;
          res.redirect('/');
          return;
        }

        var status_query;
        if (approved) {
          if (apprid == authtree.dir.infnUUID) {
            connection.query("UPDATE determine SET rup_finished=FALSE," +
                  " adm_pending=TRUE" +
                  " WHERE " + dnum_query, function(err,dbres) {
              if (err) {
                req.session.alertMessage = "Database error: " + err.code;
              } else {
                multiApprovalEmail(req.body.detnum, [ config.app.adminEmail ]);
              }
              res.redirect('/');
            });
            return;
          } else {
            connection.query("SELECT detnum from determine WHERE rup_approved=" +
                             "FALSE" + " AND " + dnum_query,
                             function(err,rprows) {
              if (err) {
                req.session.alertMessage = "Database error: " + err.code;
                res.redirect('/');
                return;
              }
              // Not approved by RUP => still pending.
              for (var row in rprows) {
                for (var i in dnums) {
                  if ((!isrup) && (dnums[i] == rprows[row].detnum)) {
                    dnums[i] = 0;
                    break;
                  }
                }
              }
              connection.query("SELECT detnum from approvals WHERE status=" +
                               "'pending'" + " AND " + dnum_query,
                               function(err,pdrows) {
                if (err) {
                  req.session.alertMessage = "Database error: " + err.code;
                  res.redirect('/');
                  return;
                }
    
                // Another approval is pending => still pending.
                for (var row in pdrows) {
                  for (var i in dnums) {
                    if (dnums[i] == pdrows[row].detnum) {
                      dnums[i] = 0;
                      break;
                    }
                  }
                }
                var emaildetnums = '';
                for (var i in dnums) {
                  if (dnums[i] <= 0) continue; // There is another pending auth.
                  // Move approval(s) to director.
                  var today_date = new Date();
                  var dirappr = {
                    detnum: dnums[i],
                    apprid: authtree.dir.infnUUID,
                    appremail: authtree.dir.email,
                    isdir: true,
                    status: 'pending',
                    apcreated: dateTimeToDb(today_date)
                  };
                  connection.query("INSERT INTO approvals SET ?",dirappr);
                  emaildetnums += dnums[i] + " ";
                }
                if (emaildetnums.length > 0) {
                  multiApprovalEmail(emaildetnums, [ authtree.dir.email ]);
                }
                res.redirect('/');
              });
            });
          }
        } else {
          // Authorisation denied. This puts the elements in a final state
          connection.query("UPDATE determine SET rup_pending=FALSE, rup_finished=TRUE" +
                " WHERE " + dnum_query, function(err,dbres) {
            if (err) {
              req.session.alertMessage = "Database error: " + err.code;
            }
            connection.query("SELECT * from determine WHERE " +
                             dnum_query, function(err,mrows) {
              if (!err) {
                for (var row in mrows) {

                  var csexp = mrows[row].exp.split(':');
                  var emailccs = [ req.user.profile.mail,
                                     mrows[row].reqemail,
                                     getRupEmail(mrows[row].rupid) ];
                  for (var i in authtree.exps[csexp[0]][csexp[1]]) {
                    emailccs.push(authtree.exps[csexp[0]][csexp[1]][i].email);
                  }
                  rejectionEmail(mrows[row].detnum, mrows[row].reqemail,
                                 emailccs, mrows[row], authName(apprid));
                }
              }
            });
            res.redirect('/');
          });
        }
      });
    }
  } else {
    res.redirect('/login');
  }
});

app.get('/get_sp_metadata', function (req, res) {
  res.set('Content-Type', 'text/xml');
  res.send(sp_metadata);
});

//--------------FUNCTIONS-----
function sendHtmlWithContext(res, file) {
  if (arguments.length < 3) return;

  var html = fs.readFileSync(__dirname + '/public' + file, 'utf8');
  var $ = cheerio.load(html);
  var scriptNode = '<script>\n';
  
  for(var i=2; i<arguments.length; i++) {
    if ((typeof arguments[i]) == "object") {
      for (attr in arguments[i]) {
        scriptNode += 'var ' + attr + '=' +
                      JSON.stringify(arguments[i][attr]) + ';\n';
      }
    }
  }
  scriptNode += "</script>\n";

  $('head').append(scriptNode);
  res.send($.html());
}

function handleDisconnect() {
  console.log('Call handleDisconnect');
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if (err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    } else {
      console.log("Mysql: connected");
    }
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {// Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}  

var authnames;
function authName(uuid) {
  if (authnames === undefined){
    authnames = {};
    for (var csn in authtree.exps) {
      for (var exp in authtree.exps[csn]) {
        for (var auth in authtree.exps[csn][exp]) {
          authnames[authtree.exps[csn][exp][auth].infnUUID] = { 
                                 name: authtree.exps[csn][exp][auth].name,
                                 email: authtree.exps[csn][exp][auth].email
          };
        }
      }
    }
    authnames[authtree.dir.infnUUID] = { 
                             name: authtree.dir.name,
                             email: authtree.dir.email
    };
  }
  return authnames[uuid];
}

function getRupEmail(uuid) {
  for (rup in authtree.rups) {
    if (uuid == authtree.rups[rup].infnUUID) return authtree.rups[rup].email;
  }
  return null;
}

function isAdmin(uuid) {
  if (uuid == authtree.dir.infnUUID) return true;
  for (admin in authtree.admins) {
    if (uuid == authtree.admins[admin].infnUUID) return true;
  }
  return false;
}

function dateToDb (when) {
  var res = when.getFullYear() + '-';
  var month = when.getMonth()+1;
  if (month < 10) res += '0';
  res += month + '-';
  var day = when.getDate();
  if (day < 10) res += '0';
  res += day;
  return res;
}

function dateTimeToDb (when) {
  var res = dateToDb(when) + ' '; 
  var hours = when.getHours();
  if (hours < 10) res += '0';
  res += hours + ':';
  var minutes = when.getMinutes();
  if (minutes < 10) res += '0';
  res += minutes;
  return res;
}

function sendEmail(from, dest, subject, msg, cc) {
  if (!(config.app.smtpServer)) return;
  var mcli  = emailjs.server.connect({
     host: config.app.smtpServer, 
     ssl: false
  });

  if (cc === undefined) {
    cc = from;
  }
  if ((typeof cc) == "string") {
    if (cc.substr(0,7) == "noreply") cc = undefined;
  }

  mcli.send({
    text:  msg, 
    from:  from, 
    to:    dest,
    cc:    cc,
    subject: subject
  }, function(err, message) { if (err) console.log(err); });
}

function approvalEmail(detnum, appremails, deter, op, dest) {
  if (!(config.app.smtpServer)) return;
  if (!op) op = "approvazione";
  if (!dest) dest = "responsabile dei fondi";
  var emailSubject = op.substr(0,1).toUpperCase() + 
                     op.substr(1) + " richiesta determina #" + detnum +
                     " su fondi " + deter.exp;
  var emailText = "Richiedo al " + dest + " la " + op +
                  " della richiesta di ordine INFN-Milano n. " + detnum + "\r\n";
  emailText += "Importo: EUR " + deter.reqamount +
               " Sigla: " + deter.exp + " Capitolo:" + deter.capid + "\r\n";
  emailText += "Oggetto: " + deter.descobj + "\r\n\r\n";
  emailText += "Per la " + op + " visitare il sito http://devel.mi.infn.it.\r\n\r\n";
  emailText += "Grazie.\r\n" + deter.reqname + "\r\n";
  //emailText += "DEBUG: Orig dest: " + appremails.join(',') + "\r\n";
  //appremails = [ "francesco.prelz@mi.infn.it" ] // DEBUG!
  sendEmail(deter.reqemail, appremails, emailSubject, emailText);
}

function rejectionEmail(detnum, dest, emailccs, deter, rejct) {
  if (!(config.app.smtpServer)) return;
  var emailSubject = "RIFIUTO richiesta determina #" + detnum +
                     " su fondi " + deter.exp;
  var emailText = "La richiesta di ordine INFN-Milano n. " + detnum + "\r\n";
  emailText += "Importo: EUR " + deter.reqamount +
               " Sigla: " + deter.exp + " Capitolo:" + deter.capid + "\r\n";
  emailText += "Oggetto: " + deter.descobj + "\r\n\r\n";
  emailText += "NON e' stata approvata.\r\n\r\n" + rejct.name + "\r\n";
  sendEmail(rejct.email, dest, emailSubject, emailText, emailccs);
}

function multiApprovalEmail(detnums, appremails, op) {
  if (!(config.app.smtpServer)) return;
  if (!op) op = "approvazione";
  var emailSubject = op.substr(0,1).toUpperCase() + 
                     op.substr(1) + " varie richieste determine";
  var emailText = "E' stata richiesta la " + op + " delle seguenti " +
                  "richieste di determine INFN-Milano: " + detnums + "\r\n\r\n";
  emailText += "Per la " + op + " visitare il sito http://devel.mi.infn.it.\r\n\r\n";
  emailText += "Grazie.\r\n";
  //emailText += "DEBUG: Orig dest: " + appremails.join(',') + "\r\n";
  //appremails = [ "francesco.prelz@mi.infn.it" ] // DEBUG!
  sendEmail("noreply@devel.mi.infn.it", appremails, emailSubject, emailText);
}
