# ordinami

### Modificare questi file: 

**generate_people_tree:**

 CHANGEME_SEZIONE_SHORT=mi  
 CHANGEME_UUID= (mettere il proprio infnUUID prendendolo da godiva)  
 CHANGEME_SEZIONE=Milano  

**config/database.js:**

 CHANGEME_DBHOST=mysqldb.mi.infn.it  
 CHANGEME_DBUSER=ordini_user  
 CHANGEME_DBPW=dbpassword  
 CHANGEME_DBNAME=ordini

**config/general.js:**

 CHANGEME_SEZIONE=Milano  
 CHANGEME_HOST=ordini.mi.infn.it  
 CHANGEME_OUTGOINGMAILSERVER=mbox.mi.infn.it  
 CHANGEME_ADMINMAIL=ordini@mi.infn.it  
 CHANGEME_PASSPORT=ordini_mi_infn_it_passport_saml

**server.js:**

 CHANGEME_HOST=ordini.mi.infn.it  
 CHANGEME_SEZIONE=Milano

### Installazione

- Installare nodejs sulla macchina  
- Mettere nella dir config/ la chiave pubblica e privata della macchina chiamandole:
  
  server_private_key.pem e server_certificate.pem 
 
- eseguire ./generate_people_tree (chiedera' la propria pw di AAI)

shell> mysqladmin -p create CHANGEME_DBNAME  
shell>mysql -p CHANGEME_DBNAME  
mysql>grant all on CHANGEME_DBNAME.* to 'CHANGEME_DBUSER'@CHANGEME_HOST identified by 'CHANGEME_DBPW';  
mysql>\q  
shell> mysql -p CHANGEME_DBNAME < ordini_table_create 

- per lanciare il programma:
 
chmod u+x server.js  
./server.js  

### - Per richiedere l'abilitazione del servizio al collegamento ad AAI:
 * verificare a questa pagina che risponda con un XML con i dati corretti:  
 http://CHANGEME_HOST/get_sp_metadata

* andare alla pagina:  
https://idp.infn.it/utils/metadata-send.php

e inserire i dati richiesti:
 - IdP => "produzione"
 - "Set di attributi" => "esteso"
 - "Metadata URL" => http://CHANGEME_HOST/get_sp_metadata

### Schema di flusso del programma

1. Qualcuno inserisce una determina. Questo genera mail a RUP e RESP(s), che devono approvare.
2. RUP e RESP(s), indipendentemente dall'ordine temporale, approvano. Questo genera mail per il direttore, che deve approvare.
3. Il direttore approva. Questo genera mail per l'Admin, che deve approvare (solo per notificare al RUP che e' stato approvato, e di mettere il CIG).
4. L'admin approva. Questo genera mail per il RUP che deve mettere il CIG.
5. Il RUP mette il CIG. Questo non genera niente.


