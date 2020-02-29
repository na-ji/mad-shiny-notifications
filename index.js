const axios = require('axios');
const { createLogger, format, transports } = require('winston');
const mysql = require('mysql2/promise');
const pokedex = require('pokemon');
const moment = require('moment');

const {
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlDatabase,
  mysqlPassword,
  locale,
  discordWebhook,
  telegramToken,
  telegramChatId,
  disableLogPersist,
  interval
} = require('./config');

const timeout = (+interval ? +interval : 60) * 1000;
const sentNotifications = {};
let connection;

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    })
  ]
});

if (!mysqlHost || !mysqlUser || !mysqlDatabase) {
  console.error('Please fill database informations');
  process.exit(1);
}

if (!pokedex.languages.has(locale)) {
  console.error('Unsupported locale');
  console.log(`Supported locales are: ${Array.from(pokedex.languages)}`);
  process.exit(1);
}

if (!disableLogPersist) {
  logger.add(new transports.File({ filename: 'error.log', level: 'error' }));
  logger.add(new transports.File({ filename: 'combined.log' }));
}

const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

const sendTelegramMessage = message => {
  return axios.get(
    `https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&parse_mode=markdown&text=${encodeURIComponent(
      message.replace(/\*\*/g, '*')
    )}`
  );
};

const run = async () => {
  try {
    const now = Math.floor(new Date().getTime() / 1000);
    if (!connection) {
      connection = await mysql.createConnection({
        host: mysqlHost,
        port: mysqlPort,
        user: mysqlUser,
        database: mysqlDatabase,
        password: mysqlPassword,
        timezone: 'Z'
      });
    }

    const [rows] = await connection.execute(`SELECT encounter_id,
             pokemon_id,
             form,
             individual_attack,
             individual_defense,
             individual_stamina,
             disappear_time,
             cp,
             cp_multiplier,
             move_1,
             move_2,
             gender,
             longitude,
             latitude,
             t.worker,
             t.timestamp_scan
      FROM pokemon
               LEFT JOIN trs_stats_detect_raw t ON encounter_id = CAST(t.type_id AS UNSIGNED INTEGER)
      WHERE disappear_time > utc_timestamp()
        AND individual_attack IS NOT NULL
        AND t.type = 'mon_iv'
        AND t.is_shiny = 1
      ORDER BY pokemon_id DESC, disappear_time DESC
    `);

    logger.info('Result:', { rows });

    if (rows.length === 0) {
      return;
    }

    let firstShiny;

    // message generation
    const output = rows.reduce((output, shiny) => {
      const cacheKey = `e${shiny.encounter_id}-m${shiny.pokemon_id}-f${shiny.form}`;

      shiny.name = pokedex.getName(shiny.pokemon_id, locale);
      shiny.img = `pokemon_icon_${`${shiny.pokemon_id}`.padStart(3, '0')}_00.png`;

      if (!(cacheKey in sentNotifications)) {
        if (!firstShiny) {
          firstShiny = shiny;
        }

        sentNotifications[cacheKey] = shiny.timestamp_scan;
        const disappearTime = moment(shiny.disappear_time);
        const timeLeft = moment.utc(disappearTime.diff(moment()));

        output += `- **${shiny.name}**  dsp **${disappearTime.format('HH:mm:ss')}** (**${timeLeft.format(
          'mm:ss'
        )}**) by **${shiny.worker}** at **${shiny.latitude.toFixed(5)},${shiny.longitude.toFixed(5)}**\n`;
      }

      return output;
    }, '');

    // clean up
    Object.keys(sentNotifications).forEach(cacheKey => {
      if (now > sentNotifications[cacheKey] + 3600) {
        delete sentNotifications[cacheKey];
      }
    });

    logger.info('Message to send', { output });

    if (output === '') {
      return;
    }

    if (discordWebhook && discordWebhook !== '') {
      await axios.post(discordWebhook, {
        username: firstShiny.name,
        avatar_url: `https://raw.githubusercontent.com/Plaryu/PJSsprites/master/${firstShiny.img}`,
        content: output
      });
    }

    if (telegramToken && telegramToken !== '' && telegramChatId && telegramChatId !== '') {
      try {
        await sendTelegramMessage(output);
      } catch (error) {
        logger.warn('Telegram failed, trying again...');
        await sleep(1000);
        await sendTelegramMessage(output);
      }
    }
  } catch (error) {
    logger.error('Something went wrong, check error: ', error);
  }
};

run();
setInterval(run, timeout);
