/** Labels of VeitAccountSettings. */
export type VeitAccountTexts = {
  profileTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  emailChangeHint: string;
  saveProfile: string;
  profileSaved: string;
  unverified: string;
  resendVerification: string;
  verificationSent: string;
  passwordTitle: string;
  currentPassword: string;
  newPassword: string;
  savePassword: string;
  passwordSaved: string;
  showPassword: string;
  hidePassword: string;
  mfaTitle: string;
  mfaDescription: string;
  mfaActive: string;
  mfaMethodTotp: string;
  mfaMethodEmail: string;
  mfaStartTotp: string;
  mfaStartEmail: string;
  mfaScanHint: string;
  mfaSecret: string;
  mfaCode: string;
  mfaEmailHint: string;
  mfaConfirm: string;
  mfaCancel: string;
  mfaDisablePassword: string;
  mfaDisable: string;
  sessionsTitle: string;
  sessionsEmpty: string;
  sessionRevoke: string;
  sessionCurrent: string;
  loading: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteButton: string;
  deleteConfirm: string;
};

export const veitAccountTexts: Record<'de' | 'en', VeitAccountTexts> = {
  de: {
    profileTitle: 'Profil',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    emailChangeHint: 'Eine neue Adresse musst du per Link bestätigen.',
    saveProfile: 'Profil speichern',
    profileSaved: 'Gespeichert.',
    unverified: 'Deine E-Mail-Adresse ist noch nicht bestätigt.',
    resendVerification: 'Link erneut senden',
    verificationSent: 'Bestätigungslink gesendet.',
    passwordTitle: 'Passwort',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    savePassword: 'Passwort ändern',
    passwordSaved: 'Passwort geändert. Andere Sitzungen wurden abgemeldet.',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    mfaTitle: 'Zwei-Faktor-Anmeldung',
    mfaDescription: 'Bei der Anmeldung zusätzlich einen Code aus einer Authenticator-App oder per E-Mail abfragen.',
    mfaActive: 'Eingeschaltet:',
    mfaMethodTotp: 'Authenticator-App',
    mfaMethodEmail: 'Code per E-Mail',
    mfaStartTotp: 'Authenticator-App einrichten',
    mfaStartEmail: 'Code per E-Mail einrichten',
    mfaScanHint: 'Scanne den QR-Code mit deiner Authenticator-App und gib den angezeigten Code ein.',
    mfaSecret: 'Schlüssel zum Abtippen',
    mfaCode: 'Code',
    mfaEmailHint: 'Wir haben dir einen Code per E-Mail geschickt.',
    mfaConfirm: 'Einschalten',
    mfaCancel: 'Abbrechen',
    mfaDisablePassword: 'Passwort zum Ausschalten',
    mfaDisable: 'Ausschalten',
    sessionsTitle: 'Angemeldete Geräte',
    sessionsEmpty: 'Keine Sitzungen.',
    sessionRevoke: 'Abmelden',
    sessionCurrent: 'dieses Gerät',
    loading: 'Lädt …',
    deleteTitle: 'Konto löschen',
    deleteDescription: 'Löscht dein Konto mit allen zugehörigen Daten. Das lässt sich nicht rückgängig machen.',
    deleteButton: 'Konto löschen',
    deleteConfirm: 'Konto mit allen Daten endgültig löschen?',
  },
  en: {
    profileTitle: 'Profile',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'E-mail',
    emailChangeHint: 'A new address must be confirmed by link.',
    saveProfile: 'Save profile',
    profileSaved: 'Saved.',
    unverified: 'Your e-mail address is not confirmed yet.',
    resendVerification: 'Send link again',
    verificationSent: 'Confirmation link sent.',
    passwordTitle: 'Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    savePassword: 'Change password',
    passwordSaved: 'Password changed. Other sessions were signed out.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    mfaTitle: 'Two-factor sign-in',
    mfaDescription: 'Ask for a code from an authenticator app or by e-mail when signing in.',
    mfaActive: 'On:',
    mfaMethodTotp: 'Authenticator app',
    mfaMethodEmail: 'Code by e-mail',
    mfaStartTotp: 'Set up authenticator app',
    mfaStartEmail: 'Set up code by e-mail',
    mfaScanHint: 'Scan the QR code with your authenticator app and enter the code it shows.',
    mfaSecret: 'Key to type in',
    mfaCode: 'Code',
    mfaEmailHint: 'We sent you a code by e-mail.',
    mfaConfirm: 'Turn on',
    mfaCancel: 'Cancel',
    mfaDisablePassword: 'Password to turn it off',
    mfaDisable: 'Turn off',
    sessionsTitle: 'Signed-in devices',
    sessionsEmpty: 'No sessions.',
    sessionRevoke: 'Sign out',
    sessionCurrent: 'this device',
    loading: 'Loading …',
    deleteTitle: 'Delete account',
    deleteDescription: 'Deletes your account with all its data. This cannot be undone.',
    deleteButton: 'Delete account',
    deleteConfirm: 'Delete the account with all its data for good?',
  },
};
