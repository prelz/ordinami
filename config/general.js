module.exports = {
  production: {
    app: {
      sezione: 'CHANGEME_SEZIONE',
      port: process.env.PORT || 80,
      sslPort: process.env.SSLPORT || 443,
      host: 'CHANGEME_HOST',
      authtree: 'config/sigle_rup_admin.json',
      smtpServer: 'CHANGEME_OUTGOINGMAILSERVER',
      timezone: 'Europe/Rome',
      adminEmail: 'CHANGEME_ADMINMAIL',
      authorizeOnChanges: false,
      privateKey: 'config/server_private_key.pem',
      certificate: 'config/server_certificate.pem',
      caCert: 'config/DigiCertCA.crt'
    },
    passport: {
      strategy: 'saml',
      saml: {
        issuer: 'CHANGEME_PASSPORT',
        host: 'CHANGEME_HOST',
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
