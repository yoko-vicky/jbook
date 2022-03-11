import * as esbuild from 'esbuild-wasm';
import axios from 'axios';
import localForage from 'localforage';

const fileCache = localForage.createInstance({
  name: 'filecache',
});

// (async () => {
//   await fileCache.setItem('color', 'red');
//   const color = await fileCache.getItem('color');
//   console.log(color);
// })();

export const unpkgPathPlugin = (inputCode: string) => {
  return {
    name: 'unpkg-path-plugin',
    setup(build: esbuild.PluginBuild) {
      // handle root entry file of 'index.js'
      build.onResolve({ filter: /^index\.js$/ }, () => {
        return { path: 'index.js', namespace: 'a' };
      });

      // hanlde relative path in a module
      build.onResolve({ filter: /^\.+\// }, (args: any) => {
        return {
          namespace: 'a',
          path: new URL(args.path, 'https://unpkg.com' + args.resolveDir + '/')
            .href,
        };
      });

      // handle main file of a module
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        return {
          namespace: 'a',
          path: `https://unpkg.com/${args.path}`,
        };
      });

      build.onLoad({ filter: /.*/ }, async (args: any) => {
        console.log('onLoad', args);

        if (args.path === 'index.js') {
          return {
            loader: 'jsx',
            contents: inputCode,
          };
        }

        // check to see if we have already fetched this file
        // and if it is in the chache,
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(
          args.path,
        );
        // if it is, return it immediately
        if (cachedResult) {
          return cachedResult;
        }
        // if it is not, make a request and
        const { data, request } = await axios.get(args.path);

        const result: esbuild.OnLoadResult = {
          loader: 'jsx',
          contents: data,
          resolveDir: new URL('./', request.responseURL).pathname,
        };

        //store response in chache
        await fileCache.setItem(args.path, result);

        return result;
      });
    },
  };
};
