  var enable_admin_buttons = false;

  function printable_date(date) {
    var res = '';
    var day = date.getDate();
    if (day < 10) res = '0';
    res += day + '/';
    var month = date.getMonth()+1;
    if (month < 10) res += '0';
    res += month + '/' + date.getFullYear();
    return res;
  }

  function printable_time(date) {
    var res = '';
    var hours = date.getHours();
    if (hours < 10) res += '0';
    res += hours + ':';
    var mins = date.getMinutes();
    if (mins < 10) res += '0';
    res += mins;
    return res;
  }

  function printable_datetime(date) {
    var res = printable_date(date) + ' ' + printable_time(date);
    return res;
  }

  function italian_date(date) {
    var res = '';
    var months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    var day = date.getDate();
    if (day < 10) res = '0';
    res += day + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    return res;
  }

  function printable_amount(reqamount) {
    var amountcents = parseInt(reqamount * 100. + 0.5).toString();
    if (amountcents.length < 3) {
      var zeros = '000';
      amountcents = zeros.substr(0, 3-amountcents.length) + amountcents;
    }
    var decamount = amountcents.substr(0, amountcents.length - 2) + "," +
                    amountcents.substr(amountcents.length - 2);
    return decamount;
  }

  function rup_name(uuid) {
    for (var i in rups) {
      if (rups[i].infnUUID == uuid) return rups[i].name;
    }
    return "Sconosciuto";
  }

  function rup_email(uuid) {
    for (var i in rups) {
      if (rups[i].infnUUID == uuid) return rups[i].email;
    }
    return "";
  }

  function adm_name(uuid) {
    for (var i in admins) {
      if (admins[i].infnUUID == uuid) return admins[i].name;
    }
    return "Sconosciuto";
  }

  function start_ord_table_row(ord) {
    var ret = '';
    var ord_date = printable_date(new Date(ord.orddate));
    var num = ord.detnum;
    if (ord.defnum > 0) {
      num = "<font color='blue'>"+ord.defnum+"</font> (R" + num +")";
    } else {
      num = "R" + num;
    }

    ret += '<tr><td>' + num;
    ret += '<input type="button" value="+" onClick="ord_details_popup(' +
           ord.detnum + ');" />';
    ret += '<input type="button" value="Email" onClick="comment_email_popup(' +
           ord.detnum + ');" /></td>';
    ret += '<td>' + ord_date + '</td>';
    ret += '<td>' + ord.reqname + '</td>\n';
    ret += '<td>' + ord.exp + '</td>\n';
    ret += '<td>' + ord.capid + '</td>';
    ret += '<td>' + printable_amount(ord.reqamount) + '</td>';
    ret += '<td>' + ord.descobj + '</td>';
    return ret;
  }

  function find_ord(detnum) {
    if (adm_approvals !== undefined) {
      for (var i in adm_approvals) {
        if (adm_approvals[i].detnum == detnum) return adm_approvals[i];
      }
    }
    if (rup_approvals !== undefined) {
      for (var i in rup_approvals) {
        if (rup_approvals[i].detnum == detnum) return rup_approvals[i];
      }
    }
    if (user_approvals !== undefined) {
      for (var i in user_approvals) {
        if (user_approvals[i].detnum == detnum) return user_approvals[i];
      }
    }
    return null;
  }

  function find_name(id) {
    if (user_profile.infnUUID == id) {
      return user_profile['urn:oid:2.5.4.4'].toUpperCase() +
             ', ' + user_profile['urn:oid:2.5.4.42'];
    }
    for (var i in rups) {
      if (rups[i].infnUUID == id) return rups[i].name;
    }
    for (var i in admins) {
      if (admins[i].infnUUID == id) return admins[i].name;
    }
    if (dir.infnUUID == id) return dir.name;
    for (var csn in exps) {
      for (var exp in exps[csn]) {
        for (var i in exps[csn][exp]) {
          if (exps[csn][exp][i].infnUUID == id) return exps[csn][exp][i].name;
        }
      }
    }
    return null;
  }

  function ord_details_popup(detnum) {
    var ord = find_ord(detnum);
    if (!ord) return;
    var modal_id = "ordDetails";
    var printable_fnames = {
      "detnum" : "Numero Richiesta di Determina",
      "defnum" : "Numero Determina (definitivo)",
      "reqname": "Richiedente",
      "reqid":   "skip",
      "admid":   "Controllo amministrativo",
      "rupid":   "Resp. Unico Procedimento",
      "descobj": "Oggetto dell'acquisto",
      "comment": "Commenti all'acquisto",
      "reqamount": "Importo dell'acquisto",
      "cig":     "CIG",
      "exp":     "Sigla Esperimento",
      "capid":   "Capitolo di Spesa",
      "critid":  "Criterio Aggiudicazione",
      "reqemail":"E-Mail richiedente",
      "modop":   "Individuazione Operatori",
      "docurl":  "URL documenti",
      "notes":   "skip",
      "orddate": "Data Determina (o richiesta)",
      "adm_pending": "skip",
      "rup_pending": "skip",
      "rup_approved": "skip",
      "rup_finished": "skip",
      "created": "Data di creazione",
      "lastupdate": "Data ultimo aggiornamento"
    };

    var detModal = $("#" + modal_id);
    if ((!detModal) || (detModal.length <= 0)) {
      $('body').append($('<div>', {
        id: modal_id, 
        class: "modal", 
        style: "display:none"
      }));
      detModal = $("#" + modal_id);
    }

    if ((!detModal) || (detModal.length <= 0)) return;

    detModal.html('');
    var detTable = "<table>";
    for (f in ord) {
      var pname = printable_fnames[f];
      if (pname == "skip") continue;
      if (!pname) pname = f;
      var pval = ord[f];

      if (f.substr(f.length - 2) == "id") {
        var nval = find_name(pval);
        if (nval) pval = nval;
      } else if (f.substr(f.length - 3) == "url") {
        pval = '<a Href="' + pval + '" target="_blank">' + pval + '</a>';
      } else if ((f == "created") || (f.substr(f.length - 4) == "date")) {
        pval = printable_datetime(new Date(pval));
      } else if (f == "reqamount") pval = printable_amount(pval);

      detTable += "<tr><td>"+pname+":</td>"; 
      detTable += "<td>"+pval+"</td></tr>\n"; 
    }
    detTable += "</table>\n";
    detTable += '<input type="button" onClick="$.modal.close();"' +
                'class="ui-btn ui-corner-all ui-shadow" ' +
                'data-type="inline" ' +
                'value="Chiudere" />';
    detModal.html(detTable);
    detModal.modal();
  }

  function comment_email_popup_ord(ord) {
    var modal_id = "commentEmail";

    var detModal = $("#" + modal_id);
    if ((!detModal) || (detModal.length <= 0)) {
      $('body').append($('<div>', {
        id: modal_id, 
        class: "modal", 
        style: "display:none"
      }));
      detModal = $("#" + modal_id);
      if ((!detModal) || (detModal.length <= 0)) return;
      var rupEmail = rup_email(ord.rupid);
      var subject = 'Richiesta chiarimenti sulla determina R'+
                    ord.detnum;
      var mHtml = 'Invia un messaggio di richiesta di chiarimenti.<br />' +
                  'From: ' + user_profile.mail + '<br />\n' +
                  'To: ' + ord.reqemail + '<br />\n' +
                  'Cc: '+ user_profile.mail + ', ' +
                          rupEmail + ', eventuali resp. fondi<br />\n' +
                  'Subject: ' + subject + '<br />\n' +
                  '<form method="post" data-ajax="false" action="/comemail">\n';
      mHtml += 'Altri Cc:<input type="text" name="emailcc" style="width:86%" /><br />\n';
      mHtml += '<input type="hidden" name="emailsubj" value="' + subject +
               '" />\n';
      mHtml += '<input type="hidden" name="detnum" value="' + ord.detnum +
               '" />\n';
      mHtml += '<textarea name="emailtxt" rows="15" style="width:90%" id="mtxt"></textarea>\n';
      mHtml += '<input type="submit" class="ui-btn ui-corner-all ui-shadow" ' +
                'data-type="inline" ' +
               'name="action" value="Invia Messaggio">\n'
      mHtml += '<input type="button" onClick="$.modal.close();"' +
                'class="ui-btn ui-corner-all ui-shadow" ' +
                'data-type="inline" ' +
                'value="Chiudere" /></form>';
      detModal.html(mHtml);
    }

    detModal.modal({closeExisting: false});
  }

  function comment_email_popup(detnum) {
    var ord = find_ord(detnum);
    if (!ord) return;
    return comment_email_popup_ord(ord);
  }

  function comment_email_popup_json(jsonord) {
    var ord = JSON.parse(jsonord);
    if (!ord) return;
    return comment_email_popup_ord(ord);
  }

  function populate_popup(orders) {

    listOrderDatatable.clear();
    var needDraw = false;

    for (var i=0; i<orders.length; i++) {
      if (orders[i].detnum > 0) {
        var ord_date = printable_date(new Date(orders[i].orddate));
        var ord_update = new Date(orders[i].lastupdate);
        var ord_updprn = printable_datetime(ord_update);
        var auth_miss = "";
        var auth_got = "";
        var got_dir = false;
        if (!(orders[i].rup_finished)) {
          if (orders[i].rup_pending) {
            if (auth_miss.length > 0) auth_miss += " - "; 
            if (!(orders[i].rup_approved)) auth_miss += "RUP"; 
            else auth_miss += "CIG"; 
          }
          if (orders[i].rup_approved) {
            if (auth_got.length > 0) auth_got += " - "; 
            auth_got += "RUP";
          }
        }

        var next;
        for (next = i; (orders[next] !== undefined) && 
             (orders[next].detnum == orders[i].detnum); next++) {
          var name = "DIR";
          if (orders[next].apprid && orders[next].apprname && orders[next].status) {
            if ((!orders[next].isdir) &&
                (orders[next].apprid != dir.infnUUID)) {
              name = orders[next].apprname.name;
            }
            if (orders[next].status == "pending") {
              if (auth_miss.length > 0) auth_miss += " - "; 
              auth_miss += name;
            } else if (orders[next].status == "approved") {
              if (auth_got.length > 0) auth_got += " - "; 
              auth_got += name;
              if ((orders[next].isdir) ||
                  (orders[next].apprid == dir.infnUUID)) got_dir = true;
            }
          }
        }

        if (orders[i].rup_finished) {
          if (auth_got.length > 0) auth_got += " - "; 
          auth_got += "Finalizzato: "; 
          if (!got_dir) auth_got += "NON ";
          auth_got += "approvato.";
        } else if (got_dir) {
          if (orders[i].defnum) {
            if (auth_got.length > 0) auth_got += " - "; 
            auth_got += "ADM";
          } else if (orders[i].adm_pending) {
            if (auth_miss.length > 0) auth_miss += " - "; 
            auth_miss += "ADM";
          }
        }

        i = next-1; 

        var num = orders[i].defnum;
        if ((!num) && (num <= 0)) {
          num = "R" + orders[i].detnum;
        } else {
          num += " (R" + orders[i].detnum + ")";
        }
        var tableRow = [];
        tableRow.push(num);
        tableRow.push(ord_date);
        tableRow.push(orders[i].cig);
        tableRow.push(orders[i].reqname);
        tableRow.push(orders[i].reqemail);
        tableRow.push(rup_name(orders[i].rupid));
        tableRow.push(orders[i].exp);
        tableRow.push(orders[i].capid);
        tableRow.push(printable_amount(orders[i].reqamount));
        tableRow.push(orders[i].descobj);
        tableRow.push(orders[i].comment);
        tableRow.push(orders[i].modop);
        tableRow.push(orders[i].critid);
        tableRow.push(adm_name(orders[i].admid));
        if (orders[i].docurl.length > 0) {
          tableRow.push('<a href=\"' + orders[i].docurl + '\" target=\"_blank\">Doc</a>');
        } else {
          tableRow.push('');
        }
        tableRow.push(auth_miss);
        tableRow.push(auth_got);
        tableRow.push(ord_updprn);
        var actions = "<input type=\"button\" onClick=\"var win=window.open('/print?detnum=" + orders[i].detnum + "');\" " +
                    "data-type=\"inline\" value=\"Stampa\" />";
        var emailbutid;
        if (enable_admin_buttons) {
          actions += "<input type=\"button\" onClick=\"window.location='/modify?detnum=" + orders[i].detnum + "';\" " +
                    "data-type=\"inline\" value=\"Modifica\" />";
          emailbutid = "emaillist" + i;
          actions += "<input type=\"button\" id=\"" + emailbutid + "\" " +
                    "data-type=\"inline\" value=\"Email\" />";
        }
        tableRow.push(actions);
        listOrderDatatable.row.add(tableRow);
        needDraw = true;
      }
    }

    if (needDraw) {
      $('#listOrders').modal();
      listOrderDatatable.draw();
    }

    if (enable_admin_buttons) {
      for (var i=0; i<orders.length; i++) {
        if (orders[i].detnum > 0) {
          emailbutid = "emaillist" + i;
          var jsonord = JSON.stringify(orders[i]);
          $("#"+emailbutid).on("click", function (jsonord) {
            return function(ev) {
              comment_email_popup_json(jsonord);
            };
          }(jsonord));
        }
      }
    }

  }

  function get_order_list(all) {
    var url = "/list";
    if (all) url += "?all=1";

    $.get(url, populate_popup, "json");
  }

  var listOrderDatatable;

  function init_order_list() {

    if (!($('#listOrderTable').length)) {
      var el = $('#listOrders');
      listHtml = '<table id="listOrderTable" class="display nowrap" width="100%" cellspacing="0">\n';
      listHtml += '<thead><tr><th data-priority="1">Num</th><th data-priority="1">Data</th>\n';
      listHtml += '<th data-priority="6">CIG</th>\n';
      listHtml += '<th data-priority="5">Richiedente</th>\n';
      listHtml += '<th data-priority="6">Email Rich.</th>\n';
      listHtml += '<th data-priority="6">RUP</th>\n';
      listHtml += '<th data-priority="1">Sigla</th>\n';
      listHtml += '<th data-priority="6">Capitolo</th>\n';
      listHtml += '<th data-priority="1">Importo</th>\n';
      listHtml += '<th data-priority="6">Descrizione</th>\n';
      listHtml += '<th data-priority="6">Commenti</th>\n';
      listHtml += '<th data-priority="6">Indiv. Operatori</th>\n';
      listHtml += '<th data-priority="6">Crit. Aggiudicazione</th>\n';
      listHtml += '<th data-priority="6">Conferma Amminist.</th>\n';
      listHtml += '<th data-priority="6">URL doc</th>\n';
      listHtml += '<th data-priority="2">Autorizzazioni mancanti</th>\n';
      listHtml += '<th data-priority="3">Autorizzazioni ottenute</th>\n';
      listHtml += '<th data-priority="6">Ultimo aggiornamento</th>\n';
      listHtml += '<th data-priority="1">Azioni</th></tr></thead><tbody>\n';
      listHtml += '</tbody></table>\n';
      listHtml += '<input type="button" onClick="$.modal.close();"' +
                  'class="ui-btn ui-corner-all ui-shadow" ' +
                  'data-type="inline" ' +
                  'value="Chiudere" />';

      el.html(listHtml).trigger('create');
      $('#listOrderTable').DataTable({
        responsive: {
          details: {
            display: $.fn.dataTable.Responsive.display.modal( {
              header: function ( row ) {
                var data = row.data();
                return 'Dettagli per '+data[0]+' '+data[1];
              }
            } ),
            renderer: function ( api, rowIdx, columns ) {
              var data = $.map( columns, function ( col, i ) {
              return '<tr>'+ '<td>'+col.title+':'+'</td> '+
                     '<td>'+col.data+'</td>'+ '</tr>';
              } ).join('');
              var ret = $('<table/>').append( data );
              ret.append('<input type="button" onClick="$(\'.dtr-modal-close\').click()" value="Chiudere" />\n');
              return ret;
            }
          }
        }
      });
      listOrderDatatable = $('#listOrderTable').dataTable().api();
      listOrderDatatable.order( [ 0, 'asc' ] );
    } else {
      $('table#listOrderTable tbody tr').remove();
    }
  }

  function redraw_listorder() {
      listOrderDatatable.columns.adjust().responsive.recalc();
  }

  $(window).on('draw.dt', function(e) {
     if ((e.target.id == "listOrderTable") && listOrderDatatable) {
       listOrderDatatable.columns.adjust().responsive.recalc();
     }
  });

  function validate_fields() {
    var amstr = $('#reqamount').val();
    if (amstr.indexOf(',') > 0) {
      amstr = amstr.replace(',','.');
      $('#reqamount').val(amstr);
    }
    var reqamount = parseFloat($('#reqamount').val());
    var ret = true;
    $('#reqamountback').css('background-color', '#aaffaa');
    if (isNaN(reqamount) || (reqamount <= 0)) {
      $('#reqamountback').css('background-color', '#ffaaaa');
      ret = false;
    } 
    $('#capidback').css('background-color', '#aaffaa');
    if ($('#capid').val().length <= 0) {
      $('#capidback').css('background-color', '#ffaaaa');
      ret = false;
    }
    $('#expidback').css('background-color', '#aaffaa');
    if ($('#expid').val().length <= 0) {
      $('#expidback').css('background-color', '#ffaaaa');
      ret = false;
    }
    $('#reqnameback').css('background-color', '#aaffaa');
    if ($('#reqname').val().length <= 0) {
      $('#reqnameback').css('background-color', '#ffaaaa');
      ret = false;
    }
    $('#descobjback').css('background-color', '#aaffaa');
    if ($('#descobj').val().length <= 0) {
      $('#descobjback').css('background-color', '#ffaaaa');
      ret = false;
    }
    $('#commentback').css('background-color', '#aaffaa');
    if ($('#comment').val().length <= 0) {
      $('#commentback').css('background-color', '#ffaaaa');
      ret = false;
    }

    $('#docurlback').css('background-color', '#aaffaa');
    if ($('#docurl').val().length > 0) {
      var isUrl = /(ftp|http|https|root):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
      if (!(isUrl.test($('#docurl').val()))) {
        $('#docurlback').css('background-color', '#ffaaaa');
        ret = false;
      }
    }
    return ret;
  }
