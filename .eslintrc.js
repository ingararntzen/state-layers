export default{
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: 'airbnb-base',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': ['error', { 'ignoreRestSiblings': true }]
  }
};