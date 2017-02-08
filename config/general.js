module.exports = {
  production: {
    app: {
      name: 'Gestione preliminare ordini sezione di Milano',
      port: process.env.PORT || 80,
      sslPort: process.env.SSLPORT || 443,
      host: 'ordini.mi.infn.it',
      authtree: 'config/sigle_rup_admin.json',
      smtpServer: 'mbox.mi.infn.it',
      timezone: 'Europe/Rome',
      adminEmail: 'ordini@mi.infn.it',
      authorizeOnChanges: false,
      privateKey: 'config/server_private_key.pem',
      certificate: 'config/server_certificate.pem',
      caCert: 'config/DigiCertCA.crt'
    },
    passport: {
      strategy: 'saml',
      saml: {
        issuer: 'ordini_mi_infn_it_passport_saml',
        host: 'ordini.mi.infn.it',
        protocol: 'https://',
        path: '/login/callback',
	identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        entryPoint: process.env.SAML_ENTRY_POINT || 'https://idp.infn.it/saml2/idp/SSOService.php',
        logoutUrl: process.env.SAML_LOGOUT_URL || 'https://idp.infn.it/saml2/idp/SingleLogoutService.php',
        cert: process.env.SAML_CERT || ''
      }
    }
  }
};
