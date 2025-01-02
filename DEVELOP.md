#### Install Node and NPM

[Install Nodejs on Ubuntu](https://github.com/nodesource/distributions)

```sh
curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt-get install -y nodejs
node -v
```


#### Build

```sh
# Web (Production)
npm run build:web
# Web (Development)
npm run build:web:dev
```

#### Test

```sh
npm run test
```