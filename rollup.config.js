// rollup.config.js

// minifying code
import terser from '@rollup/plugin-terser';

// needed if src includes non-ES6 modules
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const isProduction = process.env.BUILD_ENV === 'production';

// target directory for build
const target = "html/js";
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
      name: `${bundle.toLocaleUpperCase()}`,
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
    resolve(),
    commonjs(),
  ],
}


