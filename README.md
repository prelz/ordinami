# ordinami
Transitional node.js servlet to handle the documental process for 'determine a contrarre'.

- Modificare questi file: 

generate_people_tree:

CHANGEME_SEZIONE_SHORT=mi  
CHANGEME_UUID= (mettere il proprio infnUUID prendendolo da godiva)  
CHANGEME_SEZIONE=Milano  


config/database.js:

CHANGEME_DBHOST=mysqldb.mi.infn.it  
CHANGEME_DBUSER=ordini_user  
CHANGEME_DBPW=dbpassword  
CHANGEME_DBNAME=ordini  


config/general.js:

CHANGEME_SEZIONE=Milano  
CHANGEME_HOST=ordini.mi.infn.it  
CHANGEME_OUTGOINGMAILSERVER=mbox.mi.infn.it  
CHANGEME_ADMINMAIL=ordini@mi.infn.it  
CHANGEME_PASSPORT=ordini_mi_infn_it_passport_saml  


server.js:

CHANGEME_HOST=ordini.mi.infn.it  
CHANGEME_SEZIONE=Milano  


======================================================

- Installare nodejs sulla macchina  
- Mettere nella dir config/ la chiave pubblica e privata della macchina
  chiamandole:  
  server_private_key.pem  
  server_certificate.pem  
 
- eseguire ./generate_people_tree (chiedera' la propria pw di AAI)

shell> mysqladmin -p create CHANGEME_DBNAME  
shell>mysql -p CHANGEME_DBNAME  
mysql>grant all on CHANGEME_DBNAME.* to 'CHANGEME_DBUSER'@CHANGEME_HOST identified by 'CHANGEME_DBPW';  
mysql>\q  
shell> mysql -p CHANGEME_DBNAME < ordini_table_create  

- per lanciare il programma:  
  chmod u+x server.js   
  ./server.js  

