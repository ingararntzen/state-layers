#### Install Node and NPM

[Install Nodejs on Ubuntu](https://github.com/nodesource/distributions)

```sh
curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt-get install -y nodejs
node -v
```

#### Build Web

Start dev server.

On start, the server will build web bundles in *html/js* and open a browser at index.html. Afterwards, it will watch for source code changes, re-build web bundles and trigger browser reloads. Start server in a separate terminal.

```sh
npm run start
```

Alternatively, it is possible to trigger a manual build. Builds with a
dist option will be minified.

```sh
# Web (Development)
npm run build
# Web (Distribution)
npm run build:dist
```

#### Test

```sh
npm run test
```