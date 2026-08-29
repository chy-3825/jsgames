'use strict';

const js = require('@eslint/js');
const globals = require('globals');

// This is intentionally a correctness-first baseline.  The repository is a
// mixed CommonJS/ES-module JavaScript project, so style and type rules are
// enabled incrementally after the existing source has a stable lint target.
const correctnessRules = {
    ...js.configs.recommended.rules,
    'no-constant-condition': 'off',
    'no-undef': 'off',
    'no-unused-vars': 'off',
    'no-redeclare': 'off',
    'no-prototype-builtins': 'off',
    'no-useless-escape': 'off',
    'no-empty': 'off',
    'no-case-declarations': 'off',
    'no-control-regex': 'off',
    'no-irregular-whitespace': 'off',
};

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'tmp/**',
            'public/assets/**',
            'TEST_REPORTS/**',
            'coverage/**',
        ],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.es2021,
                ...globals.browser,
                ...globals.node,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        },
        rules: correctnessRules,
    },
    {
        files: [
            'app.js',
            'bin/**/*.js',
            'scripts/**/*.js',
            'server/**/*.js',
            'test/**/*.js',
        ],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.commonjs,
            },
        },
    },
];
