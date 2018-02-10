import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'app.js',
  output: {
    file: 'bundle.js',
    format: 'iife'
  },
  name: 'MyModule',
  plugins: [
    resolve({
      browser: true
    }),
    commonjs()
  ],
  external: ['electron'],
  globals: function (id) { return 'require("' + id + '")'; } // HACK!
};