// rollup.config.js

// minifying code
import {terser} from '@rollup-plugin-terser';

// needed if src includes non-ES6 modules
/*
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
*/

const isProduction = process.env.NODE_ENV === 'production';
const isWeb = process.env.BUILD_ENV === 'web';

// target directory for build
const target = "dist";
// name of bundle
const bundle = "layers";
// file extension
const ext = isProduction ? "min.js" : "js"; 

export default {
  input: 'src/index.js',
  output: [
    {
      file: `${target}/${bundle}.iife.${ext}`,
      format: 'iife',
      sourcemap: "inline",
      name: `${bundle.toLocaleLowerCase()}`,
      plugins: [isProduction && terser()],
    },
    {
      file: `${target}/${bundle}.es.${ext}`,
      format: 'es',
      plugins: [isProduction && terser()],
    },
  ],
  external: [],
  plugins: [
    // resolve(),
    // commonjs(),
  ],
}


