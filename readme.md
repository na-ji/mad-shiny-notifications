# MAD Shiny encounters notifications

## Installation
```
npm install
```

## Configuration
Copy the file `config.json.dist` to `config.json` and fill it.

## Usage
Add a crontab executing every minute
```shell script
* * * * * /path/to/node /path/to/script/index.js >/dev/null 2>&1
```
