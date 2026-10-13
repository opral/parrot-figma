export default {
  name: 'Parrot - Language Translation with ease - the Translator, i18n, l8n, Plugin (Free Beta)',
  id: '1205803482754362456',
  api: '1.0.0',
  documentAccess: 'dynamic-page',
  editorType: [
    'figma',
    'dev',
  ],
  capabilities: ['inspect'],
  networkAccess: {
    allowedDomains: ['https://inlang.com', 'https://parrot-global.github.io', 'https://api.parrot.global', 'https://s3-alpha.figma.com'],
    devAllowedDomains: [
      'http://localhost:8080',
    ],
    reasoning: 'Parrot connects to various sources in order to translate designs, provide analytics, enforce updates, and access the Parrot API.',
  },
  ui: 'dist/ui.html',
  main: 'dist/code.js',
  permissions: ['currentuser'],
  relaunchButtons: [
    { command: 'open', name: 'Localize' },
    { command: 'open-design-focus', name: 'Translation key', multipleSelection: false },
    { command: 'open-design', name: 'Language', multipleSelection: true },
  ],
};
