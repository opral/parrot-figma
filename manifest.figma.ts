export default {
  name: 'Parrot - Language Translation with ease - the Translator, i18n, l8n, Plugin (Free Beta)',
  id: '1205803482754362456',
  api: '1.0.0',
  editorType: [
    'figma',
    'dev',
  ],
  capabilities: ['inspect'],
  networkAccess: {
    allowedDomains: ['https://inlang.com', 'https://opral.github.io'],
    devAllowedDomains: [
      'http://localhost:8080',
    ],
    reasoning: "Parrot's interface is hosted on GitHub Pages (opral.github.io) because it needs web workers and WebAssembly, which a plugin cannot load from inline HTML. inlang.com receives usage counts with hashed user and file ids (PostHog through the inlang.com/relay proxy; never message texts, keys or file names).",
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
